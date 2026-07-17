import DeviceActivity
import FamilyControls
import ManagedSettings
import SwiftUI
import os

/// Extension DeviceActivityReport de Relock.
/// Seul endroit où iOS autorise la lecture du temps d'écran système réel
/// (par app, par heure) et le rendu des vraies icônes d'apps. Le contenu est
/// une vue SwiftUI, hébergée dans l'app via `DeviceActivityReport(…)`.
///
/// ⚠️ Sandbox Apple : cette extension NE PEUT PAS exfiltrer les données
/// (réseau interdit, écritures App Group silencieusement perdues côté app).
/// Tout chiffre de temps d'écran à AFFICHER doit donc être RENDU ICI, dans
/// une scène — jamais « publié » vers l'app.
enum RelockReportLog {
  static let log = Logger(subsystem: "com.yaya.relock", category: "report")
}

@main
struct RelockActivityReport: DeviceActivityReportExtension {
  var body: some DeviceActivityReportScene {
    // L'Activité empile trois vues : résumé, graphe, classement. Le résumé et
    // le classement veulent des segments QUOTIDIENS (seule granularité où iOS
    // renseigne activations et notifications) alors que le graphe du jour veut
    // des tranches HORAIRES : filtres différents ⇒ rapports séparés. Ils sont
    // donc scindés en deux scènes pour que le graphe puisse s'intercaler au
    // milieu, comme dans la maquette.
    SummaryReport { model in
      UsageSummaryView(model: model)
    }
    AppsReport { model in
      UsageAppsView(model: model)
    }
    // Graphe : tranches horaires (Jour) ou quotidiennes (Semaine/Mois). Deux
    // contextes distincts → la granularité est connue PAR CONSTRUCTION, même
    // quand la période ne contient aucune donnée.
    HourChartReport { model in
      UsageChartView(model: model)
    }
    DayChartReport { model in
      UsageChartView(model: model)
    }
    PillsReport { apps in
      UsagePillsView(apps: apps)
    }
    HeroReport { model in
      HeroTotalView(model: model)
    }
  }
}

// MARK: - Identité d'une app
//
// ⚠️ PIÈGE MAJEUR : iOS ne renseigne `bundleIdentifier` / `localizedDisplayName`
// QUE pour les apps explicitement autorisées (celles de la sélection de
// l'utilisateur). Pour toutes les autres, les DEUX sont nil. Une clé
// « bundleIdentifier ?? nom » vaut donc « App » pour des dizaines d'apps
// différentes : elles fusionnent en UNE ligne dont la durée est leur somme et
// dont l'icône est celle de la dernière rencontrée (« Réglages · 16 h »).
// Le `token` est la SEULE identité toujours fournie — et il est Hashable.
enum AppKey: Hashable {
  case token(ApplicationToken)
  case web(WebDomainToken)
  case label(String)
}

/// De quoi rendre l'icône + le nom réels d'une ligne. Les sites consultés dans
/// Safari sont comptés SÉPARÉMENT des apps par iOS (`res.cisco.com`, 3 h 48 —
/// premier poste d'une journée) : les ignorer amputait le total d'autant.
enum UsageIcon {
  case app(ApplicationToken)
  case web(WebDomainToken)
  case none
}

struct AppUsage: Identifiable {
  let id: String
  let name: String
  let seconds: Double
  let pickups: Int
  let notifications: Int
  let icon: UsageIcon
}

/// Mesures d'UNE app (ou d'un site) sur UN segment.
private struct AppStat {
  var seconds: Double
  var pickups: Int
  var notifications: Int
  var name: String
  var icon: UsageIcon
}

/// Une tranche de temps (heure ou jour) et le total des apps qu'elle contient.
struct UsageBucket {
  let start: Date
  let seconds: Double
}

/// Résultat brut d'un rapport, indépendant de la vue qui le consomme.
struct UsageAggregate {
  var apps: [AppUsage] = []
  var buckets: [UsageBucket] = []
  var totalSeconds: Double = 0
  var totalPickups: Int = 0
  var totalNotifications: Int = 0
  var spanStart: Date?
  var spanEnd: Date?
  var hadData = false
}

