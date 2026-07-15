import Foundation
import ManagedSettings
import ManagedSettingsUI
import UserNotifications
import os

/// Gère les boutons de l'écran de blocage Relock.
/// « Fermer » = ferme l'app bloquée ET enregistre une « résistance » (chaque
/// fois que l'utilisateur bute sur le blocage et renonce) → alimente les stats
/// réelles de l'Accueil. C'est le proxy le plus fiable des « ouvertures
/// résistées » (iOS ne fournit pas le nombre d'ouvertures d'app).
class RelockShieldAction: ShieldActionDelegate {

  private static let suite = "group.com.yaya.relock"
  private static let log = Logger(
    subsystem: "com.yaya.relock", category: "shieldaction")
  private let defaults = UserDefaults(suiteName: RelockShieldAction.suite)

  /// Verrou inter-processus sur le conteneur App Group — sérialise les
  /// read-modify-write du journal avec le moniteur et l'app. ⚠️ Miroir de
  /// `RelockMonitor.withGroupLock` / `BlocusScreenTime` — garder en phase.
  private static func withGroupLock<T>(_ body: () -> T) -> T {
    guard
      let dir = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: suite)
    else { return body() }
    let fd = open(dir.appendingPathComponent(".relock.lock").path,
                  O_CREAT | O_WRONLY, 0o644)
    guard fd >= 0 else { return body() }
    flock(fd, LOCK_EX)
    defer {
      flock(fd, LOCK_UN)
      close(fd)
    }
    return body()
  }

  private func logResisted() {
    guard let d = defaults else {
      Self.log.error("logResisted: App Group defaults NIL — écriture perdue")
      return
    }
    var total = 0
    Self.withGroupLock {
      var log = d.array(forKey: "eventLog") as? [[String: Any]] ?? []
      log.append([
        "kind": "resisted",
        "activity": "shield",
        "at": ISO8601DateFormatter().string(from: Date()),
      ])
      if log.count > 200 { log.removeFirst(log.count - 200) }
      d.set(log, forKey: "eventLog")

      // Compteur total de résistances → célébrations temps réel (l'app est
      // fermée quand ça arrive, donc c'est ici, pas côté JS).
      total = d.integer(forKey: "totalResisted") + 1
      d.set(total, forKey: "totalResisted")
      // Extension ÉPHÉMÈRE : iOS peut suspendre/tuer le process juste après
      // completion(.close). Sans flush synchrone, l'écriture (event + compteur)
      // peut ne jamais atteindre le conteneur partagé → journal vide côté app.
      d.synchronize()
      Self.log.info(
        "logResisted OK — eventLog=\(log.count, privacy: .public) total=\(total, privacy: .public)"
      )
    }
    celebrate(total: total)
  }

  /// Notifie la 1ʳᵉ victoire et les paliers — ton bienveillant et sobre. Respecte
  /// le toggle « progression » (App Group) et les heures calmes (22h–8h).
  private func celebrate(total: Int) {
    // Toggle absent = activé par défaut (célébrations ON tant que non désactivé).
    if let on = defaults?.object(forKey: "notif.celebrationsEnabled") as? Bool,
      on == false
    {
      return
    }
    let h = Calendar.current.component(.hour, from: Date())
    if h >= 22 || h < 8 { return }  // heures calmes

    let title: String
    let body: String
    if total == 1 {
      title = "Première victoire"
      body =
        "Tu viens de résister. C'est exactement comme ça qu'on reprend le contrôle."
    } else if [10, 50, 100, 250, 500, 1000].contains(total) {
      title = "\(total) résistances"
      body = "\(total) fois où tu as choisi ton temps plutôt que le scroll. Continue."
    } else {
      return
    }

    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.sound = .default
    let req = UNNotificationRequest(
      identifier: "relock.celebrate.\(total)", content: content,
      trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false))
    UNUserNotificationCenter.current().add(req)
  }

  private func respond(
    _ action: ShieldAction, _ completion: (ShieldActionResponse) -> Void
  ) {
    // Trace de vie (lisible depuis le diagnostic de l'app) : prouve que
    // l'extension d'action est bien invoquée quand un bouton est tapé.
    defaults?.set(Date().timeIntervalSince1970, forKey: "shield.lastActionAt")
    defaults?.synchronize()
    switch action {
    case .primaryButtonPressed:
      Self.log.info("handle: primaryButtonPressed (Fermer) → logResisted")
      logResisted()
      completion(.close)
    case .secondaryButtonPressed:
      Self.log.info("handle: secondaryButtonPressed → defer")
      completion(.defer)
    case .firstSecondarySubmenuItemPressed, .secondSecondarySubmenuItemPressed,
      .thirdSecondarySubmenuItemPressed:
      // iOS 26 : sous-menu du bouton secondaire — notre bouclier n'en a pas,
      // mais on répond proprement si iOS l'invoque.
      Self.log.info("handle: sous-menu secondaire → close")
      completion(.close)
    @unknown default:
      Self.log.info("handle: action inconnue → close")
      completion(.close)
    }
  }

  override func handle(
    action: ShieldAction, for application: ApplicationToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    respond(action, completionHandler)
  }

  override func handle(
    action: ShieldAction, for webDomain: WebDomainToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    respond(action, completionHandler)
  }

  override func handle(
    action: ShieldAction, for category: ActivityCategoryToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    respond(action, completionHandler)
  }
}
