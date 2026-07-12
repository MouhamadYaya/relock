import { constants } from '@/config/constants'
import { kvStorage } from '@/shared/services/storage/mmkv'

export type InitialRoute = 'ROOT_ONBOARDING' | 'ROOT_AUTH' | 'ROOT_APP'

// ⚠️ TEMPORAIRE (preview) — onboarding + connexion désactivés : l'app démarre
// directement sur les onglets. À RÉACTIVER plus tard (voir choseafaire.md).
// Pour réactiver : repasser ce flag à false.
const BYPASS_AUTH: boolean = false

export function getInitialRoute(): InitialRoute {
  if (BYPASS_AUTH) return 'ROOT_APP'

  const onboardingDone = kvStorage.getString(constants.ONBOARDING_DONE) === '1'
  const token = kvStorage.getString(constants.AUTH_TOKEN)

  if (!onboardingDone) return 'ROOT_ONBOARDING'
  if (!token) return 'ROOT_AUTH'
  return 'ROOT_APP'
}

export function setOnboardingDone() {
  kvStorage.setString(constants.ONBOARDING_DONE, '1')
}
