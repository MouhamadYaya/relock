import DeviceActivity
import SwiftUI
import UIKit

/// Héberge un rapport de temps d'écran (extension RelockActivityReport) dans une
/// UIView pour RN.
/// - `mode` : « usage » (résumé + classement), « chart » (graphe), « pills »
///   (rangée du jour, Accueil) ou « hero » (total du jour + delta, Accueil).
/// - `period` : 0 = jour, 1 = semaine, 2 = mois.
/// - `offset` : recule dans le temps, en unités de la période.
@available(iOS 16.0, *)
private struct ReportContainer: View {
  let period: Int
  let offset: Int
  let mode: String

  /// Intervalle de la période demandée (jour / semaine / mois, décalé).
  private func interval(_ cal: Calendar, _ now: Date) -> DateInterval {
    switch period {
    case 1:
      let anchor = cal.date(byAdding: .weekOfYear, value: -offset, to: now) ?? now
      return cal.dateInterval(of: .weekOfYear, for: anchor)
        ?? DateInterval(start: anchor, duration: 604_800)
    case 2:
      let anchor = cal.date(byAdding: .month, value: -offset, to: now) ?? now
      return cal.dateInterval(of: .month, for: anchor)
        ?? DateInterval(start: anchor, duration: 2_592_000)
    default:
      let anchor = cal.date(byAdding: .day, value: -offset, to: now) ?? now
      return cal.dateInterval(of: .day, for: anchor)
        ?? DateInterval(start: anchor, duration: 86_400)
    }
  }

  var body: some View {
    let cal = Calendar.current
    let now = Date()
    // iPhone uniquement : `.all` additionnerait Mac/iPad → total > 24 h/jour.
    let devices = DeviceActivityFilter.Devices(.init([.iPhone]))

    switch mode {
    case "pills":
      let today =
        cal.dateInterval(of: .day, for: now)
        ?? DateInterval(start: now, duration: 86_400)
      return AnyView(
        DeviceActivityReport(
          DeviceActivityReport.Context("TodayPills"),
          filter: DeviceActivityFilter(
            segment: .daily(during: today), users: .all, devices: devices)))

    case "hero":
      // [hier 00:00 → fin d'aujourd'hui] en segments QUOTIDIENS : la scène en
      // tire le total du jour ET celui d'hier (donc le delta). Même
      // granularité que le résumé de l'Activité → mêmes chiffres.
      let today =
        cal.dateInterval(of: .day, for: now)
        ?? DateInterval(start: now, duration: 86_400)
      let start = cal.date(byAdding: .day, value: -1, to: today.start) ?? today.start
      return AnyView(
        DeviceActivityReport(
          DeviceActivityReport.Context("TodayHero"),
          filter: DeviceActivityFilter(
            segment: .daily(during: DateInterval(start: start, end: today.end)),
            users: .all, devices: devices)))

    case "chart":
      let iv = interval(cal, now)
      if period == 0 {
        // Jour → tranches horaires. Contexte dédié : la granularité est connue
        // par construction, même si la période ne renvoie aucune donnée.
        return AnyView(
          DeviceActivityReport(
            DeviceActivityReport.Context("ChartHour"),
            filter: DeviceActivityFilter(
              segment: .hourly(during: iv), users: .all, devices: devices)))
      }
      return AnyView(
        DeviceActivityReport(
          DeviceActivityReport.Context("ChartDay"),
          filter: DeviceActivityFilter(
            segment: .daily(during: iv), users: .all, devices: devices)))

    case "apps":
      // Classement : segments quotidiens (cf. « summary »).
      return AnyView(
        DeviceActivityReport(
          DeviceActivityReport.Context("UsageApps"),
          filter: DeviceActivityFilter(
            segment: .daily(during: interval(cal, now)), users: .all,
            devices: devices)))

    default:
      // Résumé : TOUJOURS des segments quotidiens — seule granularité où iOS
      // renseigne activations et notifications (en tranches horaires ils
      // reviennent quasi nuls : « 1 activation » pour une journée entière).
      return AnyView(
        DeviceActivityReport(
          DeviceActivityReport.Context("UsageSummary"),
          filter: DeviceActivityFilter(
            segment: .daily(during: interval(cal, now)), users: .all,
            devices: devices)))
    }
  }
}

@objc(ScreenTimeReportView)
final class ScreenTimeReportView: UIView {
  @objc var period: NSNumber = 0 { didSet { setNeedsRebuild() } }
  @objc var offset: NSNumber = 0 { didSet { setNeedsRebuild() } }
  @objc var mode: NSString = "usage" { didSet { setNeedsRebuild() } }

  private struct Config: Equatable {
    let period: Int
    let offset: Int
    let mode: String
  }

  private var hosting: UIViewController?
  private var applied: Config?
  private var rebuildScheduled = false

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil { setNeedsRebuild() }
  }

  /// Reconstruit AU PLUS UNE FOIS par cycle d'exécution.
  ///
  /// React Native affecte les props une par une (`period`, puis `offset`, puis
  /// `mode`), et `didMoveToWindow` s'ajoute : reconstruire à chaque `didSet`
  /// créait jusqu'à quatre `DeviceActivityReport` en cascade. Ces rapports sont
  /// des vues système au rendu ASYNCHRONE et coûteux : les détruire pendant
  /// leur calcul laissait la carte VIDE une fois sur deux (« parfois ça
  /// s'affiche, parfois non »). On coalesce, et on ne reconstruit que si la
  /// configuration a réellement changé.
  private func setNeedsRebuild() {
    guard !rebuildScheduled else { return }
    rebuildScheduled = true
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.rebuildScheduled = false
      self.rebuildIfNeeded()
    }
  }

  private func rebuildIfNeeded() {
    guard window != nil, #available(iOS 16.0, *) else { return }
    let config = Config(
      period: period.intValue, offset: offset.intValue, mode: mode as String)
    // Même configuration (ex. simple re-attachement à la fenêtre) : on garde le
    // rapport déjà rendu au lieu d'en relancer le calcul.
    guard config != applied else { return }
    applied = config

    hosting?.view.removeFromSuperview()
    let vc = UIHostingController(
      rootView: ReportContainer(
        period: config.period, offset: config.offset, mode: config.mode))
    vc.view.backgroundColor = .clear
    vc.view.frame = bounds
    vc.view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
    addSubview(vc.view)
    hosting = vc
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    hosting?.view.frame = bounds
  }
}
