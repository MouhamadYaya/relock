import XCTest
import UIKit

final class ActivityPhysicalScrollTests: XCTestCase {
  override func setUpWithError() throws {
    continueAfterFailure = false
  }

  private func addScreenshot(_ screenshot: XCUIScreenshot, name: String) {
    let attachment = XCTAttachment(screenshot: screenshot)
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }

  /// `isHittable` est parfois faux pour une UIView locale placée au-dessus
  /// d'une surface `DeviceActivityReport`, même avec une frame visible. Un
  /// doigt touche une coordonnée; le test reproduit donc ce geste directement.
  @MainActor
  private func tapCenter(of element: XCUIElement) {
    element.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
  }

  /// Les frames d'accessibilité d'une extension `DeviceActivityReport`
  /// restent parfois figées après un geste, même lorsque son rendu distant a
  /// réellement défilé. On compare donc une miniature de la zone de contenu
  /// (hors barre d'onglets) : un vrai défilement déplace des milliers de
  /// pixels, contrairement au bruit de capture.
  private func contentDifference(
    before: XCUIScreenshot,
    after: XCUIScreenshot
  ) -> Double {
    guard
      let first = UIImage(data: before.pngRepresentation)?.cgImage,
      let second = UIImage(data: after.pngRepresentation)?.cgImage
    else { return 0 }

    func sample(_ image: CGImage) -> [UInt8] {
      let width = 64
      let height = 96
      let source = CGRect(
        x: 0,
        y: CGFloat(image.height) * 0.06,
        width: CGFloat(image.width),
        height: CGFloat(image.height) * 0.76).integral
      guard let cropped = image.cropping(to: source) else { return [] }
      var bytes = [UInt8](repeating: 0, count: width * height * 4)
      bytes.withUnsafeMutableBytes { buffer in
        guard
          let context = CGContext(
            data: buffer.baseAddress,
            width: width,
            height: height,
            bitsPerComponent: 8,
            bytesPerRow: width * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)
        else { return }
        context.interpolationQuality = .low
        context.draw(cropped, in: CGRect(x: 0, y: 0, width: width, height: height))
      }
      return bytes
    }

    let a = sample(first)
    let b = sample(second)
    guard a.count == b.count, !a.isEmpty else { return 0 }
    var total = 0
    for index in stride(from: 0, to: a.count, by: 4) {
      total += abs(Int(a[index]) - Int(b[index]))
      total += abs(Int(a[index + 1]) - Int(b[index + 1]))
      total += abs(Int(a[index + 2]) - Int(b[index + 2]))
    }
    return Double(total) / Double((a.count / 4) * 3 * 255)
  }

  /// Largeur du contenu visible dans une tuile, hors bordure. Le cadenas seul
  /// occupe environ 40 % de la largeur; l'icône agrandie dépasse 70 %. Cette
  /// mesure fait donc échouer le test si Family Controls retombe à son rendu
  /// natif de ~24 pt au centre de la tuile de 72 pt.
  private func foregroundWidthRatio(
    of element: XCUIElement,
    in app: XCUIApplication,
    screenshot: XCUIScreenshot
  ) -> CGFloat {
    guard
      let image = UIImage(data: screenshot.pngRepresentation)?.cgImage,
      app.frame.width > 0,
      app.frame.height > 0
    else { return 0 }

    let scaleX = CGFloat(image.width) / app.frame.width
    let scaleY = CGFloat(image.height) / app.frame.height
    let frame = element.frame
    let pixelRect = CGRect(
      x: frame.minX * scaleX,
      y: frame.minY * scaleY,
      width: frame.width * scaleX,
      height: frame.height * scaleY).integral.intersection(
        CGRect(
          x: 0, y: 0,
          width: CGFloat(image.width), height: CGFloat(image.height)))
    guard let cropped = image.cropping(to: pixelRect),
      cropped.width > 0, cropped.height > 0
    else { return 0 }

    let bytesPerPixel = 4
    let bytesPerRow = cropped.width * bytesPerPixel
    var pixels = [UInt8](repeating: 0, count: cropped.height * bytesPerRow)
    let rendered = pixels.withUnsafeMutableBytes { buffer -> Bool in
      guard let context = CGContext(
        data: buffer.baseAddress,
        width: cropped.width,
        height: cropped.height,
        bitsPerComponent: 8,
        bytesPerRow: bytesPerRow,
        space: CGColorSpaceCreateDeviceRGB(),
        bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
          | CGBitmapInfo.byteOrder32Big.rawValue)
      else { return false }
      context.draw(
        cropped,
        in: CGRect(x: 0, y: 0, width: cropped.width, height: cropped.height))
      return true
    }
    guard rendered else { return 0 }

    let cornerInset = max(2, Int(min(scaleX, scaleY) * 2))
    let corners = [
      (cornerInset, cornerInset),
      (cropped.width - cornerInset - 1, cornerInset),
      (cornerInset, cropped.height - cornerInset - 1),
      (cropped.width - cornerInset - 1, cropped.height - cornerInset - 1),
    ]
    func channel(_ point: (Int, Int), _ index: Int) -> Int {
      Int(pixels[point.1 * bytesPerRow + point.0 * bytesPerPixel + index])
    }
    let background = (0..<3).map { index in
      corners.map { channel($0, index) }.sorted()[corners.count / 2]
    }

    let scanInset = max(2, Int(min(scaleX, scaleY) * 5))
    var minX = cropped.width
    var maxX = -1
    for y in scanInset..<(cropped.height - scanInset) {
      for x in scanInset..<(cropped.width - scanInset) {
        let offset = y * bytesPerRow + x * bytesPerPixel
        let distance = (0..<3).map {
          abs(Int(pixels[offset + $0]) - background[$0])
        }.max() ?? 0
        guard distance > 40 else { continue }
        minX = min(minX, x)
        maxX = max(maxX, x)
      }
    }
    guard maxX >= minX else { return 0 }
    return CGFloat(maxX - minX + 1) / CGFloat(cropped.width)
  }

