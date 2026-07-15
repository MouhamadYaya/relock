import DeviceActivity
import FamilyControls
import ManagedSettings
import SwiftUI
import os

/// Extension DeviceActivityReport de Relock.
/// Seul endroit où iOS autorise la lecture du temps d'écran système réel
/// (par app, par heure) et le rendu des vraies icônes d'apps. Le contenu est
/// une vue SwiftUI, hébergée dans l'app via `DeviceActivityReport(.usage, …)`.
///
/// ⚠️ Sandbox Apple : cette extension NE PEUT PAS exfiltrer les données
/// (réseau interdit, écritures App Group silencieusement perdues côté app).
/// Tout chiffre de temps d'écran à AFFICHER doit donc être RENDU ICI, dans
/// une scène — jamais « publié » vers l'app. C'est la raison d'être de la
/// scène `HeroReport` (total du jour de l'Accueil).
enum RelockReportLog {
  static let log = Logger(subsystem: "com.yaya.relock", category: "report")
}

@main
struct RelockActivityReport: DeviceActivityReportExtension {
  var body: some DeviceActivityReportScene {
    UsageReport { model in
      UsageReportView(model: model)
    }
    PillsReport { apps in
      UsagePillsView(apps: apps)
    }
    HeroReport { model in
      HeroTotalView(model: model)
    }
  }
}

extension DeviceActivityReport.Context {
  static let usage = Self("Usage")
}

struct AppUsage: Identifiable {
  let id: String
  let name: String
  let seconds: Double
  let pickups: Int
  let notifications: Int
  let token: ApplicationToken?
}

struct UsageModel {
  var totalSeconds: Double = 0
  var totalPickups: Int = 0
  var totalNotifications: Int = 0
  var values: [Double] = [] // durée par bucket (heure ou jour), chronologique
  var xLabels: [String] = [] // 4 repères d'axe X (ex. 00h · 06h · 12h · 18h)
  var apps: [AppUsage] = []
  /// Tranches horaires (vue Jour) ou quotidiennes (Semaine/Mois) — pilote le
  /// titre du graphe (« par heure » / « par jour »).
  var isHourly = true
  /// Libellé de date FR dérivé de l'étendue réelle des segments (le filtre
  /// vient de l'app hôte) : « Aujourd'hui, 13 juillet » / « Semaine du 7 juillet ».
  var dateLabel: String = ""
}

