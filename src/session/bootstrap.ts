import { router } from 'expo-router'
import {
  noteEntitled,
  noteEntitlementLost,
} from '@/features/notifications/engine/signals'
import { constants } from '@/config/constants'
import { clearOnboardingCheckpoint } from '@/features/onboarding/services/onboarding-checkpoint'
import { resetPaywallViews } from '@/features/onboarding/services/paywall-views'
import {
  checkRelockProEntitlement,
  onEntitlementChange,
} from '@/features/onboarding/services/revenuecat'
import { kvStorage } from '@/shared/services/storage/mmkv'
import { useAppGateStore } from '@/shared/stores/app-gate.store'

/**
 * Les trois portes de Relock, et rien d'autre.
 *
 * Chaque helper écrit d'abord la trace durable (MMKV), bascule ensuite le
 * store réactif, et remplace enfin la route lui-même.
 *
 * Ce `router.replace` explicite n'est pas cosmétique : basculer la porte
 * pendant que l'écran gardé est ACTIF fait tomber son `Stack.Protected` sous
 * ses pieds. Expo Router redirige alors vers l'ancre de la pile —
 * `app/index.tsx`, elle-même un `<Redirect>` qui se ré-résout et rebondit une
 * seconde fois. Ce double saut (montage de index → effet → nouvelle
 * navigation) laisse la pile native non compositée : l'app devient
 * entièrement noire et le reste jusqu'à une navigation ordinaire ultérieure.
 * Remplacer nous-mêmes vers la destination finale, avant que la bascule
 * n'atterrisse, ramène le tout à l'unique transition que `react-native-screens`
 * gère correctement. Reproduit et vérifié sur iOS 26 / Simulateur (2026-08-30).
 */

/** Où va un utilisateur à jour de son abonnement. */
function destinationForEntitled(): '/(tabs)/home' | '/onboarding' {
  return useAppGateStore.getState().setupDone ? '/(tabs)/home' : '/onboarding'
}

function replace(path: '/(tabs)/home' | '/onboarding' | '/paywall') {
  try {
    router.replace(path)
  } catch {
    // Navigation pas encore montée (bascule au tout premier rendu) : les
    // gardes de `app/_layout.tsx` résolvent alors la bonne racine d'eux-mêmes.
  }
}

/**
 * Fin du récit et du diagnostic. Ces 13 écrans ne se rejouent JAMAIS —
 * ni après une fermeture, ni des semaines plus tard. La suite se joue
 * entièrement au paywall.
 *
 * Rend `true` si la navigation vers le paywall a été prise en charge ici,
 * `false` s'il n'y a rien à vendre à cet utilisateur — au parcours de
 * continuer, alors.
 */
export function completeSurvey(): boolean {
  kvStorage.setString(constants.ONBOARDING_SURVEY_DONE, '1')
  useAppGateStore.getState().setSurveyDone()
  // Déjà abonné (achat restauré, ou build sans facturation) : il n'y a rien à
  // lui vendre. On rend la main au parcours, qui enchaîne sur la création du
  // compte, plutôt que de le pousser vers un paywall qui se refermerait aussitôt.
  if (useAppGateStore.getState().entitled) return false
  replace('/paywall')
  return true
}

/**
 * Fin du parcours : la permission est accordée et la première règle est
 * armée. C'est seulement ici que l'app devient accessible — pas au dernier
 * écran atteint (cf. `activateAndContinue` dans `OnboardingFlow`).
 */
export function completeSetup() {
  kvStorage.setString(constants.ONBOARDING_DONE, '1')
  clearOnboardingCheckpoint()
  useAppGateStore.getState().setSetupDone()
  replace('/(tabs)/home')
}

/**
 * Retour à la porte « compte », après une déconnexion ou une suppression.
 *
 * On rouvre la porte d'activation (`setupDone`) et rien d'autre. Le récit
 * (`surveyDone`) et l'abonnement restent acquis : ils appartiennent à
 * l'APPAREIL et au compte App Store, pas à la session Supabase qu'on vient
 * de fermer. `OnboardingFlow.resumeIndex` reprend alors exactement à l'étape
 * `auth` — l'écran de connexion, sans rejouer les treize écrans du récit.
 *
 * Conséquence assumée : après s'être reconnecté, l'utilisateur repasse par le
 * tutoriel et l'armement d'une première règle. C'est le prix d'une porte qui
 * se déduit de l'état plutôt que d'une position mémorisée — et c'est
 * exactement le parcours d'une nouvelle installation, donc un chemin déjà
 * éprouvé plutôt qu'un cas particulier de plus.
 */
export function signOutToAuth() {
  kvStorage.delete(constants.ONBOARDING_DONE)
  clearOnboardingCheckpoint()
  useAppGateStore.getState().clearSetupDone()
  replace('/onboarding')
}

/**
 * Applique un état d'abonnement CONNU.
 *
 * `unknown` n'arrive jamais ici : l'appelant garde alors la dernière valeur.
 * On ne navigue que sur un vrai changement — confirmer ce qui est déjà à
 * l'écran ne doit provoquer aucune transition.
 */
export function applyEntitlement(active: boolean) {
  kvStorage.setString(constants.ENTITLEMENT_ACTIVE, active ? '1' : '0')
  // Le moteur de notifications a besoin de la DATE de la perte, pas seulement
  // de l'état : « ton abonnement a expiré » n'a de sens que quelques jours.
  if (active) noteEntitled(null)
  else noteEntitlementLost(Date.now())
  const store = useAppGateStore.getState()
  if (store.entitled === active) return
  store.setEntitled(active)
  replace(active ? destinationForEntitled() : '/paywall')
}

/** Après un achat ou une restauration réussis. */
export function unlockAfterPurchase() {
  applyEntitlement(true)
}

/**
 * Rafraîchit l'abonnement depuis RevenueCat. Un `unknown` (réseau coupé,
 * SDK muet, délai dépassé) ne change RIEN : un abonné hors ligne reste un
 * abonné. Voir `checkRelockProEntitlement`.
 */
export async function syncEntitlement(): Promise<void> {
  const result = await checkRelockProEntitlement()
  if (result === 'unknown') return
  applyEntitlement(result === 'active')
}

/**
 * Suit les changements d'abonnement pendant que l'app tourne : expiration,
 * remboursement, renouvellement, achat depuis les Réglages iOS. Sans lui, la
 * porte ne serait réévaluée qu'au démarrage à froid.
 */
export function watchEntitlement(): () => void {
  return onEntitlementChange(applyEntitlement)
}

/**
 * DEV uniquement : rejoue le parcours complet, sans réinstaller l'app.
 *
 * Ne touche QUE les portes du parcours : la session Supabase, les règles, les
 * statistiques — et l'ABONNEMENT, qui est un achat réel — restent en place.
 * Pour tester la porte dure, `dev-test-bridge` expose `entitlement-lock`.
 */
export function resetOnboarding() {
  kvStorage.delete(constants.ONBOARDING_DONE)
  kvStorage.delete(constants.ONBOARDING_SURVEY_DONE)
  clearOnboardingCheckpoint()
  resetPaywallViews()
  useAppGateStore.getState().resetOnboardingGates()
  replace('/onboarding')
}
