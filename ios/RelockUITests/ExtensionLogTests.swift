import Foundation
import XCTest

/// Le journal partagé des extensions déborde par conception : il est borné, et
/// les extensions écrivent sans savoir quand l'app viendra le vider. Ce qui se
/// teste ici n'est donc pas « rien n'est perdu » — c'est « ce qui est perdu est
/// compté honnêtement », le seul signal qui distingue une extension saine d'une
/// extension en boucle d'erreur.
final class ExtensionLogTests: XCTestCase {
  private func entry(_ index: Int) -> [String: Any] {
    [
      "ts": Double(index),
      "source": "shield",
      "kind": "info",
      "message": "entry-\(index)",
      "data": [String: String](),
    ]
  }

  private func makeEntries(_ count: Int) -> [[String: Any]] {
    (0..<count).map(entry)
  }

  private func droppedBefore(_ entries: [[String: Any]]) -> Int {
    entries.first?["droppedBefore"] as? Int ?? 0
  }

  // ── La borne ────────────────────────────────────────────────────────

  func testKeepsTheNewestEntriesUpToTheBound() {
    let trimmed = ExtensionLog.trimmed(makeEntries(ExtensionLog.maxEntries + 5))

    XCTAssertEqual(trimmed.count, ExtensionLog.maxEntries)
    // La QUEUE est conservée : la dernière entrée écrite doit survivre.
    XCTAssertEqual(
      trimmed.last?["message"] as? String,
      "entry-\(ExtensionLog.maxEntries + 4)")
  }

  func testLeavesAnUnderfilledLogUntouched() {
    let trimmed = ExtensionLog.trimmed(makeEntries(ExtensionLog.maxEntries))

    XCTAssertEqual(trimmed.count, ExtensionLog.maxEntries)
    XCTAssertEqual(droppedBefore(trimmed), 0, "rien n'a été jeté")
  }

  // ── Le compteur cumulatif ───────────────────────────────────────────
  //
  // Régression visée : chaque débordement emporte l'entrée qui PORTE le
  // marqueur. En le réécrivant à partir de zéro, le journal rapportait « 1
  // entrée perdue » après en avoir perdu des centaines — un chiffre qui
  // affirme que tout va bien.

  func testDroppedCountSurvivesASecondOverflow() {
    let first = ExtensionLog.trimmed(makeEntries(ExtensionLog.maxEntries + 3))
    XCTAssertEqual(droppedBefore(first), 3)

    // Deuxième débordement : 4 entrées de plus par-dessus un journal déjà plein.
    let second = ExtensionLog.trimmed(first + makeEntries(4))

    XCTAssertEqual(second.count, ExtensionLog.maxEntries)
    XCTAssertEqual(droppedBefore(second), 7, "3 déjà perdues + 4 à l'instant")
  }

  func testDroppedCountKeepsGrowingAcrossManyOverflows() {
    var entries = makeEntries(ExtensionLog.maxEntries)
    var previous = 0

    // Dix débordements successifs, comme une extension en boucle d'erreur
    // entre deux lancements de l'app.
    for round in 1...10 {
      entries = ExtensionLog.trimmed(entries + makeEntries(2))
      let reported = droppedBefore(entries)

      XCTAssertEqual(entries.count, ExtensionLog.maxEntries)
      XCTAssertGreaterThan(
        reported, previous, "le compteur doit croître au tour \(round)")
      XCTAssertEqual(reported, round * 2)
      previous = reported
    }
  }
}
