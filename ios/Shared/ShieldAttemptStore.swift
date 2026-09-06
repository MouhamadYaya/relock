import Darwin
import Foundation

struct ShieldPresentation: Codable, Equatable {
  let applicationKey: String
  let applicationName: String
  let count: Int
  let presentedAt: TimeInterval
}

struct PendingShieldRequest: Codable, Equatable {
  let id: String
  /// Contexte facultatif conservé pour les diagnostics. La navigation vers
  /// Blocages ne doit jamais en dépendre : certains murs de catégorie ne
  /// livrent aucun jeton d'application exploitable à l'extension d'action.
  let applicationKey: String?
  let applicationName: String?
  let requestedAt: TimeInterval
}

struct ShieldEventRecord: Codable, Equatable {
  let kind: String
  let activity: String
  let at: String

  var dictionary: [String: Any] {
    ["kind": kind, "activity": activity, "at": at]
  }
}

struct ShieldDiagnosticSnapshot: Equatable {
  let shownTotal: Int
  let lastShownAt: TimeInterval?
  let totalResisted: Int
  let probeAt: TimeInterval?
  let probeWhat: String?
  let lastActionAt: TimeInterval?
  let lastOpenRequestStatus: String?
  let lastActionResponse: String?
}

private struct ShieldAttemptRecord: Codable {
  var applicationName: String
  var dayStamp: String
  var count: Int
  var lastPresentedAt: TimeInterval
}

/// Source de vérité du mur Relock, partagée par fichier entre l'app et les
/// extensions Managed Settings.
///
/// `UserDefaults(suiteName:)` reste disponible pour migrer l'ancien état, mais
/// n'est plus utilisé pour les écritures du Shield. Sur l'appareil réel,
/// `cfprefsd` conservait un cache distinct pour les extensions éphémères : le
/// mur voyait son propre compteur alors que l'app ne voyait jamais le contexte.
private struct ShieldAttemptState: Codable {
  var records: [String: ShieldAttemptRecord] = [:]
  var latestPresentation: ShieldPresentation?
  var categoryPresentations: [String: ShieldPresentation] = [:]
  var pendingRequest: PendingShieldRequest?
  var events: [ShieldEventRecord] = []
  var shownTotal = 0
  var lastShownAt: TimeInterval?
  var totalResisted = 0
  var probeAt: TimeInterval?
  var probeWhat: String?
  var lastActionAt: TimeInterval?
  var lastOpenRequestStatus: String?
  var lastActionResponse: String?

  private enum CodingKeys: String, CodingKey {
    case records
    case latestPresentation
    case categoryPresentations
    case pendingRequest
    case events
    case shownTotal
    case lastShownAt
    case totalResisted
    case probeAt
    case probeWhat
    case lastActionAt
    case lastOpenRequestStatus
    case lastActionResponse
  }

  init() {}

  init(from decoder: Decoder) throws {
    let values = try decoder.container(keyedBy: CodingKeys.self)
    records = try values.decodeIfPresent(
      [String: ShieldAttemptRecord].self, forKey: .records) ?? [:]
    latestPresentation = try values.decodeIfPresent(
      ShieldPresentation.self, forKey: .latestPresentation)
    categoryPresentations = try values.decodeIfPresent(
      [String: ShieldPresentation].self, forKey: .categoryPresentations) ?? [:]
    pendingRequest = try values.decodeIfPresent(
      PendingShieldRequest.self, forKey: .pendingRequest)
    events = try values.decodeIfPresent(
      [ShieldEventRecord].self, forKey: .events) ?? []
    shownTotal = try values.decodeIfPresent(Int.self, forKey: .shownTotal) ?? 0
    lastShownAt = try values.decodeIfPresent(
      TimeInterval.self, forKey: .lastShownAt)
    totalResisted = try values.decodeIfPresent(
      Int.self, forKey: .totalResisted) ?? 0
    probeAt = try values.decodeIfPresent(TimeInterval.self, forKey: .probeAt)
    probeWhat = try values.decodeIfPresent(String.self, forKey: .probeWhat)
    lastActionAt = try values.decodeIfPresent(
      TimeInterval.self, forKey: .lastActionAt)
    lastOpenRequestStatus = try values.decodeIfPresent(
      String.self, forKey: .lastOpenRequestStatus)
    lastActionResponse = try values.decodeIfPresent(
      String.self, forKey: .lastActionResponse)
  }
}

