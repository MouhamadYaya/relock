import DeviceActivity
import SwiftUI
import UIKit

/// Héberge le rapport de temps d'écran (rendu par l'extension RelockActivityReport)
/// dans une UIView, pour l'afficher dans l'écran Activité RN.
@available(iOS 16.0, *)
private struct ReportContainer: View {
  var body: some View {
    let interval =
      Calendar.current.dateInterval(of: .day, for: Date())
      ?? DateInterval(start: Date(), duration: 86_400)
    let filter = DeviceActivityFilter(
      segment: .hourly(during: interval),
      users: .all,
      devices: .all)
    return DeviceActivityReport(
      DeviceActivityReport.Context("Usage"), filter: filter)
  }
}

@objc(ScreenTimeReportView)
final class ScreenTimeReportView: UIView {
  private var hosting: UIViewController?

  override func didMoveToWindow() {
    super.didMoveToWindow()
    guard hosting == nil, window != nil, #available(iOS 16.0, *) else { return }
    let vc = UIHostingController(rootView: ReportContainer())
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
