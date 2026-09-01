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

  /// Sursis en cours (déblocages temporaires), les échus retirés au passage.
  /// ⚠️ Miroir de `BlocusScreenTime.liveReprieves`.
  static func liveReprieves(_ defaults: UserDefaults?) -> [String: Double] {
    let raw = defaults?.dictionary(forKey: "reprieves") as? [String: Double] ?? [:]
    let now = Date().timeIntervalSince1970
    return raw.filter { $0.value > now }
  }

  /// Union des sélections des fenêtres actives → bouclier (ou retrait).
  private func recomputeShield() {
    var apps = Set<ApplicationToken>()
    var cats = Set<ActivityCategoryToken>()
    var webs = Set<WebDomainToken>()
    for raw in activeWindows() {
      guard let ruleId = raw.split(separator: ".").dropFirst().first
      else { continue }
      if isSuspended(String(ruleId)) { continue }
      guard let sel = loadRuleSelection(String(ruleId)) else { continue }
      apps.formUnion(sel.applicationTokens)
      cats.formUnion(sel.categoryTokens)
      webs.formUnion(sel.webDomainTokens)
    }
    // Sursis (déblocage temporaire d'une app) — miroir de
    // `BlocusScreenTime.recomputeShield`. Les échus sont filtrés par
    // l'horodatage : à la fin du sursis, le bouclier revient tout seul.
    let live = Self.liveReprieves(defaults)
    if !live.isEmpty {
      apps = apps.filter { token in
        guard let data = try? JSONEncoder().encode(token) else { return true }
        return live[data.base64EncodedString()] == nil
      }
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

  /// Un seul réveil partagé suffit : après chaque échéance, on arme la
  /// suivante. La fenêtre commence à l'expiration du sursis afin que
  /// `intervalDidStart` remette le bouclier dès la prochaine utilisation.
  private func scheduleNextReprieveWake() {
    let center = DeviceActivityCenter()
    let activity = DeviceActivityName("reprieve.shared")
    center.stopMonitoring([activity])
    guard let next = Self.liveReprieves(defaults).values.min() else { return }

    let now = Date()
    let start = max(Date(timeIntervalSince1970: next), now.addingTimeInterval(1))
    let end = start.addingTimeInterval(15 * 60)
    let full: Set<Calendar.Component> = [
      .year, .month, .day, .hour, .minute, .second,
    ]
    let calendar = Calendar.current
    let schedule = DeviceActivitySchedule(
      intervalStart: calendar.dateComponents(full, from: start),
      intervalEnd: calendar.dateComponents(full, from: end),
      repeats: false)
    try? center.startMonitoring(activity, during: schedule)
  }

  /// Avancement du quota du jour (25/50/75/100 %) partagé avec l'app.
  /// iOS ne sait pas dire « où en est le compteur ? » : seul un seuil franchi
  /// est notifiable. On ne redescend jamais dans la même journée — un
  /// ré-armement peut rejouer un palier déjà dépassé.
  private func setLimitProgress(_ ruleId: String, _ pct: Int) {
    guard let d = defaults else { return }
    let key = "limitProgress.\(ruleId)"
    let today = Self.dayKey()
    Self.withGroupLock {
      let parts = (d.string(forKey: key) ?? "").split(
        separator: ":", maxSplits: 1)
      let prev =
        parts.count == 2 && String(parts[0]) == today
        ? Int(parts[1]) ?? 0 : 0
      guard pct > prev else { return }
      d.set("\(today):\(pct)", forKey: key)
      d.synchronize()
    }
  }

  /// Une règle suspendue garde sa surveillance — ses fenêtres continuent de
  /// s'ouvrir et de se fermer — mais son bouclier est MASQUÉ. C'est ce qui
  /// permet à iOS de reprendre tout seul à l'échéance, app fermée : rien à
  /// reconstruire, il suffit de lever le masque.
  /// Valeur : timestamp de reprise, 0 = « jusqu'à ce que tu reprennes ».
  private func isSuspended(_ ruleId: String) -> Bool {
    guard let v = defaults?.object(forKey: "suspendedUntil.\(ruleId)") as? Double
    else { return false }
    return v == 0 || v > Date().timeIntervalSince1970
  }

  /// Jours d'application d'une plage (0 = dimanche … 6 = samedi), posés par
  /// l'app à l'armement. Absent ⇒ tous les jours.
  ///
  /// C'est ici que « lun→ven » se joue : un DeviceActivitySchedule ne sait pas
  /// l'exprimer, et armer une activité par jour mangerait 5 des 20 activités
  /// qu'iOS accorde à toute l'app. La fenêtre s'ouvre donc tous les jours et on
  /// la laisse passer sans bouclier les jours non retenus.
  private func dayAllows(_ ruleId: String) -> Bool {
    guard let days = defaults?.array(forKey: "days.\(ruleId)") as? [Int],
      !days.isEmpty
    else { return true }
    return days.contains(Calendar.current.component(.weekday, from: Date()) - 1)
  }

  // MARK: - Callbacks DeviceActivity

  override func intervalDidStart(for activity: DeviceActivityName) {
    super.intervalDidStart(for: activity)
    Self.log.info("intervalDidStart \(activity.rawValue, privacy: .public)")
    heartbeat("intervalDidStart \(activity.rawValue)")

    // Réveil d'une suspension : cette activité ne protège rien, elle ne sert
    // qu'à sonner à l'échéance. On lève le masque et le bouclier revient —
    // sans que l'app ait eu besoin d'être ouverte. ⚠️ Avant tout le reste :
    // « resume.<id> » n'est pas une fenêtre de blocage.
    if activity.rawValue.hasPrefix("resume."),
      let id = ruleId(from: activity.rawValue)
    {
      defaults?.removeObject(forKey: "suspendedUntil.\(id)")
      defaults?.synchronize()
      recomputeShield()
      logEvent(kind: "resume", activity: activity.rawValue)
      DeviceActivityCenter().stopMonitoring([activity])
      return
    }
    // Sursis (déblocage temporaire d'une app) : comme « resume. », cette
    // activité ne protège RIEN — elle ne sert qu'à sonner à l'échéance. La
    // traiter comme une fenêtre l'ajouterait à `activeWindows` et remettrait
    // sous bouclier toutes les apps de la règle, sursis compris.
    if activity.rawValue.hasPrefix("reprieve.") {
      recomputeShield()
      scheduleNextReprieveWake()
      return
    }
    // Échéance d'un blocage COURT (< 15 min) : iOS refuse une fenêtre aussi
    // brève, on a donc programmé un réveil qui COMMENCE à la fin voulue. Ce
    // n'est pas une fenêtre de blocage — elle ferme celle du blocage minuté.
    if activity.rawValue.hasPrefix("end."),
      let id = ruleId(from: activity.rawValue)
    {
      let window = "timed.\(id)"
      let wasActive = activeWindows().contains(window)
      setWindow(window, active: false)
      recomputeShield()
      if wasActive {
        logEvent(kind: "window_end", activity: window)
      }
      DeviceActivityCenter().stopMonitoring([activity])
      return
    }
    // Jour non retenu (« lun→ven ») : la fenêtre s'ouvre, mais elle ne protège
    // rien. `intervalDidStart` tombe au DÉBUT de la session — c'est donc bien
    // le bon jour qu'on teste, même pour une plage de nuit qui finit demain.
    if activity.rawValue.hasPrefix("sched."),
      let id = ruleId(from: activity.rawValue), !dayAllows(id)
    {
      Self.log.info("jour non retenu — \(activity.rawValue, privacy: .public)")
      return
    }
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
    // Fin d'un sursis : le bouclier revient de lui-même (les entrées échues
    // sont filtrées sur l'horodatage). Rien à retirer d'`activeWindows` —
    // un sursis n'y a jamais été inscrit.
    if activity.rawValue.hasPrefix("reprieve.") {
      recomputeShield()
      return
    }
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
      defaults?.removeObject(forKey: "limitProgress.\(id)")
    }
  }

  override func eventDidReachThreshold(
    _ event: DeviceActivityEvent.Name,
    activity: DeviceActivityName
  ) {
    super.eventDidReachThreshold(event, activity: activity)
    heartbeat("eventDidReachThreshold \(activity.rawValue) \(event.rawValue)")
    guard let id = ruleId(from: activity.rawValue) else { return }

    // Palier intermédiaire : on informe l'app de l'avancement, RIEN DE PLUS.
    // Bloquer ici viderait le quota à 25 % — le contraire de la promesse.
    if let pct = ["p25": 25, "p50": 50, "p75": 75][event.rawValue] {
      Self.log.info(
        "palier \(pct, privacy: .public) % — \(activity.rawValue, privacy: .public)"
      )
      setLimitProgress(id, pct)
      return
    }

    Self.log.info(
      "eventDidReachThreshold \(activity.rawValue, privacy: .public) — LIMITE ATTEINTE → blocage"
    )
    // Limite de temps atteinte → blocage jusqu'à la fin de journée.
    setLimitProgress(id, 100)
    setWindow(activity.rawValue, active: true)
    recomputeShield()
    logEvent(kind: "limit_reached", activity: activity.rawValue)
    // Mémorise « atteinte AUJOURD'HUI » : si l'utilisateur met en pause puis
    // reprend le même jour, l'app re-bloque aussitôt (pas de quota neuf).
    defaults?.set(Self.dayKey(), forKey: "limitReached.\(id)")
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
