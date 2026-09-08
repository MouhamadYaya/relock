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
  /**
   * Repli quand le natif ne répond pas (tests Jest, web).
   *
   * DOIT SUIVRE `MARKETING_VERSION` du projet Xcode et `versionName` côté
   * Android. Il valait `1.0.2` — un numéro hérité du starter dont ce dépôt
   * est issu, jamais celui de Relock : les Réglages annonçaient donc une
   * version que personne n'a jamais publiée dès que `Constants` se taisait.
   */
  version: '1.0.0',
  build: 1,
  enableLogs: __DEV__,
  bundleId: 'com.yaya.relock',
  /**
   * Identifiant App Store de la fiche Relock (App Store Connect → General →
   * App Information → Apple ID).
   *
   * IL DOIT ÊTRE LE BON, ET RIEN NE LE VÉRIFIE À L'EXÉCUTION : un
   * `apps.apple.com/app/idXXXXXXXXXX` est syntaxiquement valide quel que soit
   * le numéro. Un chiffre de travers n'échoue pas — il ouvre une fiche
   * introuvable, ou celle de quelqu'un d'autre. C'est pour ça que ce champ est
   * resté `null` jusqu'à ce que la fiche existe.
   *
   * `null` reste le repli prévu : les entrées « Noter » et « Partager »
   * disparaissent alors proprement (voir `links.review` / `links.share`).
   */
  appStoreId: 6809028039 as number | null,
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
 * Origine du site public, servi par Cloudflare Workers depuis `src/legal/`
 * (config à la racine dans `wrangler.jsonc`, déploiement `npm run legal:deploy`).
 *
 * Un seul endroit à changer si le domaine bouge.
 */
const SITE_ORIGIN = 'https://getrelock.com'

/**
 * Adresses publiques.
 *
 * Les chemins portent leur slash final : c'est la forme canonique servie par le
 * Worker, qui redirige sinon en 307 — autant éviter l'aller-retour dans la WebView.
 */
export const links = {
  privacy: `${SITE_ORIGIN}/privacy/`,
  privacyFr: `${SITE_ORIGIN}/fr/privacy/`,
  terms: `${SITE_ORIGIN}/terms/`,
  termsFr: `${SITE_ORIGIN}/fr/terms/`,
  help: `${SITE_ORIGIN}/help/`,
  helpFr: `${SITE_ORIGIN}/fr/help/`,
  supportEmail: 'contact@getrelock.com',
  /**
   * Fiche App Store, ouverte directement sur l'onglet des avis. `null` tant
   * qu'aucun identifiant n'est connu : l'appelant retire alors l'entrée
   * « Noter » plutôt que d'ouvrir une fiche qui n'est pas la nôtre.
   */
  review: appConfig.appStoreId
    ? `https://apps.apple.com/app/id${appConfig.appStoreId}?action=write-review`
    : null,
  /**
   * Adresse partagée par « Partager l'app ». Repli sur le site tant que la
   * fiche n'existe pas — un lien qui présente le produit vaut mieux qu'un lien
   * App Store mort dans la conversation de quelqu'un.
   */
  share: appConfig.appStoreId
    ? `https://apps.apple.com/app/id${appConfig.appStoreId}`
    : SITE_ORIGIN,
} as const
