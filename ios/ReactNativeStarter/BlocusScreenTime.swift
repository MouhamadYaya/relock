import ActivityKit
import DeviceActivity
import FamilyControls
import Foundation
import ManagedSettings
import React
import SwiftUI
import UserNotifications

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

  // MARK: - Multi-blocages : une activité DeviceActivity PAR RÈGLE
  //
  // Chaque règle a son activité (« timed.<id> », « sched.<id> », « limit.<id> »)
  // et sa propre sélection (« selection.<id> »). Le bouclier appliqué est
  // l'UNION des sélections des fenêtres actives (« activeWindows »), tenue à
  // jour ici et par RelockMonitor. Arrêter une règle n'affecte donc jamais
  // les autres. ⚠️ Les helpers miroir vivent dans RelockMonitor.swift.

  static func activityName(kind: String, ruleId: String) -> String {
    let prefix = kind == "schedule" ? "sched" : (kind == "limit" ? "limit" : "timed")
    return "\(prefix).\(ruleId)"
  }

  /// Clé de jour local « yyyy-MM-dd » (miroir de `RelockMonitor.dayKey`) pour
  /// mémoriser qu'une limite a été atteinte AUJOURD'HUI.
  static func dayKey() -> String {
    let f = DateFormatter()
    f.locale = Locale(identifier: "en_US_POSIX")
    f.dateFormat = "yyyy-MM-dd"
    return f.string(from: Date())
  }

  /// Verrou inter-processus sur le conteneur App Group : sérialise les
  /// read-modify-write (`activeWindows`, `eventLog`) avec les extensions
  /// (moniteur, bouclier) — sinon deux écritures simultanées se perdent.
  /// ⚠️ Miroir dans `RelockMonitor.swift` / `RelockShieldAction.swift`.
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

  @available(iOS 16.0, *)
  private func loadRuleSelection(_ ruleId: String) -> FamilyActivitySelection? {
    guard
      let data = defaults?.data(forKey: "selection.\(ruleId)"),
      let decoded = try? JSONDecoder().decode(
        FamilyActivitySelection.self, from: data)
    else { return nil }
    return decoded
  }

  /// Union des sélections des fenêtres actuellement actives → bouclier.
  @available(iOS 16.0, *)
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

  // MARK: - Live Activity (Dynamic Island + écran verrouillé)
  //
  // Uniquement pour « Bloquer maintenant » (durée déterminée) : le compte à
  // rebours système (`timerInterval`) tourne tout seul jusqu'à `endDate`.
  // L'UI vit dans l'extension RelockWidgets (RelockBlockAttributes partagé).

  @available(iOS 16.2, *)
  private func startBlockActivity(count: Int, start: Date, end: Date) {
    guard ActivityAuthorizationInfo().areActivitiesEnabled else { return }
    // Une seule activité Relock à la fois : on remplace l'éventuelle ancienne.
    for act in Activity<RelockBlockAttributes>.activities {
      Task { await act.end(nil, dismissalPolicy: .immediate) }
    }
    let attributes = RelockBlockAttributes(count: count)
    let state = RelockBlockAttributes.ContentState(startDate: start, endDate: end)
    let content = ActivityContent(state: state, staleDate: end)
    _ = try? Activity.request(attributes: attributes, content: content)
  }

  /// Termine les Live Activities Relock (toutes, ou seulement celles expirées).
  @available(iOS 16.2, *)
  private func endBlockActivities(onlyExpired: Bool = false) {
    let now = Date()
    for act in Activity<RelockBlockAttributes>.activities {
      if onlyExpired && act.content.state.endDate > now { continue }
      Task { await act.end(nil, dismissalPolicy: .immediate) }
    }
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

  /// « Autorisé » au sens Family Controls — accepte aussi le nouveau statut
  /// iOS 26 `approvedWithDataAccess` (le traiter en « notDetermined » ferait
  /// croire à tort que l'app n'a plus l'autorisation).
  @available(iOS 16.0, *)
  static func isAuthorized(_ status: AuthorizationStatus) -> Bool {
    switch status {
    case .approved: return true
    case .approvedWithDataAccess: return true
    case .denied, .notDetermined: return false
    @unknown default: return false
    }
  }

  @objc(authorizationStatus:rejecter:)
  func authorizationStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else { resolve("unsupported"); return }
    let status = AuthorizationCenter.shared.authorizationStatus
    if Self.isAuthorized(status) {
      resolve("approved")
    } else if status == .denied {
      resolve("denied")
    } else {
      resolve("notDetermined")
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

  // MARK: - Liaison sélection ↔ règle

  /// Copie la dernière sélection du picker (« selection ») vers la règle.
  /// À appeler UNE fois à la création (jamais au ré-armement, sinon la
  /// sélection d'une autre règle en cours de création écraserait celle-ci).
  @objc(bindSelection:resolver:rejecter:)
  func bindSelection(
    _ ruleId: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("unsupported", "iOS 16+ requis", nil); return
    }
    let sel = loadSelection()
    guard selectionCount(sel) > 0 else {
      reject("empty_selection", "Aucune app sélectionnée", nil); return
    }
    if let data = try? JSONEncoder().encode(sel) {
      defaults?.set(data, forKey: "selection.\(ruleId)")
      resolve(true)
    } else {
      reject("encode_failed", "Sélection non encodable", nil)
    }
  }

  // MARK: - Mécanique 1 : Bloquer maintenant (durée, par règle)

  @objc(startTimedBlock:minutes:strict:resolver:rejecter:)
  func startTimedBlock(
    _ ruleId: String,
    minutes: NSNumber,
    strict: Bool,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("unsupported", "iOS 16+ requis", nil); return
    }
    guard let selection = loadRuleSelection(ruleId),
      selectionCount(selection) > 0
    else {
      reject("empty_selection", "Aucune app liée à cette règle", nil); return
    }
    let raw = Self.activityName(kind: "timed", ruleId: ruleId)
    let activity = DeviceActivityName(raw)
    let mins = max(15, minutes.intValue)  // DeviceActivity : fenêtre ≥ 15 min
    let cal = Calendar.current
    let now = Date()
    let end = now.addingTimeInterval(TimeInterval(mins * 60))
    // Composants COMPLETS (avec la date) : un blocage qui traverse minuit
    // reste une fenêtre valide [maintenant → demain 00h20].
    let full: Set<Calendar.Component> = [
      .year, .month, .day, .hour, .minute, .second,
    ]
    let schedule = DeviceActivitySchedule(
      intervalStart: cal.dateComponents(full, from: now),
      intervalEnd: cal.dateComponents(full, from: end),
      repeats: false)
    do {
      center.stopMonitoring([activity])
      try center.startMonitoring(activity, during: schedule)
      setWindow(raw, active: true)  // blocage immédiat
      recomputeShield()
      // Live Activity : compte à rebours dans la Dynamic Island + écran
      // verrouillé, réservé au blocage à durée déterminée.
      if #available(iOS 16.2, *) {
        startBlockActivity(
          count: selectionCount(selection), start: now, end: end)
      }
      resolve(true)
    } catch {
      setWindow(raw, active: false)
      reject("monitor_failed", error.localizedDescription, error)
    }
  }

  // MARK: - Mécanique 2 : Plage horaire quotidienne (par règle)

  @objc(startSchedule:startHour:startMinute:endHour:endMinute:resolver:rejecter:)
  func startSchedule(
    _ ruleId: String,
    startHour: NSNumber, startMinute: NSNumber,
    endHour: NSNumber, endMinute: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("unsupported", "iOS 16+ requis", nil); return
    }
    guard let sel = loadRuleSelection(ruleId), selectionCount(sel) > 0 else {
      reject("empty_selection", "Aucune app liée à cette règle", nil); return
    }
    let raw = Self.activityName(kind: "schedule", ruleId: ruleId)
    let activity = DeviceActivityName(raw)
    let schedule = DeviceActivitySchedule(
      intervalStart: DateComponents(
        hour: startHour.intValue, minute: startMinute.intValue),
      intervalEnd: DateComponents(
        hour: endHour.intValue, minute: endMinute.intValue),
      repeats: true)
    do {
      center.stopMonitoring([activity])
      try center.startMonitoring(activity, during: schedule)
      // iOS ne rejoue PAS `intervalDidStart` pour une fenêtre DÉJÀ en cours.
      // Si « maintenant » tombe dans la plage (création ou reprise en plein
      // créneau), on applique le bouclier immédiatement — sinon rien ne serait
      // bloqué jusqu'au prochain passage à l'heure de début.
      let cal = Calendar.current
      let nowM =
        cal.component(.hour, from: Date()) * 60
        + cal.component(.minute, from: Date())
      let startM = startHour.intValue * 60 + startMinute.intValue
      let endM = endHour.intValue * 60 + endMinute.intValue
      let inside =
        startM <= endM
        ? (nowM >= startM && nowM < endM)
        : (nowM >= startM || nowM < endM)  // plage qui traverse minuit
      if inside {
        setWindow(raw, active: true)
        recomputeShield()
      } else if activeWindows().contains(raw) {
        // Auto-réparation : fenêtre restée active hors plage (fin de fenêtre
        // manquée par le moniteur : téléphone éteint, extension tuée…) → on
        // purge le blocage fantôme au ré-armement.
        setWindow(raw, active: false)
        recomputeShield()
      }
      resolve(true)
    } catch {
      reject("monitor_failed", error.localizedDescription, error)
    }
  }

  // MARK: - Mécanique 3 : Limite de temps / jour (par règle)

  @objc(startDailyLimit:minutes:resolver:rejecter:)
  func startDailyLimit(
    _ ruleId: String,
    minutes: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else {
      reject("unsupported", "iOS 16+ requis", nil); return
    }
    guard let selection = loadRuleSelection(ruleId),
      selectionCount(selection) > 0
    else {
      reject("empty_selection", "Aucune app liée à cette règle", nil); return
    }
    let raw = Self.activityName(kind: "limit", ruleId: ruleId)
    let activity = DeviceActivityName(raw)
    let schedule = DeviceActivitySchedule(
      intervalStart: DateComponents(hour: 0, minute: 0),
      intervalEnd: DateComponents(hour: 23, minute: 59),
      repeats: true)
    // Seuil en heures+minutes : la sémantique de DateComponents au-delà de
    // 59 min n'est pas garantie par DeviceActivity.
    let mins = max(1, minutes.intValue)
    let threshold = DateComponents(hour: mins / 60, minute: mins % 60)
    let event: DeviceActivityEvent
    if #available(iOS 17.4, *) {
      // `includesPastActivity` : le seuil compte l'usage depuis MINUIT, même
      // si la surveillance (re)démarre en cours de journée. Sans lui, chaque
      // ré-armement (création, pause/reprise, relance de l'app) remettait le
      // compteur d'iOS à zéro → une limite de 5 min ne se déclenchait jamais
      // dès que l'app relançait la surveillance. C'est aussi la sémantique
      // attendue d'une « limite PAR JOUR » (comme Temps d'écran d'Apple).
      event = DeviceActivityEvent(
        applications: selection.applicationTokens,
        categories: selection.categoryTokens,
        webDomains: selection.webDomainTokens,
        threshold: threshold,
        includesPastActivity: true)
    } else {
      event = DeviceActivityEvent(
        applications: selection.applicationTokens,
        categories: selection.categoryTokens,
        webDomains: selection.webDomainTokens,
        threshold: threshold)
    }
    do {
      center.stopMonitoring([activity])
      try center.startMonitoring(
        activity, during: schedule,
        events: [DeviceActivityEvent.Name("limitReached"): event])
      if defaults?.string(forKey: "limitReached.\(ruleId)") == Self.dayKey() {
        // Limite DÉJÀ atteinte aujourd'hui (marqueur posé par le moniteur) :
        // on re-bloque immédiatement — pas de quota neuf en re-armant.
        setWindow(raw, active: true)
        recomputeShield()
      } else if activeWindows().contains(raw) {
        // Auto-réparation : fenêtre « limite » restée active d'un jour passé
        // (fin de journée manquée, téléphone éteint…) → on la retire, le
        // quota du jour est neuf.
        setWindow(raw, active: false)
        recomputeShield()
      }
      resolve(true)
    } catch {
      reject("monitor_failed", error.localizedDescription, error)
    }
  }

  // MARK: - Stop CIBLÉ (une règle) — n'affecte jamais les autres blocages

  @objc(stopRule:kind:resolver:rejecter:)
  func stopRule(
    _ ruleId: String,
    kind: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else { resolve(true); return }
    let raw = Self.activityName(kind: kind, ruleId: ruleId)
    center.stopMonitoring([DeviceActivityName(raw)])
    setWindow(raw, active: false)
    recomputeShield()
    // Pause d'un minuté → son compte à rebours n'a plus lieu d'être affiché.
    if kind == "timed", #available(iOS 16.2, *) { endBlockActivities() }
    resolve(true)
  }

  /// Suppression définitive d'une règle : stop + oubli de sa sélection.
  @objc(clearRuleData:kind:resolver:rejecter:)
  func clearRuleData(
    _ ruleId: String,
    kind: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else { resolve(true); return }
    let raw = Self.activityName(kind: kind, ruleId: ruleId)
    center.stopMonitoring([DeviceActivityName(raw)])
    setWindow(raw, active: false)
    defaults?.removeObject(forKey: "selection.\(ruleId)")
    // Suppression (≠ pause) : on oublie aussi le marqueur « limite atteinte ».
    defaults?.removeObject(forKey: "limitReached.\(ruleId)")
    recomputeShield()
    if kind == "timed", #available(iOS 16.2, *) { endBlockActivities() }
    resolve(true)
  }

  // MARK: - Stop GLOBAL (réinitialisation uniquement)

  @objc(stopBlocking:rejecter:)
  func stopBlocking(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    guard #available(iOS 16.0, *) else { resolve(true); return }
    center.stopMonitoring()  // toutes les activités
    defaults?.set([String](), forKey: "activeWindows")
    recomputeShield()
    if #available(iOS 16.2, *) { endBlockActivities() }
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
    let authorized = Self.isAuthorized(
      AuthorizationCenter.shared.authorizationStatus)
    resolve([
      "supported": true,
      "authorized": authorized,
      "blocking": defaults?.bool(forKey: "blocus.isBlocking") ?? false,
      "count": selectionCount(loadSelection()),
      // Le mode strict est géré PAR règle côté JS (config.strict + isLocked).
      "strict": false,
    ])
  }

  /// Renvoie le journal d'événements SANS le vider (protocole pull-ack :
  /// l'app confirme via `ackEvents` une fois la synchro cloud réussie —
  /// sinon les événements restent et seront resynchronisés plus tard).
  @objc(pullEvents:rejecter:)
  func pullEvents(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    // Passage régulier (sync des stats) → on en profite pour retirer une
    // Live Activity dont le compte à rebours est arrivé à zéro.
    if #available(iOS 16.2, *) { endBlockActivities(onlyExpired: true) }
    // Les extensions (bouclier, moniteur) écrivent dans le conteneur partagé
    // depuis d'AUTRES processus. Le cache en mémoire d'UserDefaults côté app
    // peut être périmé et rater ces écritures : on force une relecture disque.
    defaults?.synchronize()
    let log = defaults?.array(forKey: "eventLog") as? [[String: Any]] ?? []
    resolve(log)
  }

  /// Purge les `count` premiers événements du journal (ceux qui viennent
  /// d'être synchronisés). Les extensions ajoutent en FIN de tableau, donc
  /// retirer en tête ne perd jamais un événement arrivé entre pull et ack.
  @objc(ackEvents:resolver:rejecter:)
  func ackEvents(
    _ count: NSNumber,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    Self.withGroupLock {
      var log = defaults?.array(forKey: "eventLog") as? [[String: Any]] ?? []
      let n = min(max(0, count.intValue), log.count)
      if n > 0 { log.removeFirst(n) }
      if log.isEmpty {
        defaults?.removeObject(forKey: "eventLog")
      } else {
        defaults?.set(log, forKey: "eventLog")
      }
    }
    resolve(true)
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
    // Purge complète de l'App Group (sélections par règle, fenêtres, journal…).
    defaults?.removePersistentDomain(forName: BlocusScreenTime.suite)
    defaults?.set(false, forKey: "blocus.isBlocking")
    resolve(true)
  }

  // MARK: - Notifications locales (rappels, progression)
  //
  // 100 % local : pas d'APNs. L'app planifie les notifs DIFFÉRÉES (rappel série
  // du soir, bilan hebdo, win-back) via un reconciler idempotent côté JS. Les
  // célébrations TEMPS RÉEL (1ʳᵉ victoire, jalons) partent de l'extension
  // bouclier (`RelockShieldAction`), seule réveillée quand l'app est fermée.

  private var notifCenter: UNUserNotificationCenter { .current() }

  @objc(requestNotifPermission:rejecter:)
  func requestNotifPermission(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    notifCenter.requestAuthorization(options: [.alert, .sound, .badge]) {
      granted, _ in resolve(granted ? "granted" : "denied")
    }
  }

  @objc(notifPermissionStatus:rejecter:)
  func notifPermissionStatus(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    notifCenter.getNotificationSettings { s in
      switch s.authorizationStatus {
      case .authorized, .provisional, .ephemeral: resolve("granted")
      case .denied: resolve("denied")
      case .notDetermined: resolve("notDetermined")
      @unknown default: resolve("notDetermined")
      }
    }
  }

  /// Planifie une notif locale à une date absolue (timestamp Unix, secondes).
  /// Un même `id` remplace la précédente → idempotent, aucun doublon.
  @objc(scheduleNotif:timestamp:title:body:resolver:rejecter:)
  func scheduleNotif(
    _ id: String, timestamp: NSNumber, title: String, body: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    let interval = Date(timeIntervalSince1970: timestamp.doubleValue)
      .timeIntervalSinceNow
    guard interval > 0 else { resolve(false); return }  // jamais dans le passé
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.sound = .default
    let req = UNNotificationRequest(
      identifier: id, content: content,
      trigger: UNTimeIntervalNotificationTrigger(
        timeInterval: interval, repeats: false))
    notifCenter.removePendingNotificationRequests(withIdentifiers: [id])
    notifCenter.add(req) { err in resolve(err == nil) }
  }

  /// Annule les notifs planifiées dont l'identifiant commence par `prefix`.
  @objc(cancelNotifsWithPrefix:resolver:rejecter:)
  func cancelNotifsWithPrefix(
    _ prefix: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    notifCenter.getPendingNotificationRequests { reqs in
      let ids = reqs.map { $0.identifier }.filter { $0.hasPrefix(prefix) }
      self.notifCenter.removePendingNotificationRequests(withIdentifiers: ids)
      resolve(true)
    }
  }

  /// Active/désactive les célébrations temps réel (lu par l'extension bouclier).
  @objc(setCelebrationsEnabled:resolver:rejecter:)
  func setCelebrationsEnabled(
    _ enabled: Bool,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    defaults?.set(enabled, forKey: "notif.celebrationsEnabled")
    resolve(true)
  }

  /// Bilan de santé natif (dev + diagnostic device) : build, autorisation,
  /// journal, traces de vie des extensions. Le sandbox iOS rend plusieurs
  /// pannes SILENCIEUSES (extension jamais réveillée, App Group divergent,
  /// build périmé) — ce rapport les rend observables depuis l'app.
  @objc(getDiagnostics:rejecter:)
  func getDiagnostics(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    defaults?.synchronize()
    let iso = ISO8601DateFormatter()

    // Date du binaire = date du DERNIER VRAI BUILD natif. Si elle est vieille,
    // les correctifs natifs n'ont jamais été compilés (recharger Metro ne
    // suffit pas) — cause classique de « toujours à 0 » côté stats.
    var builtAt = "inconnu"
    if let exe = Bundle.main.executablePath,
      let attrs = try? FileManager.default.attributesOfItem(atPath: exe),
      let date = attrs[.modificationDate] as? Date
    {
      builtAt = iso.string(from: date)
    }

    func when(_ key: String) -> String {
      let t = defaults?.double(forKey: key) ?? 0
      return t > 0
        ? iso.string(from: Date(timeIntervalSince1970: t)) : "jamais"
    }

    var authorized = false
    if #available(iOS 16.0, *) {
      authorized = Self.isAuthorized(
        AuthorizationCenter.shared.authorizationStatus)
    }
    let log = defaults?.array(forKey: "eventLog") as? [[String: Any]] ?? []
    resolve([
      "nativeBuiltAt": builtAt,
      "authorized": authorized,
      "appGroupOK": defaults != nil,
      "eventLogCount": log.count,
      "eventLogTail": Array(log.suffix(5)),
      "totalResisted": defaults?.integer(forKey: "totalResisted") ?? 0,
      "activeWindows": defaults?.stringArray(forKey: "activeWindows") ?? [],
      "monitorLastWakeAt": when("monitor.lastWakeAt"),
      "monitorLastWakeWhat": defaults?.string(forKey: "monitor.lastWakeWhat")
        ?? "—",
      "shieldLastActionAt": when("shield.lastActionAt"),
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
