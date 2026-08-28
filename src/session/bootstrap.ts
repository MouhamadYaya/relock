import { constants } from '@/config/constants'
import { kvStorage } from '@/shared/services/storage/mmkv'
import { useAppGateStore } from '@/shared/stores/app-gate.store'

/**
 * Call when the onboarding flow completes. Writes the MMKV flag and flips
 * the reactive gate store so `Stack.Protected` in `app/_layout.tsx`
 * redirects to the main app automatically — no imperative navigation needed.
 */
export function completeOnboarding() {
  kvStorage.setString(constants.ONBOARDING_DONE, '1')
  useAppGateStore.getState().setOnboardingDone()
}
