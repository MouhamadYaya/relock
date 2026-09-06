import React from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { ScenePlanPreparation } from '@/features/onboarding/components/ScenePlanPreparation'
import { ANTI_SCROLL_PLAN } from '@/features/onboarding/services/antiScrollPlan'
import { PLAN_PREPARATION as PREP } from '@/features/onboarding/tokens'

jest.mock('@/shared/components/ui/IconSvg', () => ({ IconSvg: 'IconSvg' }))

describe('plan preparation', () => {
  let renderer: ReactTestRenderer | undefined
  let changeAppState: (state: AppStateStatus) => void
  beforeEach(() => {
    jest.useFakeTimers()
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        changeAppState = listener
        return { remove: jest.fn() }
      })
  })
  afterEach(() => {
    act(() => renderer?.unmount())
    jest.restoreAllMocks()
    jest.useRealTimers()
  })
  const advance = (ms: number) => act(() => jest.advanceTimersByTime(ms))
  const percentage = () =>
    renderer!.root.findByProps({ accessibilityRole: 'progressbar' }).props
      .accessibilityValue.now

  it('shows the same anti-scroll steps as the plan and only continues after completion', () => {
    const onDone = jest.fn()
    act(() => {
      renderer = create(<ScenePlanPreparation onDone={onDone} />)
    })
    for (const step of ANTI_SCROLL_PLAN)
      expect(
        renderer!.root.findAllByProps({ children: step.title }).length,
      ).toBeGreaterThan(0)
    advance(PREP.duration / 2)
    expect(percentage()).toBe(50)
    expect(
      renderer!.root.findByProps({ testID: 'preparation-progress-fill' }).props
        .width,
    ).toBe('50%')
    expect(onDone).not.toHaveBeenCalled()
    advance(PREP.duration / 2)
    expect(percentage()).toBe(100)
    advance(PREP.completionHold)
    expect(onDone).toHaveBeenCalledTimes(1)
    advance(10000)
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('pauses in background and cancels the delayed navigation on unmount', () => {
    const onDone = jest.fn()
    act(() => {
      renderer = create(<ScenePlanPreparation onDone={onDone} />)
    })
    advance(PREP.duration / 2)
    act(() => changeAppState('background'))
    advance(10000)
    expect(percentage()).toBe(50)
    act(() => changeAppState('active'))
    advance(PREP.duration / 2)
    expect(percentage()).toBe(100)
    act(() => renderer!.unmount())
    renderer = undefined
    advance(PREP.completionHold)
    expect(onDone).not.toHaveBeenCalled()
    expect(jest.getTimerCount()).toBe(0)
  })
})
