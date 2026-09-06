import XCTest
import UIKit

/// Amorce du pilotage de Relock sur un iPhone physique.
///
/// Deux rôles, tous deux indispensables pour tester l'app pour de vrai :
///
/// 1. **Diagnostic réseau** — sur iOS 14+, joindre une IP du réseau local
///    exige l'autorisation « Réseau local ». Sans elle, l'app se lance mais ne
///    charge jamais son bundle et le pont de test reste muet : ce test
///    distingue ce cas d'une panne applicative.
/// 2. **Maintien au premier plan** — un iPhone laissé seul VERROUILLE son
///    écran, et iOS suspend alors les timers JavaScript : le pont
///    (`src/session/dev-test-bridge.ts`) cesse de lire les commandes, sans
///    rien signaler. `devicectl process launch` ne déverrouille pas l'appareil,
///    XCUITest si. `testHoldForegroundForBridgeCommands` garde donc l'app
///    éveillée et active pendant que le Mac lui envoie ses commandes.
///
/// Réglages passés par l'environnement DU RUNNER (xcodebuild retire le préfixe) :
///   TEST_RUNNER_RELOCK_DEV_HOST=172.20.244.246
///   TEST_RUNNER_RELOCK_HOLD_SECONDS=240
final class RelockBridgeDiagnosticsTests: XCTestCase {

  private var macHost: String {
    ProcessInfo.processInfo.environment["RELOCK_DEV_HOST"] ?? "127.0.0.1"
  }

  private var holdSeconds: TimeInterval {
    let raw = ProcessInfo.processInfo.environment["RELOCK_HOLD_SECONDS"]
    return raw.flatMap(TimeInterval.init) ?? 180
  }

