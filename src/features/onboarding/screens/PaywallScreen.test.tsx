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
jest.mock('@/session/useSocialSignIn', () => ({
  useSocialSignIn: () => ({
    signInWithApple: jest.fn(),
    signInWithGoogle: jest.fn(),
    pending: false,
  }),
}))
jest.mock('@/shared/native/useTrackingPrompt', () => ({
  useTrackingPrompt: jest.fn(),
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
    jest.mocked(syncEntitlement).mockResolvedValue(undefined)
    jest.mocked(loadPaywallCatalog).mockResolvedValue(catalog)
  })
  afterEach(() => act(() => renderer?.unmount()))

  it('argumente à la première vue, va droit au prix ensuite', async () => {
    await mount()
    expect(flow().initialScreen).toBe('benefits')
    act(() => renderer.unmount())

    // Deuxième présentation : le plan et le rituel ne se rejouent pas, et le
    // pitch non plus — il l'a déjà vu.
    await mount()
    expect(flow().initialScreen).toBe('plans')
  })

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
