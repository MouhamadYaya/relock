import React
import UIKit

@objc(ScreenTimeReportViewManager)
final class ScreenTimeReportViewManager: RCTViewManager {
  override func view() -> UIView! {
    if #available(iOS 16.0, *) {
      let report = ScreenTimeReportView()
      report.onNavigateToSettings = { [weak self] in
        self?.bridge.enqueueJSCall(
          "RCTDeviceEventEmitter",
          method: "emit",
          args: ["relock-native-settings"],
          completion: nil)
      }
      return report
    }
    return UIView()
  }
  override static func requiresMainQueueSetup() -> Bool { true }
}
