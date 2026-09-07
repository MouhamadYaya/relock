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
    dayScenes
    homeScenes
  }

  /// Activité — vue « Jour » (aujourd'hui + les 6 jours précédents).
  @DeviceActivityReportBuilder
  private var dayScenes: some DeviceActivityReportScene {
    // ⚠️ UN SEUL rapport par écran. Le contenu défilant vit entièrement
    // dans cette extension; l'app hôte ne superpose que les contrôles locaux.
    //
    // Un contexte précis par jour visible. La scène connaît ainsi le décalage
    // même lorsque iOS ne renvoie aucune donnée; aucun état ne
    // transite par le sandbox du rapport.
    UsageReportScene(context: .init("ActivityP0O0"), offset: 0) { UsageReportView(model: $0) }
    UsageReportScene(context: .init("ActivityP0O1"), offset: 1) { UsageReportView(model: $0) }
    UsageReportScene(context: .init("ActivityP0O2"), offset: 2) { UsageReportView(model: $0) }
    UsageReportScene(context: .init("ActivityP0O3"), offset: 3) { UsageReportView(model: $0) }
    UsageReportScene(context: .init("ActivityP0O4"), offset: 4) { UsageReportView(model: $0) }
    UsageReportScene(context: .init("ActivityP0O5"), offset: 5) { UsageReportView(model: $0) }
    UsageReportScene(context: .init("ActivityP0O6"), offset: 6) { UsageReportView(model: $0) }
  }

  /// Accueil — une surface unique (héro + classement).
  @DeviceActivityReportBuilder
  private var homeScenes: some DeviceActivityReportScene {
    // UNE seule scène pour le total, le delta et le classement. Deux rapports
    // qui calculent en parallèle dans l'extension bornée à 6 Mo provoquent des
    // surfaces blanches aléatoires sur appareil physique.
    HomeReport(
      context: .init("TodayHomeWithBlocks"), showsBlockedCard: true
    ) { model in
      HomeSectionView(model: model, showsBlockedCard: true)
    }
    HomeReport(
      context: .init("TodayHomeWithoutBlocks"), showsBlockedCard: false
    ) { model in
      HomeSectionView(model: model, showsBlockedCard: false)
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
  /// Apps par jour (clé = début du segment). Le héro de l'Accueil en a besoin :
  /// il couvre [hier→aujourd'hui] pour le delta, mais ses pilules ne doivent
  /// montrer QUE le jour même — `apps` (cumul sur toute la plage) mélangerait
  /// les deux.
  var perDayApps: [Date: [AppUsage]] = [:]
  var buckets: [UsageBucket] = []
  var totalSeconds: Double = 0
  var totalPickups: Int = 0
  var pickupsWithoutApplicationActivity: Int = 0
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
  var pickupsWithoutAppBySegment: [Date: Int] = [:]
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

      // Apple sépare les prises en main qui ouvrent directement une app de
      // celles sans activité d'app. Sans ce compteur de segment, le total
      // affiché reste systématiquement inférieur à celui de Temps d'écran.
      let pickupsWithoutApp = segment.totalPickupsWithoutApplicationActivity
      pickupsWithoutAppBySegment[iv.start] = max(
        pickupsWithoutAppBySegment[iv.start] ?? 0,
        pickupsWithoutApp)
      if pickupsWithoutApp > 0 { out.hadData = true }

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
    // Détail par jour, trié — sert aux pilules de l'Accueil (jour courant seul).
    out.perDayApps[start] = stats.map { key, s in
      AppUsage(
        id: keyIdentifier(key), name: s.name, seconds: s.seconds,
        pickups: s.pickups, notifications: s.notifications, icon: s.icon)
    }
    .sorted { $0.seconds > $1.seconds }
  }
  out.buckets.sort { $0.start < $1.start }

  out.pickupsWithoutApplicationActivity =
    pickupsWithoutAppBySegment.values.reduce(0, +)
  out.totalPickups += out.pickupsWithoutApplicationActivity

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
    pickupsSansApp=\(out.pickupsWithoutApplicationActivity, privacy: .public) \
    notifications=\(out.totalNotifications, privacy: .public) \
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

// MARK: - Libellé du jour

/// Libellé FR du jour sélectionné.
func dayLabel(start: Date?) -> String {
  guard let s = start else { return "" }
  let cal = Calendar.current
  let df = DateFormatter()
  df.locale = Locale(identifier: "fr_FR")
  if cal.isDateInToday(s) {
    df.dateFormat = "d MMMM"
    return "Aujourd'hui, \(df.string(from: s))"
  }
  df.dateFormat = "EEEE d MMMM"
  return df.string(from: s).capitalizedFirst
}

extension String {
  var capitalizedFirst: String {
    guard let f = first else { return self }
    return String(f).uppercased() + dropFirst()
  }
}

// MARK: - Scène : l'Activité entière (résumé + graphe + classement)

struct UsageModel {
  var totalSeconds: Double = 0
  var totalPickups: Int = 0
  var totalNotifications: Int = 0
  var apps: [AppUsage] = []
  var values: [Double] = []  // durée par tranche, chronologique
  var xLabels: [String] = []
  var dateLabel: String = ""
  /// Aucune donnée renvoyée par iOS (≠ « 0 minute »).
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
  model.dateLabel = dayLabel(start: agg.spanStart)

  let chart = makeChart(agg)
  model.values = chart.values
  model.xLabels = chart.xLabels

  if let s = agg.spanStart, !agg.hadData {
    // iOS ne conserve qu'un historique court : au-delà, « 0 min » n'est pas
    // une réalité mesurée mais une absence de données. On le dit.
    model.beyondRetention = Date().timeIntervalSince(s) > 30 * 86_400
  }
  return model
}

/// Une scène par jour. Le contexte est distinct pour forcer iOS à fournir la
/// configuration correspondant exactement au filtre demandé.
struct UsageReportScene: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context
  let offset: Int
  let content: (UsageModel) -> UsageReportView

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> UsageModel {
    await usageModel(data, scene: "activity-day-o\(offset)")
  }
}

