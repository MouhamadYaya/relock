import Config from 'react-native-config'

/** react-native-config is stringly-typed; treat common truthy/falsey spellings. */
export function parseEnvBool(raw: string | undefined): boolean {
  if (raw == null || raw.trim() === '') {
    return false
  }
  const s = raw.trim().toLowerCase()
  return s === '1' || s === 'true' || s === 'yes' || s === 'on'
}

/** Taux d'échantillonnage Sentry : un réel de 0 à 1, 0 pour toute saisie invalide. */
export function parseSampleRate(raw: string | undefined): number {
  const n = Number.parseFloat(String(raw ?? '0'))
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    return 0
  }
  return n
}

export const env = {
  API_URL: (Config.API_URL ?? '').trim(),
  USE_MOCK_API: parseEnvBool(Config.USE_MOCK_API),
  SUPABASE_URL: (Config.SUPABASE_URL ?? '').trim(),
  SUPABASE_ANON_KEY: (Config.SUPABASE_ANON_KEY ?? '').trim(),
  /** Google Cloud OAuth "Web client ID" — required by Supabase's Google provider and by `GoogleSignin.configure` (it's what makes the returned idToken usable server-side). */
  GOOGLE_WEB_CLIENT_ID: (Config.GOOGLE_WEB_CLIENT_ID ?? '').trim(),
  /** Google Cloud OAuth "iOS client ID" — passed to `GoogleSignin.configure`; its reversed form is also the native URL scheme (Info.plist). */
  GOOGLE_IOS_CLIENT_ID: (Config.GOOGLE_IOS_CLIENT_ID ?? '').trim(),
  /** Compte Supabase de dev pour `DEV_SKIP_AUTH` (jamais utilisé en release). */
  DEV_LOGIN_EMAIL: (Config.DEV_LOGIN_EMAIL ?? '').trim(),
  DEV_LOGIN_PASSWORD: (Config.DEV_LOGIN_PASSWORD ?? '').trim(),
  WS_URL: (Config.WS_URL ?? '').trim(),
  ENV: (Config.ENV ?? (__DEV__ ? 'development' : 'production')).trim(),
  /**
   * Sentry. Le DSN n'est pas un secret (il part dans le binaire), mais il
   * reste dans `.env` pour rester muet tant qu'il n'est pas renseigné.
   * `release` / `dist` ne sont volontairement PAS ici : le SDK natif les lit
   * du binaire (`CFBundleShortVersionString` / `versionName`), exactement
   * comme sentry-cli les calcule à l'upload des source maps. Les fixer à la
   * main en JS désaligne les deux et casse la symbolication.
   */
  SENTRY_DSN: (Config.SENTRY_DSN ?? '').trim(),
  SENTRY_ENABLE_IN_DEV: (Config.SENTRY_ENABLE_IN_DEV ?? '0').trim(),
  SENTRY_TRACES_SAMPLE_RATE: parseSampleRate(Config.SENTRY_TRACES_SAMPLE_RATE),
  /** Profilage Hermes — n'échantillonne QUE des traces déjà échantillonnées. */
  SENTRY_PROFILES_SAMPLE_RATE: parseSampleRate(
    Config.SENTRY_PROFILES_SAMPLE_RATE,
  ),
  /** Replay : part des sessions enregistrées de bout en bout (coûteux). */
  SENTRY_REPLAYS_SESSION_SAMPLE_RATE: parseSampleRate(
    Config.SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
  ),
  /** Replay : part des sessions AVEC erreur dont on garde les 30 s précédentes. */
  SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE: parseSampleRate(
    Config.SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,
  ),
  /** RevenueCat app keys (for paywall + subscription checks). */
  REVENUECAT_ENABLED: parseEnvBool(Config.REVENUECAT_ENABLED),
  REVENUECAT_IOS_API_KEY: (Config.REVENUECAT_IOS_API_KEY ?? '').trim(),
  REVENUECAT_ANDROID_API_KEY: (Config.REVENUECAT_ANDROID_API_KEY ?? '').trim(),
  REVENUECAT_ENTITLEMENT_ID: (
    Config.REVENUECAT_ENTITLEMENT_ID ?? 'relock_pro'
  ).trim(),
  /** Offering RevenueCat contenant le produit remisé de l'écran de rattrapage. */
  REVENUECAT_DISCOUNT_OFFERING_ID: (
    Config.REVENUECAT_DISCOUNT_OFFERING_ID ?? 'discount'
  ).trim(),
  /**
   * ImageKit — CDN média + transformations d'images par URL.
   * Ces deux valeurs ne sont PAS des secrets : l'endpoint apparaît dans chaque
   * URL d'image servie, et la public key n'autorise qu'un upload DÉJÀ signé.
   * La Private Key, elle, ne doit jamais entrer dans le binaire : elle vit
   * uniquement dans la Edge Function Supabase `imagekit-auth`.
   * Vide = intégration inerte (aucun appel réseau, fallback sur l'UI locale).
   */
  IMAGEKIT_URL_ENDPOINT: (Config.IMAGEKIT_URL_ENDPOINT ?? '')
    .trim()
    .replace(/\/+$/, ''),
  IMAGEKIT_PUBLIC_KEY: (Config.IMAGEKIT_PUBLIC_KEY ?? '').trim(),
} as const
