import { constants, flags } from '@/config/constants'
import { kvStorage } from '@/shared/services/storage/mmkv'

export type InitialRoute = 'ROOT_ONBOARDING' | 'ROOT_AUTH' | 'ROOT_APP'

export function getInitialRoute(): InitialRoute {
  // Dev : accès direct aux onglets. La session Supabase correspondante est
  // ouverte par `ensureDevSession()` (src/session/dev-auth.ts) au démarrage.
  if (flags.DEV_SKIP_AUTH) return 'ROOT_APP'

  const onboardingDone = kvStorage.getString(constants.ONBOARDING_DONE) === '1'
  const token = kvStorage.getString(constants.AUTH_TOKEN)

  if (!onboardingDone) return 'ROOT_ONBOARDING'
  if (!token) return 'ROOT_AUTH'
  return 'ROOT_APP'
}

export function setOnboardingDone() {
  kvStorage.setString(constants.ONBOARDING_DONE, '1')
}
