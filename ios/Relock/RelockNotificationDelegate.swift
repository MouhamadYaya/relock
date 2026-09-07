import Foundation
import UserNotifications
import os

/// Réception des notifications locales de Relock.
///
/// ⚠️ Ce délégué DOIT être installé dans `didFinishLaunchingWithOptions`, avant
/// que React Native ne soit prêt. Un tap sur une notification démarre l'app À
/// FROID : si le délégué est posé plus tard (depuis JS, ou dans un `didBecome
/// Active`), iOS a déjà livré la réponse à personne et l'information est perdue
/// sans recours — l'utilisateur atterrit sur l'accueil au lieu de l'écran promis
/// par la notification qu'il vient de toucher.
///
/// La réponse est donc écrite sur disque (App Group) plutôt que poussée vers JS :
/// même pattern que `ShieldAttemptStore`, pour la même raison. JS la consomme de
/// façon destructive dès qu'il est vivant (`consumeNotifResponse`).
@objc(RelockNotificationDelegate)
final class RelockNotificationDelegate: NSObject, UNUserNotificationCenterDelegate {

  @objc static let shared = RelockNotificationDelegate()

  static let suite = "group.com.yaya.relock"
  /// File des réponses non encore consommées par JS.
  static let queueKey = "notif.responses"
  /// Au-delà, on jette les plus anciennes : une file qui grossit sans lecteur
  /// est une fuite, et une réponse vieille de dix notifications n'a plus de sens.
  private static let maxQueued = 8

  private static let log = Logger(subsystem: "com.yaya.relock", category: "notifications")

  private var defaults: UserDefaults? { UserDefaults(suiteName: RelockNotificationDelegate.suite) }

  /// Installe le délégué. Idempotent.
  @objc func install() {
    UNUserNotificationCenter.current().delegate = self
  }

  // MARK: - UNUserNotificationCenterDelegate

  /// Notification reçue alors que Relock est au premier plan.
  ///
  /// On l'affiche quand même : le moteur ne planifie une notification QUE
  /// lorsqu'il a jugé l'utilisateur absent. S'il est revenu entre-temps, la
  /// bannière reste la trace honnête d'un message qui lui était destiné —
  /// l'escamoter reviendrait à perdre l'information sans que personne ne le sache.
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    completionHandler([.banner, .list, .sound])
  }

  /// L'utilisateur a touché la notification (ou une de ses actions).
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    enqueue(response)
    completionHandler()
  }

  // MARK: - File partagée

  private func enqueue(_ response: UNNotificationResponse) {
    let request = response.notification.request
    var entry: [String: Any] = [
      "id": request.identifier,
      "actionIdentifier": response.actionIdentifier,
      "respondedAt": Date().timeIntervalSince1970,
    ]
    // `userInfo` est la charge utile posée par `scheduleNotif` : c'est elle qui
    // porte la destination. Sans elle, on sait qu'on a été touché mais pas où aller.
    if let payload = request.content.userInfo["relock"] {
      entry["payload"] = payload
    }

    guard let defaults else {
      Self.log.error("réponse de notification perdue : App Group indisponible")
      return
    }
    var queue = (defaults.array(forKey: Self.queueKey) as? [[String: Any]]) ?? []
    queue.append(entry)
    if queue.count > Self.maxQueued {
      queue.removeFirst(queue.count - Self.maxQueued)
    }
    defaults.set(queue, forKey: Self.queueKey)

    let node = (entry["payload"] as? [String: Any])?["n"] as? String ?? "?"
    Self.log.notice("notification touchée node=\(node, privacy: .public)")
  }

  /// Lecture DESTRUCTIVE de la file, pour JS.
  @objc func drainResponses() -> [[String: Any]] {
    guard let defaults else { return [] }
    let queue = (defaults.array(forKey: Self.queueKey) as? [[String: Any]]) ?? []
    if !queue.isEmpty { defaults.removeObject(forKey: Self.queueKey) }
    return queue
  }
}