/// Agrège un rapport en une source de vérité UNIQUE, utilisée par toutes les
/// scènes (accueil, graphe, classement) — c'est ce qui garantit que le total
/// de l'Accueil, celui de l'Activité et la somme des lignes concordent.
///
/// Principes :
///  • Le total NE vient PAS de `segment.totalActivityDuration` : cette valeur
///    est incohérente d'une segmentation à l'autre (le même jour vaut 17 h en
///    tranches quotidiennes et 11 h en tranches horaires) et ne correspond pas
///    à la somme des apps affichées. On ne somme QUE des durées par app —
///    la seule mesure que l'utilisateur peut vérifier ligne par ligne.
///  • Anti-double-comptage : iOS peut renvoyer plusieurs « entries » couvrant
///    le même segment (plusieurs appareils/comptes). On prend le MAXIMUM par
///    (segment, app) au lieu d'additionner — sinon les durées doublent.
///  • Chaque mesure est bornée par le temps réellement écoulé du segment :
///    une app ne peut pas tourner 3 h dans une tranche d'1 h.
func aggregateUsage(
  _ data: DeviceActivityResults<DeviceActivityData>,
  scene: String = "?",
  now: Date = Date()
) async -> UsageAggregate {
  var perSegment: [Date: [AppKey: AppStat]] = [:]
  var segmentCap: [Date: Double] = [:]
  var out = UsageAggregate()
  var entryCount = 0

  for await entry in data {
    entryCount += 1
    for await segment in entry.activitySegments {
      let iv = segment.dateInterval
      out.spanStart = min(out.spanStart ?? iv.start, iv.start)
      out.spanEnd = max(out.spanEnd ?? iv.end, iv.end)
      // Tranche entièrement dans le futur : ne peut contenir que des données
      // parasites (autre fuseau, horloge d'un autre appareil).
      guard iv.start < now else { continue }
      let cap = max(0, min(iv.end, now).timeIntervalSince(iv.start))
      segmentCap[iv.start] = cap

      // MAX, pas += : deux entries décrivant le même segment sont deux vues de
      // la même réalité (plusieurs appareils/comptes), pas deux usages à cumuler.
      func record(_ key: AppKey, _ stat: AppStat) {
        out.hadData = true
        if let prev = perSegment[iv.start]?[key] {
          perSegment[iv.start]?[key] = AppStat(
            seconds: max(prev.seconds, stat.seconds),
            pickups: max(prev.pickups, stat.pickups),
            notifications: max(prev.notifications, stat.notifications),
            name: prev.name == "App" ? stat.name : prev.name,
            icon: {
              if case .none = prev.icon { return stat.icon }
              return prev.icon
            }())
        } else {
          perSegment[iv.start, default: [:]][key] = stat
        }
      }

      for await category in segment.categories {
        for await app in category.applications {
          let sec = min(app.totalActivityDuration, cap)
          let pick = app.numberOfPickups
          let notif = app.numberOfNotifications
          guard sec > 0 || pick > 0 || notif > 0 else { continue }
          let token = app.application.token
          let name =
            app.application.localizedDisplayName
            ?? app.application.bundleIdentifier ?? "App"
          record(
            token.map { .token($0) } ?? .label(name),
            AppStat(
              seconds: sec, pickups: pick, notifications: notif, name: name,
              icon: token.map { .app($0) } ?? .none))
        }

        // Sites consultés dans Safari : iOS les compte À PART des apps. Sans
        // eux, le total de l'app est très en dessous de celui de Réglages >
        // Temps d'écran (un domaine peut être le 1er poste de la journée).
        for await web in category.webDomains {
          let sec = min(web.totalActivityDuration, cap)
          guard sec > 0 else { continue }
          // Un domaine n'expose qu'une durée — ni activations ni notifications.
          let token = web.webDomain.token
          let name = web.webDomain.domain ?? "Site web"
          record(
            token.map { .web($0) } ?? .label(name),
            AppStat(
              seconds: sec, pickups: 0, notifications: 0, name: name,
              icon: token.map { .web($0) } ?? .none))
        }
      }
    }
  }

  // Somme sur les segments (chaque segment est déjà dédupliqué).
  var totals: [AppKey: AppStat] = [:]
  for (start, stats) in perSegment {
    var segSeconds = 0.0
    for (key, s) in stats {
      segSeconds += s.seconds
      if let prev = totals[key] {
        totals[key] = AppStat(
          seconds: prev.seconds + s.seconds,
          pickups: prev.pickups + s.pickups,
          notifications: prev.notifications + s.notifications,
          name: prev.name == "App" ? s.name : prev.name,
          icon: {
            if case .none = prev.icon { return s.icon }
            return prev.icon
          }())
      } else {
        totals[key] = s
      }
      out.totalPickups += s.pickups
      out.totalNotifications += s.notifications
    }
    // Le cumul des apps d'une tranche ne peut pas dépasser sa durée écoulée
    // (deux apps peuvent être comptées en parallèle : image dans l'image…).
    let cap = segmentCap[start] ?? segSeconds
    out.buckets.append(UsageBucket(start: start, seconds: min(segSeconds, cap)))
  }
  out.buckets.sort { $0.start < $1.start }

  out.apps = totals.map { key, s in
    AppUsage(
      id: keyIdentifier(key), name: s.name, seconds: s.seconds,
      pickups: s.pickups, notifications: s.notifications, icon: s.icon)
  }
  .sorted { $0.seconds > $1.seconds }

  // Total = somme des tranches = somme des apps. Une seule définition.
  out.totalSeconds = out.buckets.reduce(0) { $0 + $1.seconds }

  RelockReportLog.log.info(
    """
    agrégat[\(scene, privacy: .public)]: entries=\(entryCount, privacy: .public) \
    segments=\(perSegment.count, privacy: .public) \
    apps=\(out.apps.count, privacy: .public) \
    total=\(Int(out.totalSeconds), privacy: .public)s \
    pickups=\(out.totalPickups, privacy: .public) \
    top=\(out.apps.first.map { "\($0.name) \(Int($0.seconds))s" } ?? "—", privacy: .public)
    """
  )
  if entryCount > 1 {
    RelockReportLog.log.error(
      "agrégat: \(entryCount, privacy: .public) entries — dédup par MAX appliquée (plusieurs appareils/comptes ?)"
    )
  }
  return out
}