  private func report(_ line: String) {
    print("RELOCK-DIAG \(line)")
    let attachment = XCTAttachment(string: line)
    attachment.name = "diag"
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  /// The remote data are absent from the host's accessibility tree. Check
  /// the actually rendered score ring/pills, not just the local button above
  /// them (which also exists when the report is completely blank).
  @MainActor
  private func coloredFraction(_ screenshot: XCUIScreenshot, frame: CGRect) -> Double {
    guard let image = UIImage(data: screenshot.pngRepresentation)?.cgImage else { return 0 }
    let scale = CGFloat(image.width) / UIScreen.main.bounds.width
    let crop = CGRect(
      x: frame.minX * scale, y: frame.minY * scale,
      width: frame.width * scale, height: frame.height * scale).integral
    guard let content = image.cropping(to: crop) else { return 0 }
    let width = 100, height = 50
    var bytes = [UInt8](repeating: 0, count: width * height * 4)
    bytes.withUnsafeMutableBytes { buffer in
      guard let context = CGContext(
        data: buffer.baseAddress, width: width, height: height,
        bitsPerComponent: 8, bytesPerRow: width * 4,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { return }
      context.draw(content, in: CGRect(x: 0, y: 0, width: width, height: height))
    }
    var colored = 0
    for index in stride(from: 0, to: bytes.count, by: 4) {
      let high = max(bytes[index], bytes[index + 1], bytes[index + 2])
      let low = min(bytes[index], bytes[index + 1], bytes[index + 2])
      if high > 100 && Int(high) - Int(low) > 30 { colored += 1 }
    }
    return Double(colored) / Double(width * height)
  }

  /// Reproduit les gestes signalés sur la Home avec le vrai rapport Apple.
  /// Les captures sont conservées même lorsque le rapport distant est vide.
  @MainActor
  func testHomeScrollAndTabReturnOnPhysicalDevice() throws {
    continueAfterFailure = false
    try XCTSkipUnless(
      ProcessInfo.processInfo.environment["RELOCK_HOME_DEVICE_TEST"] == "1",
      "Parcours opt-in sur l'iPhone connecté.")
    let app = XCUIApplication()
    // activate alone can keep the executable from the preceding installation
    // alive. Always test a new process, not merely a Fast Refresh of its JS.
    app.terminate()
    // Process-only preferences: incidental motion must not open Expo's
    // developer sheet over a screenshot. Do not change the user's settings.
    app.launchArguments = [
      "-EXDevMenuMotionGestureEnabled", "NO",
      "-EXDevMenuTouchGestureEnabled", "NO",
      "-EXDevMenuDisableAutoLaunch", "YES",
      "-EXDevMenuIsOnboardingFinished", "YES",
    ]
    app.launch()
    XCTAssertTrue(waitForRelockUI(app, timeout: 90), "Interface Relock absente.")

    func settle(_ seconds: TimeInterval = 3) {
      _ = XCTWaiter.wait(
        for: [XCTestExpectation(description: "stabilisation Home")], timeout: seconds)
    }
    func capture(_ name: String) {
      XCTAssertEqual(app.state, .runningForeground, "Le parcours a été interrompu hors de Relock.")
      let shot = XCUIScreen.main.screenshot()
      addScreenshot(shot, name: name)
      if name != "home-05-activite" {
        XCTAssertTrue(app.tabBars.buttons["Accueil"].firstMatch.isSelected)
        let score = app.buttons["home.score"].firstMatch
        XCTAssertTrue(score.exists, "Le nouveau binaire Home doit être installé.")
        if score.exists {
          XCTAssertGreaterThan(
            coloredFraction(shot, frame: score.frame), 0.005,
            "Le score distant est vide sur la capture \(name).")
        }
      }
      let hierarchy = XCTAttachment(string: app.debugDescription)
      hierarchy.name = name + "-hierarchie"
      hierarchy.lifetime = .keepAlways
      add(hierarchy)
    }
    func select(_ name: String) {
      XCTAssertEqual(app.state, .runningForeground, "Relock n'est plus au premier plan.")
      let tab = app.tabBars.buttons[name].firstMatch
      XCTAssertTrue(tab.waitForExistence(timeout: 10), "Onglet \(name) absent.")
      tab.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
      settle(6)
      XCTAssertTrue(tab.isSelected, "Le toucher n'a pas sélectionné l'onglet \(name).")
    }
    func drag(from: Double, to: Double) {
      XCTAssertEqual(app.state, .runningForeground, "Relock n'est plus au premier plan.")
      app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: from))
        .press(forDuration: 0.05, thenDragTo:
          app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: to)))
      settle()
      XCTAssertTrue(
        app.tabBars.buttons["Accueil"].firstMatch.isSelected,
        "Un glissement dans l'accueil a déclenché une navigation.")
    }

    select("Accueil")
    capture("home-01-arrivee")
    drag(from: 0.78, to: 0.25)
    capture("home-02-vers-le-bas")
    drag(from: 0.78, to: 0.25)
    capture("home-03-bas-de-page")
    drag(from: 0.25, to: 0.8)
    drag(from: 0.25, to: 0.8)
    capture("home-04-retour-en-haut")
    select("Activité")
    capture("home-05-activite")
    select("Accueil")
    capture("home-06-retour-onglet")
    settle(10)
    capture("home-07-retour-apres-attente")
    drag(from: 0.78, to: 0.25)
    capture("home-08-scroll-apres-retour")
    drag(from: 0.25, to: 0.8)
    capture("home-09-fin-en-haut")
    XCUIDevice.shared.press(.home)
    settle(2)
    app.activate()
    settle(5)
    capture("home-10-retour-premier-plan")
  }

  /// Parcours de lecture SEULE des trois onglets : on regarde, on ne touche
  /// à rien qui puisse créer, modifier ou supprimer une règle. Chaque onglet
  /// est capturé, et l'on vérifie qu'aucun n'affiche un trou muet — le
  /// symptôme d'une extension DeviceActivityReport qui n'a rien rendu.
  @MainActor
  func testHomeMyAppsVisualFixtures() throws {
    continueAfterFailure = false
    try XCTSkipUnless(
      ProcessInfo.processInfo.environment["RELOCK_HOME_MY_APPS_VISUAL_TEST"] == "1",
      "Parcours visuel opt-in avec données de démonstration.")
    #if !targetEnvironment(simulator)
      throw XCTSkip("Les scénarios fictifs sont réservés au simulateur.")
    #endif
    let app = XCUIApplication()
    func settle(_ seconds: TimeInterval = 2) {
      _ = XCTWaiter.wait(
        for: [XCTestExpectation(description: "rendu Mes apps")], timeout: seconds)
    }
    func capture(_ name: String) {
      addScreenshot(XCUIScreen.main.screenshot(), name: name)
      let hierarchy = XCTAttachment(string: app.debugDescription)
      hierarchy.name = name + "-hierarchie"
      hierarchy.lifetime = .keepAlways
      add(hierarchy)
      XCTAssertTrue(app.tabBars.buttons["Accueil"].firstMatch.isSelected)
    }
    func drag(from: Double, to: Double) {
      app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: from))
        .press(forDuration: 0.05, thenDragTo:
          app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: to)))
      settle()
    }
    let scenarios = ProcessInfo.processInfo.environment["RELOCK_HOME_MY_APPS_SCENARIOS"]?
      .split(separator: ",").map(String.init) ?? ["blocked", "upcoming", "none"]
    for scenario in scenarios {
      app.terminate()
      app.launchArguments = [
        "-HomeReferenceFixture", "YES", "-HomeMyAppsScenario", scenario,
        "-EXDevMenuMotionGestureEnabled", "NO",
        "-EXDevMenuTouchGestureEnabled", "NO",
        "-EXDevMenuDisableAutoLaunch", "YES",
        "-EXDevMenuIsOnboardingFinished", "YES",
      ]
      app.launch()
      let declineTracking = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        .alerts.buttons.matching(NSPredicate(
          format: "label CONTAINS[c] 'ne pas me suivre' OR label CONTAINS[c] 'Ask App Not to Track'"))
        .firstMatch
      if declineTracking.waitForExistence(timeout: 2) { declineTracking.tap() }
      acceptSystemAlerts(rounds: 1)
      XCTAssertTrue(waitForRelockUI(app, timeout: 90))
      let home = app.tabBars.buttons["Accueil"].firstMatch
      home.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
      settle(5)
      capture("mes-apps-\(scenario)-01-arrivee")
      let card = app.descendants(matching: .any)["home-my-apps"].firstMatch
      XCTAssertEqual(card.exists, scenario != "none")
      XCTAssertEqual(app.buttons["home-unlock-apps"].firstMatch.exists, scenario == "blocked")
      let elastic = ProcessInfo.processInfo.environment["RELOCK_HOME_ELASTIC_TEST"] == "1"
      if elastic {
        let initialY = card.frame.minY
        drag(from: 0.25, to: 0.65)
        capture("mes-apps-\(scenario)-elastic-haut-retour")
        if card.exists { XCTAssertEqual(card.frame.minY, initialY, accuracy: 2) }
      }
      drag(from: 0.78, to: 0.23)
      capture("mes-apps-\(scenario)-02-defilement")
      drag(from: 0.78, to: 0.23)
      drag(from: 0.78, to: 0.23)
      capture("mes-apps-\(scenario)-03-bas")
      let progress = app.descendants(matching: .any)["home-progress"].firstMatch
      XCTAssertTrue(progress.exists)
      XCTAssertLessThanOrEqual(progress.frame.maxY, app.tabBars.firstMatch.frame.minY + 1)
      if elastic {
        let bottomY = progress.frame.minY
        drag(from: 0.78, to: 0.23)
        capture("mes-apps-\(scenario)-elastic-bas-retour")
        XCTAssertEqual(progress.frame.minY, bottomY, accuracy: 2)
      }
      drag(from: 0.24, to: 0.8)
      drag(from: 0.24, to: 0.8)
      capture("mes-apps-\(scenario)-04-retour-haut")
      let activity = app.tabBars.buttons["Activité"].firstMatch
      activity.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
      settle(3)
      home.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
      settle(4)
      capture("mes-apps-\(scenario)-05-retour-onglet")
      XCTAssertEqual(card.exists, scenario != "none")
      XCTAssertEqual(app.buttons["home-unlock-apps"].firstMatch.exists, scenario == "blocked")
    }
  }

  @MainActor
  func testWalkThroughTabsReadOnly() throws {
    let app = XCUIApplication()
    if ProcessInfo.processInfo.environment["RELOCK_ATTACH"] == "1" {
      app.activate()
    } else {
      app.launch()
    }
    acceptSystemAlerts()
    XCTAssertTrue(waitForRelockUI(app), "Relock n'a pas chargé son bundle.")

    for (index, name) in ["Accueil", "Blocages", "Activité"].enumerated() {
      let tab = app.tabBars.buttons[name]
      if tab.waitForExistence(timeout: 10) {
        tab.tap()
      } else {
        XCTFail("Onglet « \(name) » introuvable dans la barre native.")
        continue
      }
      // Laisse aux vues natives hors process (rapport DeviceActivity, icônes
      // Family Controls) le temps de rendre : elles arrivent après le JS.
      _ = XCTWaiter.wait(
        for: [XCTestExpectation(description: "rendu \(name)")], timeout: 6)
      let labels = app.staticTexts.allElementsBoundByIndex
        .prefix(40).map { $0.label }.filter { !$0.isEmpty }
      report("onglet \(name): \(labels.prefix(14).joined(separator: " ¦ "))")
      addScreenshot(app.screenshot(), name: "1\(index)-onglet-\(name)")
      XCTAssertFalse(
        labels.isEmpty,
        "L'onglet « \(name) » ne montre aucun texte : écran vide.")
    }
  }

  /// Ouvre chaque app candidate et capture ce que l'utilisateur voit : c'est
  /// la seule preuve possible du rendu du mur, que `ManagedSettingsUI` dessine
  /// HORS du processus de l'app bloquée (son texte n'apparaît donc pas dans la
  /// hiérarchie d'accessibilité de celle-ci).
  ///
  /// Bundles à essayer : `TEST_RUNNER_RELOCK_SHIELD_BUNDLES`, séparés par des
  /// virgules. Le test ne conclut rien : il rapporte et capture, à charge de
  /// l'humain (ou du test suivant) de désigner l'app réellement protégée.
  @MainActor
  func testCaptureSystemShieldForCandidateApps() throws {
    let raw = ProcessInfo.processInfo.environment["RELOCK_SHIELD_BUNDLES"] ?? ""
    let bundles = raw.split(separator: ",").map(String.init).filter { !$0.isEmpty }
    try XCTSkipIf(
      bundles.isEmpty,
      "Renseigner TEST_RUNNER_RELOCK_SHIELD_BUNDLES pour exercer le mur.")

    // ⚠️ Aucune requête d'accessibilité sur l'app visée ni sur SpringBoard :
    // quand le mur est posé, l'app n'est pas lancée et toute interrogation
    // échoue en `kAXErrorServerNotFound`, ce qui interrompt le balayage. Le
    // mur étant dessiné hors process, son texte ne serait de toute façon pas
    // visible ici. C'est le NATIF qui tranche : `shieldLastApplicationName`
    // dans le diagnostic nomme l'app qui a réellement buté.
    let wantsShots = ProcessInfo.processInfo.environment["RELOCK_SHIELD_SHOTS"] == "1"
    for (index, bundle) in bundles.enumerated() {
      let target = XCUIApplication(bundleIdentifier: bundle)
      target.activate()
      _ = XCTWaiter.wait(
        for: [XCTestExpectation(description: "rendu du mur")], timeout: 3)
      // état 1 = jamais lancée (app absente OU refusée par le bouclier),
      // 3 = arrière-plan, 4 = premier plan.
      report("\(bundle) → état \(target.state.rawValue)")
      if wantsShots {
        addScreenshot(XCUIScreen.main.screenshot(), name: "2\(index)-\(bundle)")
      }
    }
  }

  /// Coche une app dans le sélecteur système Family Controls, ouvert au
  /// préalable par la commande `pick` du pont.
  ///
  /// Le sélecteur d'Apple est une vue DISTANTE : rien ne garantit que son
  /// contenu soit exposé à l'accessibilité. Ce test le mesure au lieu de le
  /// supposer — il relève ce qu'il voit, tente la sélection, et dit ce qui
  /// s'est réellement passé.
  @MainActor
  func testSelectAppInSystemPicker() throws {
    let wanted = ProcessInfo.processInfo.environment["RELOCK_PICK_APP"] ?? "Safari"
    let app = XCUIApplication()
    app.activate()

    let cells = app.descendants(matching: .any).allElementsBoundByIndex
      .prefix(60)
      .map { $0.label }
      .filter { !$0.isEmpty }
    report("sélecteur — éléments vus: \(cells.prefix(25).joined(separator: " ¦ "))")
    addScreenshot(XCUIScreen.main.screenshot(), name: "30-selecteur")

    let row = app.descendants(matching: .any).matching(
      NSPredicate(format: "label CONTAINS[c] %@", wanted)
    ).firstMatch
    guard row.waitForExistence(timeout: 8) else {
      report("« \(wanted) » introuvable dans le sélecteur — contenu non exposé")
      return
    }
    row.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    report("« \(wanted) » coché")
    addScreenshot(XCUIScreen.main.screenshot(), name: "31-selecteur-coche")

    let done = app.buttons["Terminé"].firstMatch
    if done.waitForExistence(timeout: 5) {
      done.tap()
      report("sélection validée")
    } else {
      report("bouton Terminé introuvable")
    }
    addScreenshot(XCUIScreen.main.screenshot(), name: "32-apres-selection")
  }

  /// Parcours complet du mur système, sur une app réellement bloquée.
  ///
  /// Tout se joue hors du processus de l'app visée : le mur est dessiné par
  /// `ManagedSettingsUI`, l'app bloquée n'est même pas lancée. On capture donc
  /// l'ÉCRAN, et on tape en COORDONNÉES via SpringBoard — seul hôte qui existe
  /// toujours et couvre tout l'écran.
  ///
  /// Bundle visé : `TEST_RUNNER_RELOCK_SHIELD_BUNDLE`.
  @MainActor
  func testShieldButtonsEndToEnd() throws {
    let bundle = ProcessInfo.processInfo.environment["RELOCK_SHIELD_BUNDLE"] ?? ""
    let appName = ProcessInfo.processInfo.environment["RELOCK_SHIELD_APP_NAME"] ?? "Discord"
    try XCTSkipIf(bundle.isEmpty, "Renseigner TEST_RUNNER_RELOCK_SHIELD_BUNDLE.")

    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let relock = XCUIApplication(bundleIdentifier: "com.yaya.relock")
    let blocked = XCUIApplication(bundleIdentifier: bundle)

    /// Positions relevées sur le mur : les deux pilules sont posées par iOS,
    /// toujours au même endroit, juste au-dessus de la zone de sécurité basse.
    let primary = CGVector(dx: 0.5, dy: 0.862)
    let secondary = CGVector(dx: 0.5, dy: 0.927)

    func settle(_ seconds: TimeInterval) {
      _ = XCTWaiter.wait(
        for: [XCTestExpectation(description: "attente")], timeout: seconds)
    }

    /// Demande à SpringBoard d'ouvrir l'app protégée. Interroger ou toucher
    /// son icône est volontairement évité : iOS expose parfois comme
    /// « hittable » une icône située hors de la page visible, puis invalide
    /// toute la hiérarchie dès que le mur apparaît.
    @discardableResult
    func launchFromHome(_: String) -> Bool {
      XCUIDevice.shared.press(.home)
      settle(2)
      XCUIApplication(bundleIdentifier: bundle).activate()
      settle(4)
      return true
    }

    /// Fait apparaître puis capture le mur pour une app protégée.
    @discardableResult
    func raiseShield(_ step: String, appName: String) -> Bool {
      let launched = launchFromHome(appName)
      addScreenshot(XCUIScreen.main.screenshot(), name: "4\(step)-mur")
      report("lancement de \(appName) depuis l'accueil: \(launched ? "oui" : "ÉCHEC")")
      return launched
    }

    // ── 1. « Ignorer » ──────────────────────────────────────────────────
    guard raiseShield("0", appName: appName) else {
      XCTFail("Icône \(appName) introuvable.")
      return
    }
    springboard.coordinate(withNormalizedOffset: secondary).tap()
    settle(5)
    addScreenshot(XCUIScreen.main.screenshot(), name: "41-apres-ignorer")
    report(
      "après « Ignorer » → app bloquée état \(blocked.state.rawValue), "
        + "Relock état \(relock.state.rawValue)")
    XCTAssertEqual(springboard.state, .runningForeground, "« Ignorer » doit rendre SpringBoard.")
    XCTAssertNotEqual(blocked.state, .runningForeground, "L'app protégée ne doit pas s'ouvrir.")
    XCTAssertNotEqual(relock.state, .runningForeground, "« Ignorer » ne doit pas ouvrir Relock.")

    // ── 2. « Ouvrir Relock » mène à Blocages, sans parcours automatique ──
    relock.terminate()
    guard raiseShield("2", appName: appName) else {
      XCTFail("Icône \(appName) introuvable.")
      return
    }
    springboard.coordinate(withNormalizedOffset: primary).tap()

    XCTAssertTrue(
      relock.wait(for: .runningForeground, timeout: 12),
      "« Ouvrir Relock » n'a pas activé l'app parentale.")
    settle(5)
    addScreenshot(XCUIScreen.main.screenshot(), name: "43-arrivee-relock")
    let blockedAppsTitle = relock.staticTexts["Apps bloquées"].firstMatch
    let arrivedOnBlocks = blockedAppsTitle.waitForExistence(timeout: 12)
    XCTAssertTrue(
      arrivedOnBlocks,
      "Relock s'est ouvert, mais pas directement sur la page Blocages.")
    guard arrivedOnBlocks else {
      addScreenshot(XCUIScreen.main.screenshot(), name: "43-mauvaise-destination")
      return
    }
    settle(2)
    XCTAssertFalse(
      relock.buttons.matching(identifier: "breathing-continue").firstMatch.exists,
      "Le parcours respiration ne doit plus s'ouvrir depuis le mur système.")
    XCTAssertFalse(
      relock.buttons.matching(identifier: "unlock-duration-confirm").firstMatch.exists,
      "Le sélecteur de durée ne doit plus s'ouvrir depuis le mur système.")
    addScreenshot(XCUIScreen.main.screenshot(), name: "43-blocages-sans-rituel")

    // La simple ouverture de Relock ne doit modifier aucune protection.
    guard raiseShield("4", appName: appName) else {
      XCTFail("Impossible de retenter \(appName) après l'ouverture de Relock.")
      return
    }
    // `blocked.state` n'est pas une preuve fiable ici : quand le mur est
    // affiché hors process, iOS 26 renvoie tantôt `.runningBackground`, tantôt
    // `.runningForeground` pour l'app qu'il recouvre. La capture constitue la
    // preuve visuelle et Relock ne doit en revanche plus être au premier plan.
    XCTAssertNotEqual(
      relock.state, .runningForeground,
      "Le second lancement de l'app protégée doit quitter Relock.")
    addScreenshot(XCUIScreen.main.screenshot(), name: "45-app-toujours-bloquee")
    springboard.coordinate(withNormalizedOffset: secondary).tap()
  }

  private func addScreenshot(_ screenshot: XCUIScreenshot, name: String) {
    let attachment = XCTAttachment(screenshot: screenshot)
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  /// Adresses IPv4 de l'appareil, interface par interface : `en0` absente ⇒
  /// l'iPhone n'est pas sur le Wi-Fi, `pdp_ip0` seule ⇒ il est en cellulaire.
  private func localAddresses() -> [String] {
    var out: [String] = []
    var head: UnsafeMutablePointer<ifaddrs>?
    guard getifaddrs(&head) == 0, let first = head else { return out }
    defer { freeifaddrs(head) }
    var cursor: UnsafeMutablePointer<ifaddrs>? = first
    while let entry = cursor {
      let flags = Int32(entry.pointee.ifa_flags)
      let family = entry.pointee.ifa_addr?.pointee.sa_family
      if (flags & IFF_UP) == IFF_UP, family == UInt8(AF_INET) {
        var host = [CChar](repeating: 0, count: Int(NI_MAXHOST))
        if getnameinfo(
          entry.pointee.ifa_addr,
          socklen_t(entry.pointee.ifa_addr.pointee.sa_len),
          &host, socklen_t(host.count), nil, 0, NI_NUMERICHOST) == 0
        {
          let name = String(cString: entry.pointee.ifa_name)
          out.append("\(name)=\(String(cString: host))")
        }
      }
      cursor = entry.pointee.ifa_next
    }
    return out
  }

  /// GET synchrone court : on veut un verdict, pas une session longue.
  private func probe(_ urlString: String, timeout: TimeInterval = 6) -> String {
    guard let url = URL(string: urlString) else { return "URL invalide" }
    let configuration = URLSessionConfiguration.ephemeral
    configuration.timeoutIntervalForRequest = timeout
    configuration.timeoutIntervalForResource = timeout
    configuration.waitsForConnectivity = false
    let session = URLSession(configuration: configuration)
    let finished = XCTestExpectation(description: "probe \(urlString)")
    var verdict = "aucune réponse"
    session.dataTask(with: url) { data, response, error in
      if let error {
        verdict = "ERREUR \((error as NSError).code) \(error.localizedDescription)"
      } else if let http = response as? HTTPURLResponse {
        let body = data.flatMap { String(data: $0, encoding: .utf8) } ?? ""
        verdict = "HTTP \(http.statusCode) — \(body.prefix(120))"
      }
      finished.fulfill()
    }.resume()
    _ = XCTWaiter.wait(for: [finished], timeout: timeout + 4)
    return verdict
  }

  /// Les alertes système (Réseau local, notifications…) appartiennent à
  /// SpringBoard, jamais à l'app testée : on les accepte là où elles vivent.
  @MainActor
  @discardableResult
  private func acceptSystemAlerts(rounds: Int = 4) -> [String] {
    let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
    let affirmatives = [
      "Autoriser", "Allow", "OK", "Autoriser une fois",
      "Toujours autoriser", "Continuer",
    ]
    var accepted: [String] = []
    for _ in 0..<rounds {
      let alert = springboard.alerts.firstMatch
      guard alert.waitForExistence(timeout: 3) else { break }
      let label = alert.staticTexts.firstMatch.label
      guard let button = affirmatives.map({ alert.buttons[$0] }).first(where: { $0.exists })
        ?? alert.buttons.allElementsBoundByIndex.last
      else { break }
      let title = button.label
      button.tap()
      accepted.append("\(title) ← \(label.prefix(70))")
    }
    return accepted
  }

  /// Après une réinstallation, expo-dev-client s'ouvre sur SON lanceur et
  /// attend qu'on désigne le serveur : l'app est bien lancée, mais le bundle
  /// Relock n'est pas chargé et le pont ne tourne pas. Le lanceur a lui aussi
  /// une barre d'onglets — s'y fier donnait un faux « chargé ».
  ///
  /// ⚠️ Ne JAMAIS taper « la première entrée qui contient 8081 » : le lanceur
  /// garde l'historique des serveurs, y compris ceux d'un ANCIEN réseau (vu
  /// ici : « http://192.168.40.36:8081 »). On ne touche donc que l'entrée de
  /// l'hôte courant ; à défaut, on saisit son URL à la main.
  @MainActor
  private func dismissDevLauncher(_ app: XCUIApplication) -> Bool {
    let url = "http://\(macHost):8081"

    // 1. L'entrée de l'hôte COURANT, si le lanceur la connaît déjà.
    //    ⚠️ Jamais « la première entrée qui contient 8081 » : « RECENTLY
    //    OPENED » garde les serveurs d'anciens réseaux (vu ici :
    //    « http://192.168.40.36:8081 »), et les toucher envoie l'app vers une
    //    adresse morte.
    let known = app.descendants(matching: .any).matching(
      NSPredicate(format: "label CONTAINS %@", macHost)
    ).firstMatch
    if known.exists {
      known.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
      report("dev-launcher: entrée « \(known.label.prefix(50)) » touchée")
      return true
    }

    // 2. Sinon, saisie manuelle. Le champ n'existe QU'APRÈS avoir déplié
    //    « Enter URL manually » — le chercher avant ne trouvait rien, et la
    //    découverte Bonjour ne remplace pas cette étape sur un Wi-Fi qui
    //    filtre le mDNS (« No development servers found »).
    let manual = app.descendants(matching: .any).matching(
      NSPredicate(format: "label CONTAINS[c] 'Enter URL manually'")
    ).firstMatch
    if manual.exists {
      manual.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    }

    let field = app.textFields.firstMatch
    guard field.waitForExistence(timeout: 5) else {
      report("dev-launcher: champ de saisie introuvable")
      return false
    }
    field.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
    // Le champ conserve l'URL d'une session précédente : on l'efface avant de
    // saisir, sinon les deux se concatènent en une adresse invalide.
    if let existing = field.value as? String, !existing.isEmpty,
      existing != "http://10.0.0.25:8081"
    {
      field.typeText(
        String(
          repeating: XCUIKeyboardKey.delete.rawValue, count: existing.count))
    }
    field.typeText(url)
    if let connect = ["Connect", "Connecter", "Se connecter", "Go", "OK"]
      .map({ app.buttons[$0] }).first(where: { $0.exists })
    {
      connect.tap()
    } else {
      app.typeText("\n")
    }
    report("dev-launcher: URL saisie à la main → \(url)")
    return true
  }

  /// Repère fiable d'un bundle RELOCK rendu — un texte que seule l'app
  /// affiche. La barre d'onglets ne suffit pas : le lanceur de développement
  /// en a une aussi.
  @MainActor
  private func waitForRelockUI(_ app: XCUIApplication, timeout: TimeInterval = 420)
    -> Bool
  {
    let deadline = Date().addingTimeInterval(timeout)
    var launcherHandled = false
    while Date() < deadline {
      if app.tabBars.buttons["Blocages"].exists { return true }
      // Substitution par argument : ces libellés contiennent des apostrophes,
      // qu'un format littéral ferait échouer au parsing de NSPredicate.
      let relockOnly = ["Temps d'écran aujourd'hui", "apps bloquées",
                        "Protection active", "Aucun blocage"]
      for needle in relockOnly {
        if app.staticTexts.matching(
          NSPredicate(format: "label CONTAINS[c] %@", needle)
        ).firstMatch.exists {
          return true
        }
      }
      if !launcherHandled, dismissDevLauncher(app) {
        launcherHandled = true
      }
      _ = XCTWaiter.wait(
        for: [XCTestExpectation(description: "attente")], timeout: 2)
    }
    return false
  }

  @MainActor
  func testDeviceCanReachDevelopmentMac() throws {
    report("iOS \(UIDevice.current.systemVersion) — \(UIDevice.current.model)")
    report("adresses locales: \(localAddresses().joined(separator: ", "))")
    report("hôte Mac visé: \(macHost)")

    // Ce processus est le RUNNER, pas Relock : il a sa propre autorisation
    // « Réseau local ». Une première requête déclenche la demande système,
    // qu'on accepte ; sans cette étape, toutes les sondes échouent en -1009
    // et le diagnostic accuse le réseau alors que seul le consentement
    // manquait.
    _ = probe("http://\(macHost):8123/relock-dev-commands.json", timeout: 2)
    let alerts = acceptSystemAlerts(rounds: 2)
    report("autorisation runner: \(alerts.isEmpty ? "aucune demande" : alerts.joined(separator: " | "))")

    let metro = probe("http://\(macHost):8081/status")
    let commands = probe("http://\(macHost):8123/relock-dev-commands.json")
    report("metro     → \(metro)")
    report("commandes → \(commands)")
    // -1009 sur une IP locale = autorisation « Réseau local » refusée, pas un
    // réseau en panne. Le dire ici évite de repartir sur une fausse piste.
    if metro.contains("-1009") {
      report(
        "⚠️ -1009 : le runner n'a pas l'autorisation « Réseau local » "
          + "(Réglages > Confidentialité > Réseau local). Ce verdict ne dit "
          + "RIEN de la connectivité de Relock elle-même.")
    }
  }

  /// Garde Relock ACTIVE et l'écran allumé pendant que le Mac lui envoie ses
  /// commandes de test. Sans ce maintien, l'iPhone se verrouille au bout de
  /// quelques dizaines de secondes et le pont s'éteint en silence.
  @MainActor
  func testHoldForegroundForBridgeCommands() throws {
    let app = XCUIApplication()
    // `RELOCK_ATTACH=1` : l'app a déjà été lancée par `devicectl` avec le
    // deep link `relock://expo-development-client/?url=…`, qui la connecte
    // directement au bon Metro. La relancer ici perdrait cette URL et
    // rouvrirait le lanceur ; on se contente donc de la ramener au premier
    // plan — c'est tout ce dont le pont a besoin pour rester vivant.
    if ProcessInfo.processInfo.environment["RELOCK_ATTACH"] == "1" {
      app.activate()
    } else {
      app.launch()
    }
    acceptSystemAlerts()

    let loaded = waitForRelockUI(app)
    // Quand ça rate, savoir CE QUI est affiché vaut mieux qu'un booléen : le
    // lanceur de développement, un écran d'erreur rouge et un vrai écran
    // Relock se distinguent au premier coup d'œil dans ce relevé.
    //
    // ⚠️ Relevé DÉFENSIF : si l'app n'est plus au premier plan au moment de
    // l'interroger, la requête d'accessibilité échoue en
    // `kAXErrorServerNotFound` et fait tomber tout le test — donc le pont
    // avec. Le maintien doit survivre à un état transitoire.
    if app.state == .runningForeground {
      let texts = app.staticTexts.allElementsBoundByIndex
        .prefix(30)
        .map { $0.label }
        .filter { !$0.isEmpty }
      report("textes visibles: \(texts.joined(separator: " ¦ "))")
    } else {
      report("relevé impossible : l'app est en état \(app.state.rawValue)")
    }
    report(
      loaded
        ? "interface Relock chargée — maintien \(Int(holdSeconds)) s"
        : "interface Relock ABSENTE — maintien \(Int(holdSeconds)) s quand même")
    XCTAssertTrue(
      loaded,
      "Relock n'a pas chargé son bundle depuis Metro : le pont restera muet.")
    addScreenshot(app.screenshot(), name: "01-accueil-au-lancement")

    // ⚠️ AUCUN geste sur l'interface pendant le maintien. Une première version
    // « touchait » le centre de l'écran toutes les dix secondes pour empêcher
    // la veille : sur la feuille « Nouveau blocage », ces touches ont fini par
    // CRÉER une vraie règle dans le compte de l'utilisateur. Un harnais de
    // test n'a pas le droit de modifier les données qu'il observe. La session
    // XCUITest suffit à garder l'appareil déverrouillé ; on se contente donc
    // de vérifier que l'app est toujours au premier plan, et de l'y ramener.
    let started = Date()
    var round = 0
    while Date().timeIntervalSince(started) < holdSeconds {
      _ = XCTWaiter.wait(
        for: [XCTestExpectation(description: "maintien")], timeout: 10)
      round += 1
      if app.state != .runningForeground {
        app.activate()
        report("tour \(round): l'app avait quitté le premier plan — réactivée")
      }
    }
    addScreenshot(app.screenshot(), name: "02-accueil-fin-de-maintien")
    XCTAssertEqual(
      app.state, .runningForeground,
      "Relock doit être restée au premier plan pendant toute la session.")
  }
}
