import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings
import os

/// Extension DeviceActivityMonitor de Relock.
///
/// iOS réveille ce processus aux bornes des fenêtres programmées (plage horaire,
/// fin d'un blocage minuté) et quand un seuil d'usage est atteint (limite de
/// temps/jour). C'est ici qu'on pose ou retire le bouclier système — l'app RN
/// n'a pas besoin de tourner.
///
/// Multi-blocages : chaque règle a son activité (« timed.<id> », « sched.<id> »,
/// « limit.<id> ») et sa sélection (« selection.<id> ») dans l'App Group. Le
/// bouclier appliqué est l'UNION des sélections des fenêtres actives
/// (« activeWindows ») : la fin d'une fenêtre ne retire donc JAMAIS le
/// bouclier d'un autre blocage encore en cours.
/// ⚠️ Helpers miroir de ceux de `BlocusScreenTime.swift` — garder en phase.
final class RelockMonitor: DeviceActivityMonitor {

  private static let suite = "group.com.yaya.relock"
  private static let storeName = "blocus.default"
  private static let log = Logger(
    subsystem: "com.yaya.relock", category: "monitor")

  private let store = ManagedSettingsStore(
    named: .init(rawValue: RelockMonitor.storeName))
  private let defaults = UserDefaults(suiteName: RelockMonitor.suite)

