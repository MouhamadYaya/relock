import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { BreathingPauseModal } from '@/features/blocking/components/BreathingPauseModal'
import { ScreenTime } from '@/shared/native/screen-time'

jest.mock('@/i18n/useT', () => ({
  useT: () => (key: string, values?: { count?: number }) =>
    values?.count == null ? key : `${key}:${values.count}`,
}))

jest.mock('@/shared/components/ui/IconSvg', () => ({
  IconSvg: () => null,
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock('@/shared/native/BlockedAppIcons', () => ({
  BlockedAppIcons: () => null,
  isBlockedAppIconsAvailable: false,
}))

describe('BreathingPauseModal', () => {
  let renderer: ReactTestRenderer | undefined

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-08-31T20:00:00Z'))
    jest
      .spyOn(ScreenTime, 'playCalmSound')
      .mockImplementation(() => new Promise(() => {}))
    jest.spyOn(ScreenTime, 'stopCalmSound').mockResolvedValue(true)
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  it('keeps Continue disabled for six seconds, then enables it', () => {
    const onContinue = jest.fn()
    act(() => {
      renderer = create(
        <BreathingPauseModal
          visible
          tokenKey="app-a"
          onCancel={jest.fn()}
          onContinue={onContinue}
        />,
      )
    })

    const continueButton = () =>
      renderer?.root.findByProps({ testID: 'breathing-continue' })

    expect(
      renderer?.root.findByProps({ testID: 'breathing-mist-orb' }),
    ).toBeTruthy()
    expect(
      renderer?.root.findByProps({ testID: 'breathing-mist-orb-echo' }),
    ).toBeTruthy()
    expect(continueButton()?.props.disabled).toBe(true)
    act(() => jest.advanceTimersByTime(5_900))
    expect(continueButton()?.props.disabled).toBe(true)

    act(() => jest.advanceTimersByTime(100))
    expect(continueButton()?.props.disabled).toBe(false)

    act(() => continueButton()?.props.onPress())
    expect(onContinue).toHaveBeenCalledTimes(1)
    expect(ScreenTime.playCalmSound).toHaveBeenCalledTimes(1)
    expect(ScreenTime.stopCalmSound).toHaveBeenCalled()
  })

  it('keeps alternating Inspire and Expire after Continue becomes available', () => {
    act(() => {
      renderer = create(
        <BreathingPauseModal
          visible
          tokenKey="app-a"
          onCancel={jest.fn()}
          onContinue={jest.fn()}
        />,
      )
    })

    const phase = () =>
      renderer?.root.findByProps({ accessibilityLiveRegion: 'polite' }).props
        .children

    expect(phase()).toBe('blocking.breathing.inhale')
    act(() => jest.advanceTimersByTime(3_000))
    expect(phase()).toBe('blocking.breathing.exhale')
    act(() => jest.advanceTimersByTime(3_000))
    expect(phase()).toBe('blocking.breathing.inhale')
    expect(
      renderer?.root.findByProps({ testID: 'breathing-continue' }).props
        .disabled,
    ).toBe(false)
    act(() => jest.advanceTimersByTime(3_000))
    expect(phase()).toBe('blocking.breathing.exhale')
  })
})
