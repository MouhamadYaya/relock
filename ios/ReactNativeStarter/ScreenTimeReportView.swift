import DeviceActivity
import SwiftUI
import UIKit

/// Héberge le rapport de temps d'écran (extension RelockActivityReport) dans une
/// UIView pour l'écran Activité RN. `period` : 0 = jour, 1 = semaine, 2 = mois.
@available(iOS 16.0, *)
private struct ReportContainer: View {
  let period: Int

  var body: some View {
    let cal = Calendar.current
    let now = Date()
    let filter: DeviceActivityFilter
    switch period {
    case 1:
      let interval =
        cal.dateInterval(of: .weekOfYear, for: now)
        ?? DateInterval(start: now, duration: 604_800)
      filter = DeviceActivityFilter(
        segment: .daily(during: interval), users: .all, devices: .all)
    case 2:
      let interval =
        cal.dateInterval(of: .month, for: now)
        ?? DateInterval(start: now, duration: 2_592_000)
      filter = DeviceActivityFilter(
        segment: .daily(during: interval), users: .all, devices: .all)
    default:
      let interval =
        cal.dateInterval(of: .day, for: now)
        ?? DateInterval(start: now, duration: 86_400)
      filter = DeviceActivityFilter(
        segment: .hourly(during: interval), users: .all, devices: .all)
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
  private var hosting: UIViewController?

  override func didMoveToWindow() {
    super.didMoveToWindow()
    if window != nil { rebuild() }
  }

  private func rebuild() {
    guard window != nil, #available(iOS 16.0, *) else { return }
    hosting?.view.removeFromSuperview()
    let vc = UIHostingController(
      rootView: ReportContainer(period: period.intValue))
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
