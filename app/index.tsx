import { Redirect } from 'expo-router'
import { useAppGateStore } from '@/shared/stores/app-gate.store'

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
  const onboardingDone = useAppGateStore(s => s.onboardingDone)
  return <Redirect href={onboardingDone ? '/(tabs)/home' : '/onboarding'} />
}
