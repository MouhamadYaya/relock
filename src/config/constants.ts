import Config from 'react-native-config'
import { parseEnvBool } from '@/config/env'

// --- APPEND (do not remove anything) ---
export const constants = {
  // ...your existing entries
  MAX_UPLOAD_SIZE: 20 * 1024 * 1024,
  DEFAULT_PAGE_SIZE: 20,
  AUTH_TOKEN: 'auth.token',
  RQ_CACHE: 'rq.cache.v1',
  REFRESH_TOKEN: 'auth.refreshToken', // ← add this line
  // v3 : refonte complète de l'onboarding (rituel, permissions bloquantes…)
  // → la clé change pour qu'il s'affiche une fois, même sur un appareil où
  // l'ancien avait déjà été validé.
  ONBOARDING_DONE: 'onboarding.done.v3',
  APP_PREFERENCES_STORE: 'app.preferences',
  IS_FIRST_TIME_OPEN_KEY: 'user.isFirstTimeOpen',
  HIDE_USE_CAMERA_KEY: 'user.hideUseCamera',
  DONT_SHOW_AGAIN_KEY: 'user.dontShowAgain',
  CONFIRMATION_KEY: 'user.confirmation',
  ACCOUNTS_KEY: 'user.accounts',
  CONTACTS_KEY: 'user.contacts',

  /** MMKV key (`navigationStorage`) for persisted React Navigation root state. */
  NAVIGATION_STATE_V1: 'navigation.state.v1',
}

export const flags = {
  /** Dev-only mock transport; enable with `USE_MOCK_API=true` or `=1` in `.env`. */
  USE_MOCK: __DEV__ && parseEnvBool(Config.USE_MOCK_API),
  /**
   * Dev uniquement : saute onboarding + écran de connexion (démarrage direct
   * sur les onglets) ET ouvre une session Supabase de développement
   * (`DEV_LOGIN_EMAIL` / `DEV_LOGIN_PASSWORD` dans `.env`) pour que les
   * requêtes RLS (stats, règles) fonctionnent. Sans effet en release.
   */
  DEV_SKIP_AUTH: __DEV__ && parseEnvBool(Config.DEV_SKIP_AUTH),
}
