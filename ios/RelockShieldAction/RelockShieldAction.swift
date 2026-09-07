import Foundation
import ManagedSettings
import UserNotifications
import os

/// Gère les deux actions du mur Relock : ouvrir l'app parentale avec le
/// contexte exact, ou fermer l'app bloquée sans modifier les protections.
final class RelockShieldAction: ShieldActionDelegate {

  /// Démarre sentry-cocoa dès l'instanciation par iOS : c'est le premier
  /// instant où ce processus existe, et donc le seul endroit d'où un crash
  /// survenant plus loin puisse être capté. Muet tant que l'app n'a pas
  /// publié le DSN dans le groupe d'app (voir `ExtensionSentry`).
  override init() {
    super.init()
    ExtensionSentry.startIfNeeded(source: "action")
  }

  private static let suite = "group.com.yaya.relock"
  private static let log = Logger(
    subsystem: "com.yaya.relock", category: "shieldaction")

  private let defaults = UserDefaults(suiteName: RelockShieldAction.suite)
  private let attempts = ShieldAttemptStore.production()

  /// Textes des célébrations, déposés TRADUITS par l'app dans le groupe d'app.
  ///
  /// Cette extension ne peut pas charger i18next : elle écrivait donc du
  /// français codé en dur, quelle que soit la langue de l'utilisateur — un
  /// russophone recevait ses félicitations en français. L'app republie ces
  /// textes à chaque passage du moteur, donc à chaque changement de langue.
  /// Le repli français ne sert que le cas où l'app n'a pas encore tourné une
  /// seule fois depuis la mise à jour.
  private func celebrationCopy() -> [String: String] {
    guard let data = defaults?.data(forKey: "notif.celebrationCopy"),
      let parsed = try? JSONSerialization.jsonObject(with: data) as? [String: String]
    else { return [:] }
    return parsed
  }

  /// Notifie la première victoire et les paliers, sans réveiller Relock.
  private func celebrate(total: Int) {
    if let on = defaults?.object(forKey: "notif.celebrationsEnabled") as? Bool,
      on == false
    {
      return
    }
    // Fenêtre de silence. Volontairement en dur ici : l'extension doit pouvoir
    // décider seule, sans dépendre d'une préférence que l'app n'aurait pas
    // encore publiée. Le moteur applique la fenêtre choisie par l'utilisateur
    // pour tout ce qu'il planifie lui-même.
    let hour = Calendar.current.component(.hour, from: Date())
    if hour >= 22 || hour < 8 { return }

    let copy = celebrationCopy()
    let title: String
    let body: String
    if total == 1 {
      title = copy["firstTitle"] ?? "Première victoire"
      body =
        copy["firstBody"]
        ?? "Tu viens de résister. C'est exactement comme ça qu'on reprend le contrôle."
    } else if [10, 50, 100, 250, 500, 1000].contains(total) {
      // Le gabarit porte `{total}` : l'app ne peut pas connaître le compteur au
      // moment où elle publie les textes, seule l'extension le connaît.
      let titleTemplate = copy["milestoneTitle"] ?? "{total} résistances"
      let bodyTemplate =
        copy["milestoneBody"]
        ?? "{total} fois où tu as choisi ton temps plutôt que le scroll. Continue."
      title = titleTemplate.replacingOccurrences(of: "{total}", with: "\(total)")
      body = bodyTemplate.replacingOccurrences(of: "{total}", with: "\(total)")
    } else {
      return
    }

    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.sound = .default
    // Même charge utile que les notifications du moteur : un tap sur une
    // célébration doit emmener à l'Activité, pas ouvrir l'app au hasard.
    content.userInfo = [
      "relock": [
        "v": 1,
        "n": total == 1 ? "progress.first_resist" : "progress.milestone_resists",
        "f": "progress",
        "s": Int(Date().timeIntervalSince1970),
        "r": ["p": "/(tabs)/activity"],
      ]
    ]
    content.threadIdentifier = "progress"
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

    // L'utilisateur a appuyé sur « ouvrir Relock » et la demande n'a PAS pu
    // être écrite : l'app va démarrer sans savoir quelle app débloquer, donc
    // la feuille de déblocage n'apparaîtra jamais. Du point de vue de
    // l'utilisateur, le bouton « ne marche pas » — au hasard, sans message.
    // Cette extension embarque aussi sentry-cocoa (crashs durs) ; ceci en est
    // le pendant pour les échecs ATTRAPÉS.
    if requestStatus == "write-failed" {
      ExtensionLog.error(
        "action",
        "demande d'ouverture non écrite : la feuille de déblocage ne s'ouvrira pas",
        data: ["hasApplication": String(hasApplication),
               "hasCategory": String(hasCategory)])
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
