import { create } from 'zustand'
import { constants } from '@/config/constants'
import { isPaywallSkipped } from '@/session/dev-skip-paywall'
import { kvStorage } from '@/shared/services/storage/mmkv'

function readFlag(key: string): boolean {
  return kvStorage.getString(key) === '1'
}

/**
 * L'abonnement au démarrage, sans attendre le réseau.
 *
 * Deux principes, et ils comptent plus que la valeur elle-même :
 *
 * 1. On part du DERNIER ÉTAT CONNU. Le rafraîchissement RevenueCat corrigera
 *    dans la seconde qui suit ; d'ici là un abonné reste un abonné, même
 *    hors ligne. L'inverse — repartir de « non abonné » — mettrait un mur
 *    de prix devant un client payant à chaque lancement dans le métro.
 * 2. Une installation ANTÉRIEURE à la porte dure (`setupDone` déjà vrai, mais
 *    aucun état d'abonnement jamais écrit) démarre ouverte. Sans ça, la mise
 *    à jour éjecterait tout le monde vers le paywall le temps d'un aller-retour
 *    réseau. Si RevenueCat répond « pas d'abonnement », la porte se referme
 *    proprement au rafraîchissement — la vérité gagne, elle arrive juste sans
 *    faire clignoter l'app.
 */
function readEntitled(setupDone: boolean): boolean {
  // DEV : « skip paywall ». Décidé AVANT le cache, sinon le premier
  // rafraîchissement RevenueCat d'un démarrage à froid rouvrirait le paywall
  // avant même que le bouton puisse être retrouvé.
  if (isPaywallSkipped()) return true
  const cached = kvStorage.getString(constants.ENTITLEMENT_ACTIVE)
  if (cached === null) return setupDone
  return cached === '1'
}

type AppGateStore = {
  /** Le récit + le diagnostic ont été joués. Ne se rejoue jamais. */
  surveyDone: boolean
  /** Abonnement actif. Vérité RevenueCat, mise en cache localement. */
  entitled: boolean
  /** Permission accordée et première règle armée : l'app est opérationnelle. */
  setupDone: boolean
  setSurveyDone: () => void
  setEntitled: (entitled: boolean) => void
  setSetupDone: () => void
  /**
   * Rouvre la porte d'activation SANS toucher au récit ni à l'abonnement.
   * Utilisé à la déconnexion et à la suppression de compte : l'utilisateur
   * repart à l'étape « compte » du parcours, pas au premier écran du récit.
   */
  clearSetupDone: () => void
  /** Dev only (`src/session/dev-test-bridge.ts`) : rejoue tout le parcours. */
  resetOnboardingGates: () => void
}

/**
 * Les trois portes de l'app, dans l'ordre où on les franchit.
 *
 * `app/_layout.tsx` en déduit la racine affichée (`Stack.Protected`) et
 * `app/index.tsx` la destination du premier rendu. Aucune ne mémorise « où
 * l'utilisateur en était » : la position se déduit de l'état, ce qui reste
 * juste après une réinstallation, un changement d'appareil ou une refonte
 * du parcours. Les écritures MMKV correspondantes vivent dans
 * `src/session/bootstrap.ts` — ce store ne fait que porter l'état réactif.
 */
/**
 * L'état des trois portes tel qu'il est écrit sur cet appareil. Exporté pour
 * lui-même : c'est LA décision de démarrage, elle mérite d'être vérifiable
 * sans monter toute l'app.
 */
export function readGateState(): {
  surveyDone: boolean
  entitled: boolean
  setupDone: boolean
} {
  const setupDone = readFlag(constants.ONBOARDING_DONE)
  return {
    surveyDone: readFlag(constants.ONBOARDING_SURVEY_DONE),
    entitled: readEntitled(setupDone),
    setupDone,
  }
}

export const useAppGateStore = create<AppGateStore>(set => {
  return {
    ...readGateState(),
    setSurveyDone: () => set({ surveyDone: true }),
    setEntitled: entitled => set({ entitled }),
    setSetupDone: () => set({ setupDone: true }),
    clearSetupDone: () => set({ setupDone: false }),
    resetOnboardingGates: () => set({ surveyDone: false, setupDone: false }),
  }
})

/** L'app elle-même est accessible : parcours terminé ET abonnement actif. */
export function selectAppUnlocked(state: AppGateStore): boolean {
  return state.setupDone && state.entitled
}

/** La racine de navigation à monter : il n'y en a jamais ni zéro, ni deux. */
export type AppRoot = 'onboarding' | 'paywall' | 'app'

/**
 * De l'état des trois portes vers la racine affichée.
 *
 * `app/_layout.tsx` (quelle racine monter) et `app/index.tsx` (vers quoi
 * rediriger au premier rendu) DOIVENT toujours dire la même chose : viser une
 * racine non montée laisse un écran vide, sans le moindre message pour le
 * dire. Une seule fonction, donc, plutôt que deux expressions booléennes
 * parallèles qu'un jour on modifierait d'un seul côté.
 *
 * L'ordre des tests EST la règle produit : l'abonnement passe avant tout —
 * il referme la porte à n'importe quel stade, y compris chez quelqu'un qui
 * avait déjà tout terminé et dont l'abonnement vient d'expirer.
 */
export function resolveAppRoot({
  surveyDone,
  entitled,
  setupDone,
}: {
  surveyDone: boolean
  entitled: boolean
  setupDone: boolean
}): AppRoot {
  if (!entitled && (surveyDone || setupDone)) return 'paywall'
  if (!setupDone) return 'onboarding'
  return 'app'
}
