import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings
import React
import SwiftUI

/// Module natif Family Controls de Relock (app principale).
///
/// - Autorisation + sélecteur d'apps Apple (jeton opaque).
/// - Trois mécaniques pilotées par DeviceActivity (l'extension `RelockMonitor`
///   applique/retire le bouclier aux bons moments, même app fermée) :
///     • Bloquer maintenant  → fenêtre [maintenant, +durée] (+ mode strict).
///     • Plage horaire       → fenêtre quotidienne début→fin.
///     • Limite de temps/jour → seuil d'usage atteint = blocage jusqu'au lendemain.
///
/// Sélection + état sont partagés avec l'extension via l'App Group.
/// ⚠️ iOS 16+, iPhone physique, entitlement family-controls.
@objc(BlocusScreenTime)
final class BlocusScreenTime: NSObject {

  private static let suite = "group.com.yaya.relock"
  private static let storeName = "blocus.default"

  private let defaults = UserDefaults(suiteName: BlocusScreenTime.suite)

  // Noms d'activité DeviceActivity (doivent matcher RelockMonitor).
  private let timedActivity = DeviceActivityName("timed")
  private let scheduleActivity = DeviceActivityName("schedule")
  private let limitActivity = DeviceActivityName("dailyLimit")

  @objc static func requiresMainQueueSetup() -> Bool { true }

  @available(iOS 16.0, *)
  private var store: ManagedSettingsStore {
    ManagedSettingsStore(named: .init(rawValue: BlocusScreenTime.storeName))
  }

  @available(iOS 16.0, *)
  private var center: DeviceActivityCenter { DeviceActivityCenter() }

  // MARK: - Sélection partagée (App Group)

  @available(iOS 16.0, *)
  private func loadSelection() -> FamilyActivitySelection {
    guard
      let data = defaults?.data(forKey: "selection"),
      let decoded = try? JSONDecoder().decode(
        FamilyActivitySelection.self, from: data)
    else { return FamilyActivitySelection() }
    return decoded
  }

  @available(iOS 16.0, *)
  private func saveSelection(_ selection: FamilyActivitySelection) {
    if let data = try? JSONEncoder().encode(selection) {
      defaults?.set(data, forKey: "selection")
    }
  }

  @available(iOS 16.0, *)
  private func selectionCount(_ s: FamilyActivitySelection) -> Int {
    s.applicationTokens.count + s.categoryTokens.count + s.webDomainTokens.count
  }

  @available(iOS 16.0, *)
  private func applyShield(_ s: FamilyActivitySelection) {
    store.shield.applications = s.applicationTokens.isEmpty ? nil : s.applicationTokens
    store.shield.applicationCategories =
      s.categoryTokens.isEmpty ? nil : .specific(s.categoryTokens)
    store.shield.webDomains = s.webDomainTokens.isEmpty ? nil : s.webDomainTokens
    defaults?.set(true, forKey: "blocus.isBlocking")
  }

  @available(iOS 16.0, *)
  private func clearShield() {
    store.shield.applications = nil
    store.shield.applicationCategories = nil
    store.shield.webDomains = nil
    defaults?.set(false, forKey: "blocus.isBlocking")
  }

  // MARK: - Autorisation

