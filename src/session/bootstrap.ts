import { router } from 'expo-router'
import { constants } from '@/config/constants'
import { kvStorage } from '@/shared/services/storage/mmkv'
import { useAppGateStore } from '@/shared/stores/app-gate.store'

/**
 * Call when the onboarding flow completes. Writes the MMKV flag and flips
 * the reactive gate store, then explicitly replaces to the main app.
 *
 * The explicit `router.replace` isn't cosmetic: flipping the store while
 * `onboarding` is the ACTIVE screen makes its `Stack.Protected` guard turn
 * false out from under it. Expo Router then auto-redirects to the stack's
 * anchor route — which is `app/index.tsx`, itself a `<Redirect>` that
 * re-resolves and bounces once more to `/(tabs)/home`. That extra bounce
 * (mount index → effect → navigate again) leaves the native screen stack
 * uncomposited: the app goes fully black and stays that way until some
 * later, ordinary navigation forces a fresh transition. Replacing to the
 * final destination ourselves, before the guard flip lands, collapses that
 * double-hop into the one clean transition `react-native-screens` handles
 * correctly. Reproduced and verified on iOS 26 / Simulator (2026-08-30).
 */
export function completeOnboarding() {
  kvStorage.setString(constants.ONBOARDING_DONE, '1')
  useAppGateStore.getState().setOnboardingDone()
  router.replace('/(tabs)/home')
}

/**
 * DEV uniquement : rejoue le parcours complet depuis la première scène de
 * l'onboarding, sans réinstaller l'app. Symétrique de `completeOnboarding()`,
 * et pour la même raison son `router.replace` explicite n'est pas cosmétique :
 * laisser `Stack.Protected` rediriger seul depuis l'écran (tabs) encore actif
 * passe par l'ancre `app/index.tsx` (elle-même un `<Redirect>`), et ce rebond
 * en deux temps laisse le stack natif non composité — écran entièrement noir
 * jusqu'à la navigation suivante.
 *
 * Ne touche QUE la porte d'onboarding : la session Supabase, les règles et
 * les statistiques restent en place. L'étape `auth` du parcours se rejoue
 * telle quelle même avec une session ouverte.
 */
export function resetOnboarding() {
  kvStorage.delete(constants.ONBOARDING_DONE)
  useAppGateStore.getState().resetOnboardingDone()
  router.replace('/onboarding')
}
