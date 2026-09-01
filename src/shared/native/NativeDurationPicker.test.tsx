import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import {
  NativeDurationPicker,
  normalizeDurationMinutes,
} from '@/shared/native/NativeDurationPicker'

describe('normalizeDurationMinutes', () => {
  it('snaps stored values to the native minute interval', () => {
    expect(normalizeDurationMinutes(31, 5, 480, 5)).toBe(30)
    expect(normalizeDurationMinutes(33, 5, 480, 5)).toBe(35)
  })

  it('enforces each product boundary', () => {
    expect(normalizeDurationMinutes(0, 5, 480, 5)).toBe(5)
    expect(normalizeDurationMinutes(900, 5, 480, 5)).toBe(480)
    expect(normalizeDurationMinutes(300, 5, 240, 5)).toBe(240)
  })
})

describe('NativeDurationPicker', () => {
  let renderer: ReactTestRenderer | undefined

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
  })

  it('forwards the minute selected by the Apple picker', () => {
    const onMinutesChange = jest.fn()
    act(() => {
      renderer = create(
        <NativeDurationPicker
          testID="native-duration-picker"
          accessibilityLabel="Durée"
          minutes={30}
          minimumMinutes={5}
          maximumMinutes={480}
          onMinutesChange={onMinutesChange}
        />,
      )
    })

    const nativePicker = renderer?.root
      .findAllByProps({ testID: 'native-duration-picker' })
      .find(node => typeof node.props.onChange === 'function')

    act(() => nativePicker?.props.onChange({ nativeEvent: { minutes: 45 } }))

    expect(nativePicker?.props.accessibilityRole).toBe('adjustable')
    expect(onMinutesChange).toHaveBeenCalledWith(45)
  })
})