  @objc(requestAuthorization:rejecter:)
  func requestAuthorization(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("unsupported", "iOS 16+ requis pour Family Controls", nil); return
    }
    Task {
      do {
        try await AuthorizationCenter.shared.requestAuthorization(for: .individual)
        resolve("approved")
      } catch {
        reject("auth_failed", error.localizedDescription, error)
      }
    }
  }

  @objc(authorizationStatus:rejecter:)
  func authorizationStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else { resolve("unsupported"); return }
    switch AuthorizationCenter.shared.authorizationStatus {
    case .approved: resolve("approved")
    case .denied: resolve("denied")
    case .notDetermined: resolve("notDetermined")
    @unknown default: resolve("notDetermined")
    }
  }

  // MARK: - Sélecteur d'apps Apple

  @objc(presentPicker:rejecter:)
  func presentPicker(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("unsupported", "iOS 16+ requis", nil); return
    }
    DispatchQueue.main.async {
      guard let presenter = RCTPresentedViewController() else {
        reject("no_vc", "Aucun view controller pour présenter le sélecteur", nil)
        return
      }
      let model = SelectionModel(selection: self.loadSelection())
      let view = PickerContainer(
        model: model,
        onDone: {
          self.saveSelection(model.selection)
          presenter.dismiss(animated: true) {
            resolve(["count": self.selectionCount(model.selection)])
          }
        },
        onCancel: {
          presenter.dismiss(animated: true) {
            resolve(["count": self.selectionCount(self.loadSelection())])
          }
        }
      )
      let host = UIHostingController(rootView: view)
      host.modalPresentationStyle = .automatic
      presenter.present(host, animated: true)
    }
  }

  // MARK: - Mécanique 1 : Bloquer maintenant (durée + mode strict)

  @objc(startTimedBlock:strict:resolver:rejecter:)
  func startTimedBlock(
    _ minutes: NSNumber,
    strict: Bool,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("unsupported", "iOS 16+ requis", nil); return
    }
    let selection = loadSelection()
    guard selectionCount(selection) > 0 else {
      reject("empty_selection", "Aucune app sélectionnée", nil); return
    }
    let mins = max(15, minutes.intValue)  // DeviceActivity : fenêtre ≥ 15 min
    let cal = Calendar.current
    let now = Date()
    let end = now.addingTimeInterval(TimeInterval(mins * 60))
    let schedule = DeviceActivitySchedule(
      intervalStart: cal.dateComponents([.hour, .minute, .second], from: now),
      intervalEnd: cal.dateComponents([.hour, .minute, .second], from: end),
      repeats: false)
    do {
      center.stopMonitoring([timedActivity])
      try center.startMonitoring(timedActivity, during: schedule)
      applyShield(selection)  // blocage immédiat ; l'extension retire à la fin
      if strict {
        defaults?.set(end.timeIntervalSince1970, forKey: "strictUntil")
      } else {
        defaults?.removeObject(forKey: "strictUntil")
      }
      resolve(true)
    } catch {
      reject("monitor_failed", error.localizedDescription, error)
    }
  }

  // MARK: - Mécanique 2 : Plage horaire quotidienne

  @objc(startSchedule:startMinute:endHour:endMinute:resolver:rejecter:)
  func startSchedule(
    _ startHour: NSNumber, startMinute: NSNumber,
    endHour: NSNumber, endMinute: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("unsupported", "iOS 16+ requis", nil); return
    }
    guard selectionCount(loadSelection()) > 0 else {
      reject("empty_selection", "Aucune app sélectionnée", nil); return
    }
    let schedule = DeviceActivitySchedule(
      intervalStart: DateComponents(
        hour: startHour.intValue, minute: startMinute.intValue),
      intervalEnd: DateComponents(
        hour: endHour.intValue, minute: endMinute.intValue),
      repeats: true)
    do {
      center.stopMonitoring([scheduleActivity])
      try center.startMonitoring(scheduleActivity, during: schedule)
      resolve(true)
    } catch {
      reject("monitor_failed", error.localizedDescription, error)
    }
  }

  // MARK: - Mécanique 3 : Limite de temps / jour

  @objc(startDailyLimit:resolver:rejecter:)
  func startDailyLimit(
    _ minutes: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("unsupported", "iOS 16+ requis", nil); return
    }
    let selection = loadSelection()
    guard selectionCount(selection) > 0 else {
      reject("empty_selection", "Aucune app sélectionnée", nil); return
    }
    let schedule = DeviceActivitySchedule(
      intervalStart: DateComponents(hour: 0, minute: 0),
      intervalEnd: DateComponents(hour: 23, minute: 59),
      repeats: true)
    let event = DeviceActivityEvent(
      applications: selection.applicationTokens,
      categories: selection.categoryTokens,
      webDomains: selection.webDomainTokens,
      threshold: DateComponents(minute: max(1, minutes.intValue)))
    do {
      center.stopMonitoring([limitActivity])
      try center.startMonitoring(
        limitActivity, during: schedule,
        events: [DeviceActivityEvent.Name("limitReached"): event])
      resolve(true)
    } catch {
      reject("monitor_failed", error.localizedDescription, error)
    }
  }

  // MARK: - Stop (respecte le mode strict)

  @objc(stopBlocking:rejecter:)
  func stopBlocking(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else { resolve(true); return }
    // Le mode strict est appliqué PAR blocage côté JS (isLocked masque le bouton
    // d'arrêt du blocage strict). Pas de verrou global ici, sinon un blocage
    // strict empêcherait d'arrêter les AUTRES (indépendance des blocages).
    center.stopMonitoring([timedActivity, scheduleActivity, limitActivity])
    clearShield()
    defaults?.removeObject(forKey: "strictUntil")
    resolve(true)
  }

  // MARK: - Statut + journal d'événements (pour les stats)

  @objc(getStatus:rejecter:)
  func getStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      resolve([
        "supported": false, "authorized": false, "blocking": false,
        "count": 0, "strict": false,
      ])
      return
    }
    let authorized = AuthorizationCenter.shared.authorizationStatus == .approved
    let strictUntil = defaults?.double(forKey: "strictUntil") ?? 0
    resolve([
      "supported": true,
      "authorized": authorized,
      "blocking": defaults?.bool(forKey: "blocus.isBlocking") ?? false,
      "count": selectionCount(loadSelection()),
      "strict": strictUntil > Date().timeIntervalSince1970,
    ])
  }

  /// Renvoie et vide le journal d'événements accumulé par l'extension.
  @objc(pullEvents:rejecter:)
  func pullEvents(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let log = defaults?.array(forKey: "eventLog") as? [[String: Any]] ?? []
    defaults?.removeObject(forKey: "eventLog")
    resolve(log)
  }

  /// Au 1er lancement après (ré)installation : enlève tout blocage résiduel
  /// laissé au niveau système (le bouclier/surveillance survivent à la
  /// suppression de l'app). Renvoie `true` si c'était une install fraîche
  /// (l'app en profite pour effacer aussi l'historique cloud).
  @objc(resetIfFreshInstall:rejecter:)
  func resetIfFreshInstall(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    // Drapeau dans le sandbox app (effacé à la désinstallation).
    let key = "blocus.installed"
    if UserDefaults.standard.bool(forKey: key) {
      resolve(false)
      return
    }
    UserDefaults.standard.set(true, forKey: key)
    guard #available(iOS 16.0, *) else {
      resolve(true)
      return
    }
    center.stopMonitoring() // stoppe toutes les surveillances
    store.shield.applications = nil
    store.shield.applicationCategories = nil
    store.shield.webDomains = nil
    defaults?.removeObject(forKey: "selection")
    defaults?.removeObject(forKey: "eventLog")
    defaults?.set(false, forKey: "blocus.isBlocking")
    defaults?.removeObject(forKey: "strictUntil")
    resolve(true)
  }
}

// MARK: - SwiftUI : conteneur du sélecteur avec boutons Terminé / Annuler

@available(iOS 16.0, *)
final class SelectionModel: ObservableObject {
  @Published var selection: FamilyActivitySelection
  init(selection: FamilyActivitySelection) { self.selection = selection }
}

@available(iOS 16.0, *)
private struct PickerContainer: View {
  @ObservedObject var model: SelectionModel
  let onDone: () -> Void
  let onCancel: () -> Void

  var body: some View {
    NavigationView {
      FamilyActivityPicker(selection: $model.selection)
        .navigationTitle("Apps à bloquer")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) {
            Button("Annuler", action: onCancel)
          }
          ToolbarItem(placement: .confirmationAction) {
            Button("Terminé", action: onDone).bold()
          }
        }
    }
  }
}
