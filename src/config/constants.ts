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
  /**
   * Rituel de pause exigé avant un déblocage (`respiration`, `calcul`,
   * `transcription`). Une clé à part entière, et non un booléen : le jeu de
   * rituels est destiné à s'agrandir, et une valeur inconnue doit pouvoir
   * retomber sur la respiration sans migration.
   */
  PREF_PAUSE_RITUAL: 'pref.pauseRitual.v1',
  /**
   * Dernier déblocage d'urgence (timestamp ms). Le quota hebdomadaire s'en
   * déduit — on ne stocke pas un compteur, qui se désynchroniserait du temps
   * qui passe.
   */
  EMERGENCY_UNLOCK_AT: 'emergency.unlockAt.v1',

  /** Heure des rappels du soir, en minutes depuis minuit. */
  PREF_REMINDER_MINUTES: 'pref.reminderMinutes.v1',

  /**
   * Notifications v2. `NOTIF_PREFS_LEGACY` n'est lu qu'une fois, pour la
   * migration : les trois booléens de la v1 deviennent des canaux, et l'ancienne
   * clé est effacée pour qu'aucun code ne puisse la relire par accident.
   */
  NOTIF_PREFS: 'notif.prefs.v2',
  NOTIF_PREFS_LEGACY: 'notif.prefs',
  /** Journal d'instrumentation (anneau borné). */
  NOTIF_LOG: 'notif.log.v1',
  /**
   * État du moteur : derniers envois par nœud, ancres écrites, score de
   * fatigue par famille, drapeau de purge de l'ancien préfixe `relock.sched.`.
   */
  NOTIF_STATE: 'notif.state.v1',
  /** Soft-ask déjà proposé (permission demandée une seule fois, au bon moment). */
  NOTIF_PERMISSION_ASKED: 'notif.permissionAsked',
  /** Première ouverture connue de l'app — base de `daysSinceInstall`. */
  NOTIF_INSTALLED_AT: 'notif.installedAt.v1',

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
