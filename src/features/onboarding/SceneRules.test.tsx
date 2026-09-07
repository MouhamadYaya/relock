/**
 * L'écran des règles proposées, vu sous l'angle qui lui manquait : dit-il sur
 * QUOI ces règles vont porter ?
 *
 * Fichier séparé de `scenes-tutorial.test.tsx`, qui couvre la scène du
 * sélecteur d'apps — deux scènes, deux jeux de mocks (celui-ci a besoin des
 * vraies cartes pour vérifier ce qu'elles reçoivent, l'autre les remplace).
 */
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { SceneRules } from '@/features/onboarding/scenes-tutorial'
import { ScreenTime } from '@/shared/native/screen-time'

jest.mock('@/features/onboarding/bits', () => ({
  Footnote: 'Footnote',
  GhostLink: 'GhostLink',
  Moon: 'Moon',
  Pill: 'Pill',
  RedAlert: 'RedAlert',
  ChoiceCard: 'ChoiceCard',
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('@/features/onboarding/motion', () => ({ Reveal: 'Reveal' }))
jest.mock('@/features/onboarding/PickerAnimation', () => ({
  PickerAnimation: 'PickerAnimation',
  PICKER_DEMO_TAUGHT_MS: 4400,
}))
jest.mock('@/features/onboarding/LockAnimation', () => ({
  LockAnimation: 'LockAnimation',
}))
jest.mock('@/features/blocking/components/BlockingGlyphs', () => ({
  RuleTemplateFlowGlyph: 'RuleTemplateFlowGlyph',
}))
jest.mock('@/shared/components/ui/IconSvg', () => ({ IconSvg: 'IconSvg' }))
jest.mock('@/shared/native/BlockedAppIcons', () => ({
  BlockedAppIcons: 'BlockedAppIcons',
  isBlockedAppIconsAvailable: true,
}))
jest.mock('@/shared/native/screen-time', () => ({
  ScreenTime: { isAvailable: true, draftAppKeys: jest.fn() },
}))

describe('proposed rules screen', () => {
  let renderer: ReactTestRenderer
  const onToggle = jest.fn()
  const onActivate = jest.fn()

  const render = async (appCount = 3) => {
    await act(async () => {
      renderer = create(
        <SceneRules
          name="Yaya"
          recommendedIds={[]}
          selectedIds={[]}
          onToggle={onToggle}
          busy={false}
          onActivate={onActivate}
          appCount={appCount}
        />,
      )
    })
  }

  /** Toutes les chaînes rendues, aplaties — pour interroger la copie. */
  const copy = () =>
    renderer.root
      .findAll(n => typeof n.type === 'string')
      .flatMap(n =>
        Array.isArray(n.props.children) ? n.props.children : [n.props.children],
      )
      .filter((c): c is string => typeof c === 'string')
      .join(' ⏐ ')

  /**
   * Les « ? », un par carte. Dédupliqués par `onPress` : `findAll` descend
   * dans le composite ET dans les hôtes qu'il rend, donc un même bouton
   * ressort plusieurs fois.
   */
  const helpButtons = () => {
    const seen = new Set<unknown>()
    return renderer.root
      .findAll(
        n =>
          String(n.props?.accessibilityLabel ?? '').startsWith(
            'Ce que fait la règle ',
          ) && typeof n.props?.onPress === 'function',
      )
      .filter(n => {
        if (seen.has(n.props.onPress)) return false
        seen.add(n.props.onPress)
        return true
      })
  }

  beforeEach(() => {
    jest.clearAllMocks()
    jest
      .mocked(ScreenTime.draftAppKeys)
      .mockReset()
      .mockResolvedValue(['key-a', 'key-b'])
  })

  it('names the apps chosen on the previous screen', async () => {
    await render(3)
    expect(copy()).toContain('les 3 apps que tu viens de choisir')
  })

  it('speaks of a single app in the singular', async () => {
    await render(1)
    expect(copy()).toContain('l’app que tu viens de choisir')
  })

  it('resolves the picker tokens once for the whole carousel', async () => {
    await render()
    // Huit cartes, une seule interrogation du natif : la sélection est la même
    // pour toutes, `bindSelection` la recopiera telle quelle dans chacune.
    expect(ScreenTime.draftAppKeys).toHaveBeenCalledTimes(1)
    const tiles = renderer.root.findAll(
      n => (n.type as unknown) === 'BlockedAppIcons',
    )
    expect(tiles.length).toBeGreaterThan(1)
  })

  it('never asks the native side when nothing was selected', async () => {
    await render(0)
    expect(ScreenTime.draftAppKeys).not.toHaveBeenCalled()
    expect(
      renderer.root.findAll(n => (n.type as unknown) === 'BlockedAppIcons'),
    ).toHaveLength(0)
  })

  it('leaves the cards bare when the tokens cannot be read', async () => {
    jest
      .mocked(ScreenTime.draftAppKeys)
      .mockRejectedValue(new Error('selection illisible'))
    await render()
    expect(
      renderer.root.findAll(n => (n.type as unknown) === 'BlockedAppIcons'),
    ).toHaveLength(0)
    // La phrase, elle, tient toujours : le compte vient du sélecteur.
    expect(copy()).toContain('les 3 apps que tu viens de choisir')
  })

  it('explains one rule at a time, on demand', async () => {
    await render()
    const buttons = helpButtons()
    expect(buttons.length).toBe(8)
    // Rien d'ouvert tant qu'on n'a rien demandé.
    expect(copy()).not.toContain('Ce qui se passe')

    await act(async () => buttons[0].props.onPress())
    const shown = copy()
    expect(shown).toContain('Quand')
    expect(shown).toContain('Sur quelles apps')
    expect(shown).toContain('Ce qui se passe')
    // Le point qui manquait le plus : c'est réversible.
    expect(shown).toContain('Rien n’est figé')
  })
})
