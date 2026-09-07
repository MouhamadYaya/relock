import React from 'react'
import { type SharedValue, useSharedValue } from 'react-native-reanimated'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import {
  SceneHardMode,
  ScenePickApps,
} from '@/features/onboarding/scenes-tutorial'
import { ScreenTime } from '@/shared/native/screen-time'
import { showErrorToast } from '@/shared/utils/toast'

jest.mock('@/features/onboarding/bits', () => ({
  Pill: 'Pill',
  GhostLink: 'GhostLink',
  RedAlert: 'RedAlert',
  ChoiceCard: 'ChoiceCard',
  Footnote: 'Footnote',
}))
jest.mock('@/features/onboarding/motion', () => ({ Reveal: 'Reveal' }))
jest.mock('@/features/onboarding/PickerAnimation', () => ({
  PickerAnimation: 'PickerAnimation',
  PICKER_DEMO_TAUGHT_MS: 2950,
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
  const cards = () =>
    renderer.root.findAll(node => node.props?.accessibilityRole === 'button')
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
  /** Le montage EST l'ouverture du sélecteur : plus de carte « + » à toucher. */
  const mount = async () => {
    await act(async () => {
      renderer = create(<Harness />)
    })
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
    jest.replaceProperty(ScreenTime, 'isAvailable', true)
  })
  afterEach(() => {
    act(() => renderer.unmount())
    jest.useRealTimers()
  })

  it('ouvre le sélecteur Apple de lui-même, sans carte à toucher d’abord', async () => {
    await mount()
    expect(ScreenTime.presentPicker).toHaveBeenCalledTimes(1)
    expect(onCount).toHaveBeenCalledWith(3)
    // Il choisit ses apps, il ne quitte pas l'écran pour autant.
    expect(onNext).not.toHaveBeenCalled()
    act(() => button('Continuer').props.onPress())
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('garde la sélection à travers l’aide facultative, sans rouvrir le sélecteur', async () => {
    await mount()
    act(() => button('Voir comment faire').props.onPress())
    act(() => jest.advanceTimersByTime(3000))
    act(() => button('J’ai compris').props.onPress())
    expect(ScreenTime.presentPicker).toHaveBeenCalledTimes(1)
    act(() => button('Continuer').props.onPress())
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  it('reste sur l’écran quand la feuille se ferme sans rien, et laisse relancer', async () => {
    jest.mocked(ScreenTime.presentPicker).mockResolvedValueOnce({ count: 0 })
    await mount()
    expect(onCount).toHaveBeenCalledWith(0)
    expect(onNext).not.toHaveBeenCalled()
    // Aucune relance automatique : ce serait un sélecteur dont on ne sort pas.
    expect(ScreenTime.presentPicker).toHaveBeenCalledTimes(1)
    expect(button('Voir comment faire')).toBeDefined()
    expect(button('Ouvrir le sélecteur').props.disabled).toBe(false)
    await act(async () => button('Ouvrir le sélecteur').props.onPress())
    expect(button('Continuer')).toBeDefined()
  })

  it('allows retry after a native error', async () => {
    const error = new Error('Sélecteur indisponible')
    jest.mocked(ScreenTime.presentPicker).mockRejectedValueOnce(error)
    await mount()
    expect(showErrorToast).toHaveBeenCalledWith(error)
    expect(onCount).not.toHaveBeenCalled()
    expect(onNext).not.toHaveBeenCalled()
    await act(async () => button('Ouvrir le sélecteur').props.onPress())
    expect(button('Continuer')).toBeDefined()
  })

  it('prevents two native pickers from opening on a double tap', async () => {
    await mount()
    const modify = cards()[0].props.onPress
    await act(async () => {
      await Promise.all([modify(), modify()])
    })
    // Une seule feuille de plus que l'ouverture automatique.
    expect(ScreenTime.presentPicker).toHaveBeenCalledTimes(2)
  })

  it('n’ouvre rien et laisse passer là où Family Controls n’existe pas', async () => {
    jest.replaceProperty(ScreenTime, 'isAvailable', false)
    await mount()
    expect(ScreenTime.presentPicker).not.toHaveBeenCalled()
    await act(async () => button('Ouvrir le sélecteur').props.onPress())
    expect(onNext).toHaveBeenCalledTimes(1)
  })
})

describe('hard mode showcase screen', () => {
  let renderer: ReactTestRenderer
  const onNext = jest.fn()

  /** Toute la copie rendue, aplatie — pour interroger ce que l'écran promet. */
  const copy = () =>
    renderer.root
      .findAll(node => typeof node.type === 'string')
      .flatMap(node => node.props.children)
      .concat(
        renderer.root
          .findAllByType('Footnote' as never)
          .map(node => node.props.text as string),
      )
      .filter((chunk): chunk is string => typeof chunk === 'string')
      .join(' ')

  beforeEach(() => {
    jest.clearAllMocks()
    act(() => {
      renderer = create(<SceneHardMode onNext={onNext} />)
    })
  })

  // Le garde-fou central : l'écran ANNONCE le Hard Mode, il ne l'active pas.
  // Un contrôle manipulable ici ferait croire qu'on l'allume pour toute l'app,
  // alors qu'il se décide blocage par blocage, plus tard.
  it('exposes nothing the user can toggle', () => {
    expect(renderer.root.findAllByType('Switch' as never)).toHaveLength(0)
    expect(renderer.root.findAllByType('ChoiceCard' as never)).toHaveLength(0)
    // Le CTA est le SEUL élément de l'écran qui répond au doigt.
    const pressable = renderer.root.findAll(
      node => typeof node.props?.onPress === 'function',
    )
    expect(pressable).toHaveLength(1)
    expect(pressable[0].props.label).toBe('Continuer')
  })

  it('takes no value and reports none — only that the screen was passed', () => {
    expect(onNext).not.toHaveBeenCalled()
    act(() => renderer.root.findByProps({ label: 'Continuer' }).props.onPress())
    expect(onNext).toHaveBeenCalledTimes(1)
  })

  // Le « où et quand ? » : sans ces mots, l'écran laisse croire que le réglage
  // vit ici et qu'on vient de l'allumer.
  it('says the setting lives in the app, to be turned on per block', () => {
    const text = copy()
    expect(text).toContain('DANS L’APP')
    expect(text).toContain('Rien à régler maintenant')
    expect(text).toContain('blocage par blocage')
  })

  // La maquette est une image : un lecteur d'écran ne doit pas annoncer un
  // interrupteur que personne ne peut actionner.
  it('hides the mockup from assistive technology', () => {
    const mock = renderer.root.findByProps({
      accessibilityElementsHidden: true,
    })
    expect(mock.props.importantForAccessibility).toBe('no-hide-descendants')
    expect(mock.props.pointerEvents).toBe('none')
  })
})
