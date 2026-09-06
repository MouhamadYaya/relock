import AppTrackingTransparency
import Foundation
import React
import UIKit

/// Pont ATT (App Tracking Transparency) — la feuille système « Autoriser
/// "Relock" à suivre votre activité… ».
///
/// Deux pièges qu'iOS ne signale jamais et que ce module absorbe :
///
///  1. **L'app doit être `active`.** Appelée pendant le lancement, un retour
///     de tâche ou une transition, `requestTrackingAuthorization` se résout
///     silencieusement en `notDetermined` — sans alerte, et le système
///     considère la demande consommée. On attend donc `didBecomeActive`.
///  2. **La demande est à usage unique côté OS.** Une fois le statut
///     déterminé (autorisé / refusé), un nouvel appel résout immédiatement
///     avec ce statut sans rien afficher. Inutile de mémoriser « déjà
///     demandé » côté JS.
///
/// La phrase affichée dans l'alerte vient de `NSUserTrackingUsageDescription`
/// (Info.plist) — sans cette clé, iOS n'affiche rien du tout.
@objc(RelockTracking)
final class RelockTracking: NSObject {

  @objc static func requiresMainQueueSetup() -> Bool { true }

  /// Observateur `didBecomeActive` en attente (au plus un à la fois).
  private var activationObserver: NSObjectProtocol?

  // MARK: - Lecture

  @objc(status:rejecter:)
  func status(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    if #available(iOS 14.0, *) {
      resolve(RelockTracking.label(ATTrackingManager.trackingAuthorizationStatus))
    } else {
      resolve("unavailable")
    }
  }

  // MARK: - Demande

  @objc(request:rejecter:)
  func request(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 14.0, *) else {
      resolve("unavailable")
      return
    }

    whenActive {
      ATTrackingManager.requestTrackingAuthorization { status in
        DispatchQueue.main.async { resolve(RelockTracking.label(status)) }
      }
    }
  }

  // MARK: - Outils

  /// Exécute `work` sur la main queue dès que l'app est au premier plan et
  /// active. Si elle l'est déjà, c'est immédiat.
  private func whenActive(_ work: @escaping () -> Void) {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }

      if UIApplication.shared.applicationState == .active {
        work()
        return
      }

      // Remplace une éventuelle attente précédente : seule la dernière
      // demande compte, et l'observateur se retire dès le premier passage.
      self.clearActivationObserver()
      self.activationObserver = NotificationCenter.default.addObserver(
        forName: UIApplication.didBecomeActiveNotification,
        object: nil,
        queue: .main
      ) { [weak self] _ in
        self?.clearActivationObserver()
        work()
      }
    }
  }

  private func clearActivationObserver() {
    guard let observer = activationObserver else { return }
    NotificationCenter.default.removeObserver(observer)
    activationObserver = nil
  }

  deinit {
    clearActivationObserver()
  }

  @available(iOS 14.0, *)
  private static func label(
    _ status: ATTrackingManager.AuthorizationStatus
  ) -> String {
    switch status {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .restricted: return "restricted"
    case .notDetermined: return "notDetermined"
    @unknown default: return "notDetermined"
    }
  }
}
