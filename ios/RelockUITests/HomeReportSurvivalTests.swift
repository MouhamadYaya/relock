import XCTest
import UIKit

/// Le bloc « Temps d'écran » de l'Accueil survit-il aux allers-retours ?
///
/// Ce bloc — le héro et le classement des apps — est dessiné par l'extension
/// `RelockActivityReport`, DANS UN AUTRE PROCESSUS. Deux conséquences dictent
/// la forme de ce test :
///
/// 1. **Rien de ce que l'extension dessine n'entre dans l'arbre
///    d'accessibilité de l'app hôte.** Seules les vues locales y figurent
///    (le plan tactile `home.hero` / `home.apps`), et elles existent encore,
///    intactes, quand la surface distante est morte. Un test qui interroge la
///    hiérarchie voit donc un écran parfaitement sain pendant que
///    l'utilisateur regarde un trou noir. C'est exactement pour cela que le
///    bug a survécu à `testHomeScrollAndTabReturnOnPhysicalDevice`, qui ne
///    mesure que la carte de score — une vue React Native, toujours vivante.
///    → On mesure donc les PIXELS de la bande occupée par le rapport.
///
/// 2. **Les logs de l'appareil ne sont plus lisibles depuis le Mac** en Wi-Fi
///    (`log stream --device` a disparu de macOS 26). Le relais de diagnostic
///    natif (`screen-time-report-diagnostics`, DEBUG) publie donc l'état du
///    cycle de vie dans une `accessibilityValue`, seul canal qui traverse.
///
/// Opt-in : `TEST_RUNNER_RELOCK_HOME_REPORT_TEST=1`.
final class HomeReportSurvivalTests: XCTestCase {

  private var cycles: Int {
    let raw = ProcessInfo.processInfo.environment["RELOCK_REPORT_CYCLES"]
    return raw.flatMap(Int.init) ?? 4
  }

  private var findings: [String] = []

  override func setUpWithError() throws {
    // Diagnostic avant verdict : une première panne ne doit pas masquer le
    // reste du parcours, c'est la séquence complète qui désigne la cause.
    continueAfterFailure = true
  }

  // MARK: - Mesure

