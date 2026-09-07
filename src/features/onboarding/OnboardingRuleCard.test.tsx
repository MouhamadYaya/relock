import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { OnboardingRuleCard } from '@/features/onboarding/OnboardingRuleCard'

jest.mock('@/features/blocking/components/BlockingGlyphs', () => ({
  RuleTemplateFlowGlyph: 'RuleTemplateFlowGlyph',
}))
jest.mock('@/shared/components/ui/IconSvg', () => ({ IconSvg: 'IconSvg' }))
jest.mock('@/shared/native/BlockedAppIcons', () => ({
  BlockedAppIcons: 'BlockedAppIcons',
  isBlockedAppIconsAvailable: true,
}))

describe('onboarding rule card', () => {
  let renderer: ReactTestRenderer
  const onToggle = jest.fn()
  const onInfo = jest.fn()

  const render = (
    props: Partial<React.ComponentProps<typeof OnboardingRuleCard>> = {},
  ) => {
    act(() => {
      renderer = create(
        <OnboardingRuleCard
          title="Travail"
          description="Bloque les distractions"
          time="09:00 – 17:00"
          kind="schedule"
          image={1}
          selected={false}
          onToggle={onToggle}
          appKeys={['key-a', 'key-b', 'key-c']}
          appOthers={0}
          appsLabel="S’applique aux 3 apps que tu viens de choisir."
          onInfo={onInfo}
          {...props}
        />,
      )
    })
  }

  const tiles = () =>
    renderer.root.findAll(node => (node.type as unknown) === 'BlockedAppIcons')
  /** Le « +N » des vignettes, ou null s'il n'est pas dessiné. */
  const overflow = (): number | null => {
    const node = renderer.root.findAll(
      n =>
        typeof n.type === 'string' &&
        Array.isArray(n.props.children) &&
        n.props.children[0] === '+',
    )[0]
    return node ? (node.props.children[1] as number) : null
  }
  const help = () =>
    renderer.root.findByProps({
      accessibilityLabel: 'Ce que fait la règle Travail',
    })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('poses the real icons of the chosen apps, and counts the overflow', () => {
    render()
    // Deux vignettes au plus : la troisième app bascule dans le « +N ».
    expect(tiles()).toHaveLength(2)
    expect(overflow()).toBe(1)
  })

  it('adds categories and web domains to the overflow count', () => {
    render({ appKeys: ['key-a'], appOthers: 4 })
    expect(tiles()).toHaveLength(1)
    expect(overflow()).toBe(4)
  })

  it('draws no tile when no token could be resolved', () => {
    // Android, iOS < 16, simulateur, binaire sans `draftAppKeys` : on préfère
    // le vide à une icône devinée, et un « +N » orphelin n'informe personne.
    render({ appKeys: [], appOthers: 3 })
    expect(tiles()).toHaveLength(0)
    expect(overflow()).toBeNull()
  })

  it('asks for the explanation without selecting the rule', () => {
    render()
    act(() => help().props.onPress())
    expect(onInfo).toHaveBeenCalledTimes(1)
    expect(onToggle).not.toHaveBeenCalled()
  })

  it('keeps the help button in place once the rule is selected', () => {
    render({ selected: true })
    expect(help()).toBeTruthy()
  })

  it('tells screen readers what the tiles show', () => {
    render()
    const card = renderer.root.findByProps({ accessibilityRole: 'checkbox' })
    expect(card.props.accessibilityLabel).toContain(
      'S’applique aux 3 apps que tu viens de choisir.',
    )
  })
})
