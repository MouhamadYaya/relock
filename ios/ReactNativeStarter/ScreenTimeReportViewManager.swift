import React
import UIKit

@objc(ScreenTimeReportViewManager)
final class ScreenTimeReportViewManager: RCTViewManager {
  override func view() -> UIView! {
    if #available(iOS 16.0, *) {
      let report = ScreenTimeReportView()
      // Même canal que les autres commandes de la vue : `enqueueJSCall` passe
      // par le bridge, absent en mode bridgeless — l'événement n'arrivait
      // alors jamais côté JS, qui sait déjà traiter « settings ».
      report.onNavigateToSettings = { [weak report] in
        report?.onCommand?(["command": "settings"])
      }
      return report
    }
    return UIView()
  }
  override static func requiresMainQueueSetup() -> Bool { true }
}
