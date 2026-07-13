import React
import UIKit

@objc(ScreenTimeReportViewManager)
final class ScreenTimeReportViewManager: RCTViewManager {
  override func view() -> UIView! {
    if #available(iOS 16.0, *) { return ScreenTimeReportView() }
    return UIView()
  }
  override static func requiresMainQueueSetup() -> Bool { true }
}