  private func attach(_ name: String, _ text: String) {
    let attachment = XCTAttachment(string: text)
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  private func attach(_ name: String, _ shot: XCUIScreenshot) {
    let attachment = XCTAttachment(screenshot: shot)
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  /// Part de pixels qui s'écartent du fond de la bande.
  ///
  /// Un rapport vivant y pose du texte et des icônes : des milliers de pixels
  /// s'éloignent de la teinte dominante. Une surface morte laisse le fond de
  /// l'app — uni — et le score tombe à zéro. La mesure ne suppose donc AUCUN
  /// contenu particulier : elle vaut aussi pour « Aucune utilisation mesurée »,
  /// qui est un rendu réussi, contrairement au vide.
  @MainActor
  private func inkScore(_ shot: XCUIScreenshot, frame: CGRect) -> Double {
    guard let image = UIImage(data: shot.pngRepresentation)?.cgImage,
      frame.width > 1, frame.height > 1
    else { return -1 }
    let scale = CGFloat(image.width) / UIScreen.main.bounds.width
    let crop = CGRect(
      x: frame.minX * scale, y: frame.minY * scale,
      width: frame.width * scale, height: frame.height * scale
    ).integral.intersection(
      CGRect(x: 0, y: 0, width: CGFloat(image.width), height: CGFloat(image.height)))
    guard crop.width > 1, crop.height > 1, let band = image.cropping(to: crop) else { return -1 }

    let width = 96
    let height = 48
    var bytes = [UInt8](repeating: 0, count: width * height * 4)
    bytes.withUnsafeMutableBytes { buffer in
      guard
        let context = CGContext(
          data: buffer.baseAddress, width: width, height: height,
          bitsPerComponent: 8, bytesPerRow: width * 4,
          space: CGColorSpaceCreateDeviceRGB(),
          bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
      else { return }
      context.interpolationQuality = .low
      context.draw(band, in: CGRect(x: 0, y: 0, width: width, height: height))
    }

    var luma: [Int] = []
    luma.reserveCapacity(width * height)
    for index in stride(from: 0, to: bytes.count, by: 4) {
      luma.append(
        (Int(bytes[index]) * 299 + Int(bytes[index + 1]) * 587 + Int(bytes[index + 2]) * 114)
          / 1000)
    }
    guard !luma.isEmpty else { return -1 }
    let median = luma.sorted()[luma.count / 2]
    let inked = luma.filter { abs($0 - median) > 12 }.count
    return Double(inked) / Double(luma.count)
  }

  /// Etat publié par `ScreenTimeReportView` (DEBUG). Absent = binaire trop
  /// ancien : on le dit, plutôt que de conclure sur du vide.
  @MainActor
  private func diagnostics(_ app: XCUIApplication) -> String {
    let probes = app.descendants(matching: .any)
      .matching(identifier: "screen-time-report-diagnostics")
      .allElementsBoundByIndex
    let values = probes.compactMap { $0.value as? String }
    return values.first(where: { $0.contains("mode=home") })
      ?? values.first
      ?? "relais de diagnostic absent"
  }

  @MainActor
  private func settle(_ seconds: TimeInterval) {
    _ = XCTWaiter.wait(for: [XCTestExpectation(description: "stabilisation")], timeout: seconds)
  }

  /// Bande du classement des apps : elle a le fond UNI de l'app derrière elle,
  /// c'est donc la plus honnête des deux. Le héro, lui, se détache sur l'image
  /// d'arrière-plan, dont les dégradés brouillent la mesure.
  @MainActor
  private func appsBand(_ app: XCUIApplication) -> CGRect? {
    let apps = app.descendants(matching: .any)["home.apps"].firstMatch
    guard apps.exists, apps.frame.height > 1 else { return nil }
    return apps.frame
  }

  @MainActor
  private func heroBand(_ app: XCUIApplication) -> CGRect? {
    let hero = app.descendants(matching: .any)["home.hero"].firstMatch
    guard hero.exists, hero.frame.height > 1 else { return nil }
    return hero.frame
  }

  /// L'app restaure son dernier onglet APRÈS l'apparition de la barre : un
  /// unique tap au lancement se fait écraser par la restauration, et le test
  /// mesure alors l'écran Blocages en croyant regarder l'Accueil. On insiste
  /// donc jusqu'à ce que l'onglet soit réellement sélectionné.
  @MainActor
  private func select(_ tab: String, in app: XCUIApplication) {
    let button = app.tabBars.buttons[tab].firstMatch
    XCTAssertTrue(button.waitForExistence(timeout: 20), "Onglet \(tab) absent.")
    for _ in 0..<5 {
      if button.isSelected { break }
      button.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
      settle(2)
    }
    XCTAssertTrue(button.isSelected, "L'onglet \(tab) n'a pas pu être sélectionné.")
    settle(1)
  }

  /// Une mesure, journalisée quoi qu'il arrive : c'est la série complète qui
  /// raconte la panne, pas le premier écart.
  @MainActor
  @discardableResult
  private func probe(_ app: XCUIApplication, _ step: String, floor: Double) -> Double {
    let shot = XCUIScreen.main.screenshot()
    let apps = appsBand(app)
    let hero = heroBand(app)
    let appsInk = apps.map { inkScore(shot, frame: $0) } ?? -1
    let heroInk = hero.map { inkScore(shot, frame: $0) } ?? -1
    let state = diagnostics(app)
    let line =
      String(format: "%@ | apps=%.4f hero=%.4f seuil=%.4f | %@", step, appsInk, heroInk, floor, state)
    attach("mesure-\(step)", line)
    attach("ecran-\(step)", shot)
    if appsInk < floor {
      findings.append(line)
      XCTFail("Surface du rapport vide après « \(step) » — \(line)")
    }
    return appsInk
  }

  // MARK: - Parcours

  @MainActor
  func testHomeReportSurvivesTabRoundTripsOnPhysicalDevice() throws {
    try XCTSkipUnless(
      ProcessInfo.processInfo.environment["RELOCK_HOME_REPORT_TEST"] == "1",
      "Parcours opt-in sur l'iPhone connecté.")

    let app = XCUIApplication()
    app.terminate()
    app.launchArguments = [
      "-EXDevMenuMotionGestureEnabled", "NO",
      "-EXDevMenuTouchGestureEnabled", "NO",
      "-EXDevMenuDisableAutoLaunch", "YES",
      "-EXDevMenuIsOnboardingFinished", "YES",
    ]
    // Sur iPhone physique le dev-launcher n'a AUCUN moyen de deviner le
    // serveur : il s'arrête sur « Enter URL manually » et le bundle ne charge
    // jamais. `--initialUrl` est lu avant l'affichage de son interface
    // (EXDevLauncherController.initialUrlFromProcessInfo), comme le fait
    // `scripts/dev-open.cjs`.
    if let host = ProcessInfo.processInfo.environment["RELOCK_DEV_HOST"], !host.isEmpty {
      app.launchArguments += ["--initialUrl", "http://\(host):8081"]
    }
    app.launch()

    XCTAssertTrue(
      app.tabBars.buttons["Accueil"].firstMatch.waitForExistence(timeout: 180),
      "Interface Relock absente — le bundle Metro n'est pas chargé.")
    // Laisser la restauration de navigation se produire avant de choisir.
    settle(6)
    select("Accueil", in: app)

    attach("hierarchie-00-arrivee", app.debugDescription)

    // Première agrégation : elle est lente, et tant qu'elle n'a pas abouti il
    // n'y a rien à comparer. On attend une surface RÉELLEMENT dessinée, en
    // gardant la trace de l'attente : « jamais rendu » et « rendu puis perdu »
    // n'ont pas la même cause et n'appellent pas le même correctif.
    var baseline = 0.0
    var trace: [String] = []
    for attempt in 0..<20 {
      let shot = XCUIScreen.main.screenshot()
      let appsInk = appsBand(app).map { inkScore(shot, frame: $0) } ?? -1
      let heroInk = heroBand(app).map { inkScore(shot, frame: $0) } ?? -1
      let bands =
        "apps=\(appsBand(app).map { "\(Int($0.minY))..\(Int($0.maxY))" } ?? "absent")"
        + " hero=\(heroBand(app).map { "\(Int($0.minY))..\(Int($0.maxY))" } ?? "absent")"
      trace.append(
        String(
          format: "t=%02ds apps=%.4f hero=%.4f | %@ | %@", attempt * 3, appsInk, heroInk, bands,
          diagnostics(app)))
      if attempt % 4 == 0 { attach("ecran-attente-\(attempt)", shot) }
      if appsInk > 0.02 {
        baseline = appsInk
        attach("ecran-00-reference", shot)
        break
      }
      settle(3)
    }
    attach("trace-attente-initiale", trace.joined(separator: "\n"))
    XCTAssertGreaterThan(
      baseline, 0,
      "Le rapport n'a JAMAIS rendu au premier affichage — la panne n'attend "
        + "même pas un aller-retour. Diagnostic : \(diagnostics(app))")
    // Sans référence vivante il n'y a rien à comparer : le reste du parcours
    // ne prouverait rien.
    try XCTSkipIf(baseline == 0, "Parcours interrompu : aucune surface de référence.")

    // Un rapport vivant ne redescend jamais au quart de sa densité de départ ;
    // une surface morte tombe à zéro. Le seuil sépare les deux sans exiger un
    // contenu identique d'une mesure à l'autre (les minutes avancent).
    let floor = max(0.01, baseline * 0.25)

    for cycle in 1...cycles {
      select("Blocages", in: app)
      settle(2)
      select("Accueil", in: app)
      settle(4)
      probe(app, String(format: "%02d-retour-de-blocages", cycle), floor: floor)

      select("Activité", in: app)
      // L'Activité agrège à l'heure sur la journée entière : c'est le rapport
      // le plus lourd, et l'extension est bornée à 6 Mo pour les deux.
      settle(6)
      select("Accueil", in: app)
      settle(4)
      probe(app, String(format: "%02d-retour-d-activite", cycle), floor: floor)

      // Laisser du temps : si la surface se répare seule, ce n'est pas la même
      // panne qu'un vide définitif, et le correctif n'est pas le même.
      settle(8)
      probe(app, String(format: "%02d-apres-attente", cycle), floor: floor)
    }

    // Arrière-plan : la vue ne quitte pas sa fenêtre, mais l'extension peut
    // mourir pendant ce temps. Chemin distinct, panne identique à l'écran.
    XCUIDevice.shared.press(.home)
    settle(3)
    app.activate()
    settle(6)
    probe(app, "99-retour-premier-plan", floor: floor)

    attach(
      "bilan",
      findings.isEmpty
        ? "Aucune disparition observée sur \(cycles) cycles."
        : findings.joined(separator: "\n"))
  }
}