final class ShieldAttemptStore {
  static let suiteName = "group.com.yaya.relock"
  static let storageKey = "relock.shieldAttempts.v1"
  static let stateFileName = "relock-shield-state-v2.json"
  static let defaultDedupeInterval: TimeInterval = 3
  static let defaultContextLifetime: TimeInterval = 5 * 60
  static let unknownApplicationName = "Cette app"

  private let legacyDefaults: UserDefaults
  private let lockURL: URL
  private let stateURL: URL
  private var calendar: Calendar
  private let dedupeInterval: TimeInterval

  static func production() -> ShieldAttemptStore? {
    guard
      let defaults = UserDefaults(suiteName: suiteName),
      let container = FileManager.default.containerURL(
        forSecurityApplicationGroupIdentifier: suiteName)
    else { return nil }

    // Sur l'iPhone réel, une écriture atomique directement à la racine du
    // conteneur App Group peut échouer silencieusement depuis une extension.
    // `Application Support` est le répertoire persistant prévu par iOS pour
    // ce type d'état partagé et autorise le fichier temporaire + renommage
    // dont `Data.write(options: .atomic)` a besoin.
    let directory = container
      .appendingPathComponent("Library", isDirectory: true)
      .appendingPathComponent("Application Support", isDirectory: true)
      .appendingPathComponent("Relock", isDirectory: true)
    do {
      try FileManager.default.createDirectory(
        at: directory,
        withIntermediateDirectories: true)
    } catch {
      return nil
    }

    let stateURL = directory.appendingPathComponent(stateFileName)
    let legacyStateURL = container.appendingPathComponent(stateFileName)
    if
      !FileManager.default.fileExists(atPath: stateURL.path),
      FileManager.default.fileExists(atPath: legacyStateURL.path)
    {
      try? FileManager.default.copyItem(at: legacyStateURL, to: stateURL)
    }

    return ShieldAttemptStore(
      defaults: defaults,
      lockURL: directory.appendingPathComponent(".relock.lock"),
      stateURL: stateURL,
      calendar: .autoupdatingCurrent)
  }

  init(
    defaults: UserDefaults,
    lockURL: URL,
    stateURL: URL? = nil,
    calendar: Calendar,
    dedupeInterval: TimeInterval = ShieldAttemptStore.defaultDedupeInterval
  ) {
    legacyDefaults = defaults
    self.lockURL = lockURL
    self.stateURL = stateURL ?? lockURL.appendingPathExtension("state.json")
    self.calendar = calendar
    self.dedupeInterval = dedupeInterval
  }

  func recordAttempt(
    applicationKey: String,
    applicationName: String,
    categoryKey: String? = nil,
    now: Date = Date()
  ) -> ShieldPresentation {
    withLock {
      var state = loadState()
      let stamp = dayStamp(for: now)
      state.records = state.records.filter { $0.value.dayStamp == stamp }

      let timestamp = now.timeIntervalSince1970
      let existing = state.records[applicationKey]
      let elapsed = existing.map { timestamp - $0.lastPresentedAt }
      let isDuplicate = existing?.dayStamp == stamp
        && elapsed.map { $0 >= 0 && $0 < dedupeInterval } == true
      let count = isDuplicate ? max(1, existing?.count ?? 1) : (existing?.count ?? 0) + 1

      state.records[applicationKey] = ShieldAttemptRecord(
        applicationName: applicationName,
        dayStamp: stamp,
        count: count,
        lastPresentedAt: timestamp)
      let presentation = ShieldPresentation(
        applicationKey: applicationKey,
        applicationName: applicationName,
        count: count,
        presentedAt: timestamp)
      state.latestPresentation = presentation
      if let categoryKey {
        state.categoryPresentations[categoryKey] = presentation
      }
      if !isDuplicate {
        state.shownTotal += 1
        state.lastShownAt = timestamp
        state.events.append(
          ShieldEventRecord(
            kind: "shield_shown",
            activity: "shield",
            at: ISO8601DateFormatter().string(from: now)))
        trimEvents(&state.events)
      }
      saveState(state)
      return presentation
    }
  }

