import React from 'react'
import { type SharedValue, useSharedValue } from 'react-native-reanimated'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { ScenePickApps } from '@/features/onboarding/scenes-tutorial'
import { ScreenTime } from '@/shared/native/screen-time'
import { showErrorToast } from '@/shared/utils/toast'

jest.mock('@/features/onboarding/bits', () => ({
  Pill: 'Pill',
  GhostLink: 'GhostLink',
  RedAlert: 'RedAlert',
}))
jest.mock('@/features/onboarding/motion', () => ({ Reveal: 'Reveal' }))
jest.mock('@/features/onboarding/PickerAnimation', () => ({
  PickerAnimation: 'PickerAnimation',
}))
jest.mock('@/features/onboarding/LockAnimation', () => ({
  LockAnimation: 'LockAnimation',
}))
jest.mock('@/features/onboarding/OnboardingRuleCard', () => ({
  OnboardingRuleCard: 'OnboardingRuleCard',
}))
jest.mock('@/shared/components/ui/IconSvg', () => ({ IconSvg: 'IconSvg' }))
jest.mock('@/shared/native/screen-time', () => ({
  ScreenTime: { isAvailable: true, presentPicker: jest.fn() },
}))
jest.mock('@/shared/utils/toast', () => ({ showErrorToast: jest.fn() }))

describe('single app selection screen', () => {
  let renderer: ReactTestRenderer
  const onNext = jest.fn()
  const onCount = jest.fn()
  const button = (label: string) => renderer.root.findByProps({ label })
  function Harness() {
    const [count, setCount] = React.useState(0)
    return (
      <ScenePickApps
        count={count}
        onCount={n => {
          setCount(n)
          onCount(n)
        }}
        onNext={onNext}
      />
    )
  }
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest
      .mocked(useSharedValue)
      .mockImplementation(
        <T,>(value: T) => React.useRef({ value }).current as SharedValue<T>,
      )
    jest
      .mocked(ScreenTime.presentPicker)
      .mockReset()
      .mockResolvedValue({ count: 3 })
    act(() => {
      renderer = create(<Harness />)
    })
  })
  afterEach(() => {
    act(() => renderer.unmount())
    jest.useRealTimers()
  })

  it('opens only the real picker and retains the selection through optional help', async () => {
    expect(ScreenTime.presentPicker).not.toHaveBeenCalled()
    await act(async () => button('Ouvrir le sélecteur').props.onPress())
    expect(onCount).toHaveBeenCalledWith(3)
    expect(onNext).not.toHaveBeenCalled()
    act(() => button('Voir comment faire').props.onPress())
    act(() => jest.advanceTimersByTime(4500))
    act(() => button('J’ai compris').props.onPress())
    expect(ScreenTime.presentPicker).toHaveBeenCalledTimes(1)
    act(() => button('Continuer').props.onPress())
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('keeps an empty or canceled selection on the same screen with help and retry', async () => {
    jest.mocked(ScreenTime.presentPicker).mockResolvedValueOnce({ count: 0 })
    await act(async () => button('Ouvrir le sélecteur').props.onPress())
    expect(onCount).toHaveBeenCalledWith(0)
    expect(onNext).not.toHaveBeenCalled()
    expect(button('Voir comment faire')).toBeDefined()
    expect(button('Ouvrir le sélecteur').props.disabled).toBe(false)
    await act(async () => button('Ouvrir le sélecteur').props.onPress())
    expect(button('Continuer')).toBeDefined()
  })

  it('allows retry after a native error', async () => {
    const error = new Error('Sélecteur indisponible')
    jest.mocked(ScreenTime.presentPicker).mockRejectedValueOnce(error)
    await act(async () => button('Ouvrir le sélecteur').props.onPress())
    expect(showErrorToast).toHaveBeenCalledWith(error)
    expect(onCount).not.toHaveBeenCalled()
    expect(onNext).not.toHaveBeenCalled()
    expect(button('Ouvrir le sélecteur').props.disabled).toBe(false)
  })

  it('prevents two native pickers from opening on a double tap', async () => {
    const pick = button('Ouvrir le sélecteur').props.onPress
    await act(async () => {
      await Promise.all([pick(), pick()])
    })
    expect(ScreenTime.presentPicker).toHaveBeenCalledTimes(1)
  })
})