// MARK: - Graphe : grille alignée sur le temps

struct ChartModel {
  var values: [Double] = []
  var xLabels: [String] = []
}

/// Chaque tranche à SA place réelle, 0 ailleurs — sinon les segments épars se
/// tassent et débordent.
private func makeChart(_ agg: UsageAggregate) -> ChartModel {
  var model = ChartModel()
  guard let s = agg.spanStart, let e = agg.spanEnd else { return model }

  let slot = 3_600.0
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
  lf.dateFormat = "HH'h'"  // 00h · 06h · 12h · 18h
  for frac in [0.0, 0.25, 0.5, 0.75] {
    let i = min(n - 1, Int(Double(n) * frac))
    model.xLabels.append(lf.string(from: s.addingTimeInterval(Double(i) * slot)))
  }
  return model
}

// MARK: - Héro Accueil (total du jour + delta vs hier)
//
// Filtre hôte : [hier 00:00 → fin d'aujourd'hui] en segments QUOTIDIENS — la
// même granularité et la même formule que le résumé de l'Activité, pour que
// les deux écrans affichent rigoureusement le même chiffre.

private struct HomeReportCopy {
  let screenTimeToday: String
  let topApps: String
  let noUsage: String
  /// Comparaison a la reference PERSONNELLE, proratisee au temps ecoule.
  /// « Hier » ne peut pas servir de repere : le filtre du rapport est en
  /// segments quotidiens, donc hier n'existe qu'en total de journee pleine —
  /// le comparer a un aujourd'hui partiel produisait le « -14 h 51 » de la
  /// capture. On compare desormais des fenetres equivalentes.
  let onAverage: String
  let belowAverage: (String) -> String
  let aboveAverage: (String) -> String
  let improvingContext: String
  let stableContext: String
  let risingContext: String
  let globalScore: String
  let focusScore: String
  let restScore: String
  let today: String
  let scoreCalculating: String
  /// Suffixe de la pastille d'ecart du score. Sans lui, « ↑ 38 » pouvait se
  /// lire comme un second score, un rang ou un delta hebdomadaire — trois
  /// interpretations pour un seul chiffre, donc aucune.
  let scoreDeltaSuffix: String
  /// Index 0 → 3 : a ameliorer, moyen, bon, excellent.
  let bands: [String]
  let footerPending: String
  let footerProvisional: String
  /// Memes index que `bands`. Deux series : celle qu'on montre quand c'est
  /// l'attention qui decroche, celle quand c'est le volume d'ecran.
  let footerFocus: [String]
  let footerRest: [String]

