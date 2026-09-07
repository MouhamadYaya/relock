import Foundation
import ManagedSettings
import UserNotifications
import os

/// Gère les deux actions du mur Relock : ouvrir l'app parentale avec le
/// contexte exact, ou fermer l'app bloquée sans modifier les protections.
final class RelockShieldAction: ShieldActionDelegate {

  private static let suite = "group.com.yaya.relock"
  private static let log = Logger(
    subsystem: "com.yaya.relock", category: "shieldaction")

  private let defaults = UserDefaults(suiteName: RelockShieldAction.suite)
  private let attempts = ShieldAttemptStore.production()

  /// Notifie la première victoire et les paliers, sans réveiller Relock.
  private func celebrate(total: Int) {
    if let on = defaults?.object(forKey: "notif.celebrationsEnabled") as? Bool,
      on == false
    {
      return
    }
    let hour = Calendar.current.component(.hour, from: Date())
    if hour >= 22 || hour < 8 { return }

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
    let request = UNNotificationRequest(
      identifier: "relock.celebrate.\(total)",
      content: content,
      trigger: UNTimeIntervalNotificationTrigger(timeInterval: 1, repeats: false))
    UNUserNotificationCenter.current().add(request)
  }

  private func respond(
    _ action: ShieldAction,
    applicationKey: String?,
    categoryKey: String?,
    _ completion: (ShieldActionResponse) -> Void
  ) {
    let response: ShieldActionResponse
    let opensRelock: Bool
    switch action {
    case .primaryButtonPressed:
      if #available(iOS 26.5, *) {
        response = .openParentalControlsApp
        opensRelock = true
      } else {
        response = .close
        opensRelock = false
      }
    case .secondaryButtonPressed:
      response = .close
      opensRelock = false
    default:
      response = .close
      opensRelock = false
    }

    // Cette écriture atomique doit précéder l'ouverture : Relock peut démarrer
    // à froid dès le rappel du completion handler. Le store borne son attente
    // du verrou à ~50 ms, afin qu'aucun autre processus ne fige le bouton ;
    // au-delà il renonce à écrire (`nil`) plutôt que d'écraser l'état d'un
    // autre processus, et l'action répond quand même.
    let queuedRequest = opensRelock
      ? attempts?.enqueueOpenRequest(
        applicationKey: applicationKey,
        categoryKey: categoryKey)
      : nil

    let actionName = String(describing: action)
    let hasApplication = applicationKey != nil
    let hasCategory = categoryKey != nil
    let requestQueued = queuedRequest != nil
    Self.log.notice(
      "action=\(actionName, privacy: .public) app=\(hasApplication) category=\(hasCategory) queued=\(requestQueued)")

    let requestStatus: String
    let responseName: String
    switch action {
    case .primaryButtonPressed:
      requestStatus = queuedRequest == nil ? "write-failed" : "queued"
      responseName = opensRelock ? "openParentalControlsApp" : "close-unsupported-os"
    case .secondaryButtonPressed:
      requestStatus = "ignored"
      responseName = "close"
    default:
      requestStatus = "other"
      responseName = "close"
    }

    let resisted = action == .secondaryButtonPressed
    // `nil` = rien n'a été persisté (verrou indisponible) : on ne fête pas un
    // palier qui n'existe pas sur disque.
    let total = attempts?.recordAction(
      requestStatus: requestStatus,
      response: responseName,
      resisted: resisted) ?? 0

    // Toutes les données indispensables sont désormais sur disque. Répondre
    // seulement maintenant évite qu'iOS suspende l'extension entre l'action
    // utilisateur et l'écriture de la preuve/contexte partagé.
    completion(response)

    if resisted { celebrate(total: total) }
  }

  override func handle(
    action: ShieldAction,
    for application: ApplicationToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    respond(
      action,
      applicationKey: ShieldAttemptStore.tokenKey(application),
      categoryKey: nil,
      completionHandler)
  }

  override func handle(
    action: ShieldAction,
    for webDomain: WebDomainToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    respond(
      action,
      applicationKey: ShieldAttemptStore.tokenKey(webDomain),
      categoryKey: nil,
      completionHandler)
  }

  override func handle(
    action: ShieldAction,
    for category: ActivityCategoryToken,
    completionHandler: @escaping (ShieldActionResponse) -> Void
  ) {
    respond(
      action,
      applicationKey: nil,
      categoryKey: ShieldAttemptStore.tokenKey(category),
      completionHandler)
  }
}