struct UsageReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .usage
  let content: (UsageModel) -> UsageReportView

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> UsageModel {
    var model = UsageModel()
    var byApp: [String: AppUsage] = [:]
    var buckets: [(Date, Double)] = []
    var spanStart: Date?
    var spanEnd: Date?
    var entryCount = 0
    var segmentCount = 0
    let nowRef = Date()

    for await entry in data {
      entryCount += 1
      for await segment in entry.activitySegments {
        segmentCount += 1
        let dur = segment.totalActivityDuration
        buckets.append((segment.dateInterval.start, dur))
        spanStart = min(spanStart ?? segment.dateInterval.start, segment.dateInterval.start)
        spanEnd = max(spanEnd ?? segment.dateInterval.end, segment.dateInterval.end)

        // Un segment FUTUR (start ≥ maintenant) ne peut contenir que des
        // données parasites (autre fuseau / autre appareil) : il est déjà
        // exclu du graphe, on l'exclut aussi des totaux et du classement.
        guard segment.dateInterval.start < nowRef else { continue }

        for await category in segment.categories {
          for await app in category.applications {
            let sec = app.totalActivityDuration
            let pick = app.numberOfPickups
            let notif = app.numberOfNotifications
            guard sec > 0 || pick > 0 || notif > 0 else { continue }
            let name = app.application.localizedDisplayName ?? "App"
            let key = app.application.bundleIdentifier ?? name
            let prev = byApp[key]
            byApp[key] = AppUsage(
              id: key, name: name,
              seconds: (prev?.seconds ?? 0) + sec,
              pickups: (prev?.pickups ?? 0) + pick,
              notifications: (prev?.notifications ?? 0) + notif,
              token: app.application.token)
            model.totalPickups += pick
            model.totalNotifications += notif
          }
        }
      }
    }

    // Une app ne peut pas avoir tourné plus longtemps que la fenêtre écoulée
    // elle-même : plafonne les valeurs aberrantes remontées par iOS (ex.
    // « Réglages · 20 h ») au temps réellement écoulé de la période.
    let elapsedWindow = windowElapsed(from: spanStart, to: spanEnd, now: nowRef)
    if let cap = elapsedWindow {
      for (key, app) in byApp where app.seconds > cap {
        RelockReportLog.log.error(
          "usage: valeur aberrante plafonnée \(key, privacy: .public) \(Int(app.seconds), privacy: .public)s > fenêtre \(Int(cap), privacy: .public)s"
        )
        byApp[key] = AppUsage(
          id: app.id, name: app.name, seconds: cap, pickups: app.pickups,
          notifications: app.notifications, token: app.token)
      }
    }

    model.apps = byApp.values.sorted { $0.seconds > $1.seconds }
    RelockReportLog.log.info(
      "usage: entries=\(entryCount, privacy: .public) segments=\(segmentCount, privacy: .public) apps=\(byApp.count, privacy: .public) top=\(Int(model.apps.first?.seconds ?? 0), privacy: .public)s"
    )

    // ── Grille alignée sur le TEMPS (chaque tranche à SA place réelle) ──
    // iOS renvoie des segments épars ou décalés (autre appareil/fuseau) : les
    // afficher bout à bout les désaligne et les fait « déborder » dans le futur.
    // On construit une grille fixe : chaque segment est rangé dans sa tranche
    // réelle (heure du jour, ou jour de la période), 0 ailleurs, et toute
    // tranche FUTURE (start ≥ maintenant) est ignorée. L'axe X est calé dessus,
    // et le total = somme des barres réellement affichées (puis plafonné).
    let now = Date()
    let lf = DateFormatter()
    lf.locale = Locale(identifier: "fr_FR")
    if let s = spanStart, let e = spanEnd {
      let span = e.timeIntervalSince(s)
      let hourly = span <= 90_000 // ≤ ~25h → vue Jour (tranches d'1 h)
      model.isHourly = hourly
      let slot = hourly ? 3_600.0 : 86_400.0
      let n = max(1, Int((span / slot).rounded()))
      var grid = [Double](repeating: 0, count: n)
      for (start, dur) in buckets where start < now {
        let idx = Int((start.timeIntervalSince(s) / slot).rounded(.down))
        if idx >= 0 && idx < n { grid[idx] += dur }
      }
      model.values = grid
      model.totalSeconds = cappedScreenTime(grid.reduce(0, +), from: s, to: e)

      // Axe X calé sur la grille (mêmes positions que les barres).
      if hourly {
        lf.dateFormat = "HH'h'" // 00h · 06h · 12h · 18h
        for frac in [0.0, 0.25, 0.5, 0.75] {
          let i = min(n - 1, Int(Double(n) * frac))
          model.xLabels.append(
            lf.string(from: s.addingTimeInterval(Double(i) * slot)))
        }
      } else if n <= 10 {
        lf.dateFormat = "EEEEE" // Semaine : L M M J V S D
        for i in 0..<n {
          model.xLabels.append(
            lf.string(from: s.addingTimeInterval(Double(i) * slot))
              .uppercased())
        }
      } else {
        lf.dateFormat = "d/M" // Mois : 4 repères de date
        for frac in [0.0, 0.25, 0.5, 0.75] {
          let i = min(n - 1, Int(Double(n) * frac))
          model.xLabels.append(
            lf.string(from: s.addingTimeInterval(Double(i) * slot)))
        }
      }

    }

    // Libellé de date FR — dérivé des dates réelles de la période, valable
    // aussi pour les semaines/mois passés (sélecteurs de l'Activité).
    if let s = spanStart, let e = spanEnd {
      let days = e.timeIntervalSince(s) / 86_400
      let cal = Calendar.current
      let df = DateFormatter()
      df.locale = Locale(identifier: "fr_FR")
      if days <= 1.5 {
        df.dateFormat = "d MMMM"
        if cal.isDateInToday(s) {
          model.dateLabel = "Aujourd'hui, \(df.string(from: s))"
        } else {
          df.dateFormat = "EEEE d MMMM"
          model.dateLabel = df.string(from: s).capitalizedFirst
        }
      } else if days <= 8 {
        if cal.isDate(Date(), equalTo: s, toGranularity: .weekOfYear) {
          model.dateLabel = "Cette semaine"
        } else {
          df.dateFormat = "d MMMM"
          model.dateLabel = "Semaine du \(df.string(from: s))"
        }
      } else {
        if cal.isDate(Date(), equalTo: s, toGranularity: .month) {
          model.dateLabel = "Ce mois-ci"
        } else {
          df.dateFormat = "MMMM yyyy"
          model.dateLabel = df.string(from: s).capitalizedFirst
        }
      }
    }
    return model
  }
}

extension String {
  var capitalizedFirst: String {
    guard let f = first else { return self }
    return String(f).uppercased() + dropFirst()
  }
}