  static var current: HomeReportCopy {
    // L'interface React Native démarre en français. Une extension de rapport
    // reçoit cependant la langue SYSTÈME, pas celle choisie dans Relock; utiliser
    // cette valeur produisait une Home moitié française, moitié anglaise.
    let language = "fr"
    switch language {
    case "fr":
      return HomeReportCopy(
        screenTimeToday: "Temps d’écran aujourd’hui",
        topApps: "Top 3 applications aujourd’hui",
        noUsage: "Aucune utilisation mesurée aujourd’hui.",
        onAverage: "dans ta moyenne",
        belowAverage: { "\($0) sous ta moyenne" },
        aboveAverage: { "\($0) au-dessus de ta moyenne" },
        improvingContext: "Un rythme plus équilibré qu’hier.",
        stableContext: "Un rythme stable par rapport à hier.",
        risingContext: "Un rythme plus soutenu qu’hier.",
        globalScore: "Score global",
        focusScore: "Focus",
        restScore: "Repos",
        today: "Aujourd’hui",
        scoreCalculating: "Calcul en cours",
        scoreDeltaSuffix: "vs hier",
        bands: [
          "Équilibre fragile", "Équilibre moyen", "Bon équilibre",
          "Excellent équilibre",
        ],
        footerPending: "Ton score arrive dès que quelques jours seront mesurés.",
        footerProvisional: "Score encore approximatif : il se précise chaque jour.",
        footerFocus: [
          "Tu décroches souvent aujourd’hui. Un blocage t’aiderait à tenir.",
          "Ton attention se fragmente : beaucoup d’allers-retours aujourd’hui.",
          "Bon rythme. Tu ouvres ton téléphone un peu plus que d’habitude.",
          "Journée maîtrisée : ton attention tient bon.",
        ],
        footerRest: [
          "Beaucoup d’écran aujourd’hui. Offre-toi une vraie coupure.",
          "Tu passes plus de temps à l’écran que d’habitude.",
          "Bon rythme, avec un peu plus d’écran que ta moyenne.",
          "Journée maîtrisée : tu laisses ton écran de côté.",
        ])
    case "de":
      return HomeReportCopy(
        screenTimeToday: "Bildschirmzeit heute",
        topApps: "Meistgenutzte Apps",
        noUsage: "Heute wurde noch keine Nutzung gemessen.",
        onAverage: "in deinem Schnitt",
        belowAverage: { "\($0) unter deinem Schnitt" },
        aboveAverage: { "\($0) über deinem Schnitt" },
        improvingContext: "Ein ausgewogenerer Rhythmus als gestern.",
        stableContext: "Ein ähnlicher Rhythmus wie gestern.",
        risingContext: "Ein intensiverer Rhythmus als gestern.",
        globalScore: "Gesamtscore",
        focusScore: "Fokus",
        restScore: "Ruhe",
        today: "Heute",
        scoreCalculating: "Wird berechnet",
        scoreDeltaSuffix: "vs. gestern",
        bands: [
          "Fragile Balance", "Mittlere Balance", "Gute Balance",
          "Ausgezeichnete Balance",
        ],
        footerPending: "Dein Score erscheint, sobald einige Tage gemessen sind.",
        footerProvisional: "Noch ungefähr — der Score wird täglich genauer.",
        footerFocus: [
          "Du greifst heute oft zum Handy. Eine Sperre würde helfen.",
          "Deine Aufmerksamkeit zerfällt: viele Unterbrechungen heute.",
          "Guter Rhythmus. Etwas häufiger am Handy als sonst.",
          "Starker Tag: deine Aufmerksamkeit hält.",
        ],
        footerRest: [
          "Viel Bildschirmzeit heute. Gönn dir eine echte Pause.",
          "Du verbringst mehr Zeit am Bildschirm als sonst.",
          "Guter Rhythmus, mit etwas mehr Bildschirmzeit als üblich.",
          "Starker Tag: du lässt den Bildschirm liegen.",
        ])
    case "ru":
      return HomeReportCopy(
        screenTimeToday: "Экранное время сегодня",
        topApps: "Самые используемые приложения",
        noUsage: "Сегодня использование пока не зафиксировано.",
        onAverage: "в пределах твоей нормы",
        belowAverage: { "на \($0) ниже твоей нормы" },
        aboveAverage: { "на \($0) выше твоей нормы" },
        improvingContext: "Более сбалансированный ритм, чем вчера.",
        stableContext: "Ритм на уровне вчерашнего дня.",
        risingContext: "Более интенсивный ритм, чем вчера.",
        globalScore: "Общий балл",
        focusScore: "Фокус",
        restScore: "Отдых",
        today: "Сегодня",
        scoreCalculating: "Идёт расчёт",
        scoreDeltaSuffix: "к вчера",
        bands: [
          "Хрупкий баланс", "Средний баланс", "Хороший баланс",
          "Отличный баланс",
        ],
        footerPending: "Балл появится, когда наберётся несколько дней замеров.",
        footerProvisional: "Пока приблизительно — балл уточняется каждый день.",
        footerFocus: [
          "Сегодня ты часто отвлекаешься. Блокировка помогла бы удержаться.",
          "Внимание дробится: сегодня слишком много переключений.",
          "Хороший ритм. Берёшь телефон чуть чаще обычного.",
          "Собранный день: внимание держится.",
        ],
        footerRest: [
          "Сегодня много экрана. Устрой себе настоящий перерыв.",
          "Ты проводишь у экрана больше времени, чем обычно.",
          "Хороший ритм, экрана чуть больше среднего.",
          "Собранный день: ты откладываешь экран.",
        ])
    default:
      return HomeReportCopy(
        screenTimeToday: "Screen time today",
        topApps: "Top 3 apps today",
        noUsage: "No usage measured today yet.",
        onAverage: "in line with your average",
        belowAverage: { "\($0) below your average" },
        aboveAverage: { "\($0) above your average" },
        improvingContext: "A more balanced rhythm than yesterday.",
        stableContext: "A steady rhythm compared with yesterday.",
        risingContext: "A busier rhythm than yesterday.",
        globalScore: "Global score",
        focusScore: "Focus",
        restScore: "Rest",
        today: "Today",
        scoreCalculating: "Calculating",
        scoreDeltaSuffix: "vs yesterday",
        bands: [
          "Fragile balance", "Fair balance", "Good balance",
          "Excellent balance",
        ],
        footerPending: "Your score arrives once a few days have been measured.",
        footerProvisional: "Still approximate — the score sharpens every day.",
        footerFocus: [
          "You are drifting often today. A block would help you hold on.",
          "Your attention is fragmenting: a lot of back and forth today.",
          "Good rhythm. You reach for your phone a bit more than usual.",
          "Focused day: your attention is holding.",
        ],
        footerRest: [
          "A lot of screen time today. Give yourself a real break.",
          "You are spending more time on screen than usual.",
          "Good rhythm, with slightly more screen time than your average.",
          "Focused day: you are leaving your screen alone.",
        ])
    }
  }
}

struct HeroModel {
  var todaySeconds: Double = 0
  /// Ce que l'utilisateur aurait consommé À CETTE HEURE-CI une journée
  /// normale : sa médiane personnelle, proratisée au temps écoulé. C'est le
  /// seul repère honnête dont on dispose — le filtre du rapport est en
  /// segments quotidiens, donc « hier à 12 h 47 » n'existe pas.
  var expectedSeconds: Double?
  /// Jours pleins mesurés servant de référence. En dessous de
  /// `heroComparisonMinimumDays`, aucune comparaison n'est affichée.
  var historyDays: Int = 0
}

/// Il faut une semaine pleine avant d'oser comparer : en dessous, la médiane
/// bouge à chaque nouveau jour et l'écart affiché dirait surtout que la
/// référence est jeune.
let heroComparisonMinimumDays = 7

/// Au-delà de cet écart, on bascule en pourcentage : « 4 h de moins » sur une
/// journée est un chiffre qu'on ne peut pas se représenter, et qui donne
/// l'impression d'un bug plutôt que d'une mesure.
let heroComparisonCapSeconds: Double = 3 * 3_600

/// Etat de confiance du score. `pending` n'est pas un score bas : c'est
/// l'absence de score. Un nouvel utilisateur n'a aucun historique auquel se
/// comparer, on le dit au lieu d'inventer un 100.
enum HomeScoreStatus: String {
  case pending
  case provisional
  case ready
}

