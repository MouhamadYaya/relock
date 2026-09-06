import Foundation
import XCTest

final class ShieldAttemptStoreTests: XCTestCase {
  private var suiteName = ""
  private var defaults: UserDefaults!
  private var lockURL: URL!
  private var stateURL: URL!
  private var calendar: Calendar!

  override func setUpWithError() throws {
    suiteName = "relock.shield.tests.\(UUID().uuidString)"
    defaults = try XCTUnwrap(UserDefaults(suiteName: suiteName))
    defaults.removePersistentDomain(forName: suiteName)
    lockURL = FileManager.default.temporaryDirectory
      .appendingPathComponent("relock-shield-\(UUID().uuidString).lock")
    stateURL = lockURL.appendingPathExtension("state.json")
    calendar = Calendar(identifier: .gregorian)
    calendar.timeZone = try XCTUnwrap(TimeZone(secondsFromGMT: 0))
  }

  override func tearDownWithError() throws {
    defaults.removePersistentDomain(forName: suiteName)
    try? FileManager.default.removeItem(at: lockURL)
    try? FileManager.default.removeItem(at: stateURL)
    defaults = nil
    lockURL = nil
    stateURL = nil
    calendar = nil
  }

  private func makeStore(dedupeInterval: TimeInterval = 3) -> ShieldAttemptStore {
    ShieldAttemptStore(
      defaults: defaults,
      lockURL: lockURL,
      stateURL: stateURL,
      calendar: calendar,
      dedupeInterval: dedupeInterval)
  }

  private let morning = Date(timeIntervalSince1970: 1_788_170_400)

  // ── Ouverture de Relock depuis le mur ───────────────────────────────
  //
  // Régression vécue : « Ouvrir Relock » refermait le mur et laissait
  // l'utilisateur sur l'écran d'accueil. La demande exigeait qu'une
  // « présentation » ait été écrite par l'AUTRE extension (celle qui dessine
  // le mur) ; quand cette écriture n'arrivait pas, l'action refusait alors
  // qu'elle tenait pourtant le jeton exact.

  func testOpenRequestUsesTheTokenGivenByTheAction() {
    let store = makeStore()
    // Aucune présentation enregistrée : le jeton seul doit suffire.
    let request = store.enqueueOpenRequest(applicationKey: "discord", now: morning)
    XCTAssertEqual(request?.applicationKey, "discord")
  }

  func testOpenRequestKeepsTheRealNameWhenKnown() {
    let store = makeStore()
    _ = store.recordAttempt(
      applicationKey: "discord", applicationName: "Discord", now: morning)
    let request = store.enqueueOpenRequest(
      applicationKey: "discord", now: morning.addingTimeInterval(5))
    XCTAssertEqual(request?.applicationName, "Discord")
  }

  func testCategoryShieldFallsBackToTheLatestPresentation() {
    let store = makeStore()
    _ = store.recordAttempt(
      applicationKey: "discord", applicationName: "Discord", now: morning)
    // iOS ne donne aucun jeton pour le mur d'une catégorie entière.
    let request = store.enqueueOpenRequest(
      applicationKey: nil, now: morning.addingTimeInterval(10))
    XCTAssertEqual(request?.applicationKey, "discord")
  }

  func testCategoryShieldUsesThePresentationForThatCategory() {
    let store = makeStore()
    _ = store.recordAttempt(
      applicationKey: "discord",
      applicationName: "Discord",
      categoryKey: "social",
      now: morning)
    _ = store.recordAttempt(
      applicationKey: "mail",
      applicationName: "Mail",
      categoryKey: "productivity",
      now: morning.addingTimeInterval(4))

    let request = store.enqueueOpenRequest(
      applicationKey: nil,
      categoryKey: "social",
      now: morning.addingTimeInterval(5))

    XCTAssertEqual(request?.applicationKey, "discord")
    XCTAssertEqual(request?.applicationName, "Discord")
  }

  func testCategoryShieldStillQueuesNavigationWithStaleContext() {
    let store = makeStore()
    _ = store.recordAttempt(
      applicationKey: "discord", applicationName: "Discord", now: morning)
    let request = store.enqueueOpenRequest(
      applicationKey: nil, now: morning.addingTimeInterval(3600))
    XCTAssertNotNil(request)
    XCTAssertNil(request?.applicationKey)
    XCTAssertNil(request?.applicationName)
  }

  func testOpenRequestQueuesWithoutAnyApplicationContext() {
    let request = makeStore().enqueueOpenRequest(
      applicationKey: nil, categoryKey: "social", now: morning)
    XCTAssertNotNil(request)
    XCTAssertNil(request?.applicationKey)
  }

  func testOpenRequestIsConsumedOnlyOnce() {
    let store = makeStore()
    _ = store.enqueueOpenRequest(applicationKey: "discord", now: morning)
    XCTAssertNotNil(store.consumeOpenRequest(now: morning.addingTimeInterval(1)))
    XCTAssertNil(store.consumeOpenRequest(now: morning.addingTimeInterval(2)))
  }

  func testFirstAttemptStartsAtOne() {
    let result = makeStore().recordAttempt(
      applicationKey: "facebook", applicationName: "Facebook", now: morning)
    XCTAssertEqual(result.count, 1)
    XCTAssertEqual(result.applicationName, "Facebook")
  }

  func testMultipleAttemptsForSameAppIncrement() {
    let store = makeStore()
    _ = store.recordAttempt(
      applicationKey: "facebook", applicationName: "Facebook", now: morning)
    let result = store.recordAttempt(
      applicationKey: "facebook",
      applicationName: "Facebook",
      now: morning.addingTimeInterval(4))
    XCTAssertEqual(result.count, 2)
  }