  /// Dépose le signal de navigation avant que `.openParentalControlsApp`
  /// active Relock. Le contexte exact est conservé quand iOS le fournit, mais
  /// son absence ne doit plus empêcher d'ouvrir directement l'onglet Blocages.
  @discardableResult
  func enqueueOpenRequest(
    applicationKey: String?,
    categoryKey: String? = nil,
    now: Date = Date(),
    maximumPresentationAge: TimeInterval = ShieldAttemptStore.defaultContextLifetime
  ) -> PendingShieldRequest? {
    withLock { () -> PendingShieldRequest? in
      var state = loadState()
      var key = applicationKey
      var name = applicationKey.flatMap { state.records[$0]?.applicationName }

      if key == nil {
        let presentation = categoryKey.flatMap { state.categoryPresentations[$0] }
          ?? state.latestPresentation
        if let presentation {
          let age = now.timeIntervalSince1970 - presentation.presentedAt
          if age >= 0, age <= maximumPresentationAge {
            key = presentation.applicationKey
            name = presentation.applicationName
          }
        }
      }

      let request = PendingShieldRequest(
        id: UUID().uuidString,
        applicationKey: key,
        applicationName: key == nil ? nil : (name ?? Self.unknownApplicationName),
        requestedAt: now.timeIntervalSince1970)
      state.pendingRequest = request
      guard saveState(state) else { return nil }
      return request
    }
  }

  func consumeOpenRequest(
    now: Date = Date(),
    maximumAge: TimeInterval = ShieldAttemptStore.defaultContextLifetime
  ) -> PendingShieldRequest? {
    withLock {
      var state = loadState()
      let request = state.pendingRequest
      state.pendingRequest = nil
      guard saveState(state) else { return nil }
      guard let request else { return nil }
      let age = now.timeIntervalSince1970 - request.requestedAt
      guard age >= 0, age <= maximumAge else { return nil }
      return request
    }
  }

  func peekOpenRequest(
    now: Date = Date(),
    maximumAge: TimeInterval = ShieldAttemptStore.defaultContextLifetime
  ) -> PendingShieldRequest? {
    withLock {
      guard let request = loadState().pendingRequest else { return nil }
      let age = now.timeIntervalSince1970 - request.requestedAt
      guard age >= 0, age <= maximumAge else { return nil }
      return request
    }
  }

  func lastPresentation() -> ShieldPresentation? {
    withLock { loadState().latestPresentation }
  }

  func recordProbe(_ description: String, now: Date = Date()) {
    withLock {
      var state = loadState()
      state.probeAt = now.timeIntervalSince1970
      state.probeWhat = description
      saveState(state)
    }
  }

  /// Enregistre l'action après avoir répondu au système. Le retour est le
  /// compteur total de résistances, utilisé pour les célébrations locales.
  @discardableResult
  func recordAction(
    requestStatus: String,
    response: String,
    resisted: Bool,
    now: Date = Date()
  ) -> Int {
    withLock {
      var state = loadState()
      state.lastActionAt = now.timeIntervalSince1970
      state.lastOpenRequestStatus = requestStatus
      state.lastActionResponse = response
      if resisted {
        state.totalResisted += 1
        state.events.append(
          ShieldEventRecord(
            kind: "resisted",
            activity: "shield",
            at: ISO8601DateFormatter().string(from: now)))
        trimEvents(&state.events)
      }
      saveState(state)
      return state.totalResisted
    }
  }

  func eventRecords() -> [ShieldEventRecord] {
    withLock { loadState().events }
  }