/// L'axe le plus faible du jour. Sert a formuler l'encouragement : nommer ce
/// qui decroche vaut mieux qu'une phrase generique.
enum HomeScoreAxis: String {
  case focus
  case rest
}

struct HomeScoreModel {
  /// `nil` tant que le score n'est pas calculable — la carte affiche « — ».
  var focus: Int?
  var rest: Int?
  var global: Int?
  /// Score global d'hier, calcule a l'identique sur une journee pleine.
  var previousGlobal: Int?
  var status: HomeScoreStatus = .pending
  var weakestAxis: HomeScoreAxis = .focus
  /// Jours complets ayant servi de reference. Pilote la confiance.
  var historyDays: Int = 0

  var delta: Int? {
    guard let global, let previousGlobal else { return nil }
    return global - previousGlobal
  }
}

/// Usage d'une journee, reduit a ce que le score consomme.
struct DayUsage {
  var seconds: Double = 0
  var pickups: Int = 0
}

private func boundedScore(_ value: Int) -> Int {
  min(max(value, 0), 100)
}

private func median(_ values: [Double]) -> Double {
  guard !values.isEmpty else { return 0 }
  let sorted = values.sorted()
  let mid = sorted.count / 2
  if sorted.count % 2 == 1 { return sorted[mid] }
  return (sorted[mid - 1] + sorted[mid]) / 2
}

/// Traduit « combien de fois ta normale » en note.
///
/// 50 = exactement ta normale, 100 = deux fois mieux, 0 = deux fois pire.
/// La courbe est volontairement lineaire par morceaux : elle doit pouvoir
/// s'expliquer en une phrase dans la feuille de detail.
private func relativeScore(_ ratio: Double) -> Int {
  if ratio <= 0.5 { return 100 }
  if ratio >= 2 { return 0 }
  if ratio <= 1 { return boundedScore(Int((100 - 100 * (ratio - 0.5)).rounded())) }
  return boundedScore(Int((50 - 50 * (ratio - 1)).rounded()))
}

/// Il faut un minimum de journee mesuree avant de la caracteriser. Sans ce
/// garde-fou, chaque jour demarrerait a 100 a minuit — un compte a rebours,
/// pas un score.
private let scoreMinimumPickups = 3
private let scoreMinimumSeconds: Double = 300

/// Nombre de jours complets a partir duquel le score est pleinement fiable.
/// En dessous, il est tire vers la neutralite (50) au prorata.
private let scoreConfidenceDays = 5.0

/// Score relatif a l'utilisateur lui-meme, jamais a un absolu : 2 h d'ecran
/// sont excellentes pour l'un et une rechute pour l'autre.
///
/// - `focus` : prises en main par heure ecoulee, contre la mediane des jours
///   complets. La fragmentation compte plus que le volume.
/// - `rest` : secondes d'ecran par heure ecoulee, meme reference.
///
/// `elapsedHours` est plancher a 3 h : a 1 h du matin, diviser par 1 ferait
/// exploser le ratio sur deux prises en main sans signification.
private func makeHomeScore(
  today: DayUsage,
  elapsedHours: Double,
  history: [DayUsage]
) -> HomeScoreModel {
  var model = HomeScoreModel(historyDays: history.count)

  // Pas de reference : rien a comparer, donc rien a afficher.
  guard !history.isEmpty else { return model }
  // Journee pas encore assez mesuree pour etre caracterisee.
  guard today.pickups >= scoreMinimumPickups || today.seconds >= scoreMinimumSeconds
  else { return model }

  let hours = max(3, elapsedHours)
  let baselineFocus = median(history.map { Double($0.pickups) / 24 })
  let baselineRest = median(history.map { $0.seconds / 24 })
  // Un historique entierement vide ne fait pas une reference exploitable.
  guard baselineFocus > 0, baselineRest > 0 else { return model }

  let rawFocus = relativeScore(Double(today.pickups) / hours / baselineFocus)
  let rawRest = relativeScore(today.seconds / hours / baselineRest)

  // Confiance progressive : avec un seul jour de recul le score existe deja,
  // mais reste proche de la neutralite; il se precise en s'appuyant sur plus
  // de jours. On ne fait jamais croire a une precision qu'on n'a pas.
  let confidence = min(1, Double(history.count) / scoreConfidenceDays)
  let blended = { (raw: Int) in
    boundedScore(Int((50 + (Double(raw) - 50) * confidence).rounded()))
  }

  let focus = blended(rawFocus)
  let rest = blended(rawRest)
  model.focus = focus
  model.rest = rest
  // Deux axes, poids egaux : aucun des deux ne prime sur l'autre.
  model.global = boundedScore(Int((Double(focus + rest) / 2).rounded()))
  model.weakestAxis = focus <= rest ? .focus : .rest
  model.status = confidence >= 1 ? .ready : .provisional
  return model
}

/// Rendu centré dans l'anneau lumineux du hero.
struct HeroTotalView: View {
  let model: HeroModel
  private let copy = HomeReportCopy.current

  private let ink = Color(red: 0.961, green: 0.961, blue: 0.969)  // #F5F5F7
  private let unit = Color(red: 0.922, green: 0.922, blue: 0.961)
  private let green = Color(red: 0.373, green: 0.788, blue: 0.545)  // #5FC98B
  private let amber = Color(red: 0.878, green: 0.635, blue: 0.306)  // #E0A24E

  /// Ecart avec la reference personnelle, en secondes. `nil` = rien a dire :
  /// pas assez de jours mesures, ou pas de reference exploitable. On prefere
  /// n'afficher aucune comparaison plutot qu'une comparaison fausse.
  private var comparison: Double? {
    guard model.historyDays >= heroComparisonMinimumDays else { return nil }
    guard let expected = model.expectedSeconds, expected > 0 else { return nil }
    return model.todaySeconds - expected
  }

