import React from 'react'
import { AppState, type AppStateStatus, Text } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { SceneRecognition } from '@/features/onboarding/components/SceneRecognition'
import { RECOGNITION } from '@/features/onboarding/tokens'

jest.mock('@/features/onboarding/bits', () => ({ Moon: 'Moon', Pill: 'Pill' }))

describe('SceneRecognition', () => {
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

  const advanceBeat = (delay: number) =>
    act(() => jest.advanceTimersByTime(delay))
  const hidden = (testID: string) =>
    renderer!.root
      .findAllByProps({ testID })
      .find(node => typeof node.props.accessibilityElementsHidden === 'boolean')
      ?.props.accessibilityElementsHidden

  it('shows the approved situation without an invented personal statistic', () => {
    act(() => {
      renderer = create(<SceneRecognition onNext={jest.fn()} />)
    })
    expect(
      renderer!.root.findAllByType(Text).map(text => text.props.children),
    ).toEqual([
      'Tu ouvres TikTok pour deux minutes.',
      'Tu relèves la tête.',
      'Deux heures ont passé.',
      'Tu connais ce moment ?',
    ])
  })

  it('reveals each phrase before allowing continuation', () => {
    const onNext = jest.fn()
    act(() => {
      renderer = create(<SceneRecognition onNext={onNext} />)
    })
    const button = () => renderer!.root.findByProps({ label: 'Ça me parle' })
    expect(button().props.disabled).toBe(true)
    act(() => button().props.onPress())
    expect(onNext).not.toHaveBeenCalled()

    const beats = [
      'recognition-intro',
      'recognition-look-up',
      'recognition-elapsed',
      'recognition-question',
      'recognition-continue',
    ]
    for (const [index, id] of beats.entries()) {
      expect(hidden(id)).toBe(true)
      advanceBeat(RECOGNITION.readingDelays[index] - 1)
      expect(hidden(id)).toBe(true)
      advanceBeat(1)
      expect(hidden(id)).toBe(false)
      expect(button().props.disabled).toBe(index < beats.length - 1)
    }
    act(() => button().props.onPress())
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('pauses reading while the app is not active and clears its timers on exit', () => {
    act(() => {
      renderer = create(<SceneRecognition onNext={jest.fn()} />)
    })
    advanceBeat(RECOGNITION.readingDelays[0])
    act(() => changeAppState('background'))
    advanceBeat(30000)
    expect(hidden('recognition-look-up')).toBe(true)
    expect(
      renderer!.root.findByProps({ label: 'Ça me parle' }).props.disabled,
    ).toBe(true)
    act(() => changeAppState('active'))
    advanceBeat(RECOGNITION.readingDelays[1])
    expect(hidden('recognition-look-up')).toBe(false)
    act(() => renderer?.unmount())
    expect(jest.getTimerCount()).toBe(0)
    renderer = undefined
  })
})