/// Plafonne un total de temps d'écran au temps réellement ÉCOULÉ de la fenêtre :
/// il ne peut PAS dépasser (fin_effective − début). Neutralise les agrégations
/// multi-appareils / multi-comptes (Partage familial) qui gonflent le total
/// au-delà du possible (ex. « 20 h aujourd'hui » alors qu'il est 17 h).
func cappedScreenTime(_ raw: Double, from s: Date?, to e: Date?) -> Double {
  guard let s = s, let e = e else { return raw }
  let elapsed = max(0, min(e, Date()).timeIntervalSince(s))
  return min(raw, elapsed)
}

/// Temps écoulé (s) d'une fenêtre [début, fin] à l'instant `now`, ou nil si
/// la fenêtre est inconnue. Sert de plafond aux durées PAR APP.
func windowElapsed(from s: Date?, to e: Date?, now: Date = Date()) -> Double? {
  guard let s = s, let e = e else { return nil }
  return max(0, min(e, now).timeIntervalSince(s))
}

// MARK: - Pilules « où part ton temps aujourd'hui » (Accueil)

/// Scène compacte : les apps du jour triées par durée décroissante.
/// Hébergée sur l'Accueil via `ScreenTimeReportView` (mode « pills »).
struct PillsReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .init("TodayPills")
  let content: ([AppUsage]) -> UsagePillsView

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> [AppUsage] {
    var byApp: [String: AppUsage] = [:]
    let nowRef = Date()
    var spanStart: Date?
    var spanEnd: Date?
    for await entry in data {
      for await segment in entry.activitySegments {
        spanStart = min(
          spanStart ?? segment.dateInterval.start, segment.dateInterval.start)
        spanEnd = max(
          spanEnd ?? segment.dateInterval.end, segment.dateInterval.end)
        guard segment.dateInterval.start < nowRef else { continue }
        for await category in segment.categories {
          for await app in category.applications {
            let sec = app.totalActivityDuration
            guard sec > 0 else { continue }
            let name = app.application.localizedDisplayName ?? "App"
            let key = app.application.bundleIdentifier ?? name
            let prev = byApp[key]
            byApp[key] = AppUsage(
              id: key, name: name, seconds: (prev?.seconds ?? 0) + sec,
              pickups: 0, notifications: 0,
              token: prev?.token ?? app.application.token)
          }
        }
      }
    }
    // Plafond par app : jamais plus que le temps écoulé de la journée.
    if let cap = windowElapsed(from: spanStart, to: spanEnd, now: nowRef) {
      for (key, app) in byApp where app.seconds > cap {
        byApp[key] = AppUsage(
          id: app.id, name: app.name, seconds: cap, pickups: 0,
          notifications: 0, token: app.token)
      }
    }
    return byApp.values.sorted { $0.seconds > $1.seconds }
  }
}

/// Rangée de pilules : carte gris foncé SUBTILE derrière chaque pilule, icône en
/// haut + durée compacte juste dessous (espace moyen). Défilement horizontal,
/// ~5 cartes visibles + la suivante tronquée à droite (indice de défilement).
struct UsagePillsView: View {
  let apps: [AppUsage]

  // Carte gris foncé SUBTILE (plus discrète que l'image, sans liseré) + durée sobre.
  private let cardBg = Color.white.opacity(0.045)
  private let time = Color.white.opacity(0.55)
  private let ink2 = Color(red: 0.66, green: 0.67, blue: 0.75)
  private let iconBg = Color.white.opacity(0.08)

  private func short(_ s: Double) -> String {
    let m = Int(s / 60)
    if m < 1 { return "<1m" }
    if m < 60 { return "\(m)m" }
    let h = m / 60
    let r = m % 60
    return r == 0 ? "\(h)h" : "\(h)h \(r)"  // « 2h 14 » — compact, minimaliste
  }

  var body: some View {
    // Carte gris foncé subtile derrière chaque pilule (comme l'image, en plus
    // discret) : icône en haut, durée compacte juste dessous, espace MOYEN.
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(alignment: .top, spacing: 9) {
        ForEach(apps.prefix(12)) { app in
          VStack(spacing: 5) {  // espace MOYEN icône ↔ durée
            if let token = app.token {
              Label(token)
                .labelStyle(.iconOnly)
                .font(.system(size: 40))
                .frame(width: 42, height: 42)
                .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
            } else {
              RoundedRectangle(cornerRadius: 11, style: .continuous)
                .fill(iconBg)
                .frame(width: 42, height: 42)
            }
            Text(short(app.seconds))
              .font(.system(size: 12, weight: .medium))
              .foregroundColor(time)
              .lineLimit(1)
          }
          .frame(width: 66, height: 74)  // ~taille image (un peu + haute que large)
          .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous).fill(cardBg)
          )
        }
        if apps.isEmpty {
          Text("Aucune utilisation aujourd'hui — belle journée.")
            .font(.system(size: 13))
            .foregroundColor(ink2)
            .padding(.vertical, 12)
        }
      }
      .padding(.horizontal, 2)
    }
    .environment(\.colorScheme, .dark)  // sinon iOS rend les libellés en noir
  }
}

