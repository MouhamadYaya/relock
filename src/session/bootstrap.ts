import { router } from 'expo-router'
import { constants } from '@/config/constants'
import {
  noteEntitled,
  noteEntitlementLost,
} from '@/features/notifications/engine/signals'
import { clearOnboardingCheckpoint } from '@/features/onboarding/services/onboarding-checkpoint'
import { resetPaywallViews } from '@/features/onboarding/services/paywall-views'
import {
  checkRelockProEntitlement,
  onEntitlementChange,
} from '@/features/onboarding/services/revenuecat'
import { isPaywallSkipped, setPaywallSkipped } from '@/session/dev-skip-paywall'
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
 * Combien de bascules d'identité de facturation sont en cours.
 *
 * `Purchases.logIn` / `logOut` changent l'identifiant sous lequel RevenueCat
 * répond. Le temps que le reçu de l'appareil soit reporté sur le nouvel
 * identifiant, le SDK dit « pas d'abonnement » — et il le dit en poussant un
 * `CustomerInfo` à tous ses abonnés, dont `watchEntitlement`.
 */
let billingIdentitySwitches = 0

/**
 * Ouvre la fenêtre pendant laquelle un « pas d'abonnement » ne veut RIEN
 * dire. À appeler autour de tout `logIn`/`logOut` RevenueCat — c'est le rôle
 * de `src/session/billing-identity.ts`, seul endroit qui les déclenche.
 */
export function beginBillingIdentitySwitch(): void {
  billingIdentitySwitches += 1
}

/** Referme la fenêtre. Toujours dans un `finally`. */
export function endBillingIdentitySwitch(): void {
  billingIdentitySwitches = Math.max(0, billingIdentitySwitches - 1)
}

/**
 * Applique un état d'abonnement CONNU.
 *
 * `unknown` n'arrive jamais ici : l'appelant garde alors la dernière valeur.
 * On ne navigue que sur un vrai changement — confirmer ce qui est déjà à
 * l'écran ne doit provoquer aucune transition.
 *
 * Une fermeture pendant une bascule d'identité est IGNORÉE, cache comprise.
 * C'est le bug du 2026-09-07 : payer, avancer vers la connexion, et se
 * retrouver au paywall — parce que `Purchases.logIn` passait de
 * l'identifiant anonyme (celui qui portait l'achat) au compte, et que le
 * `CustomerInfo` de cet instant-là ne connaissait encore aucun abonnement.
 * Le geste « Restaurer » de l'utilisateur ne faisait que rattraper ça.
 * La bascule tranche elle-même à sa sortie (`attachBillingIdentity`), et le
 * prochain démarrage à froid a toujours le dernier mot.
 */
export function applyEntitlement(active: boolean) {
  // DEV : « skip paywall » posé depuis le premier écran du parcours. Sans
  // cette garde, la vérité RevenueCat (« pas d'abonnement », inévitable sur
  // simulateur) refermerait la porte quelques secondes après le clic.
  if (!active && isPaywallSkipped()) return
  if (!active && billingIdentitySwitches > 0) return
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

/**
 * DEV uniquement — saute TOUT le parcours depuis son premier écran : la porte
 * de l'abonnement, le récit et l'activation d'un coup. On atterrit sur
 * l'Accueil, dans l'app réelle.
 *
 * Les trois portes sont franchies dans l'ordre où `resolveAppRoot` les lit :
 * en sauter une laisserait la racine sur le paywall ou sur l'onboarding, et le
 * bouton n'aurait fait que déplacer le problème.
 */
export function devSkipOnboarding(): void {
  if (!__DEV__) return
  // 1. La porte de l'abonnement. Le DRAPEAU, pas seulement l'état : le
  //    prochain rafraîchissement RevenueCat (« pas d'abonnement », inévitable
  //    sur simulateur) refermerait sinon la porte quelques secondes plus tard.
  setPaywallSkipped(true)
  kvStorage.setString(constants.ENTITLEMENT_ACTIVE, '1')
  useAppGateStore.getState().setEntitled(true)
  // 2. Le récit est réputé joué : sans ça, la porte du paywall se rouvre au
  //    prochain démarrage (`resolveAppRoot` teste `surveyDone || setupDone`).
  kvStorage.setString(constants.ONBOARDING_SURVEY_DONE, '1')
  useAppGateStore.getState().setSurveyDone()
  // 3. `completeSetup` porte la SEULE navigation de la séquence. Deux
  //    `replace` enchaînés laissent la pile native non compositée — écran noir
  //    jusqu'à la navigation suivante (voir l'entête de ce fichier).
  completeSetup()
}

/**
 * DEV uniquement — bascule le court-circuit du paywall SEUL
 * (`relock://dev/paywall-skip/<on|off>`), pour travailler le mur de prix sans
 * rejouer le parcours. Rend l'état qui vient d'être posé.
 *
 * Le retour en arrière n'appelle PAS `applyEntitlement(false)` : celui-ci
 * remplace la route par `/paywall`, qui n'est pas montée tant que le récit
 * n'est pas terminé (écran noir, cf. l'entête de ce fichier). On écrit donc
 * l'état, et on laisse les gardes de `app/_layout.tsx` rouvrir la bonne racine
 * d'eux-mêmes.
 */
export function toggleDevPaywallSkip(): boolean {
  if (!__DEV__) return false
  const next = !isPaywallSkipped()
  setPaywallSkipped(next)
  if (next) {
    applyEntitlement(true)
  } else {
    kvStorage.setString(constants.ENTITLEMENT_ACTIVE, '0')
    useAppGateStore.getState().setEntitled(false)
  }
  return next
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
