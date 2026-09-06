import React
import UIKit

@objc(NativeDurationPickerViewManager)
final class NativeDurationPickerViewManager: RCTViewManager {
  override func view() -> UIView! {
    NativeDurationPickerView()
  }

  override static func requiresMainQueueSetup() -> Bool { true }
}
