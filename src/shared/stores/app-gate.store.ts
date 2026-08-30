import { create } from 'zustand'
import { constants } from '@/config/constants'
import { kvStorage } from '@/shared/services/storage/mmkv'

function readOnboardingDone(): boolean {
  return kvStorage.getString(constants.ONBOARDING_DONE) === '1'
}

type AppGateStore = {
  onboardingDone: boolean
  setOnboardingDone: () => void
  resetOnboardingDone: () => void
}

/**
 * Gates the root Expo Router stack (`app/_layout.tsx`) between onboarding
 * and the main app via `Stack.Protected`. Initialized once from the same
 * MMKV key `src/session/bootstrap.ts` writes to.
 */
export const useAppGateStore = create<AppGateStore>(set => ({
  onboardingDone: readOnboardingDone(),
  setOnboardingDone: () => set({ onboardingDone: true }),
  // Dev only (`src/session/dev-test-bridge.ts`) : symétrique de
  // `setOnboardingDone`, pour rejouer l'onboarding par un flip réactif du
  // store (voir `completeOnboarding()` dans `src/session/bootstrap.ts` pour
  // pourquoi ce flip doit être suivi d'un `router.replace` explicite).
  resetOnboardingDone: () => set({ onboardingDone: false }),
}))
