import { Redirect } from 'expo-router'
import { resolveAppRoot, useAppGateStore } from '@/shared/stores/app-gate.store'
import { useShieldRequestStore } from '@/shared/stores/shield-request.store'

/**
 * Sans fichier possédant le chemin "/", Expo Router ne peut pas le résoudre
 * au tout premier lancement (aucun path persisté, aucun deep link) et retombe
 * sur son écran interne "+not-found" — avant même que `app/_layout.tsx` ne
 * monte, empêchant `BootSplash.hide()` de s'exécuter (l'app reste bloquée sur
 * l'écran de lancement natif).
 *
 * On redirige directement vers la cible valide plutôt que de viser
 * inconditionnellement "/onboarding" : quand `onboardingDone` est déjà vrai,
 * "onboarding" n'a jamais fait partie du groupe `Stack.Protected` actif, et
 * compter sur sa redirection automatique depuis un écran protégé absent
 * laissait l'app bloquée sur un écran vide (aucune route résolue).
 */
export default function Index() {
  const surveyDone = useAppGateStore(s => s.surveyDone)
  const entitled = useAppGateStore(s => s.entitled)
  const setupDone = useAppGateStore(s => s.setupDone)
  // Ouverture depuis le mur système : la destination est l'onglet Blocages,
  // sans ouvrir automatiquement le rituel de déblocage. Sans ce test, ce
  // `<Redirect>` renvoyait vers l'accueil et écrasait cette destination.
  const shieldRequest = useShieldRequestStore(s => s.request)

  // La MÊME décision que les gardes de `app/_layout.tsx`, par construction :
  // viser une racine non montée laisserait un écran vide.
  const root = resolveAppRoot({ surveyDone, entitled, setupDone })
  if (root === 'paywall') {
    return <Redirect href="/paywall" />
  }
  if (root === 'onboarding') {
    return <Redirect href="/onboarding" />
  }
  if (shieldRequest) {
    return <Redirect href="/(tabs)/blocks" />
  }
  return <Redirect href="/(tabs)/home" />
}
