import React from 'react'
import { StyleSheet } from 'react-native'
import { type SharedValue, useSharedValue } from 'react-native-reanimated'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { SceneGoodNews } from '@/features/onboarding/scenes-verdict'
import { recoveryGoal } from '@/features/onboarding/services/recoveryGoal'
import { GOOD_NEWS, OB } from '@/features/onboarding/tokens'

jest.mock('@/features/onboarding/motion', () => ({ Reveal: 'Reveal' }))
jest.mock('@/features/onboarding/bits', () => ({
  Pill: 'Pill',
  GradientLine: 'GradientLine',
  Footnote: 'Footnote',
  Moon: 'Moon',
}))

describe('annual good news', () => {
  let renderer: ReactTestRenderer | undefined
  beforeEach(() => {
    jest.useFakeTimers()
    // Native shared values keep their identity between renders.
    jest
      .mocked(useSharedValue)
      .mockImplementation(
        <T,>(value: T) => React.useRef({ value }).current as SharedValue<T>,
      )
  })
  afterEach(() => {
    act(() => renderer?.unmount())
    jest.useRealTimers()
  })

  it.each([
    [1, 33],
    [5, 38],
    [9, 68],
  ])('settles at %s hours/day within three seconds', (hours, recovered) => {
    act(() => {
      renderer = create(<SceneGoodNews hours={hours} onNext={jest.fn()} />)
    })
    act(() => {
      jest.advanceTimersByTime(3000)
    })
    const lead = renderer!.root.findByProps({ testID: 'good-news-lead' })
    expect(lead.props.children.join('')).toBe(
      'Relock va t’aider à récupérer\ndu temps pour toi.',
    )
    expect(StyleSheet.flatten(lead.props.style)).toMatchObject({
      color: OB.ink,
      fontSize: GOOD_NEWS.leadSize,
      lineHeight: GOOD_NEWS.leadLineHeight,
    })
    expect(
      renderer!.root.findAllByProps({ text: `${recovered} jours` }).length,
    ).toBeGreaterThan(0)
    expect(
      renderer!.root.findAllByProps({ text: 'par an' }).length,
    ).toBeGreaterThan(0)
    expect(
      renderer!.root.findAllByProps({
        children: recoveryGoal(hours).note,
      }).length,
    ).toBeGreaterThan(0)
  })
})