  // MARK: - Verrou inter-processus (App Group)
  //
  // L'app ET les extensions font des read-modify-write sur les mêmes clés
  // (`activeWindows`, `eventLog`). Sans verrou, deux écritures simultanées se
  // perdent (dernier écrivain gagne) — ex. un « Arrêter » utilisateur au même
  // instant qu'une fin de fenêtre. `flock` sur un fichier du conteneur partagé
  // sérialise ces sections critiques entre processus. ⚠️ Miroir dans
  // `BlocusScreenTime.swift` et `RelockShieldAction.swift` — garder en phase.
  static func withGroupLock<T>(_ body: () -> T) -> T {
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

  /// Trace de vie de l'extension (lisible depuis l'app via le diagnostic) :
  /// prouve que iOS réveille bien le moniteur, et quand, et pourquoi.
  private func heartbeat(_ what: String) {
    defaults?.set(Date().timeIntervalSince1970, forKey: "monitor.lastWakeAt")
    defaults?.set(what, forKey: "monitor.lastWakeWhat")
    defaults?.synchronize()
  }

  // MARK: - Registre des fenêtres actives + sélections par règle (App Group)

  private func activeWindows() -> [String] {
    defaults?.stringArray(forKey: "activeWindows") ?? []
  }

  private func setWindow(_ activityRaw: String, active: Bool) {
    Self.withGroupLock {
      var wins = activeWindows()
      if active {
        if !wins.contains(activityRaw) { wins.append(activityRaw) }
      } else {
        wins.removeAll { $0 == activityRaw }
      }
      defaults?.set(wins, forKey: "activeWindows")
    }
  }

  /// Clé de jour local « yyyy-MM-dd » (miroir de `BlocusScreenTime.dayKey`).
  private static func dayKey() -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: Date())
  }

  /// Id de règle extrait d'un nom d'activité « prefix.<ruleId> ».
  private func ruleId(from raw: String) -> String? {
    raw.split(separator: ".").dropFirst().first.map(String.init)
  }

  private func loadRuleSelection(_ ruleId: String) -> FamilyActivitySelection? {
    guard
      let data = defaults?.data(forKey: "selection.\(ruleId)"),
      let sel = try? JSONDecoder().decode(
        FamilyActivitySelection.self, from: data)
    else { return nil }
    return sel
  }

  /// Union des sélections des fenêtres actives → bouclier (ou retrait).
  private func recomputeShield() {
    var apps = Set<ApplicationToken>()
    var cats = Set<ActivityCategoryToken>()
    var webs = Set<WebDomainToken>()
    for raw in activeWindows() {
      guard let ruleId = raw.split(separator: ".").dropFirst().first
      else { continue }
      guard let sel = loadRuleSelection(String(ruleId)) else { continue }
      apps.formUnion(sel.applicationTokens)
      cats.formUnion(sel.categoryTokens)
      webs.formUnion(sel.webDomainTokens)
    }
    if apps.isEmpty && cats.isEmpty && webs.isEmpty {
      store.shield.applications = nil
      store.shield.applicationCategories = nil
      store.shield.webDomains = nil
      defaults?.set(false, forKey: "blocus.isBlocking")
    } else {
      store.shield.applications = apps.isEmpty ? nil : apps
      store.shield.applicationCategories = cats.isEmpty ? nil : .specific(cats)
      store.shield.webDomains = webs.isEmpty ? nil : webs
      defaults?.set(true, forKey: "blocus.isBlocking")
    }
  }

  // MARK: - Callbacks DeviceActivity

  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    Self.log.info("intervalDidStart \(activity.rawValue, privacy: .public)")
    heartbeat("intervalDidStart \(activity.rawValue)")
    // Une limite de temps ne bloque qu'au SEUIL, pas au début de journée.
    if !activity.rawValue.hasPrefix("limit.") {
      setWindow(activity.rawValue, active: true)
      recomputeShield()
      logEvent(kind: "window_start", activity: activity.rawValue)
    }
  }

  override func intervalDidEnd(for activity: DeviceActivityName) {
    super.intervalDidEnd(for: activity)
    heartbeat("intervalDidEnd \(activity.rawValue)")
    // Fin de CETTE fenêtre uniquement — l'union préserve les autres blocages.
    let wasActive = activeWindows().contains(activity.rawValue)
    setWindow(activity.rawValue, active: false)
    recomputeShield()
    // Ne journalise « window_end » que si une fenêtre était RÉELLEMENT active :
    // une limite jamais atteinte déclenche quand même intervalDidEnd à 23:59 et
    // polluerait les stats de faux « blocage terminé ».
    if wasActive {
      logEvent(kind: "window_end", activity: activity.rawValue)
    }
    // Fin de journée d'une limite → quota frais demain : on oublie le marqueur.
    if activity.rawValue.hasPrefix("limit."),
      let id = ruleId(from: activity.rawValue)
    {
      defaults?.removeObject(forKey: "limitReached.\(id)")
    }
  }

  override func eventDidReachThreshold(
    _ event: DeviceActivityEvent.Name,
    activity: DeviceActivityName
  ) {
    super.eventDidReachThreshold(event, activity: activity)
    Self.log.info(
      "eventDidReachThreshold \(activity.rawValue, privacy: .public) — LIMITE ATTEINTE → blocage"
    )
    heartbeat("eventDidReachThreshold \(activity.rawValue)")
    // Limite de temps atteinte → blocage jusqu'à la fin de journée.
    setWindow(activity.rawValue, active: true)
    recomputeShield()
    logEvent(kind: "limit_reached", activity: activity.rawValue)
    // Mémorise « atteinte AUJOURD'HUI » : si l'utilisateur met en pause puis
    // reprend le même jour, l'app re-bloque aussitôt (pas de quota neuf).
    if let id = ruleId(from: activity.rawValue) {
      defaults?.set(Self.dayKey(), forKey: "limitReached.\(id)")
    }
  }

  // MARK: - Journal d'événements (remonté vers Supabase par l'app, pull-ack)

  private func logEvent(kind: String, activity: String) {
    guard let d = defaults else { return }
    Self.withGroupLock {
      var log = d.array(forKey: "eventLog") as? [[String: Any]] ?? []
      log.append([
        "kind": kind,
        "activity": activity,
        "at": ISO8601DateFormatter().string(from: Date()),
      ])
      // Garde au plus 200 entrées.
      if log.count > 200 { log.removeFirst(log.count - 200) }
      d.set(log, forKey: "eventLog")
      // Extension éphémère : flush synchrone avant que iOS suspende le process,
      // sinon l'écriture peut ne pas atteindre le conteneur partagé (App Group).
      d.synchronize()
    }
  }
}