  /// « 36 » + « min », ou « 3 » + « h » + « 06 » — segments (valeur, unite) du
  /// gros total. Les minutes sont sur DEUX chiffres et rien ne separe la
  /// valeur de son unite : la largeur du nombre ne doit pas sauter a chaque
  /// minute qui passe.
  private var segments: [(String, String)] {
    let m = Int(model.todaySeconds / 60)
    if m < 60 { return [(String(m), "min")] }
    let h = m / 60
    let r = m % 60
    return [(String(h), "h"), (String(format: "%02d", r), "")]
  }

  /// Sous 3 h d'ecart on nomme la duree, au-dela on bascule en pourcentage.
  private func comparisonLabel(_ diff: Double) -> String {
    let magnitude = abs(diff)
    if magnitude >= heroComparisonCapSeconds, let expected = model.expectedSeconds,
      expected > 0
    {
      return "\(Int((magnitude / expected * 100).rounded())) %"
    }
    let absMin = Int((magnitude / 60).rounded())
    if absMin < 60 { return "\(absMin) min" }
    let h = absMin / 60
    let r = absMin % 60
    return r == 0 ? "\(h)h" : "\(h)h\(String(format: "%02d", r))"
  }

  var body: some View {
    VStack(alignment: .center, spacing: 5) {
      // Aucune espace entre les segments : « 3h06 » est un seul mot.
      HStack(alignment: .firstTextBaseline, spacing: 0) {
        ForEach(Array(segments.enumerated()), id: \.offset) { _, seg in
          Text(seg.0)
            .font(.system(size: 48, weight: .bold))
            .kerning(-1.2)
            .monospacedDigit()
            .foregroundColor(ink)
          if !seg.1.isEmpty {
            // L'unite accompagne la valeur : meme graisse, 0.45x sa taille,
            // 0.45 d'opacite. Jamais une graisse plus legere.
            Text(seg.1)
              .font(.system(size: 22, weight: .bold))
              .kerning(-0.4)
              .foregroundColor(unit.opacity(0.45))
          }
        }
      }
      if let diff = comparison {
        // Le seuil de neutralite evite un « 1 min au-dessus » qui se lirait
        // comme un jugement sur du bruit de mesure.
        let same = abs(diff) < 300
        let less = diff < 0
        let color = same ? unit : (less ? green : amber)
        HStack(spacing: 6) {
          Image(systemName: same ? "minus" : (less ? "arrow.down" : "arrow.up"))
            .font(.system(size: 17, weight: .bold))
            .foregroundColor(color)
          Text(
            same
              ? copy.onAverage
              : (less
                ? copy.belowAverage(comparisonLabel(diff))
                : copy.aboveAverage(comparisonLabel(diff)))
          )
          .font(.system(size: 17, weight: .semibold))
          .foregroundColor(color)
        }
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
    .shadow(color: .black.opacity(0.9), radius: 8, x: 0, y: 2)
    .environment(\.colorScheme, .dark)
  }
}

// MARK: - Scène : bloc « Temps d'écran » de l'Accueil (total + delta + pilules)
//
// Filtre hôte : [hier 00:00 → fin d'aujourd'hui] en segments QUOTIDIENS. Un
// SEUL rapport rend tout le bloc : plus de course entre deux vues distantes.

struct HomeModel {
  var hero = HeroModel()
  var apps: [AppUsage] = []
  var score = HomeScoreModel()
}

struct HomeReport: DeviceActivityReportScene {
  let context: DeviceActivityReport.Context
  let showsBlockedCard: Bool
  let content: (HomeModel) -> HomeSectionView

  func makeConfiguration(
    representing data: DeviceActivityResults<DeviceActivityData>
  ) async -> HomeModel {
    let agg = await aggregateUsage(data, scene: "home")
    let cal = Calendar.current
    let now = Date()
    var model = HomeModel()

    // Un jour = une cle de segment. Le filtre couvre J-7 → aujourd'hui, ce qui
    // donne la reference personnelle dont le score a besoin.
    var days: [Date: DayUsage] = [:]
    for b in agg.buckets {
      let key = cal.startOfDay(for: b.start)
      days[key, default: DayUsage()].seconds += b.seconds
    }
    for (start, apps) in agg.perDayApps {
      let key = cal.startOfDay(for: start)
      days[key, default: DayUsage()].pickups += apps.reduce(0) { $0 + $1.pickups }
    }

    let todayKey = cal.startOfDay(for: now)
    let yesterdayKey = cal.date(byAdding: .day, value: -1, to: todayKey) ?? todayKey
    let today = days[todayKey] ?? DayUsage()
    model.hero.todaySeconds = today.seconds

    // Pilules : le JOUR COURANT uniquement, jamais le cumul de la plage.
    if let key = agg.perDayApps.keys.first(where: { cal.isDateInToday($0) }) {
      model.apps = agg.perDayApps[key] ?? []
    }

    // La reference exclut aujourd'hui (incomplet) et tout jour sans mesure :
    // une journee vide est une absence de donnee, pas une journee exemplaire.
    func history(before day: Date) -> [DayUsage] {
      days
        .filter { $0.key < day && ($0.value.seconds > 0 || $0.value.pickups > 0) }
        .sorted { $0.key > $1.key }
        .prefix(7)
        .map(\.value)
    }

    let elapsedHours = now.timeIntervalSince(todayKey) / 3_600
    let reference = history(before: todayKey)
    model.score = makeHomeScore(
      today: today,
      elapsedHours: elapsedHours,
      history: reference)

    // Fenetres EQUIVALENTES : la mediane personnelle par heure, ramenee aux
    // heures reellement ecoulees aujourd'hui. Comparer un aujourd'hui partiel
    // au total d'hier — ce que faisait la version precedente — produisait des
    // ecarts impossibles (« 14 h 51 de moins » sur un total de 3 h 06), et un
    // chiffre invraisemblable detruit la confiance dans tous les autres.
    model.hero.historyDays = reference.count
    let baselinePerHour = median(reference.map { $0.seconds / 24 })
    if baselinePerHour > 0 {
      model.hero.expectedSeconds = baselinePerHour * max(1, elapsedHours)
    }
    // Delta : hier note exactement comme aujourd'hui, sur une journee pleine
    // et sa propre reference. Comparer autrement fausserait l'ecart.
    if let yesterday = days[yesterdayKey] {
      model.score.previousGlobal = makeHomeScore(
        today: yesterday,
        elapsedHours: 24,
        history: history(before: yesterdayKey)
      ).global
    }

    publishHomeScore(model.score)
    RelockReportLog.log.info(
      "home: today=\(Int(model.hero.todaySeconds), privacy: .public)s apps=\(model.apps.count, privacy: .public) score=\(model.score.global ?? -1, privacy: .public) status=\(model.score.status.rawValue, privacy: .public) history=\(model.score.historyDays, privacy: .public)d"
    )
    return model
  }
}

/// Depose le score dans le conteneur App Group. Les mesures de Temps d'ecran ne
/// sortent jamais du bac a sable Apple ; seul le resultat agrege le fait, pour
/// que React Native puisse afficher la meme chose dans la feuille de detail
/// sans jamais toucher aux donnees brutes.
private func publishHomeScore(_ score: HomeScoreModel) {
  // Cette extension n'a AUCUN accès réseau (Apple l'interdit aux
  // DeviceActivityReportExtension) : le journal partagé est son unique moyen
  // de signaler quoi que ce soit. Sans le conteneur, l'Accueil garde
  // indéfiniment un score périmé, sans le moindre indice.
  guard let defaults = UserDefaults(suiteName: "group.com.yaya.relock") else {
    ExtensionLog.error(
      "report",
      "groupe d'app inaccessible : le score d'accueil ne sera pas publié")
    return
  }
  var payload: [String: Any] = [
    "status": score.status.rawValue,
    "weakestAxis": score.weakestAxis.rawValue,
    "historyDays": score.historyDays,
    "updatedAt": Date().timeIntervalSince1970,
  ]
  if let global = score.global { payload["global"] = global }
  if let focus = score.focus { payload["focus"] = focus }
  if let rest = score.rest { payload["rest"] = rest }
  if let delta = score.delta { payload["delta"] = delta }
  defaults.set(payload, forKey: "homeScore")
}

/// Surface Accueil complète. Le hero, le score et les trois apps restent dans
/// CET UNIQUE rapport, seule manière autorisée par iOS d'afficher les données
/// privées tout en évitant plusieurs surfaces distantes concurrentes.
/// Verre des cartes de l'Accueil — miroir exact de `HomeCardMaterial.tsx`.
///
/// Un voile clair translucide, une arete haute de 1 pt qui donne son epaisseur
/// a l'objet, un liseré, et une ombre qui la decolle du fond. Les valeurs sont
/// celles des jetons `homeGlass*` de `relock-material.ts` : les cartes RN et
/// les cartes natives s'empilent dans le MEME defilement, la moindre
/// divergence se voit.
///
/// Pas de `Material` SwiftUI ici : cette vue est rendue hors processus par une
/// extension `DeviceActivityReport`, qui ne peut pas echantillonner le fond de
/// l'application hote — un vrai flou d'arriere-plan n'y produirait rien. Ce
/// qui passe derriere ces cartes est de toute facon un degrade lisse, dont le
/// flou serait visuellement identique a lui-meme.
private struct HomeGlassCard: ViewModifier {
  /// Palier lumineux : plus la carte est haute dans l'ecran, plus elle est
  /// proche du limbe eclaire et plus elle capte de lumiere.
  let fill: Double
  let edge: Double
  private let corner: CGFloat = 36

  func body(content: Content) -> some View {
    content
      .background(
        ZStack(alignment: .top) {
          Color.white.opacity(fill)
          Rectangle().fill(Color.white.opacity(edge)).frame(height: 1)
        }
        .clipShape(RoundedRectangle(cornerRadius: corner, style: .continuous))
      )
      .overlay(
        RoundedRectangle(cornerRadius: corner, style: .continuous)
          .stroke(Color.white.opacity(0.07), lineWidth: 1)
      )
      .shadow(color: .black.opacity(0.45), radius: 20, x: 0, y: 12)
  }
}

extension View {
  /// `tier` 1 = premiere carte de l'ecran (la plus eclairee), 3 = les suivantes.
  fileprivate func homeGlass(tier: Int) -> some View {
    let fill = [1: 0.055, 2: 0.045, 3: 0.035][tier] ?? 0.045
    let edge = [1: 0.12, 2: 0.09, 3: 0.06][tier] ?? 0.09
    return modifier(HomeGlassCard(fill: fill, edge: edge))
  }
}

struct HomeSectionView: View {
  let model: HomeModel
  let showsBlockedCard: Bool
  private let copy = HomeReportCopy.current
  private let ink = Color(red: 0.984, green: 0.980, blue: 1.0)
  private let ink2 = Color(red: 0.725, green: 0.690, blue: 0.792)
  private let ink3 = Color(red: 0.522, green: 0.525, blue: 0.604)

  var body: some View {
    GeometryReader { geometry in
      VStack(alignment: .leading, spacing: 0) {
      ZStack(alignment: .top) {
        VStack(alignment: .center, spacing: 5) {
          Text(copy.screenTimeToday)
            .font(.system(size: 15, weight: .medium))
            .foregroundColor(ink.opacity(0.94))
            .shadow(color: .black.opacity(0.9), radius: 7, x: 0, y: 2)
          HeroTotalView(model: model.hero)
            .frame(height: 128, alignment: .top)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, 180)
      }
      .frame(width: geometry.size.width, height: 360, alignment: .top)

      homeScoreCard
        .padding(.horizontal, 16)

      // Carte RN « Mes apps » : 280 pt, entre deux espaces de 24 pt.
      Color.clear.frame(height: showsBlockedCard ? 328 : 24)
        .accessibilityHidden(true)

      VStack(alignment: .leading, spacing: 16) {
        Text(copy.topApps)
          .font(.system(size: 15, weight: .semibold))
          .foregroundColor(ink)

        if model.apps.isEmpty {
          Text(copy.noUsage)
            .font(.system(size: 14))
            .foregroundColor(ink3)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
        } else {
          VStack(spacing: 12) {
            ForEach(0..<3, id: \.self) { index in
              if index < model.apps.count {
                let app = model.apps[index]
                homeAppRow(app: app, maxSeconds: max(model.apps.first?.seconds ?? 1, 1))
              } else {
                placeholderRow()
              }
            }
          }
        }
      }
      .padding(.horizontal, 20)
      .padding(.vertical, 18)
      .frame(width: geometry.size.width - 32, height: 232, alignment: .topLeading)
      .homeGlass(tier: 3)
      .padding(.horizontal, 16)
      }
      .frame(
        width: geometry.size.width, height: geometry.size.height,
        alignment: .topLeading)
      .background(Color.clear)
      .environment(\.colorScheme, .dark)
    }
    .ignoresSafeArea()
    // Home gestures belong to the hosting app's controls and ScrollView.
    // Disabling the host UIView alone cannot disable out-of-process buttons.
    .allowsHitTesting(false)
  }

  // Miroir des accents violet Relock et lavande côté React Native.
  private let violet = Color(red: 0.655, green: 0.545, blue: 0.980)
  private let lavender = Color(red: 0.784, green: 0.722, blue: 1.0)
  private let green = Color(red: 0.373, green: 0.788, blue: 0.545)  // #5FC98B
  private let amber = Color(red: 0.878, green: 0.635, blue: 0.306)  // #E0A24E

  /// 0 = a ameliorer, 3 = excellent. Sert d'index aux tableaux de copie.
  private func bandRank(_ value: Int) -> Int {
    if value >= 80 { return 3 }
    if value >= 60 { return 2 }
    if value >= 35 { return 1 }
    return 0
  }

  /// Palier affiche sous le chiffre. Sans score, on dit qu'on calcule — on
  /// n'affiche pas un palier qui n'a pas ete mesure.
  private var scoreBandLabel: String {
    guard let global = model.score.global else { return copy.scoreCalculating }
    return copy.bands[bandRank(global)]
  }

  /// Encouragement du pied de carte. Il nomme l'axe qui decroche plutot que de
  /// resumer la journee : « c'est le nombre de prises en main qui coince » est
  /// actionnable, « ton rythme est sain » ne l'est pas.
  private var scoreFooter: String {
    guard let global = model.score.global else { return copy.footerPending }
    if model.score.status == .provisional { return copy.footerProvisional }
    let rank = bandRank(global)
    return model.score.weakestAxis == .focus
      ? copy.footerFocus[rank]
      : copy.footerRest[rank]
  }

  /// Carte « Score global » : la rosace et son chiffre a gauche, les sous-scores
  /// en liste a droite, l'encouragement en pied. Hauteur miroir de
  /// `homeScoreHeight` (relock-material.ts) et de la zone tactile de
  /// ScreenTimeReportView.
  private var homeScoreCard: some View {
    VStack(spacing: 0) {
      HStack(alignment: .top, spacing: 12) {
        VStack(alignment: .leading, spacing: 2) {
          Text(copy.globalScore)
            .font(.system(size: 20, weight: .bold))
            .foregroundColor(ink)
            .lineLimit(1)
          Text(copy.today)
            .font(.system(size: 14))
            .foregroundColor(ink3)
            .lineLimit(1)
        }
        Spacer(minLength: 8)
        // Pastille masquee tant qu'hier n'est pas mesure : pas de faux progres.
        if let delta = model.score.delta, delta != 0 {
          scoreDeltaPill(delta)
        }
      }
      .frame(height: 46)

      Spacer(minLength: 0)

      HStack(spacing: 0) {
        scoreDial
          .frame(width: 152, height: 152)
        scoreSeparator
        VStack(spacing: 0) {
          scoreRow(
            symbol: "circle.circle.fill", label: copy.focusScore,
            value: model.score.focus, tint: violet)
          Rectangle()
            .fill(Color.white.opacity(0.09))
            .frame(height: 1)
          scoreRow(
            symbol: "moon.fill", label: copy.restScore,
            value: model.score.rest, tint: lavender)
        }
        .frame(height: 152)
      }

      Spacer(minLength: 0)

      HStack(spacing: 8) {
        Image(systemName: "heart")
          .font(.system(size: 14, weight: .medium))
          .foregroundColor(lavender)
        Text(scoreFooter)
          .font(.system(size: 14, weight: .medium))
          .foregroundColor(ink2)
          .lineLimit(1)
          .minimumScaleFactor(0.8)
      }
      .frame(height: 20)
    }
    .padding(20)
    .frame(maxWidth: .infinity, minHeight: 290, maxHeight: 290)
    .homeGlass(tier: 1)
    .accessibilityElement(children: .combine)
    .accessibilityLabel(
      "\(copy.globalScore) \(model.score.global.map(String.init) ?? copy.scoreCalculating), \(scoreBandLabel), \(copy.focusScore) \(model.score.focus.map(String.init) ?? "—"), \(copy.restScore) \(model.score.rest.map(String.init) ?? "—"). \(scoreFooter)"
    )
  }

  /// Ecart avec le score d'hier. Vert quand ca progresse, ambre quand ca recule.
  private func scoreDeltaPill(_ delta: Int) -> some View {
    let rising = delta > 0
    let tint = rising ? green : amber
    return HStack(spacing: 4) {
      Image(systemName: rising ? "arrow.up" : "arrow.down")
        .font(.system(size: 12, weight: .bold))
      Text(String(abs(delta)))
        .font(.system(size: 15, weight: .semibold))
        .monospacedDigit()
      Text(copy.scoreDeltaSuffix)
        .font(.system(size: 12, weight: .medium))
        .opacity(0.72)
        .lineLimit(1)
    }
    .foregroundColor(tint)
    .padding(.horizontal, 12)
    .padding(.vertical, 7)
    .background(Capsule().fill(tint.opacity(0.14)))
  }

  /// Anneau du score : illustration fournie (`home-score-dial`), centre
  /// transparent pour que la valeur se lise dedans. Rien n'est dessine ici —
  /// le motif est un asset, pas une jauge.
  private var scoreDial: some View {
    ZStack {
      Image("home-score-dial")
        .resizable()
        .scaledToFit()
        .opacity(0.22)
        .accessibilityHidden(true)

      VStack(spacing: 1) {
        Text(model.score.global.map(String.init) ?? "—")
          .font(.system(size: 44, weight: .bold))
          .monospacedDigit()
          .foregroundColor(ink)
        Text(scoreBandLabel)
          .font(.system(size: 13, weight: .medium))
          .foregroundColor(lavender)
          .lineLimit(1)
          .minimumScaleFactor(0.7)
      }
    }
  }

  private var scoreSeparator: some View {
    Rectangle()
      .fill(Color.white.opacity(0.09))
      .frame(width: 1, height: 152)
      .overlay(
        Image(systemName: "arrowtriangle.right.fill")
          .font(.system(size: 7))
          .foregroundColor(Color.white.opacity(0.18))
      )
      .padding(.horizontal, 14)
  }

  private func scoreRow(
    symbol: String,
    label: String,
    value: Int?,
    tint: Color
  ) -> some View {
    HStack(spacing: 10) {
      Image(systemName: symbol)
        .font(.system(size: 17, weight: .medium))
        .foregroundColor(tint)
        .frame(width: 24)
      Text(label)
        .font(.system(size: 15, weight: .medium))
        .foregroundColor(ink)
        .lineLimit(1)
      Spacer(minLength: 8)
      Text(value.map(String.init) ?? "—")
        .font(.system(size: 22, weight: .bold))
        .monospacedDigit()
        .foregroundColor(value == nil ? ink3 : ink)
    }
    .frame(maxHeight: .infinity)
  }

  private func homeAppRow(app: AppUsage, maxSeconds: Double) -> some View {
    HStack(spacing: 12) {
      homeIcon(app)
      homeTitle(app)
        .font(.system(size: 14, weight: .medium))
        .foregroundColor(ink)
        .lineLimit(1)
        .truncationMode(.tail)
        .frame(width: 96, alignment: .leading)
      GeometryReader { geometry in
        ZStack(alignment: .leading) {
          Capsule().fill(Color.white.opacity(0.08))
          Capsule()
            .fill(
              LinearGradient(
                colors: [
                  Color(red: 0.451, green: 0.341, blue: 0.863),
                  Color(red: 0.784, green: 0.722, blue: 1.0),
                ],
                startPoint: .leading,
                endPoint: .trailing)
            )
            .frame(
              width: geometry.size.width
                * CGFloat(min(max(app.seconds / maxSeconds, 0), 1)))
        }
      }
      .frame(height: 6)
      Text(formatDuration(app.seconds))
        .font(.system(size: 13, weight: .medium))
        .monospacedDigit()
        .foregroundColor(ink2)
        .lineLimit(1)
        .frame(width: 54, alignment: .trailing)
    }
    .frame(height: 46)
  }

  private func placeholderRow() -> some View {
    HStack(spacing: 12) {
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(Color.white.opacity(0.045)).frame(width: 38, height: 38)
      RoundedRectangle(cornerRadius: 5, style: .continuous)
        .fill(Color.white.opacity(0.045)).frame(width: 96, height: 10)
      Capsule().fill(Color.white.opacity(0.045)).frame(height: 6)
      Color.clear.frame(width: 54, height: 1)
    }
    .frame(height: 46)
    .accessibilityHidden(true)
  }

  @ViewBuilder
  private func homeTitle(_ app: AppUsage) -> some View {
    switch app.icon {
    case .app(let token): Label(token).labelStyle(.titleOnly)
    case .web(let token): Label(token).labelStyle(.titleOnly)
    case .none: Text(app.name)
    }
  }

  @ViewBuilder
  private func homeIcon(_ app: AppUsage) -> some View {
    switch app.icon {
    case .app(let token):
      Label(token).labelStyle(.iconOnly).font(.system(size: 32))
        .frame(width: 38, height: 38)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    case .web(let token):
      Label(token).labelStyle(.iconOnly).font(.system(size: 32))
        .frame(width: 38, height: 38)
        .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
    case .none:
      RoundedRectangle(cornerRadius: 10, style: .continuous)
        .fill(Color.white.opacity(0.08)).frame(width: 38, height: 38)
    }
  }
}