  @MainActor
  private func openActivity(in app: XCUIApplication) {
    let title = app.descendants(matching: .any)["activity-native-title"].firstMatch
    let activityTab = app.buttons["Activité"].firstMatch
    if !title.waitForExistence(timeout: 3) {
      if activityTab.waitForExistence(timeout: 5), activityTab.isHittable {
        activityTab.tap()
      } else {
        let tabBar = app.tabBars.firstMatch
        let thirdTab = tabBar.exists
          ? tabBar.coordinate(withNormalizedOffset: CGVector(dx: 0.72, dy: 0.50))
          : app.coordinate(withNormalizedOffset: CGVector(dx: 0.72, dy: 0.95))
        thirdTab.tap()
      }
    }
    XCTAssertTrue(
      title.waitForExistence(timeout: 30),
      "Le titre SwiftUI du vrai rapport Activité ne s'est pas affiché.")

    XCTAssertFalse(
      app.staticTexts["Mois"].exists,
      "La barre de période ne doit plus afficher « Mois ».")
    XCTAssertFalse(
      app.staticTexts["Semaine"].exists,
      "La barre de période ne doit plus afficher « Semaine ».")
    XCTAssertFalse(
      app.staticTexts["Jour"].exists,
      "La barre de période ne doit plus afficher « Jour ».")
  }

  @MainActor
  private func openBlocages(in app: XCUIApplication) {
    // La navigation restaurée peut rouvrir la fiche d'un preset au-dessus des
    // onglets. Sa hiérarchie laisse les éléments de l'écran précédent
    // accessibles, donc `Débloquer.exists` seul donnerait un faux positif.
    for _ in 0..<3 {
      let dismissPreset = app.descendants(matching: .any)["Pas maintenant"].firstMatch
      guard dismissPreset.waitForExistence(timeout: 0.5) else { break }
      tapCenter(of: dismissPreset)
    }

    let title = app.staticTexts["Apps bloquées"].firstMatch
    let blockedApp = app.buttons["Débloquer"].firstMatch
    let blockingTab = app.buttons["Blocages"].firstMatch
    if !title.waitForExistence(timeout: 3) {
      if blockingTab.waitForExistence(timeout: 5), blockingTab.isHittable {
        blockingTab.tap()
      } else {
        let tabBar = app.tabBars.firstMatch
        let secondTab = tabBar.exists
          ? tabBar.coordinate(withNormalizedOffset: CGVector(dx: 0.50, dy: 0.50))
          : app.coordinate(withNormalizedOffset: CGVector(dx: 0.50, dy: 0.95))
        secondTab.tap()
      }
    }
    XCTAssertTrue(
      title.waitForExistence(timeout: 30),
      "La page Blocages doit être visible avant de contrôler ses icônes.")
    XCTAssertTrue(
      blockedApp.waitForExistence(timeout: 30),
      "Une vraie app bloquée est nécessaire pour vérifier son icône Family Controls.")
  }

