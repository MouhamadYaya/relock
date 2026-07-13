import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings

/// Extension DeviceActivityMonitor de Relock.
///
/// iOS réveille ce processus aux bornes des fenêtres programmées (plage horaire,
/// fin d'un blocage minuté) et quand un seuil d'usage est atteint (limite de
/// temps/jour). C'est ici qu'on pose ou retire le bouclier système — l'app RN
/// n'a pas besoin de tourner.
///
/// Le nom du store et le suite App Group DOIVENT correspondre à ceux de
/// `BlocusScreenTime.swift` (app principale).
final class RelockMonitor: DeviceActivityMonitor {

  private let store = ManagedSettingsStore(named: .init(rawValue: "blocus.default"))
  private let defaults = UserDefaults(suiteName: "group.com.yaya.relock")

  // Nom d'activité réservé à la limite de temps (ne pose pas le bouclier au start).
  private static let dailyLimit = DeviceActivityName("dailyLimit")

  // MARK: - Sélection partagée (App Group)

  private func selection() -> FamilyActivitySelection {
    guard
      let data = defaults?.data(forKey: "selection"),
      let sel = try? JSONDecoder().decode(FamilyActivitySelection.self, from: data)
    else { return FamilyActivitySelection() }
    return sel
  }

  private func applyShield() {
    let sel = selection()
    store.shield.applications =
      sel.applicationTokens.isEmpty ? nil : sel.applicationTokens
    store.shield.applicationCategories =
      sel.categoryTokens.isEmpty ? nil : .specific(sel.categoryTokens)
    store.shield.webDomains =
      sel.webDomainTokens.isEmpty ? nil : sel.webDomainTokens
    defaults?.set(true, forKey: "blocus.isBlocking")
  }

  private func clearShield() {
    store.shield.applications = nil
    store.shield.applicationCategories = nil
    store.shield.webDomains = nil
    defaults?.set(false, forKey: "blocus.isBlocking")
  }

  // MARK: - Callbacks DeviceActivity

  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    // Plage horaire + blocage minuté : le début de fenêtre pose le bouclier.
    // (La limite de temps ne bloque qu'au seuil, pas au début de journée.)
    if activity != Self.dailyLimit {
      applyShield()
      logEvent(kind: "intercepted", activity: activity.rawValue)
    }
  }

  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)
    // Fin de fenêtre (fin de plage, durée écoulée, fin de journée) → on retire.
    clearShield()
    logEvent(kind: "interval_end", activity: activity.rawValue)
  }

  override func eventDidReachThreshold(
    _ event: DeviceActivityEvent.Name,
    activity: DeviceActivityName
  ) {
    super.eventDidReachThreshold(event, activity: activity)
    // Limite de temps atteinte → on bloque jusqu'à la fin de journée.
    applyShield()
    logEvent(kind: "limit_reached", activity: activity.rawValue)
  }

  // MARK: - Journal d'événements (remonté vers Supabase par l'app à l'ouverture)

  private func logEvent(kind: String, activity: String) {
    guard let d = defaults else { return }
    var log = d.array(forKey: "eventLog") as? [[String: Any]] ?? []
    log.append([
      "kind": kind,
      "activity": activity,
      "at": ISO8601DateFormatter().string(from: Date()),
    ])
    // Garde au plus 200 entrées.
    if log.count > 200 { log.removeFirst(log.count - 200) }
    d.set(log, forKey: "eventLog")
  }
}
