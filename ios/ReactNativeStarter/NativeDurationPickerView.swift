import React
import UIKit

/// Minuterie Apple (`UIDatePickerMode.countDownTimer`) pilotée en minutes.
///
/// `@react-native-community/datetimepicker` transmet `UIDatePicker.date`, qui
/// ne représente pas la sélection en mode compte à rebours. Cette vue remonte
/// directement `countDownDuration`, la source native correcte.
final class NativeDurationPickerView: UIView {
  @objc var minutes: NSNumber = 30 {
    didSet { applyControlledMinutes() }
  }

  @objc var minimumMinutes: NSNumber = 5 {
    didSet { applyControlledMinutes() }
  }

  @objc var maximumMinutes: NSNumber = 480 {
    didSet { applyControlledMinutes() }
  }

  @objc var minuteInterval: NSNumber = 5 {
    didSet {
      picker.minuteInterval = safeMinuteInterval
      applyControlledMinutes()
    }
  }

  @objc var onChange: RCTDirectEventBlock?

  private let picker = UIDatePicker()

  override init(frame: CGRect) {
    super.init(frame: frame)
    configure()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    configure()
  }

  private var lowerBound: Int {
    max(1, minimumMinutes.intValue)
  }

  private var upperBound: Int {
    max(lowerBound, min(1_439, maximumMinutes.intValue))
  }

  private var safeMinuteInterval: Int {
    let supported = [1, 2, 3, 4, 5, 6, 10, 12, 15, 20, 30]
    let requested = minuteInterval.intValue
    return supported.contains(requested) ? requested : 5
  }

  private func bounded(_ value: Int) -> Int {
    let stepped = Int((Double(value) / Double(safeMinuteInterval)).rounded())
      * safeMinuteInterval
    return min(upperBound, max(lowerBound, stepped))
  }

  private func configure() {
    backgroundColor = .clear
    clipsToBounds = true

    picker.datePickerMode = .countDownTimer
    picker.preferredDatePickerStyle = .wheels
    picker.minuteInterval = safeMinuteInterval
    picker.overrideUserInterfaceStyle = .dark
    picker.addTarget(self, action: #selector(valueChanged), for: .valueChanged)
    picker.accessibilityIdentifier = "native-duration-picker-wheel"
    addSubview(picker)

    applyControlledMinutes()
  }

  private func applyControlledMinutes() {
    let next = bounded(minutes.intValue)
    let seconds = TimeInterval(next * 60)
    guard abs(picker.countDownDuration - seconds) >= 1 else { return }
    picker.countDownDuration = seconds
  }

  @objc private func valueChanged() {
    let selected = bounded(Int((picker.countDownDuration / 60).rounded()))
    let selectedSeconds = TimeInterval(selected * 60)

    if abs(picker.countDownDuration - selectedSeconds) >= 1 {
      picker.countDownDuration = selectedSeconds
    }

    onChange?(["minutes": selected])
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    picker.frame = bounds
  }
}
