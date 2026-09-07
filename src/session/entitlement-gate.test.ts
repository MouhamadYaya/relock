import { router } from 'expo-router'
import { constants } from '@/config/constants'
import { checkRelockProEntitlement } from '@/features/onboarding/services/revenuecat'
import { applyEntitlement, syncEntitlement } from '@/session/bootstrap'
import { kvStorage } from '@/shared/services/storage/mmkv'
import {
  readGateState,
  resolveAppRoot,
  useAppGateStore,
} from '@/shared/stores/app-gate.store'

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }))
jest.mock('@/features/onboarding/services/revenuecat', () => ({
  checkRelockProEntitlement: jest.fn(),
  onEntitlementChange: jest.fn(() => () => {}),
}))

/**
 * La porte dure vue depuis sa charnière.
 *
 * Un abonnement est une vérité SERVEUR : la seule question qui compte ici est
 * « que fait-on quand on n'arrive pas à la lire ? ». La réponse doit être
 * « rien » — sans quoi un client payant se retrouve devant un mur de prix
 * chaque fois que le réseau tousse.
 */
describe('porte d’abonnement', () => {
  const replace = jest.mocked(router.replace)

  beforeEach(() => {
    jest.clearAllMocks()
    kvStorage.delete(constants.ENTITLEMENT_ACTIVE)
    kvStorage.delete(constants.ONBOARDING_DONE)
    useAppGateStore.setState({
      surveyDone: true,
      entitled: true,
      setupDone: true,
    })
  })

  it('ne referme JAMAIS la porte sur un « on ne sait pas »', async () => {
    jest.mocked(checkRelockProEntitlement).mockResolvedValue('unknown')
    await syncEntitlement()
    expect(useAppGateStore.getState().entitled).toBe(true)
    expect(replace).not.toHaveBeenCalled()
  })

  it('la referme sur un « inactif » avéré, et renvoie au paywall', async () => {
    jest.mocked(checkRelockProEntitlement).mockResolvedValue('inactive')
    await syncEntitlement()
    expect(useAppGateStore.getState().entitled).toBe(false)
    expect(replace).toHaveBeenCalledWith('/paywall')
  })

  it('ne navigue pas quand l’état confirmé est déjà celui affiché', async () => {
    jest.mocked(checkRelockProEntitlement).mockResolvedValue('active')
    await syncEntitlement()
    expect(replace).not.toHaveBeenCalled()
  })

  it('renvoie au parcours, pas à l’app, quand l’activation n’est pas faite', () => {
    useAppGateStore.setState({ entitled: false, setupDone: false })
    applyEntitlement(true)
    expect(replace).toHaveBeenCalledWith('/onboarding')
  })

  it('grave le dernier état connu pour le prochain démarrage', () => {
    useAppGateStore.setState({ entitled: true })
    applyEntitlement(false)
    expect(kvStorage.getString(constants.ENTITLEMENT_ACTIVE)).toBe('0')
  })
})

describe('état des portes au démarrage', () => {
  beforeEach(() => {
    kvStorage.delete(constants.ENTITLEMENT_ACTIVE)
    kvStorage.delete(constants.ONBOARDING_DONE)
    kvStorage.delete(constants.ONBOARDING_SURVEY_DONE)
  })

  it('part fermée pour une installation neuve', () => {
    expect(readGateState()).toEqual({
      surveyDone: false,
      entitled: false,
      setupDone: false,
    })
  })

  it('part OUVERTE pour une installation antérieure à la porte dure', () => {
    // Parcours déjà terminé, aucun état d'abonnement jamais écrit : la mise à
    // jour ne doit éjecter personne vers le paywall le temps d'un aller-retour
    // réseau. Si RevenueCat répond « pas d'abonnement », `syncEntitlement`
    // refermera proprement.
    kvStorage.setString(constants.ONBOARDING_DONE, '1')
    expect(readGateState().entitled).toBe(true)
  })

  it('respecte le dernier état connu plutôt que de le deviner', () => {
    kvStorage.setString(constants.ONBOARDING_DONE, '1')
    kvStorage.setString(constants.ENTITLEMENT_ACTIVE, '0')
    expect(readGateState().entitled).toBe(false)
  })
})

/**
 * Les huit combinaisons possibles des trois portes, énumérées une fois pour
 * toutes. Ce n'est pas du zèle : un état sans racine — ou avec deux — ne se
 * manifeste pas par une erreur, mais par un écran noir qu'on met des jours à
 * relier à sa cause.
 */
describe('racine de navigation', () => {
  const root = (surveyDone: boolean, entitled: boolean, setupDone: boolean) =>
    resolveAppRoot({ surveyDone, entitled, setupDone })

  it('envoie au récit tant que le questionnaire n’est pas fait', () => {
    expect(root(false, false, false)).toBe('onboarding')
  })

  it('envoie au paywall dès que le questionnaire est fait sans abonnement', () => {
    expect(root(true, false, false)).toBe('paywall')
  })

  it('ramène au parcours d’activation une fois l’abonnement pris', () => {
    expect(root(true, true, false)).toBe('onboarding')
  })

  it('ouvre l’app quand tout est fait', () => {
    expect(root(true, true, true)).toBe('app')
  })

  it('REFERME l’app quand l’abonnement expire, parcours terminé ou non', () => {
    expect(root(true, false, true)).toBe('paywall')
    expect(root(false, false, true)).toBe('paywall')
  })

  it('ne laisse aucun état sans racine', () => {
    for (const s of [false, true])
      for (const e of [false, true])
        for (const d of [false, true])
          expect(['onboarding', 'paywall', 'app']).toContain(root(s, e, d))
  })
})
