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
    return min(max(raw.flatMap(Int.init) ?? 4, 1), 20)
  }

  private var findings: [String] = []
  private var appsChecks = 0

  override func setUpWithError() throws {
    // Diagnostic avant verdict : une première panne ne doit pas masquer le
    // reste du parcours, c'est la séquence complète qui désigne la cause.
    continueAfterFailure = ProcessInfo.processInfo.environment["RELOCK_REPORT_FAIL_FAST"] != "1"
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
  private func inkScore(_ shot: XCUIScreenshot, frame: CGRect, in app: XCUIApplication) -> Double {
    guard let image = UIImage(data: shot.pngRepresentation)?.cgImage,
      frame.width > 1, frame.height > 1, app.frame.width > 1
    else { return -1 }
    // ⚠️ JAMAIS `UIScreen.main` ici : dans le processus du RUNNER il vaut
    // 320 × 480 — les bornes de compatibilité d'un processus sans scène — et
    // non les 430 × 932 de l'appareil. Toutes les découpes s'en trouvaient
    // décalées d'un tiers, et la bande du classement était jugée « hors
    // écran » alors qu'elle s'affichait. `app.frame` est la seule mesure qui
    // décrit l'app observée.
    let scale = CGFloat(image.width) / app.frame.width
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
  private func diagnostics(_ app: XCUIApplication, mode: String = "home") -> String {
    let probes = app.descendants(matching: .any)
      .matching(identifier: "screen-time-report-diagnostics")
      .allElementsBoundByIndex
    let values = probes.compactMap { $0.value as? String }
    return values.first(where: { $0.contains("mode=\(mode)") })
      ?? "relais de diagnostic absent"
  }

  /// Numéro de la connexion courante au rapport. Le correctif doit maintenant
  /// préserver cette connexion : un epoch différent au retour prouverait une
  /// reconstruction et donc une fenêtre de chargement visible.
  @MainActor
  private func epoch(_ app: XCUIApplication, mode: String = "home") -> Int {
    let state = diagnostics(app, mode: mode)
    guard let range = state.range(of: "epoch=") else { return -1 }
    let digits = state[range.upperBound...].prefix { $0.isNumber }
    return Int(digits) ?? -1
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
  private func select(
    _ tab: String, in app: XCUIApplication, settleAfter: TimeInterval = 1
  ) {
    let button = app.tabBars.buttons[tab].firstMatch
    XCTAssertTrue(button.waitForExistence(timeout: 20), "Onglet \(tab) absent.")
    for _ in 0..<5 {
      if button.isSelected { break }
      button.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
      let selected = NSPredicate { _, _ in button.isSelected }
      _ = XCTWaiter.wait(
        for: [XCTNSPredicateExpectation(predicate: selected, object: button)], timeout: 2)
    }
    XCTAssertTrue(button.isSelected, "L'onglet \(tab) n'a pas pu être sélectionné.")
    if settleAfter > 0 { settle(settleAfter) }
  }

  /// La bande du classement descend sous le pli quand la carte « Mes apps »
  /// existe (`showsBlockedCard`) : hors écran, elle ne mesure rien. Le héro,
  /// lui, est toujours visible. On évalue donc les deux et on n'exige que
  /// celles qui sont réellement à l'écran.
  @MainActor
  private func visible(_ frame: CGRect?, in app: XCUIApplication) -> CGRect? {
    guard let frame else { return nil }
    // La barre d'onglets flottante mange le bas de l'écran : exiger la moitié
    // de la bande écartait des cartes pourtant largement lisibles.
    let screen = app.frame
    let tabs = app.tabBars.firstMatch
    let bottom = tabs.exists ? min(tabs.frame.minY, screen.maxY) : screen.maxY
    let content = CGRect(
      x: screen.minX, y: screen.minY + 150,
      width: screen.width, height: max(0, bottom - screen.minY - 150))
    let shown = frame.intersection(content)
    guard shown.height > frame.height * 0.3, shown.height > 40 else { return nil }
    return shown
  }

  /// Bring the remote ranking into view without a fling. The optional blocked
  /// apps card puts it below the fold; silently skipping it proves nothing.
  @MainActor
  private func revealApps(_ app: XCUIApplication) {
    for _ in 0..<6 {
      guard let frame = appsBand(app) else { return }
      if let shown = visible(frame, in: app), shown.height >= frame.height * 0.85 {
        return
      }
      let screen = app.frame
      let distance = frame.minY - (screen.minY + screen.height * 0.32)
      let amount = min(abs(distance) / screen.height, 0.42)
      guard amount > 0.02 else { return }
      let startY = distance > 0 ? 0.78 : 0.30
      let endY = startY + (distance > 0 ? -amount : amount)
      app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: startY))
        .press(
          forDuration: 0.1,
          thenDragTo: app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: endY)),
          withVelocity: .slow, thenHoldForDuration: 0.3)
      settle(0.5)
    }
  }

  @MainActor
  private func waitForMount(_ app: XCUIApplication) {
    let ready = NSPredicate { _, _ in
      self.diagnostics(app).contains("host=1")
        && !app.descendants(matching: .any)["home-report-skeleton"].firstMatch.exists
    }
    XCTAssertEqual(
      XCTWaiter.wait(for: [XCTNSPredicateExpectation(predicate: ready, object: app)], timeout: 20),
      .completed, "Le rapport natif n'a pas termine son montage : \(diagnostics(app))")
  }

  /// Pourquoi une bande n'a pas pu être mesurée — sans cette trace, un test qui
  /// SAUTE son assertion se lit exactement comme un test qui la réussit.
  @MainActor
  private func bandTrace(_ app: XCUIApplication, _ identifier: String) -> String {
    let element = app.descendants(matching: .any)[identifier].firstMatch
    guard element.exists else { return "\(identifier)=absent" }
    let frame = element.frame
    let shown = frame.intersection(app.frame)
    return String(
      format: "%@=[%.0f→%.0f h%.0f vis%.0f]", identifier, frame.minY, frame.maxY, frame.height,
      shown.height)
  }

  /// Une mesure, journalisée quoi qu'il arrive : c'est la série complète qui
  /// raconte la panne, pas le premier écart.
  @MainActor
  @discardableResult
  private func probe(
    _ app: XCUIApplication, _ step: String, appsFloor: Double, heroFloor: Double
  ) -> (apps: Double, hero: Double) {
    waitForMount(app)
    revealApps(app)
    let shot = XCUIScreen.main.screenshot()
    let appsInk = visible(appsBand(app), in: app).map { inkScore(shot, frame: $0, in: app) } ?? -1
    let heroInk = visible(heroBand(app), in: app).map { inkScore(shot, frame: $0, in: app) } ?? -1
    let state = diagnostics(app)
    let line = String(
      format: "%@ | apps=%.4f (seuil %.4f) hero=%.4f (seuil %.4f) | %@ %@ | %@",
      step, appsInk, appsFloor, heroInk, heroFloor, bandTrace(app, "home.apps"),
      bandTrace(app, "home.hero"), state)
    attach("mesure-\(step)", line)
    attach("ecran-\(step)", shot)
    // Seule la bande du classement tranche. Le héro se détache sur l'image
    // d'arrière-plan — il garde donc de l'encre même mort — et, dès que la page
    // défile, il n'en reste qu'un fragment en haut d'écran dont la densité ne
    // veut plus rien dire. Sa valeur est journalisée, pas jugée.
    var dead: [String] = []
    if appsInk >= 0 {
      appsChecks += 1
      if appsInk < appsFloor { dead.append("classement") }
    } else {
      dead.append("classement non mesurable")
    }
    if !dead.isEmpty {
      findings.append(line)
      XCTFail(
        "Surface du rapport vide (\(dead.joined(separator: " + "))) après « \(step) » — \(line)")
    }
    return (appsInk, heroInk)
  }

  /// Mesure le tout premier rendu observable après la sélection de l'Accueil.
  /// Aucun waitForMount, revealApps ou délai de grâce ne peut cacher une
  /// reconstruction derrière cette assertion.
  @MainActor
  private func probeImmediately(
    _ app: XCUIApplication, _ step: String, appsFloor: Double
  ) {
    let skeleton = app.descendants(matching: .any)["home-report-skeleton"].firstMatch
    let shot = XCUIScreen.main.screenshot()
    let appsInk = visible(appsBand(app), in: app).map { inkScore(shot, frame: $0, in: app) } ?? -1
    let line = String(
      format: "%@ | immediate apps=%.4f (seuil %.4f) skeleton=%d | %@",
      step, appsInk, appsFloor, skeleton.exists ? 1 : 0, diagnostics(app))
    attach("mesure-immediate-\(step)", line)
    attach("ecran-immediat-\(step)", shot)
    appsChecks += 1
    if skeleton.exists || appsInk < appsFloor {
      findings.append(line)
      XCTFail("Retour non instantané après « \(step) » — \(line)")
    }
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

    let homeTab = app.tabBars.buttons["Accueil"].firstMatch
    let launchDeadline = Date().addingTimeInterval(180)
    while !homeTab.waitForExistence(timeout: 1), Date() < launchDeadline {
      // Existing development-only entry point, never an App Store purchase.
      // A sandbox entitlement may expire between two native test builds.
      let devSkip = app.buttons["paywall-dev-skip"].firstMatch
      if devSkip.exists { devSkip.tap() }
    }
    XCTAssertTrue(
      homeTab.exists,
      "Accueil inaccessible au lancement (Metro, authentification ou paywall).")
    // Laisser la restauration de navigation se produire avant de choisir.
    settle(6)
    select("Accueil", in: app)

    attach("hierarchie-00-arrivee", app.debugDescription)

    // Première agrégation : elle est lente, et tant qu'elle n'a pas abouti il
    // n'y a rien à comparer. On attend une surface RÉELLEMENT dessinée, en
    // gardant la trace de l'attente : « jamais rendu » et « rendu puis perdu »
    // n'ont pas la même cause et n'appellent pas le même correctif.
    var baseline = 0.0
    var heroBaseline = 0.0
    var trace: [String] = []
    waitForMount(app)
    revealApps(app)
    for attempt in 0..<20 {
      let shot = XCUIScreen.main.screenshot()
      let appsInk = visible(appsBand(app), in: app).map { inkScore(shot, frame: $0, in: app) } ?? -1
      let heroInk = visible(heroBand(app), in: app).map { inkScore(shot, frame: $0, in: app) } ?? -1
      let bands =
        "apps=\(appsBand(app).map { "\(Int($0.minY))..\(Int($0.maxY))" } ?? "absent")"
        + " hero=\(heroBand(app).map { "\(Int($0.minY))..\(Int($0.maxY))" } ?? "absent")"
      trace.append(
        String(
          format: "t=%02ds apps=%.4f hero=%.4f | %@ | %@", attempt * 3, appsInk, heroInk, bands,
          diagnostics(app)))
      if attempt % 4 == 0 { attach("ecran-attente-\(attempt)", shot) }
      if appsInk > 0.02 {
        baseline = max(appsInk, 0)
        heroBaseline = max(heroInk, 0)
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
    try XCTSkipIf(
      baseline == 0, "Parcours interrompu : aucun classement de référence.")

    // Un rapport vivant ne redescend jamais au quart de sa densité de départ ;
    // une surface morte tombe au fond d'écran seul. Le seuil sépare les deux
    // sans exiger un contenu identique d'une mesure à l'autre (les minutes
    // avancent, la carte « Mes apps » apparaît et disparaît).
    let appsFloor = max(0.01, baseline * 0.35)
    let heroFloor = heroBaseline > 0 ? max(0.01, heroBaseline * 0.35) : 0
    attach(
      "seuils",
      String(
        format: "reference apps=%.4f hero=%.4f → seuils apps=%.4f hero=%.4f",
        baseline, heroBaseline, appsFloor, heroFloor))

    /// Un aller-retour doit retrouver les pixels déjà rendus et le même epoch
    /// dès la fin de la transition, sans délai de reconnexion.
    @MainActor
    func roundTrip(_ step: String, through tab: String, dwell: TimeInterval) {
      let before = epoch(app)
      select(tab, in: app)
      settle(dwell)
      select("Accueil", in: app, settleAfter: 0)
      probeImmediately(app, step, appsFloor: appsFloor)
      let after = epoch(app)
      if after != before {
        findings.append("\(step) : epoch \(before) → \(after)")
        XCTFail(
          "Le rapport a été reconstruit au retour (epoch \(before) → \(after)), "
            + "ce qui réintroduit un chargement visible. Etape « \(step) ».")
      }
    }

    for cycle in 1...cycles {
      roundTrip(String(format: "%02d-retour-de-blocages", cycle), through: "Blocages", dwell: 3)

      // L'Activité agrège à l'heure sur la journée entière : c'est le rapport
      // le plus lourd, et l'extension est bornée à 6 Mo pour les DEUX écrans.
      // On y reste, et on y fait défiler, pour lui coûter réellement cher.
      let before = epoch(app)
      select("Activité", in: app)
      settle(6)
      app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.8))
        .press(forDuration: 0.05, thenDragTo:
          app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.2)))
      settle(6)
      select("Accueil", in: app, settleAfter: 0)
      let activityStep = String(format: "%02d-retour-d-activite", cycle)
      probeImmediately(app, activityStep, appsFloor: appsFloor)
      let after = epoch(app)
      if after != before {
        findings.append("retour d'Activité : epoch \(before) → \(after)")
        XCTFail("Le retour d'Activité a reconstruit Home (epoch \(before) → \(after)).")
      }

      // La surface doit TENIR : une reconstruction qui se rejoue en boucle
      // ferait clignoter l'écran aussi sûrement qu'un vide.
      let epochBeforeWait = epoch(app)
      settle(10)
      probe(
        app, String(format: "%02d-apres-attente", cycle), appsFloor: appsFloor,
        heroFloor: heroFloor)
      XCTAssertEqual(
        epoch(app), epochBeforeWait,
        "La surface se reconstruit toute seule à l'arrêt : l'écran clignoterait.")
    }

    // Activity uses the same native foreground policy. A manual refresh must
    // also reconnect, rather than only animating the refresh icon.
    select("Activité", in: app)
    settle(5)
    let beforeActivityBackground = epoch(app, mode: "usage")
    XCTAssertGreaterThan(beforeActivityBackground, 0)
    XCUIDevice.shared.press(.home)
    settle(3)
    app.activate()
    XCTAssertTrue(app.tabBars.buttons["Activité"].firstMatch.waitForExistence(timeout: 30))
    settle(5)
    XCTAssertGreaterThan(epoch(app, mode: "usage"), beforeActivityBackground)
    let beforeRefresh = epoch(app, mode: "usage")
    let refreshButton = app.buttons["activity-native-refresh"].firstMatch
    XCTAssertTrue(refreshButton.waitForExistence(timeout: 10))
    refreshButton.tap()
    settle(5)
    XCTAssertGreaterThan(epoch(app, mode: "usage"), beforeRefresh)
    select("Accueil", in: app, settleAfter: 0)
    probeImmediately(app, "45-retour-activite-reprise-refresh", appsFloor: appsFloor)

    // Réglages : un écran empilé, pas un onglet. Même perte de fenêtre.
    let beforeSettings = epoch(app)
    let settings = app.descendants(matching: .any)["Ouvrir les réglages"].firstMatch
    if settings.waitForExistence(timeout: 5) {
      settings.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
      settle(4)
      // L'écran Réglages porte son propre en-tête : pas de `UINavigationBar`,
      // donc pas de bouton « précédent » système à toucher.
      let back = app.descendants(matching: .any)["Retour"].firstMatch
      if back.waitForExistence(timeout: 3) {
        back.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
      } else {
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.02, dy: 0.5))
          .press(forDuration: 0.05, thenDragTo:
            app.coordinate(withNormalizedOffset: CGVector(dx: 0.95, dy: 0.5)))
      }
      let home = app.tabBars.buttons["Accueil"].firstMatch
      XCTAssertTrue(
        home.waitForExistence(timeout: 20) && home.isSelected,
        "Le retour depuis les Réglages n'a pas ramené à l'Accueil.")
      probeImmediately(app, "50-retour-de-reglages", appsFloor: appsFloor)
      XCTAssertEqual(
        epoch(app), beforeSettings,
        "Le retour des Réglages a reconstruit le rapport Home.")
    }

    // Arrière-plan : ce chemin ne détache aucune vue de sa fenêtre. Home doit
    // donc conserver la même connexion et ses pixels plutôt que clignoter en
    // reconstruisant systématiquement au retour.
    let beforeBackground = epoch(app)
    XCUIDevice.shared.press(.home)
    settle(4)
    app.activate()
    // `activate()` rend la main avant que la hiérarchie soit reconstruite :
    // sonder tout de suite lisait un arbre vide et accusait le rapport.
    let relay = app.descendants(matching: .any)["screen-time-report-diagnostics"].firstMatch
    XCTAssertTrue(
      relay.waitForExistence(timeout: 30), "L'Accueil n'est pas revenu au premier plan.")
    probeImmediately(app, "99-retour-premier-plan", appsFloor: appsFloor)
    XCTAssertEqual(
      epoch(app), beforeBackground,
      "Le retour de veille a reconstruit le rapport Home.")

    attach(
      "bilan",
      findings.isEmpty
        ? "Aucune disparition observée sur \(cycles) cycles, "
          + "\(appsChecks) mesures du classement."
        : findings.joined(separator: "\n"))
    // La bande du classement n'a derrière elle que le fond UNI de l'app : elle
    // sépare vivant (≈0,16) de mort (≈0,0002). Celle du héro se détache sur
    // l'image d'arrière-plan et discrimine moins bien. Un parcours qui n'aurait
    // jamais pu mesurer la première ne prouverait donc pas grand-chose — et le
    // dire vaut mieux que le passer sous silence.
    XCTAssertGreaterThan(
      appsChecks, 0,
      "Le classement n'a jamais été mesurable (sous le pli tout le parcours) : "
        + "seule la bande du héro a été vérifiée. \(bandTrace(app, "home.apps"))")
  }
}