  func testDifferentAppsHaveIndependentCounts() {
    let store = makeStore()
    _ = store.recordAttempt(
      applicationKey: "facebook", applicationName: "Facebook", now: morning)
    let instagram = store.recordAttempt(
      applicationKey: "instagram", applicationName: "Instagram", now: morning)
    let facebook = store.recordAttempt(
      applicationKey: "facebook",
      applicationName: "Facebook",
      now: morning.addingTimeInterval(4))
    XCTAssertEqual(instagram.count, 1)
    XCTAssertEqual(facebook.count, 2)
  }

  func testNextLocalDayResetsCount() {
    let store = makeStore()
    _ = store.recordAttempt(
      applicationKey: "facebook", applicationName: "Facebook", now: morning)
    let tomorrow = store.recordAttempt(
      applicationKey: "facebook",
      applicationName: "Facebook",
      now: morning.addingTimeInterval(24 * 60 * 60))
    XCTAssertEqual(tomorrow.count, 1)
  }

  func testStatePersistsAcrossStoreInstances() {
    _ = makeStore().recordAttempt(
      applicationKey: "facebook", applicationName: "Facebook", now: morning)
    let result = makeStore().recordAttempt(
      applicationKey: "facebook",
      applicationName: "Facebook",
      now: morning.addingTimeInterval(4))
    XCTAssertEqual(result.count, 2)
  }

  func testStateFileIsSharedEvenWhenDefaultsSuitesDiffer() throws {
    _ = makeStore().recordAttempt(
      applicationKey: "facebook", applicationName: "Facebook", now: morning)

    let otherSuite = "relock.shield.tests.\(UUID().uuidString)"
    let otherDefaults = try XCTUnwrap(UserDefaults(suiteName: otherSuite))
    defer { otherDefaults.removePersistentDomain(forName: otherSuite) }
    let reader = ShieldAttemptStore(
      defaults: otherDefaults,
      lockURL: lockURL,
      stateURL: stateURL,
      calendar: calendar)

    XCTAssertEqual(reader.lastPresentation()?.applicationName, "Facebook")
    XCTAssertEqual(reader.diagnostics().shownTotal, 1)
  }

  func testRepeatedConfigurationInsideDedupeWindowDoesNotIncrement() {
    let store = makeStore()
    _ = store.recordAttempt(
      applicationKey: "facebook", applicationName: "Facebook", now: morning)
    let duplicate = store.recordAttempt(
      applicationKey: "facebook",
      applicationName: "Facebook",
      now: morning.addingTimeInterval(1))
    XCTAssertEqual(duplicate.count, 1)
    XCTAssertEqual(store.diagnostics().shownTotal, 1)
  }

  func testPendingRequestIsConsumedOnlyOnceAndExpires() {
    let store = makeStore()
    _ = store.recordAttempt(
      applicationKey: "facebook", applicationName: "Facebook", now: morning)
    XCTAssertNotNil(store.enqueueOpenRequest(applicationKey: "facebook", now: morning))
    XCTAssertNotNil(store.consumeOpenRequest(now: morning.addingTimeInterval(1)))
    XCTAssertNil(store.consumeOpenRequest(now: morning.addingTimeInterval(2)))

    _ = store.recordAttempt(
      applicationKey: "facebook",
      applicationName: "Facebook",
      now: morning.addingTimeInterval(10))
    XCTAssertNotNil(
      store.enqueueOpenRequest(
        applicationKey: "facebook", now: morning.addingTimeInterval(10)))
    XCTAssertNil(
      store.consumeOpenRequest(
        now: morning.addingTimeInterval(400), maximumAge: 300))
  }

  func testPendingRequestCanBeInspectedWithoutConsumingIt() {
    let store = makeStore()
    _ = store.recordAttempt(
      applicationKey: "facebook", applicationName: "Facebook", now: morning)
    let queued = store.enqueueOpenRequest(applicationKey: "facebook", now: morning)

    XCTAssertEqual(store.peekOpenRequest(now: morning.addingTimeInterval(1)), queued)
    XCTAssertEqual(store.consumeOpenRequest(now: morning.addingTimeInterval(2)), queued)
    XCTAssertNil(store.peekOpenRequest(now: morning.addingTimeInterval(3)))
  }

  func testActionDiagnosticsAndEventsUseTheSharedStateFile() {
    let store = makeStore()
    _ = store.recordAttempt(
      applicationKey: "facebook", applicationName: "Facebook", now: morning)
    let total = store.recordAction(
      requestStatus: "ignored",
      response: "close",
      resisted: true,
      now: morning.addingTimeInterval(5))

    XCTAssertEqual(total, 1)
    XCTAssertEqual(store.diagnostics().lastOpenRequestStatus, "ignored")
    XCTAssertEqual(store.diagnostics().lastActionResponse, "close")
    XCTAssertEqual(
      store.eventRecords().map(\.kind),
      ["shield_shown", "resisted"])

    store.acknowledgeEvents(1)
    XCTAssertEqual(store.eventRecords().map(\.kind), ["resisted"])
  }

  func testFreshResetPreservesOnlyANonExpiredPendingRequest() {
    let store = makeStore()
    _ = store.recordAttempt(
      applicationKey: "facebook", applicationName: "Facebook", now: morning)
    let request = store.enqueueOpenRequest(applicationKey: "facebook", now: morning)

    store.resetKeepingFreshPendingRequest(now: morning.addingTimeInterval(5))

    XCTAssertEqual(store.peekOpenRequest(now: morning.addingTimeInterval(6)), request)
    XCTAssertNil(store.lastPresentation())
    XCTAssertEqual(store.diagnostics().shownTotal, 0)
  }
}
