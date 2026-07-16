import { constants, flags } from '@/config/constants'
import { kvStorage } from '@/shared/services/storage/mmkv'

export type InitialRoute = 'ROOT_ONBOARDING' | 'ROOT_AUTH' | 'ROOT_APP'

export function getInitialRoute(): InitialRoute {
  const onboardingDone = kvStorage.getString(constants.ONBOARDING_DONE) === '1'

  // L'onboarding passe AVANT le bypass dev : sinon, avec DEV_SKIP_AUTH=true il
  // ne s'afficherait jamais et serait intestable en développement.
  if (!onboardingDone) return 'ROOT_ONBOARDING'
  return getPostOnboardingRoute()
}

/**
 * Où aller une fois l'onboarding terminé (ou déjà fait auparavant).
 * Dev : accès direct aux onglets — la session Supabase correspondante est
 * ouverte par `ensureDevSession()` (src/session/dev-auth.ts) au démarrage.
 */
export function getPostOnboardingRoute(): 'ROOT_AUTH' | 'ROOT_APP' {
  if (flags.DEV_SKIP_AUTH) return 'ROOT_APP'
  return kvStorage.getString(constants.AUTH_TOKEN) ? 'ROOT_APP' : 'ROOT_AUTH'
}

export function setOnboardingDone() {
  kvStorage.setString(constants.ONBOARDING_DONE, '1')
}