private func keyIdentifier(_ key: AppKey) -> String {
  switch key {
  case .token(let t): return "t\(t.hashValue)"
  case .web(let w): return "w\(w.hashValue)"
  case .label(let l): return "l\(l)"
  }
}

// MARK: - Libellé de période

/// Libellé FR d'une période, dérivé de la granularité DEMANDÉE (pas des
/// données) : reste correct quand la période ne contient aucune donnée.
func periodLabel(start: Date?, end: Date?, hourly: Bool) -> String {
  guard let s = start else { return "" }
  let cal = Calendar.current
  let df = DateFormatter()
  df.locale = Locale(identifier: "fr_FR")
  let days = (end?.timeIntervalSince(s) ?? 0) / 86_400

  if hourly || days <= 1.5 {
    if cal.isDateInToday(s) {
      df.dateFormat = "d MMMM"
      return "Aujourd'hui, \(df.string(from: s))"
    }
    df.dateFormat = "EEEE d MMMM"
    return df.string(from: s).capitalizedFirst
  }
  if days <= 8 {
    if cal.isDate(Date(), equalTo: s, toGranularity: .weekOfYear) {
      return "Cette semaine"
    }
    df.dateFormat = "d MMMM"
    return "Semaine du \(df.string(from: s))"
  }
  if cal.isDate(Date(), equalTo: s, toGranularity: .month) { return "Ce mois-ci" }
  df.dateFormat = "MMMM yyyy"
  return df.string(from: s).capitalizedFirst
}

extension String {
  var capitalizedFirst: String {
    guard let f = first else { return self }
    return String(f).uppercased() + dropFirst()
  }
}

// MARK: - Scènes : résumé et classement (segments QUOTIDIENS)

struct UsageModel {
  var totalSeconds: Double = 0
  var totalPickups: Int = 0
  var totalNotifications: Int = 0
  var apps: [AppUsage] = []
  var dateLabel: String = ""
  /// Aucune donnée renvoyée par iOS pour cette période (≠ « 0 minute »).
  var isEmpty = true
  /// Période antérieure à l'historique conservé par iOS (~30 j).
  var beyondRetention = false
}

private func usageModel(
  _ data: DeviceActivityResults<DeviceActivityData>,
  scene: String
) async -> UsageModel {
  let agg = await aggregateUsage(data, scene: scene)
  var model = UsageModel()
  model.totalSeconds = agg.totalSeconds
  model.totalPickups = agg.totalPickups
  model.totalNotifications = agg.totalNotifications
  model.apps = agg.apps
  model.isEmpty = !agg.hadData
  model.dateLabel = periodLabel(
    start: agg.spanStart, end: agg.spanEnd, hourly: false)
  if let s = agg.spanStart, !agg.hadData {
    // iOS ne conserve qu'un historique court : au-delà, « 0 min » n'est pas
    // une réalité mesurée mais une absence de données. On le dit.
    model.beyondRetention = Date().timeIntervalSince(s) > 30 * 86_400
  }
  return model
}

struct SummaryReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .init("UsageSummary")
  let content: (UsageModel) -> UsageSummaryView

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> UsageModel {
    await usageModel(data, scene: "summary")
  }
}

struct AppsReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .init("UsageApps")
  let content: (UsageModel) -> UsageAppsView

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> UsageModel {
    await usageModel(data, scene: "apps")
  }
}

// MARK: - Scènes : graphe (deux granularités = deux contextes)

struct ChartModel {
  var values: [Double] = []
  var xLabels: [String] = []
  var isHourly = true
}

