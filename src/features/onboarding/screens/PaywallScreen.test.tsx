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
})