// MARK: - Héro Accueil : total du jour + delta vs hier
//
// Le sandbox de cette extension interdit de « publier » le total vers l'app
// (écritures App Group invisibles côté app) : le chiffre de l'Accueil est donc
// RENDU ici. Le filtre hôte couvre [hier 00:00 → aujourd'hui 23:59] en
// segments quotidiens → la scène calcule aujourd'hui ET hier, donc le delta.

struct HeroModel {
  var todaySeconds: Double = 0
  /// nil = aucune donnée d'hier (delta masqué, jamais inventé).
  var yesterdaySeconds: Double?
}

struct HeroReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .init("TodayHero")
  let content: (HeroModel) -> HeroTotalView

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> HeroModel {
    let cal = Calendar.current
    let nowRef = Date()
    var today = 0.0
    var yesterday = 0.0
    var sawYesterday = false
    var todayStart: Date?
    var todayEnd: Date?

    for await entry in data {
      for await segment in entry.activitySegments {
        let start = segment.dateInterval.start
        guard start < nowRef else { continue }
        let dur = segment.totalActivityDuration
        if cal.isDateInToday(start) {
          today += dur
          todayStart = min(todayStart ?? start, start)
          todayEnd = max(
            todayEnd ?? segment.dateInterval.end, segment.dateInterval.end)
        } else if cal.isDateInYesterday(start) {
          yesterday += dur
          sawYesterday = true
        }
      }
    }

    var model = HeroModel()
    model.todaySeconds = cappedScreenTime(today, from: todayStart, to: todayEnd)
    model.yesterdaySeconds = sawYesterday ? min(yesterday, 86_400) : nil
    RelockReportLog.log.info(
      "hero: today=\(Int(model.todaySeconds), privacy: .public)s yesterday=\(Int(yesterday), privacy: .public)s"
    )
    return model
  }
}

/// Rendu du héro — calqué sur la maquette RN (gros total 44 pt + delta coloré).
struct HeroTotalView: View {
  let model: HeroModel

  private let ink = Color(red: 0.961, green: 0.961, blue: 0.969)  // #F5F5F7
  private let unit = Color(red: 0.922, green: 0.922, blue: 0.961).opacity(0.45)
  private let green = Color(red: 0.373, green: 0.788, blue: 0.545)  // #5FC98B
  private let amber = Color(red: 0.878, green: 0.635, blue: 0.306)  // #E0A24E

  private var deltaMin: Int? {
    guard let y = model.yesterdaySeconds else { return nil }
    return Int(((model.todaySeconds - y) / 60).rounded())
  }

  /// « 36 min » / « 2 h 14 » — segments (valeur, unité) du gros total.
  private var segments: [(String, String)] {
    let m = Int(model.todaySeconds / 60)
    if m < 60 { return [(String(m), "min")] }
    let h = m / 60
    let r = m % 60
    var out = [(String(h), "h")]
    if r > 0 { out.append((String(r), "min")) }
    return out
  }

  private func deltaLabel(_ absMin: Int) -> String {
    if absMin < 60 { return "\(absMin) min" }
    let h = absMin / 60
    let r = absMin % 60
    return r == 0 ? "\(h) h" : "\(h) h \(r)"
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 5) {
      HStack(alignment: .firstTextBaseline, spacing: 7) {
        ForEach(Array(segments.enumerated()), id: \.offset) { _, seg in
          HStack(alignment: .firstTextBaseline, spacing: 7) {
            Text(seg.0)
              .font(.system(size: 44, weight: .bold))
              .kerning(-1.2)
              .monospacedDigit()
              .foregroundColor(ink)
            Text(seg.1)
              .font(.system(size: 22, weight: .semibold))
              .kerning(-0.4)
              .foregroundColor(unit)
          }
        }
      }
      if let d = deltaMin {
        let less = d < 0
        let same = d == 0
        let color = same ? unit : (less ? green : amber)
        HStack(spacing: 6) {
          Image(systemName: same ? "minus" : (less ? "chevron.down" : "chevron.up"))
            .font(.system(size: 11, weight: .bold))
            .foregroundColor(color)
          Text(
            same
              ? "identique à hier"
              : "\(deltaLabel(abs(d))) de \(less ? "moins" : "plus") qu'hier"
          )
          .font(.system(size: 13.5, weight: .medium))
          .foregroundColor(color)
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .environment(\.colorScheme, .dark)
  }
}