/// Construit une grille alignée sur le TEMPS : chaque tranche à SA place
/// réelle, 0 ailleurs — sinon les segments épars se tassent et débordent.
private func makeChart(_ agg: UsageAggregate, hourly: Bool) -> ChartModel {
  var model = ChartModel()
  model.isHourly = hourly
  guard let s = agg.spanStart, let e = agg.spanEnd else { return model }

  let slot = hourly ? 3_600.0 : 86_400.0
  let span = e.timeIntervalSince(s)
  let n = max(1, Int((span / slot).rounded()))
  var grid = [Double](repeating: 0, count: n)
  for b in agg.buckets {
    let idx = Int((b.start.timeIntervalSince(s) / slot).rounded(.down))
    if idx >= 0 && idx < n { grid[idx] = min(grid[idx] + b.seconds, slot) }
  }
  model.values = grid

  let lf = DateFormatter()
  lf.locale = Locale(identifier: "fr_FR")
  if hourly {
    lf.dateFormat = "HH'h'"  // 00h · 06h · 12h · 18h
    for frac in [0.0, 0.25, 0.5, 0.75] {
      let i = min(n - 1, Int(Double(n) * frac))
      model.xLabels.append(lf.string(from: s.addingTimeInterval(Double(i) * slot)))
    }
  } else if n <= 10 {
    lf.dateFormat = "EEEEE"  // Semaine : L M M J V S D
    for i in 0..<n {
      model.xLabels.append(
        lf.string(from: s.addingTimeInterval(Double(i) * slot)).uppercased())
    }
  } else {
    lf.dateFormat = "d/M"  // Mois : 4 repères de date
    for frac in [0.0, 0.25, 0.5, 0.75] {
      let i = min(n - 1, Int(Double(n) * frac))
      model.xLabels.append(lf.string(from: s.addingTimeInterval(Double(i) * slot)))
    }
  }
  return model
}

struct HourChartReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .init("ChartHour")
  let content: (ChartModel) -> UsageChartView

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> ChartModel {
    makeChart(await aggregateUsage(data, scene: "chartHour"), hourly: true)
  }
}

struct DayChartReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .init("ChartDay")
  let content: (ChartModel) -> UsageChartView

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> ChartModel {
    makeChart(await aggregateUsage(data, scene: "chartDay"), hourly: false)
  }
}

// MARK: - Scène : pilules « où part ton temps aujourd'hui » (Accueil)

struct PillsReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context = .init("TodayPills")
  let content: ([AppUsage]) -> UsagePillsView

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> [AppUsage] {
    await aggregateUsage(data, scene: "pills").apps
  }
}

/// Rangée de pilules : carte gris foncé SUBTILE derrière chaque pilule, icône en
/// haut + durée compacte juste dessous. Défilement horizontal.
struct UsagePillsView: View {
  let apps: [AppUsage]

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
    return r == 0 ? "\(h)h" : "\(h)h \(r)"
  }

  var body: some View {
    ScrollView(.horizontal, showsIndicators: false) {
      HStack(alignment: .top, spacing: 9) {
        ForEach(apps.prefix(12)) { app in
          VStack(spacing: 5) {
            switch app.icon {
            case .app(let token):
              Label(token)
                .labelStyle(.iconOnly)
                .font(.system(size: 40))
                .frame(width: 42, height: 42)
                .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
            case .web(let token):
              Label(token)
                .labelStyle(.iconOnly)
                .font(.system(size: 40))
                .frame(width: 42, height: 42)
                .clipShape(RoundedRectangle(cornerRadius: 11, style: .continuous))
            case .none:
              RoundedRectangle(cornerRadius: 11, style: .continuous)
                .fill(iconBg)
                .frame(width: 42, height: 42)
            }
            Text(short(app.seconds))
              .font(.system(size: 12, weight: .medium))
              .foregroundColor(time)
              .lineLimit(1)
          }
          .frame(width: 66, height: 74)
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

// MARK: - Scène : héro Accueil (total du jour + delta vs hier)
//
// Filtre hôte : [hier 00:00 → fin d'aujourd'hui] en segments QUOTIDIENS — la
// même granularité et la même formule que le résumé de l'Activité, pour que
// les deux écrans affichent rigoureusement le même chiffre.

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
    let agg = await aggregateUsage(data, scene: "hero")
    let cal = Calendar.current
    var model = HeroModel()
    for b in agg.buckets {
      if cal.isDateInToday(b.start) {
        model.todaySeconds += b.seconds
      } else if cal.isDateInYesterday(b.start) {
        model.yesterdaySeconds = (model.yesterdaySeconds ?? 0) + b.seconds
      }
    }
    RelockReportLog.log.info(
      "hero: today=\(Int(model.todaySeconds), privacy: .public)s yesterday=\(Int(model.yesterdaySeconds ?? -1), privacy: .public)s"
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