  @MainActor
  func testBlockedAppIconFillsLargeTileOnPhysicalDevice() throws {
    let app = XCUIApplication()
    app.launchArguments.append("--relock-blocked-icons-ui-test")
    app.launch()
    openBlocages(in: app)

    let blockedApp = app.buttons["Débloquer"].firstMatch
    XCTAssertGreaterThanOrEqual(
      blockedApp.frame.width,
      68,
      "La tuile Apps bloquées doit conserver sa largeur visuelle de 68 pt.")
    XCTAssertGreaterThanOrEqual(
      blockedApp.frame.height,
      68,
      "La tuile Apps bloquées doit conserver sa hauteur visuelle de 68 pt.")

    let iconResolved = XCTestExpectation(description: "Résolution de l'icône via Family Controls")
    DispatchQueue.main.asyncAfter(deadline: .now() + 3) {
      iconResolved.fulfill()
    }
    wait(for: [iconResolved], timeout: 4)
    let screenshot = app.screenshot()
    XCTAssertGreaterThanOrEqual(
      foregroundWidthRatio(of: blockedApp, in: app, screenshot: screenshot),
      0.70,
      "L'icône réelle doit remplir la grande tuile, pas rester à ~24 pt.")
    addScreenshot(screenshot, name: "apps-bloquees-icones-pleine-tuile")
  }

  /// Parcours réversible sur un vrai jeton Family Controls : l'app choisie
  /// est ouverte cinq minutes, puis immédiatement remise sous bouclier. Ce
  /// test couvre ce que le simulateur ne peut pas reproduire (icône native,
  /// ManagedSettings et état de sursis réellement partagé avec les extensions).
  @MainActor
  func testUnlockBreathingDurationAndReblockFlowOnPhysicalDevice() throws {
    XCUIDevice.shared.orientation = .portrait
    let app = XCUIApplication()
    // Rend les jetons déjà sélectionnés disponibles au test même entre deux
    // plages horaires, sans démarrer ni modifier une règle utilisateur.
    app.launchArguments.append("--relock-blocked-icons-ui-test")
    app.launch()
    openBlocages(in: app)

    let unlock = app.buttons["Débloquer"].firstMatch
    tapCenter(of: unlock)

    let continueButton = app.buttons["breathing-continue"].firstMatch
    XCTAssertTrue(
      continueButton.waitForExistence(timeout: 10),
      "La pause de respiration doit apparaître après avoir choisi une app.")
    XCTAssertFalse(
      continueButton.isEnabled,
      "Continuer doit rester désactivé pendant les six secondes de respiration.")
    XCTAssertTrue(
      app.staticTexts["Une respiration avant de décider. Ce moment t’appartient."]
        .firstMatch.exists,
      "Le message de respiration doit être lisible sur le téléphone.")
    addScreenshot(app.screenshot(), name: "deblocage-respiration-attente")

    let breathingFinished = XCTNSPredicateExpectation(
      predicate: NSPredicate(format: "enabled == true"), object: continueButton)
    XCTAssertEqual(
      XCTWaiter.wait(for: [breathingFinished], timeout: 10),
      .completed,
      "Le bouton Continuer doit s'activer après six secondes.")
    XCTAssertEqual(
      continueButton.label,
      "Continuer",
      "Le décompte doit être remplacé par Continuer.")
    tapCenter(of: continueButton)

    XCTAssertTrue(
      app.staticTexts["Pendant…"].firstMatch.waitForExistence(timeout: 10),
      "Le choix de durée plein écran doit suivre la respiration.")
    XCTAssertTrue(
      app.staticTexts["Choisis entre 5 et 30 minutes."].firstMatch.exists,
      "La limite maximale de trente minutes doit être annoncée.")
    XCTAssertTrue(
      app.buttons["5 min"].firstMatch.exists,
      "La roue doit afficher la durée minimale de cinq minutes par défaut.")
    let fiveMinutes = app.buttons["unlock-duration-confirm"].firstMatch
    XCTAssertTrue(
      fiveMinutes.waitForExistence(timeout: 5),
      "La durée minimale de cinq minutes doit être proposée par défaut.")
    addScreenshot(app.screenshot(), name: "deblocage-duree-5-a-30-minutes")
    tapCenter(of: fiveMinutes)

    let reblock = app.buttons["Rebloquer"].firstMatch
    XCTAssertTrue(
      reblock.waitForExistence(timeout: 15),
      "La tuile doit passer à l'état déverrouillé après le sursis natif.")
    addScreenshot(app.screenshot(), name: "application-temporairement-debloquee")
    tapCenter(of: reblock)

    let reblockConfirm = app.buttons["reblock-confirm"].firstMatch
    XCTAssertTrue(
      reblockConfirm.waitForExistence(timeout: 10),
      "Toucher une app ouverte doit afficher sa feuille de rebloquage.")
    XCTAssertTrue(
      app.staticTexts["Protections concernées"].firstMatch.exists,
      "La feuille doit montrer les règles qui protégeaient l'app.")
    addScreenshot(app.screenshot(), name: "confirmation-rebloquage-et-regles")
    tapCenter(of: reblockConfirm)

    XCTAssertTrue(
      unlock.waitForExistence(timeout: 15),
      "Après confirmation, la même app doit revenir à l'état bloqué.")
    let reblockFinished = XCTNSPredicateExpectation(
      predicate: NSPredicate(format: "exists == false"), object: reblock)
    XCTAssertEqual(
      XCTWaiter.wait(for: [reblockFinished], timeout: 5),
      .completed,
      "Aucun sursis ne doit rester actif après le rebloquage final.")
    addScreenshot(app.screenshot(), name: "application-rebloquee")
  }

