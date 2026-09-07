import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { PREVIEW_PLANS } from '@/features/onboarding/components/paywall/paywall-preview'
import PaywallScreen from '@/features/onboarding/screens/PaywallScreen'
import { loadPaywallCatalog } from '@/features/onboarding/services/revenuecat'
import { syncEntitlement } from '@/session/bootstrap'

jest.mock('@/features/onboarding/components/paywall/PaywallFlow', () => ({
  PaywallFlow: 'PaywallFlow',
}))
jest.mock('@/features/onboarding/scenes-auth', () => ({
  SceneAuth: 'SceneAuth',
}))
jest.mock('@/features/onboarding/services/revenuecat', () => ({
  isRevenueCatEnabled: () => true,
  loadPaywallCatalog: jest.fn(),
  paywallPurchaseWithRevenueCat: jest.fn(),
  restoreRevenueCatPurchases: jest.fn(),
}))
jest.mock('@/features/onboarding/services/onboarding-answers.service', () => ({
  saveOnboardingAnswers: jest.fn(),
}))
jest.mock('@/session/bootstrap', () => ({
  syncEntitlement: jest.fn(async () => undefined),
  unlockAfterPurchase: jest.fn(),
}))
const mockSignIn = jest.fn()
jest.mock('@/session/useSocialSignIn', () => ({
  useSocialSignIn: () => ({
    signInWithApple: mockSignIn,
    signInWithGoogle: mockSignIn,
    pending: false,
  }),
}))
jest.mock('@/i18n/useT', () => ({ useT: () => (k: string) => k }))

describe('écran paywall', () => {
  let renderer: ReactTestRenderer
  const catalog = { plans: PREVIEW_PLANS, offer: null }
  const mount = async () => {
    await act(async () => {
      renderer = create(<PaywallScreen />)
    })
  }
  const flow = () =>
    renderer.root.find(node => (node.type as unknown) === 'PaywallFlow').props

  beforeEach(() => {
    jest.clearAllMocks()
    mockSignIn.mockReset().mockResolvedValue({ ok: true })
    jest.mocked(syncEntitlement).mockResolvedValue(undefined)
    jest.mocked(loadPaywallCatalog).mockResolvedValue(catalog)
  })
  afterEach(() => act(() => renderer?.unmount()))

  it('ne laisse jamais sortir', async () => {
    await mount()
    expect(flow().escapable).toBe(false)
    expect(flow().onSignIn).toEqual(expect.any(Function))
  })

  it('revérifie l’abonnement à l’ouverture, avant d’afficher un prix', async () => {
    await mount()
    expect(syncEntitlement).toHaveBeenCalledTimes(1)
  })

  it('demande de réessayer plutôt que d’inventer un tarif', async () => {
    jest.mocked(loadPaywallCatalog).mockResolvedValue(null)
    await mount()
    expect(flow().plans).toEqual([])
    expect(flow().escapable).toBe(false)
  })
})

/**
 * « J'ai déjà un compte » est la seule chose qu'on puisse OUVRIR depuis une
 * porte dont on ne peut pas sortir. Elle doit donc se refermer : une feuille
 * Apple qu'on annule ne peut pas coûter l'accès au tarif — c'est-à-dire, ici,
 * l'accès à l'app entière.
 */
describe('connexion depuis le paywall', () => {
  let renderer: ReactTestRenderer
  const mount = async () => {
    await act(async () => {
      renderer = create(<PaywallScreen />)
    })
  }
  const flow = () =>
    renderer.root.find(node => (node.type as unknown) === 'PaywallFlow').props
  const authScene = () =>
    renderer.root.find(node => (node.type as unknown) === 'SceneAuth')
  const countOf = (name: string) =>
    renderer.root.findAll(node => (node.type as unknown) === name).length

  beforeEach(() => {
    jest.clearAllMocks()
    mockSignIn.mockReset().mockResolvedValue({ ok: true })
    jest.mocked(syncEntitlement).mockResolvedValue(undefined)
    // Le cul-de-sac réel : RevenueCat muet, aucun tarif affichable. C'est le
    // seul écran qui propose la connexion.
    jest.mocked(loadPaywallCatalog).mockResolvedValue(null)
  })
  afterEach(() => act(() => renderer?.unmount()))

  it('ouvre l’écran de compte, et sait le refermer', async () => {
    await mount()
    act(() => flow().onSignIn())
    expect(countOf('SceneAuth')).toBe(1)
    expect(authScene().props.onBack).toEqual(expect.any(Function))

    act(() => authScene().props.onBack())
    // On revient à l'écran d'où l'on venait — pas dans le vide.
    expect(countOf('SceneAuth')).toBe(0)
    expect(countOf('PaywallFlow')).toBe(1)
  })

  it('n’enferme pas quand la feuille de connexion est annulée', async () => {
    mockSignIn.mockResolvedValue({
      ok: false,
      canceled: true,
      error: { code: 'AUTH_CANCELED', message: 'annulé', raw: null },
    })
    await mount()
    act(() => flow().onSignIn())
    await act(async () => authScene().props.onApple())
    // L'écran reste (il peut réessayer), mais la sortie existe toujours.
    expect(countOf('SceneAuth')).toBe(1)
    act(() => authScene().props.onBack())
    expect(countOf('PaywallFlow')).toBe(1)
  })

  it('ramène aux tarifs quand le compte n’a aucun abonnement', async () => {
    await mount()
    act(() => flow().onSignIn())
    await act(async () => authScene().props.onGoogle())
    expect(countOf('SceneAuth')).toBe(0)
    expect(countOf('PaywallFlow')).toBe(1)
  })
})
