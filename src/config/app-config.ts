/**
 * Métadonnées statiques de l'app + adresses publiques (légal, support, store).
 *
 * Ce n'est PAS `env.ts` : rien ici ne change entre dev, staging et prod. Le
 * numéro de version, lui, n'est volontairement pas figé dans ce fichier —
 * voir `appVersion()`, qui lit le binaire.
 */
import Constants from 'expo-constants'

export const appConfig = {
  appName: 'Relock',
  /** Repli quand le natif ne répond pas (tests Jest, web). */
  version: '1.0.2',
  build: 1,
  enableLogs: __DEV__,
  bundleId: 'com.yaya.relock',
  /** Identifiant App Store — sert aux liens « Noter » et « Partager ». */
  appStoreId: '0000000000',
}

/**
 * La version RÉELLEMENT installée, lue dans le binaire
 * (`CFBundleShortVersionString` / `versionName`).
 *
 * `app.json` et `package.json` divergent régulièrement du projet Xcode ; le
 * seul numéro qui ait un sens dans un rapport de bug est celui de l'app que
 * la personne a entre les mains.
 */
export function appVersion(): string {
  return Constants.nativeAppVersion ?? appConfig.version
}

/** Le numéro de build installé, `null` hors appareil. */
export function appBuild(): string | null {
  return Constants.nativeBuildVersion ?? null
}

/**
 * Adresses publiques.
 *
 * ⚠️ À REMPLACER par les URLs réelles avant publication : l'App Store exige
 * une politique de confidentialité ATTEIGNABLE (guideline 5.1.1) et un moyen
 * de contact. Les liens ci-dessous sont des emplacements, pas des promesses.
 */
export const links = {
  privacy: 'https://relock.app/privacy',
  terms: 'https://relock.app/terms',
  help: 'https://relock.app/help',
  supportEmail: 'hello@relock.app',
  /** Fiche App Store, ouverte directement sur l'onglet des avis. */
  review: `https://apps.apple.com/app/id${appConfig.appStoreId}?action=write-review`,
  share: `https://apps.apple.com/app/id${appConfig.appStoreId}`,
} as const
