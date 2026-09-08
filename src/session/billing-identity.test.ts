import { router } from 'expo-router'
import { constants } from '@/config/constants'
import { linkRevenueCatUser } from '@/features/onboarding/services/revenuecat'
import { attachBillingIdentity } from '@/session/billing-identity'
import { applyEntitlement, watchEntitlement } from '@/session/bootstrap'
import { kvStorage } from '@/shared/services/storage/mmkv'
import { supabase } from '@/shared/services/supabase/client'
import { useAppGateStore } from '@/shared/stores/app-gate.store'

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }))
jest.mock('@/shared/services/supabase/client', () => ({
  supabase: { auth: { getUser: jest.fn() } },
}))
jest.mock('@/features/onboarding/services/revenuecat', () => ({
  linkRevenueCatUser: jest.fn(),
  unlinkRevenueCatUser: jest.fn(),
  checkRelockProEntitlement: jest.fn(),
  // Le vrai écoute RevenueCat ; ici on garde la main sur l'auditeur pour
  // rejouer la poussée de `CustomerInfo` que déclenche `Purchases.logIn`.
  onEntitlementChange: jest.fn((listener: (active: boolean) => void) => {
    pushCustomerInfo = listener
    return () => {
      pushCustomerInfo = undefined
    }
  }),
}))

let pushCustomerInfo: ((active: boolean) => void) | undefined

/**
 * La connexion qui suit un achat — le parcours normal de Relock, le paywall
 * précédant la création du compte.
 *
 * Ce que ces tests protègent est arrivé pour de vrai (2026-09-07) : payer,
 * avancer vers la connexion, et se faire renvoyer au paywall. La cause tient
 * en une phrase : `Purchases.logIn` quitte l'identifiant anonyme qui portait
 * l'achat, et le `CustomerInfo` de cet instant-là ne connaît pas encore
 * l'abonnement. Un « pas d'abonnement » pendant cette bascule n'est PAS une
 * réponse — c'est le milieu d'une question.
 */
describe('rattachement des achats au compte', () => {
  const replace = jest.mocked(router.replace)
  const getUser = jest.mocked(supabase.auth.getUser)
  const link = jest.mocked(linkRevenueCatUser)
  let stopWatch: (() => void) | undefined

  beforeEach(() => {
    jest.clearAllMocks()
    getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>)
    // Ce que dit un appareil qui vient de payer : abonné, parcours pas encore
    // terminé (il reste le tutoriel et la première règle).
    kvStorage.setString(constants.ENTITLEMENT_ACTIVE, '1')
    useAppGateStore.setState({
      surveyDone: true,
      entitled: true,
      setupDone: false,
    })
    stopWatch = watchEntitlement()
  })

  afterEach(() => {
    stopWatch?.()
    kvStorage.delete(constants.ENTITLEMENT_ACTIVE)
  })

  it('ne renvoie PAS au paywall quand la bascule d’identité dit « pas d’abonnement »', async () => {
    link.mockImplementation(async () => {
      // Ce que fait le SDK au milieu d'un `logIn` : il pousse le
      // `CustomerInfo` du nouvel identifiant, encore vierge de tout achat.
      pushCustomerInfo?.(false)
      return 'active'
    })

    await attachBillingIdentity()

    expect(useAppGateStore.getState().entitled).toBe(true)
    expect(replace).not.toHaveBeenCalledWith('/paywall')
    // Et rien n'est gravé : au prochain démarrage il est toujours abonné.
    expect(kvStorage.getString(constants.ENTITLEMENT_ACTIVE)).toBe('1')
  })

  it('ne referme pas la porte sur un « inactif » rendu par le rattachement', async () => {
    // Le reçu peut n'être reporté qu'après notre relecture : cette étape ne
    // sait pas dire « il ne paie pas », seulement « il paie ». Le prochain
    // démarrage à froid, lui, aura une identité posée et tranchera.
    link.mockResolvedValue('inactive')

    await attachBillingIdentity()

    expect(useAppGateStore.getState().entitled).toBe(true)
    expect(replace).not.toHaveBeenCalledWith('/paywall')
  })

  it('OUVRE la porte pour qui se connecte à un compte déjà abonné', async () => {
    useAppGateStore.setState({ entitled: false, setupDone: false })
    kvStorage.setString(constants.ENTITLEMENT_ACTIVE, '0')
    link.mockResolvedValue('active')

    await attachBillingIdentity()

    expect(useAppGateStore.getState().entitled).toBe(true)
    expect(replace).toHaveBeenCalledWith('/onboarding')
  })

  it('rend la porte refermable dès la bascule terminée', async () => {
    link.mockResolvedValue('active')
    await attachBillingIdentity()
    // Une expiration ou un remboursement APRÈS la bascule est une vraie
    // réponse : la fenêtre ne doit pas rester ouverte.
    applyEntitlement(false)
    expect(useAppGateStore.getState().entitled).toBe(false)
    expect(replace).toHaveBeenLastCalledWith('/paywall')
  })

  it('n’exige aucun compte : sans session, rien ne bouge', async () => {
    getUser.mockResolvedValue({ data: { user: null } } as unknown as Awaited<
      ReturnType<typeof supabase.auth.getUser>
    >)

    await attachBillingIdentity()

    expect(link).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })
})
