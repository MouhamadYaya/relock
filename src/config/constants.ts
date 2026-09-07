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
  /**
   * Reprise de l'onboarding : étape atteinte + réponses déjà données
   * (`src/features/onboarding/services/onboarding-checkpoint.ts`). Effacée
   * dès que l'onboarding est terminé.
   */
  ONBOARDING_CHECKPOINT: 'onboarding.checkpoint.v1',
  /** Le récit + le diagnostic ont été joués une fois. Définitif. */
  ONBOARDING_SURVEY_DONE: 'onboarding.survey.v1',
  /**
   * Dernier état d'abonnement CONNU. Cache local d'une vérité serveur
   * (RevenueCat), lu de façon synchrone au démarrage pour ouvrir la bonne
   * porte sans attendre le réseau. Jamais la source de vérité.
   */
  ENTITLEMENT_ACTIVE: 'billing.entitlement.v1',
  /** Nombre de présentations du paywall (choix de la variante + mesure). */
  PAYWALL_VIEWS: 'paywall.views.v1',
  APP_PREFERENCES_STORE: 'app.preferences',
  IS_FIRST_TIME_OPEN_KEY: 'user.isFirstTimeOpen',
  HIDE_USE_CAMERA_KEY: 'user.hideUseCamera',
  DONT_SHOW_AGAIN_KEY: 'user.dontShowAgain',
  CONFIRMATION_KEY: 'user.confirmation',
  ACCOUNTS_KEY: 'user.accounts',
  CONTACTS_KEY: 'user.contacts',

  /**
   * Préférences réglables depuis l'écran Réglages. Une clé par préférence
   * (et non un blob JSON) : chacune se lit isolément, tôt, sans parser quoi
   * que ce soit — `haptics` et Sentry les consultent hors de React.
   */
  PREF_HAPTICS: 'pref.haptics.v1',
  PREF_PAUSE_SOUND: 'pref.pauseSound.v1',
  PREF_CRASH_REPORTS: 'pref.crashReports.v1',

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