  @MainActor
  func testPeriodSelectorIsRemovedAndDaysMoveUp() throws {
    let app = XCUIApplication()
    app.launch()
    openActivity(in: app)

    let title = app.descendants(matching: .any)["activity-native-title"].firstMatch
    let firstDay = app.descendants(matching: .any)["activity-native-day-6"].firstMatch
    XCTAssertTrue(firstDay.waitForExistence(timeout: 10), "Les sept jours doivent rester visibles.")
    XCTAssertLessThan(
      firstDay.frame.minY - title.frame.maxY,
      48,
      "Les jours doivent remonter directement sous l'en-tête après la suppression de la barre.")
  }

  @MainActor
  func testNativeDaySelectorAndHeaderButtonsWorkOnPhysicalReport() throws {
    let app = XCUIApplication()
    app.launch()
    openActivity(in: app)

    let apps = app.descendants(matching: .any)["activity-native-apps"].firstMatch
    XCTAssertTrue(
      apps.waitForExistence(timeout: 30),
      "Le rapport natif doit être chargé avant de tester les contrôles.")

    let refresh = app.descendants(matching: .any)["activity-native-refresh"].firstMatch
    XCTAssertTrue(refresh.waitForExistence(timeout: 10), "Le bouton Rafraîchir est absent.")
    tapCenter(of: refresh)

    let refreshAcknowledged = XCTNSPredicateExpectation(
      predicate: NSPredicate(format: "value BEGINSWITH 'Actualisé'"), object: refresh)
    XCTAssertEqual(
      XCTWaiter.wait(for: [refreshAcknowledged], timeout: 3),
      .completed,
      "Rafraîchir doit confirmer immédiatement la resynchronisation.")
    XCTAssertTrue(
      apps.exists,
      "Rafraîchir doit préserver le rapport natif déjà chargé.")

    let yesterday = app.descendants(matching: .any)["activity-native-day-1"].firstMatch
    XCTAssertTrue(yesterday.waitForExistence(timeout: 10), "Le jour précédent est absent.")
    tapCenter(of: yesterday)

    let daySelected = XCTNSPredicateExpectation(
      predicate: NSPredicate(format: "selected == true"), object: yesterday)
    XCTAssertEqual(
      XCTWaiter.wait(for: [daySelected], timeout: 10),
      .completed,
      "L'appui sur un jour doit le sélectionner et reconstruire le rapport journalier.")
    addScreenshot(app.screenshot(), name: "rapport-journalier-apres-selection")

    let settings = app.descendants(matching: .any)["activity-native-settings"].firstMatch
    XCTAssertTrue(settings.waitForExistence(timeout: 10), "Le bouton Réglages est absent.")
    tapCenter(of: settings)
    XCTAssertTrue(
      app.staticTexts["Préférences"].firstMatch.waitForExistence(timeout: 15),
      "Le bouton Réglages doit ouvrir l'écran des réglages Relock.")
  }

  @MainActor
  func testDragInsideLoadedDeviceActivityReportScrollsTheUnifiedPage() throws {
    let app = XCUIApplication()
    app.launch()

    openActivity(in: app)

    // Ces identifiants appartiennent à la vue SwiftUI de l'extension, pas au
    // squelette React Native. Leur présence prouve que le vrai rapport distant
    // a fini de charger avant le geste.
    let apps = app.descendants(matching: .any)["activity-native-apps"].firstMatch
    XCTAssertTrue(
      apps.waitForExistence(timeout: 30),
      "La liste native d'apps ne s'est pas affichée.")

    let before = app.screenshot()
    addScreenshot(before, name: "avant-glissement-rapport")

    // Le geste commence explicitement DANS la liste rendue hors process. Avec
    // l'ancienne architecture, ce point de départ figeait le ScrollView RN.
    let start = apps.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.65))
    let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.22))
    start.press(forDuration: 0.05, thenDragTo: end)

    let scrollSettled = XCTWaiter.wait(
      for: [XCTestExpectation(description: "Stabilisation du défilement")],
      timeout: 2)
    XCTAssertEqual(scrollSettled, .timedOut)
    let after = app.screenshot()
    addScreenshot(after, name: "apres-glissement-rapport")

    let difference = contentDifference(before: before, after: after)
    XCTAssertGreaterThan(
      difference,
      0.015,
      "Un glissement commencé dans le rapport doit déplacer visuellement toute la page "
        + "Activité. Différence normalisée observée: \(difference).")
  }
}
