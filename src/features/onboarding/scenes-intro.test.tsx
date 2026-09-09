import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { SceneName, SceneWelcome } from '@/features/onboarding/scenes-intro'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))
jest.mock('react-native-gesture-handler', () => ({}))
// `IconSvg` résout un composant SVG depuis le registre d'assets, que Jest
// remplace par un stub : c'est le rendu du glyphe qui compte à l'écran, pas
// dans ces tests de composition.
jest.mock('@/shared/components/ui/IconSvg', () => {
  const React = require('react')
  const { View } = require('react-native')
  return { IconSvg: (props: object) => React.createElement(View, props) }
})
jest.mock('@/features/onboarding/motion', () => ({ Reveal: 'Reveal' }))
jest.mock('@/features/onboarding/bits', () => ({
  Pill: 'Pill',
  GhostLink: 'GhostLink',
  StudyLine: 'StudyLine',
  HaloBackdrop: 'HaloBackdrop',
}))
/**
 * Le premier écran n'a plus AUCUN raccourci de développement (2026-09-08) :
 * « Passer (dev) », « Paywall (dev) » puis « skip onboarding » vivaient sous
 * `__DEV__`, donc absents du binaire livré — mais présents dans toute build
 * de dev, y compris celles qu'on fait essayer autour de soi. Le saut du
 * parcours reste accessible, sans pixel à l'écran, par
 * `relock://dev/skip-onboarding` (`src/session/dev-test-bridge.ts`).
 *
 * Ce test tient le bout qui compte : même dans une build de dev, « Continuer »
 * est la seule issue de l'écran.
 */
describe('Welcome step', () => {
  let renderer: ReactTestRenderer | undefined
  const runtime = globalThis as typeof globalThis & { __DEV__: boolean }
  const originalDev = __DEV__

  afterEach(() => {
    act(() => renderer?.unmount())
    runtime.__DEV__ = originalDev
    jest.clearAllMocks()
  })

  const render = () => {
    const onNext = jest.fn()
    act(() => {
      renderer = create(<SceneWelcome onNext={onNext} />)
    })
    return onNext
  }

  it('offers a single way forward', () => {
    const onNext = render()
    expect(renderer!.root.findAllByProps({ label: 'Continuer' })).toHaveLength(
      1,
    )
    act(() => {
      renderer!.root.findByProps({ label: 'Continuer' }).props.onPress()
    })
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('keeps every dev shortcut out, even in a dev build', () => {
    runtime.__DEV__ = true
    render()
    for (const label of ['Passer (dev)', 'Paywall (dev)']) {
      expect(renderer!.root.findAllByProps({ label })).toHaveLength(0)
    }
    expect(
      renderer!.root.findAllByProps({ testID: 'dev-skip-onboarding' }),
    ).toHaveLength(0)
  })

  /**
   * La pluie et le lecteur sont posés en ABSOLU sur un cadre déduit de deux
   * mesures — la scène, puis la cale laissée à l'illustration. Tant que rien
   * n'est mesuré, ils ne doivent pas exister : dessiner à (0, 0) le temps
   * d'une image ferait clignoter l'illustration dans le coin de l'écran.
   */
  const measure = (scene: number[], stage: number[]) => {
    // `typeof n.type === 'string'` : sans ce filtre, chaque View compte
    // DEUX fois (le composant puis l'hôte), et l'index 1 retombe sur la
    // scène au lieu de la cale.
    const boxes = () =>
      renderer!.root.findAll(
        n =>
          typeof n.props.onLayout === 'function' && typeof n.type === 'string',
      )
    act(() => {
      boxes()[0].props.onLayout({
        nativeEvent: {
          layout: { x: 0, y: 0, width: scene[0], height: scene[1] },
        },
      })
    })
    act(() => {
      boxes()[1].props.onLayout({
        nativeEvent: {
          layout: { x: 0, y: stage[0], width: scene[0], height: stage[1] },
        },
      })
    })
  }

  it('opens the science sheet from the badge, and not before', () => {
    render()
    const sheet = () =>
      renderer!.root.findAllByProps({ testID: 'science-backdrop' })
    // Le badge AFFIRME (« soutenu par la science ») ; la feuille DÉMONTRE.
    // Tant que personne ne l'a touché, l'écran ne porte que l'affirmation.
    expect(sheet()).toHaveLength(0)
    act(() =>
      renderer!.root.findByProps({ testID: 'science-badge' }).props.onPress(),
    )
    expect(sheet().length).toBeGreaterThan(0)
  })

  it('draws nothing on top until the scene has been measured', () => {
    render()
    expect(
      renderer!.root.findAllByProps({ testID: 'shield-rain' }),
    ).toHaveLength(0)
  })

  it('centres the reader in the space the layout left it, without distorting it', () => {
    render()
    measure([390, 844], [300, 380])

    expect(
      renderer!.root.findAllByProps({ testID: 'shield-rain' }).length,
    ).toBeGreaterThan(0)

    // La `Reveal` qui porte une largeur chiffrée : c'est le cadre absolu
    // calculé pour l'illustration (le lavis du haut est un View, pas une
    // Reveal — il ne se révèle pas, il est déjà là).
    const frame = renderer!.root
      .findAll(n => String(n.type) === 'Reveal')
      .map(n => n.props.style)
      .find(style => typeof style?.width === 'number')
    // 1130 × 1218 : la boîte opaque de `onboarding-welcome-hero.png`. La
    // largeur est bornée à 72 % de l'écran (la cale de 380 pt est ici plus
    // haute que large, c'est donc elle qui décide), la hauteur suit ce
    // rapport — un écart ici veut dire une illustration étirée.
    expect(frame.width).toBeCloseTo(390 * 0.72, 3)
    expect(frame.height).toBeCloseTo((390 * 0.72 * 1218) / 1130, 3)
    expect(frame.left).toBeCloseTo((390 - frame.width) / 2, 3)
    expect(frame.top).toBeCloseTo(300 + (380 - frame.height) / 2, 3)
  })
})

describe('Name step', () => {
  let renderer: ReactTestRenderer | undefined

  afterEach(() => act(() => renderer?.unmount()))

  const render = (value: string, onNext = jest.fn()) => {
    act(() => {
      renderer = create(
        <SceneName value={value} onChange={jest.fn()} onNext={onNext} />,
      )
    })
    return onNext
  }

  it('keeps the CTA disabled until a name is typed', () => {
    render('   ')
    expect(
      renderer!.root.findByProps({ label: 'Continuer' }).props.disabled,
    ).toBe(true)
  })

  it('enables the CTA once a name is typed', () => {
    render('Léa')
    expect(
      renderer!.root.findByProps({ label: 'Continuer' }).props.disabled,
    ).toBe(false)
  })

  it('offers no way to skip the name', () => {
    render('')
    expect(renderer!.root.findAllByProps({ label: 'Passer' })).toHaveLength(0)
  })

  it('ignores the keyboard submit while the field is empty', () => {
    const onNext = render('')
    act(() =>
      renderer!.root
        .findByProps({ placeholder: 'Ton prénom' })
        .props.onSubmitEditing(),
    )
    expect(onNext).not.toHaveBeenCalled()
  })
})
