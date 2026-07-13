import Foundation
import ManagedSettings
import ManagedSettingsUI

/// Gère les boutons de l'écran de blocage Relock.
/// « Fermer » = ferme l'app bloquée ET enregistre une « résistance » (chaque
/// fois que l'utilisateur bute sur le blocage et renonce) → alimente les stats
/// réelles de l'Accueil. C'est le proxy le plus fiable des « ouvertures
/// résistées » (iOS ne fournit pas le nombre d'ouvertures d'app).
class RelockShieldAction: ShieldActionDelegate {

  private let defaults = UserDefaults(suiteName: "group.com.yaya.relock")

  private func logResisted() {
    guard let d = defaults else { return }
    var log = d.array(forKey: "eventLog") as? [[String: Any]] ?? []
    log.append([
      "kind": "resisted",
      "activity": "shield",
      "at": ISO8601DateFormatter().string(from: Date()),
    ])
    if log.count > 200 { log.removeFirst(log.count - 200) }
    d.set(log, forKey: "eventLog")
  }

  private func respond(
    _ action: ShieldAction, _ completion: (ShieldActionResponse) -> Void
  ) {
    switch action {
    case .primaryButtonPressed:
      logResisted()
      completion(.close)
    case .secondaryButtonPressed:
      completion(.defer)
    @unknown default:
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
