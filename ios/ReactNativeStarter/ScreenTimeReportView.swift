import DeviceActivity
import SwiftUI
import UIKit

/// Héberge le rapport de temps d'écran (extension RelockActivityReport) dans une
/// UIView pour RN. `period` : 0 = jour, 1 = semaine, 2 = mois. `offset` recule
/// dans le temps en unités de la période (jours, semaines ou mois). `mode` :
/// « usage » (rapport complet), « pills » (rangée du jour) ou « hero » (total du
/// jour + delta vs hier, Accueil).
@available(iOS 16.0, *)
private struct ReportContainer: View {
  let period: Int
  /// Décalage en unités de période : 0 = courant, 1 = précédent, etc.
  let offset: Int
  let mode: String

  var body: some View {
    let cal = Calendar.current
    let now = Date()
    let filter: DeviceActivityFilter
    // iPhone uniquement : `.all` additionnerait Mac/iPad → total > 24h/jour.
    let devices = DeviceActivityFilter.Devices(.init([.iPhone]))

    // Pilules : toujours AUJOURD'HUI, rendu compact dans un contexte dédié.
    if mode == "pills" {
      let interval =
        cal.dateInterval(of: .day, for: now)
        ?? DateInterval(start: now, duration: 86_400)
      let pillsFilter = DeviceActivityFilter(
        segment: .daily(during: interval), users: .all, devices: devices)
      return DeviceActivityReport(
        DeviceActivityReport.Context("TodayPills"), filter: pillsFilter)
    }

    // Héro Accueil : [hier 00:00 → fin d'aujourd'hui] en segments quotidiens —
    // la scène calcule le total du jour ET celui d'hier (delta). Le chiffre est
    // RENDU dans l'extension : son sandbox interdit de le publier vers l'app.
    if mode == "hero" {
      let today =
        cal.dateInterval(of: .day, for: now)
        ?? DateInterval(start: now, duration: 86_400)
      let start = cal.date(byAdding: .day, value: -1, to: today.start)
        ?? today.start
      let heroFilter = DeviceActivityFilter(
        segment: .daily(during: DateInterval(start: start, end: today.end)),
        users: .all, devices: devices)
      return DeviceActivityReport(
        DeviceActivityReport.Context("TodayHero"), filter: heroFilter)
    }

    switch period {
    case 1:
      let anchor = cal.date(byAdding: .weekOfYear, value: -offset, to: now) ?? now
      let interval =
        cal.dateInterval(of: .weekOfYear, for: anchor)
        ?? DateInterval(start: anchor, duration: 604_800)
      filter = DeviceActivityFilter(
        segment: .daily(during: interval), users: .all, devices: devices)
    case 2:
      let anchor = cal.date(byAdding: .month, value: -offset, to: now) ?? now
      let interval =
        cal.dateInterval(of: .month, for: anchor)
        ?? DateInterval(start: anchor, duration: 2_592_000)
      filter = DeviceActivityFilter(
        segment: .daily(during: interval), users: .all, devices: devices)
    default:
      let anchor = cal.date(byAdding: .day, value: -offset, to: now) ?? now
      let interval =
        cal.dateInterval(of: .day, for: anchor)
        ?? DateInterval(start: anchor, duration: 86_400)
      filter = DeviceActivityFilter(
        segment: .hourly(during: interval), users: .all, devices: devices)
    }
    return DeviceActivityReport(
      DeviceActivityReport.Context("Usage"), filter: filter)
  }
}

@objc(ScreenTimeReportView)
final class ScreenTimeReportView: UIView {
  @objc var period: NSNumber = 0 {
    didSet { rebuild() }
  }
  @objc var offset: NSNumber = 0 {
    didSet { rebuild() }
  }
  @objc var mode: NSString = "usage" {
    didSet { rebuild() }
  }
  private var hosting: UIViewController?

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil { rebuild() }
  }

  private func rebuild() {
    guard window != nil, #available(iOS 16.0, *) else { return }
    hosting?.view.removeFromSuperview()
    let vc = UIHostingController(
      rootView: ReportContainer(
        period: period.intValue,
        offset: offset.intValue,
        mode: mode as String))
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
