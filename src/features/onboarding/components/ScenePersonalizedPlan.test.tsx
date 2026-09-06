import React from 'react'
import { AppState, type AppStateStatus, Text } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { ScenePersonalizedPlan } from '@/features/onboarding/components/ScenePersonalizedPlan'
import { buildPersonalizedPlan } from '@/features/onboarding/services/personalizedPlan'
import { PERSONALIZED_PLAN } from '@/features/onboarding/tokens'

jest.mock('@/features/onboarding/bits', () => ({ Moon: 'Moon', Pill: 'Pill' }))
jest.mock('@/shared/components/ui/IconSvg', () => ({ IconSvg: 'IconSvg' }))
jest.mock('@/i18n/useT', () => ({ useT: () => (key: string) => key }))

describe('ScenePersonalizedPlan', () => {
  let renderer: ReactTestRenderer
  let changeAppState: (state: AppStateStatus) => void
  const plan = buildPersonalizedPlan({
    name: 'Léa',
    apps: ['TikTok', 'Instagram'],
    moment: 'bed',
    trigger: 'bed',
    feelings: ['empty'],
    hours: 5,
  })
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
    act(() => renderer.unmount())
    jest.restoreAllMocks()
    jest.useRealTimers()
  })
  const advance = (delay: number) => act(() => jest.advanceTimersByTime(delay))
  const button = () => renderer.root.findByProps({ label: 'C’est parti' })
  const scroll = () => renderer.root.findByProps({ testID: 'plan-scroll' })
  const measure = (height: number, content: number) =>
    act(() => {
      scroll().props.onLayout({ nativeEvent: { layout: { height } } })
      scroll().props.onContentSizeChange(375, content)
    })

  it('requires the staged reveal and the end of the content before continuing', () => {
    const onNext = jest.fn()
    act(() => {
      renderer = create(<ScenePersonalizedPlan plan={plan} onNext={onNext} />)
    })
    measure(400, 700)
    act(() => button().props.onPress())
    expect(onNext).not.toHaveBeenCalled()
    for (const delay of PERSONALIZED_PLAN.readingDelays) advance(delay)
    expect(button().props.disabled).toBe(true)
    act(() =>
      scroll().props.onScroll({ nativeEvent: { contentOffset: { y: 300 } } }),
    )
    expect(button().props.disabled).toBe(false)
    act(() => button().props.onPress())
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('does not demand a scroll when all content fits, and pauses while backgrounded', () => {
    act(() => {
      renderer = create(
        <ScenePersonalizedPlan plan={plan} onNext={jest.fn()} />,
      )
    })
    measure(800, 800)
    advance(PERSONALIZED_PLAN.readingDelays[0])
    act(() => changeAppState('background'))
    advance(10000)
    expect(button().props.disabled).toBe(true)
    act(() => changeAppState('active'))
    for (const delay of PERSONALIZED_PLAN.readingDelays.slice(1)) advance(delay)
    expect(button().props.disabled).toBe(false)
  })

  it('shows a minimal universal plan and labels 33 days as a goal, not a personal estimate', () => {
    act(() => {
      renderer = create(
        <ScenePersonalizedPlan
          plan={{ ...plan, hours: 1 }}
          onNext={jest.fn()}
        />,
      )
    })
    const copy = renderer.root
      .findAllByType(Text)
      .map(node => [node.props.children].flat(Infinity).join(''))
      .join('\n')
    expect(copy).toContain('33 jours pour toi')
    expect(copy).toContain('Objectif annuel')
    expect(copy).toContain('Cap non personnalisé')
    expect(copy).toContain('Bloque les distractions')
    expect(copy).toContain('Casse le réflexe')
    expect(copy).toContain('Vois tes progrès')
    expect(copy).not.toContain(plan.recap)
    expect(copy).not.toContain('Sommeil profond')
    expect(copy).not.toContain('22:00')
  })
})
