import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { PREVIEW_PLANS } from '@/features/onboarding/components/paywall/paywall-preview'
import PaywallScreen from '@/features/onboarding/screens/PaywallScreen'
import {
  loadPaywallCatalog,
  restoreRevenueCatPurchases,
} from '@/features/onboarding/services/revenuecat'
import { syncEntitlement, unlockAfterPurchase } from '@/session/bootstrap'

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

  /**
   * La porte ne s'ouvre que sur `restored`.
   *
   * Le piège vaut d'être gardé : le service a rendu un booléen avant de rendre
   * `restored | none | failed`, et le test de véracité laissé derrière
   * (`if (restored)`) trouvait vraies les TROIS chaînes. Une restauration vide
   * — ou une panne de réseau — déverrouillait alors l'abonnement.
   */
  const restoreVia = async (result: 'restored' | 'none' | 'failed') => {
    jest.mocked(restoreRevenueCatPurchases).mockResolvedValue(result)
    await mount()
    let returned: unknown
    await act(async () => {
      returned = await flow().onRestore()
    })
    return returned
  }

  it('déverrouille sur une restauration aboutie', async () => {
    expect(await restoreVia('restored')).toBe('restored')
    expect(unlockAfterPurchase).toHaveBeenCalledTimes(1)
  })

  it('ne déverrouille pas quand ce compte n’a aucun abonnement', async () => {
    expect(await restoreVia('none')).toBe('none')
    expect(unlockAfterPurchase).not.toHaveBeenCalled()
  })

  it('ne déverrouille pas quand le store n’a pas pu répondre', async () => {
    expect(await restoreVia('failed')).toBe('failed')
    expect(unlockAfterPurchase).not.toHaveBeenCalled()
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
