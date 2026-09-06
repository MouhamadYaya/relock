import React
import UIKit

@objc(BlockedAppIconsViewManager)
final class BlockedAppIconsViewManager: RCTViewManager {
  override func view() -> UIView! {
    if #available(iOS 16.0, *) { return BlockedAppIconsView() }
    return UIView()
  }
  override static func requiresMainQueueSetup() -> Bool { true }
}
