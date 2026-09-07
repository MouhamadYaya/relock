import * as AppleAuthentication from 'expo-apple-authentication'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { SceneAuth } from '@/features/onboarding/scenes-auth'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}))
jest.mock('@/features/onboarding/bits', () => ({
  BackBtn: 'BackBtn',
  GradientLine: 'GradientLine',
}))
jest.mock('@/features/onboarding/motion', () => ({ Reveal: 'Reveal' }))

/**
 * L'écran de compte, tel qu'un utilisateur le rencontre : après avoir payé,
 * ou depuis « J'ai déjà un compte » sur le paywall. Il n'a pas de formulaire,
 * pas de mot de passe — deux boutons, et la seule chose qui puisse mal
 * tourner est qu'il n'en reste aucun d'utilisable.
 */
describe('écran de compte', () => {
  let renderer: ReactTestRenderer
  const available = jest.mocked(AppleAuthentication.isAvailableAsync)
  const onApple = jest.fn()
  const onGoogle = jest.fn()

  const mount = async (
    props: Partial<Parameters<typeof SceneAuth>[0]> = {},
  ) => {
    await act(async () => {
      renderer = create(
        <SceneAuth onApple={onApple} onGoogle={onGoogle} {...props} />,
      )
    })
  }
  const buttons = () =>
    renderer.root
      .findAll(
        node =>
          typeof node.type === 'string' &&
          node.props?.accessibilityRole === 'button' &&
          typeof node.props?.accessibilityLabel === 'string',
      )
      .map(node => node.props.accessibilityLabel as string)

  beforeEach(() => {
    jest.clearAllMocks()
    available.mockResolvedValue(true)
  })
  afterEach(() => act(() => renderer?.unmount()))

  it('propose Apple ET Google sur un appareil qui sait faire les deux', async () => {
    await mount()
    expect(buttons()).toEqual(['Continuer avec Apple', 'Continuer avec Google'])
  })

  it('n’affiche pas Apple là où il n’existe pas', async () => {
    available.mockResolvedValue(false)
    await mount()
    expect(buttons()).toEqual(['Continuer avec Google'])
  })

  /**
   * App Store, 4.8 : là où un login tiers est proposé, Sign in with Apple
   * doit l'être aussi. Un test de disponibilité qui échoue ne peut donc pas
   * se traduire par « on n'affiche que Google » — c'est le seul cas où l'on
   * préfère un bouton qui refusera proprement à un bouton absent.
   */
  it('garde Apple quand le test de disponibilité échoue', async () => {
    available.mockRejectedValue(new Error('module natif muet'))
    await mount()
    expect(buttons()).toContain('Continuer avec Apple')
  })

  it('déclenche la bonne connexion, et se verrouille pendant l’échange', async () => {
    await mount()
    const apple = renderer.root.find(
      node => node.props?.accessibilityLabel === 'Continuer avec Apple',
    )
    act(() => apple.props.onPress())
    expect(onApple).toHaveBeenCalledTimes(1)

    await act(async () => {
      renderer.update(<SceneAuth onApple={onApple} onGoogle={onGoogle} busy />)
    })
    for (const label of ['Continuer avec Apple', 'Continuer avec Google']) {
      expect(
        renderer.root.find(n => n.props?.accessibilityLabel === label).props
          .disabled,
      ).toBe(true)
    }
  })

  it('n’offre un retour que lorsqu’on lui en donne un', async () => {
    await mount()
    expect(
      renderer.root.findAll(n => (n.type as unknown) === 'BackBtn'),
    ).toHaveLength(0)

    const onBack = jest.fn()
    await mount({ onBack })
    const back = renderer.root.find(n => (n.type as unknown) === 'BackBtn')
    act(() => back.props.onPress())
    expect(onBack).toHaveBeenCalledTimes(1)
  })
})
