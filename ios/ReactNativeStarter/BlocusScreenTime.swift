import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings
import React
import SwiftUI

/// Module natif Family Controls pour Blocus.
///
/// A1 : autorisation + sélecteur d'apps Apple (jeton opaque) + bouclier
/// ManagedSettings (blocage réel des apps choisies). Aucune extension requise
/// pour cet incrément : le bouclier est posé directement depuis l'app.
///
/// ⚠️ Ne fonctionne QUE sur iPhone physique (iOS 16+) avec l'entitlement
/// `com.apple.developer.family-controls` approuvé par Apple.
@objc(BlocusScreenTime)
final class BlocusScreenTime: NSObject {

  /// Store des réglages gérés — le bouclier posé ici bloque les apps ciblées.
  /// Propriété calculée (l'init `named:` est iOS 16+, la classe cible iOS 15).
  @available(iOS 16.0, *)
  private var store: ManagedSettingsStore {
    ManagedSettingsStore(named: .init(rawValue: "blocus.default"))
  }

  /// Clé de persistance de la sélection (jeton opaque, Codable).
  private let selectionKey = "blocus.selection"
  private let blockingKey = "blocus.isBlocking"

  @objc static func requiresMainQueueSetup() -> Bool { true }

  // MARK: - Persistance de la sélection (jeton opaque)

  @available(iOS 16.0, *)
  private func loadSelection() -> FamilyActivitySelection {
    guard
      let data = UserDefaults.standard.data(forKey: selectionKey),
      let decoded = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    else {
      return FamilyActivitySelection()
    }
    return decoded
  }

  @available(iOS 16.0, *)
  private func saveSelection(_ selection: FamilyActivitySelection) {
    if let data = try? JSONEncoder().encode(selection) {
      UserDefaults.standard.set(data, forKey: selectionKey)
    }
  }

  @available(iOS 16.0, *)
  private func selectionCount(_ s: FamilyActivitySelection) -> Int {
    s.applicationTokens.count + s.categoryTokens.count + s.webDomainTokens.count
  }

  // MARK: - Autorisation

  @objc(requestAuthorization:rejecter:)
  func requestAuthorization(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("unsupported", "iOS 16+ requis pour Family Controls", nil)
      return
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
    guard #available(iOS 16.0, *) else {
      resolve("unsupported")
      return
    }
    switch AuthorizationCenter.shared.authorizationStatus {
    case .approved: resolve("approved")
    case .denied: resolve("denied")
    case .notDetermined: resolve("notDetermined")
    @unknown default: resolve("notDetermined")
    }
  }

  // MARK: - Sélecteur d'apps Apple (FamilyActivityPicker)

  @objc(presentPicker:rejecter:)
  func presentPicker(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("unsupported", "iOS 16+ requis", nil)
      return
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

  // MARK: - Bouclier (blocage réel)

  @objc(startBlocking:rejecter:)
  func startBlocking(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("unsupported", "iOS 16+ requis", nil)
      return
    }
    let selection = loadSelection()
    guard selectionCount(selection) > 0 else {
      reject("empty_selection", "Aucune app sélectionnée", nil)
      return
    }
    store.shield.applications =
      selection.applicationTokens.isEmpty ? nil : selection.applicationTokens
    store.shield.applicationCategories =
      selection.categoryTokens.isEmpty ? nil : .specific(selection.categoryTokens)
    store.shield.webDomains =
      selection.webDomainTokens.isEmpty ? nil : selection.webDomainTokens
    UserDefaults.standard.set(true, forKey: blockingKey)
    resolve(true)
  }

  @objc(stopBlocking:rejecter:)
  func stopBlocking(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      resolve(true)
      return
    }
    store.shield.applications = nil
    store.shield.applicationCategories = nil
    store.shield.webDomains = nil
    UserDefaults.standard.set(false, forKey: blockingKey)
    resolve(true)
  }

  @objc(getStatus:rejecter:)
  func getStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      resolve(["supported": false, "authorized": false, "blocking": false, "count": 0])
      return
    }
    let authorized = AuthorizationCenter.shared.authorizationStatus == .approved
    resolve([
      "supported": true,
      "authorized": authorized,
      "blocking": UserDefaults.standard.bool(forKey: blockingKey),
      "count": selectionCount(loadSelection()),
    ])
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
