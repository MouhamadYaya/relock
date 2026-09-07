import React from 'react'
import { AppState, type AppStateStatus, ScrollView, Text } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { ScenePersonalizedPlan } from '@/features/onboarding/components/ScenePersonalizedPlan'
import { buildPersonalizedPlan } from '@/features/onboarding/services/personalizedPlan'
import {
  PERSONALIZED_PLAN,
  PLAN_SUMMARY as SUM,
} from '@/features/onboarding/tokens'

jest.mock('@/features/onboarding/bits', () => ({
  GradientLine: 'GradientLine',
  Moon: 'Moon',
  Pill: 'Pill',
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('@/shared/components/ui/IconSvg', () => ({ IconSvg: 'IconSvg' }))
jest.mock('@/i18n/useT', () => ({ useT: () => (key: string) => key }))

describe('ScenePersonalizedPlan', () => {
  let renderer: ReactTestRenderer
  let changeAppState: (state: AppStateStatus) => void
  const plan = buildPersonalizedPlan({
    name: 'Léa',
    apps: ['TikTok', 'Instagram'],
    moment: ['bed'],
    trigger: ['bed'],
    feelings: ['empty'],
    stolen: ['nights'],
    attempts: ['limit'],
    aspirations: ['sleep', 'read'],
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
  const render = (
    props: Partial<React.ComponentProps<typeof ScenePersonalizedPlan>> = {},
  ) =>
    act(() => {
      renderer = create(
        <ScenePersonalizedPlan plan={plan} onNext={jest.fn()} {...props} />,
      )
    })
  const advance = (delay: number) => act(() => jest.advanceTimersByTime(delay))
  const revealAll = () => {
    for (const delay of PERSONALIZED_PLAN.readingDelays) advance(delay)
  }
  const button = () => renderer.root.findByProps({ label: 'C’est parti' })

  it('unlocks the CTA once every block has appeared, without ever asking for a scroll', () => {
    const onNext = jest.fn()
    render({ onNext })
    // Le bouton est là dès la première image — désactivé, mais accompagné de
    // sa jauge : c'est elle qui explique l'attente.
    expect(button().props.disabled).toBe(true)
    expect(button().props.progress).toBeDefined()
    act(() => button().props.onPress())
    expect(onNext).not.toHaveBeenCalled()
    // Tout tient dans un écran : plus aucune zone défilante, donc plus rien à
    // découvrir sous la ligne de flottaison.
    expect(renderer.root.findAllByType(ScrollView)).toHaveLength(0)

    revealAll()
    expect(button().props.disabled).toBe(false)
    act(() => button().props.onPress())
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('freezes the reveal — and the CTA gauge — while backgrounded', () => {
    render()
    advance(PERSONALIZED_PLAN.readingDelays[0])
    act(() => changeAppState('background'))
    const frozen = button().props.progress.value
    advance(10000)
    expect(button().props.disabled).toBe(true)
    expect(button().props.progress.value).toBe(frozen)
    act(() => changeAppState('active'))
    for (const delay of PERSONALIZED_PLAN.readingDelays.slice(1)) advance(delay)
    expect(button().props.disabled).toBe(false)
  })

  /**
   * Les cinq blocs révélés de l'écran. Autant de blocs que de temps de lecture
   * dans `readingDelays` : un bloc ajouté sans son délai laisserait le CTA
   * verrouillé pour toujours, et un délai sans bloc ferait attendre pour rien.
   */
  const BEATS = [
    'plan-title',
    'plan-echo',
    'plan-goal',
    'plan-method',
    'plan-note',
  ]

  it('reveals exactly one block per reading delay', () => {
    render()
    expect(BEATS).toHaveLength(PERSONALIZED_PLAN.readingDelays.length)
    for (const testID of BEATS)
      expect(renderer.root.findByProps({ testID })).toBeTruthy()
  })

  /**
   * Le garde-fou du « sans scroll » : la somme, dans le PIRE cas (chaque texte
   * à la limite de son `numberOfLines`), doit tenir dans la hauteur de la
   * maquette de référence. Tout le reste de l'écran étant remis à l'échelle de
   * cette référence, ce qui tient ici tient sur tous les iPhone.
   */
  it('keeps the worst-case layout inside the reference viewport', () => {
    /** `styles.pill.minHeight` dans `bits.tsx` — la pilule ne se met pas à l'échelle. */
    const PILL_HEIGHT = 58
    /** `GradientLine` réserve `ceil(size * 1.24)` de hauteur. */
    const heroHeight = Math.ceil(SUM.goalSize * 1.24)
    const header = SUM.badgeSize + SUM.headingGap + 2 * SUM.titleLineHeight
    const echo =
      SUM.eyebrowLineHeight + SUM.echoGap + SUM.echoLines * SUM.echoLineHeight
    const card =
      2 * SUM.cardPadding +
      2 + // liseré
      SUM.eyebrowLineHeight +
      3 * SUM.cardGap +
      heroHeight +
      SUM.goalSummaryLines * SUM.goalSummaryLineHeight +
      2 * SUM.noteLineHeight
    const methods = SUM.tileSize + SUM.tileGap + 2 * SUM.tileLabelLineHeight
    const footnote = SUM.footnoteLines * SUM.noteLineHeight
    const total =
      SUM.screenPaddingTop +
      header +
      echo +
      card +
      methods +
      footnote +
      4 * SUM.gap +
      SUM.footerGap +
      PILL_HEIGHT
    expect(total).toBeLessThanOrEqual(SUM.referenceHeight)
  })

  it('shows a minimal universal plan and labels 33 days as a goal, not a personal estimate', () => {
    render({ plan: { ...plan, hours: 1 } })
    revealAll()
    // Le chiffre héros passe par le dégradé signature (texte SVG), le reste
    // de la phrase reste du texte natif juste en dessous.
    expect(renderer.root.findByProps({ text: '33 jours' })).toBeTruthy()
    const copy = renderer.root
      .findAllByType(Text)
      .map(node => [node.props.children].flat(Infinity).join(''))
      .join('\n')
    expect(copy).toContain('pour dormir et lire')
    expect(copy).toContain('Objectif annuel')
    expect(copy).toContain('Cap non personnalisé')
    expect(copy).toContain('Bloque les distractions')
    expect(copy).toContain('Casse le réflexe')
    expect(copy).toContain('Vois tes progrès')
    // Le plan RE-DIT ses réponses : c'est ce qui prouve qu'il les a prises en
    // compte. Ce qu'il ne fait toujours pas, c'est déballer la mécanique des
    // règles (horaires, noms de presets) — ça vient au tutoriel.
    expect(copy).toContain(plan.recap)
    expect(copy).toContain(plan.loss)
    expect(copy).toContain(plan.defense)
    expect(copy).toContain('Tu choisiras tes apps et tes blocages ensuite.')
    expect(copy).not.toContain('Sommeil profond')
    expect(copy).not.toContain('22:00')
  })
})