  func acknowledgeEvents(_ count: Int) {
    guard count > 0 else { return }
    withLock {
      var state = loadState()
      state.events.removeFirst(min(count, state.events.count))
      saveState(state)
    }
  }

  func diagnostics() -> ShieldDiagnosticSnapshot {
    withLock {
      let state = loadState()
      return ShieldDiagnosticSnapshot(
        shownTotal: state.shownTotal,
        lastShownAt: state.lastShownAt,
        totalResisted: state.totalResisted,
        probeAt: state.probeAt,
        probeWhat: state.probeWhat,
        lastActionAt: state.lastActionAt,
        lastOpenRequestStatus: state.lastOpenRequestStatus,
        lastActionResponse: state.lastActionResponse)
    }
  }

  /// Une vraie nouvelle installation repart à zéro, sauf si elle vient juste
  /// d'être activée par le Shield : cette requête doit survivre au reset.
  func resetKeepingFreshPendingRequest(now: Date = Date()) {
    withLock {
      let previous = loadState()
      var fresh = ShieldAttemptState()
      if let request = previous.pendingRequest {
        let age = now.timeIntervalSince1970 - request.requestedAt
        if age >= 0, age <= Self.defaultContextLifetime {
          fresh.pendingRequest = request
        }
      }
      saveState(fresh)
    }
  }

  static func tokenKey<T: Encodable>(_ token: T) -> String? {
    guard let data = try? JSONEncoder().encode(token) else { return nil }
    return data.base64EncodedString()
  }

  private func dayStamp(for date: Date) -> String {
    let components = calendar.dateComponents([.era, .year, .month, .day], from: date)
    return [components.era, components.year, components.month, components.day]
      .map { String($0 ?? 0) }
      .joined(separator: "-")
  }

  private func loadState() -> ShieldAttemptState {
    if
      let data = try? Data(contentsOf: stateURL),
      let state = try? JSONDecoder().decode(ShieldAttemptState.self, from: data)
    {
      return state
    }
    guard
      let legacyData = legacyDefaults.data(forKey: Self.storageKey),
      let legacy = try? JSONDecoder().decode(ShieldAttemptState.self, from: legacyData)
    else { return ShieldAttemptState() }
    return legacy
  }

  @discardableResult
  private func saveState(_ state: ShieldAttemptState) -> Bool {
    guard let data = try? JSONEncoder().encode(state) else { return false }
    do {
      try data.write(to: stateURL, options: .atomic)
      return true
    } catch {
      return false
    }
  }

  private func trimEvents(_ events: inout [ShieldEventRecord]) {
    if events.count > 200 {
      events.removeFirst(events.count - 200)
    }
  }

  private func withLock<T>(_ body: () -> T) -> T {
    let fd = open(lockURL.path, O_CREAT | O_WRONLY, 0o644)
    guard fd >= 0 else { return body() }
    var locked = false
    for _ in 0..<Self.lockAttempts {
      if flock(fd, LOCK_EX | LOCK_NB) == 0 {
        locked = true
        break
      }
      if errno != EWOULDBLOCK && errno != EINTR { break }
      usleep(Self.lockRetryMicroseconds)
    }
    // Le fichier d'état est lu-modifié-écrit en entier : une exécution sans
    // verrou laisserait l'app et les extensions s'écraser mutuellement. Après
    // la fenêtre non bloquante, on attend donc réellement le verrou ; les
    // sections critiques ne font qu'un chargement et une écriture atomique.
    while !locked {
      if flock(fd, LOCK_EX) == 0 {
        locked = true
        break
      }
      if errno != EINTR { break }
    }
    defer {
      if locked { flock(fd, LOCK_UN) }
      close(fd)
    }
    return body()
  }

  /// ~50 ms de tentatives non bloquantes avant de basculer sur une attente
  /// bloquante : le chemin sans contention reste sans latence.
  private static let lockAttempts = 25
  private static let lockRetryMicroseconds: UInt32 = 2_000
}
