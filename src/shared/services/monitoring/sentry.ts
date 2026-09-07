/**
 * FILE: sentry.ts
 * LAYER: shared/services/monitoring
 * ---------------------------------------------------------------------
 * Point d'entrée UNIQUE vers Sentry. Aucun autre fichier ne doit importer
 * `@sentry/react-native` (cf. .claude/rules/shared-services.md).
 *
 * CE QUI EST VOLONTAIREMENT ABSENT :
 *   `release` et `dist`. Le SDK natif les déduit du binaire
 *   (`CFBundleShortVersionString`+`CFBundleVersion` / `versionName`+`versionCode`)
 *   et sentry-cli calcule EXACTEMENT la même chaîne au moment d'uploader les
 *   source maps. Les fixer à la main en JS est le moyen le plus rapide de se
 *   retrouver avec des stacks non symbolisées en production.
 *
 * INTERRUPTEUR :
 *   Sans `SENTRY_DSN`, tout ce module est inerte — aucun réseau, aucun coût.
 *   En __DEV__ il faut en plus `SENTRY_ENABLE_IN_DEV=1`, sinon on polluerait
 *   le projet Sentry avec les erreurs de la boucle de développement.
 * ---------------------------------------------------------------------
 */

import * as Sentry from '@sentry/react-native'
import type { ErrorInfo } from 'react'

import { env } from '@/config/env'
import { scrubBreadcrumb, scrubEvent } from './scrub'

/**
 * Instrumentation Expo Router. Créée AU CHARGEMENT DU MODULE, avant
 * `Sentry.init`, parce que `app/_layout.tsx` doit lui remettre la référence
 * du conteneur de navigation dès son premier rendu.
 */
export const navigationIntegration = Sentry.reactNavigationIntegration({
  enableTimeToInitialDisplay: true,
  // Le chemin complet contient nos segments dynamiques (`/block-detail?id=…`),
  // donc potentiellement des identifiants. Le nom de route suffit.
  useFullPathsForNavigationRoutes: false,
})

/** Bruit connu qui n'apprend rien et remplit le quota. */
const IGNORED_ERRORS: readonly (string | RegExp)[] = [
  'Network request failed',
  'AbortError',
  /Request (aborted|timeout)/i,
  // Rejet de promesse sans objet Error : sans stack, non actionnable.
  'Non-Error promise rejection captured',
]

let didInit = false
let active = false

/** Vrai quand les événements partent réellement. */
export function isSentryEnabled(): boolean {
  return active
}

function shouldEnable(): boolean {
  if (!env.SENTRY_DSN) return false
  if (__DEV__ && env.SENTRY_ENABLE_IN_DEV !== '1') return false
  return true
}

export function initSentry(): void {
  if (didInit) return
  didInit = true
  if (!shouldEnable()) return

  const replayEnabled =
    env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE > 0 ||
    env.SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE > 0

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.ENV,
    debug: __DEV__,

    // ---- Confidentialité ------------------------------------------------
    // Le SDK n'ajoute de lui-même ni IP, ni e-mail, ni corps de requête.
    sendDefaultPii: false,
    // Deux filets successifs : l'événement entier, puis chaque miette.
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,

    // ---- Fiabilité ------------------------------------------------------
    // Attache une stack même aux `captureMessage`, sinon impossible de savoir
    // d'où vient un avertissement.
    attachStacktrace: true,
    maxBreadcrumbs: 100,
    // Les événements produits hors ligne sont mis en cache par la couche
    // native et repartent au retour du réseau — cœur d'un blocage d'apps
    // qui, par nature, tourne souvent sans connexion.
    maxCacheItems: 60,
    ignoreErrors: [...IGNORED_ERRORS],

    // ---- Release Health -------------------------------------------------
    // C'est ce qui produit le « % de sessions sans crash » par version, le
    // seul chiffre qui autorise ou non une mise en production.
    enableAutoSessionTracking: true,

    // ---- Crashs natifs --------------------------------------------------
    enableNativeCrashHandling: true,
    // iOS : « l'app s'est figée » (App Hang) et « tuée par le watchdog /
    // mémoire » (Watchdog Termination) — invisibles côté JS.
    enableAppHangTracking: true,
    enableWatchdogTerminationTracking: true,
    // Android : crashs C/C++ (NDK) et ANR.
    enableNdk: true,

    // ---- Performance ----------------------------------------------------
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    profilesSampleRate: env.SENTRY_PROFILES_SAMPLE_RATE,

    // ---- Session Replay -------------------------------------------------
    replaysSessionSampleRate: env.SENTRY_REPLAYS_SESSION_SAMPLE_RATE,
    replaysOnErrorSampleRate: env.SENTRY_REPLAYS_ON_ERROR_SAMPLE_RATE,

    // Un tableau S'AJOUTE aux intégrations par défaut (il ne les remplace
    // pas — seule la forme fonction fait ça).
    integrations: [
      navigationIntegration,
      ...(env.SENTRY_PROFILES_SAMPLE_RATE > 0
        ? [Sentry.hermesProfilingIntegration()]
        : []),
      ...(replayEnabled
        ? [
            // Masquage TOTAL : le replay ne doit jamais montrer un e-mail à
            // la saisie, un montant d'abonnement ou la liste des apps
            // bloquées d'un utilisateur. On perd en lisibilité, on gagne le
            // droit de l'activer.
            Sentry.mobileReplayIntegration({
              maskAllText: true,
              maskAllImages: true,
              maskAllVectors: true,
            }),
          ]
        : []),
    ],
  })

  active = true
}

/**
 * Branche l'instrumentation Supabase APRÈS l'init, pour ne pas créer de
 * dépendance de ce module vers le client Supabase (et donc aucun risque
 * d'import circulaire au démarrage). Chaque requête devient une miette du
 * fil d'Ariane : on voit la dernière table interrogée avant un crash.
 */
export function attachSupabaseTelemetry(supabaseClient: unknown): void {
  if (!active) return
  Sentry.addIntegration(Sentry.supabaseIntegration({ supabaseClient }))
}

/** Signale les échecs d'`ErrorBoundary` (pas de PII, stack de composants). */
export function captureBoundaryError(error: Error, errorInfo: ErrorInfo): void {
  if (!active) return
  Sentry.captureException(error, {
    contexts: {
      react: { componentStack: errorInfo.componentStack ?? undefined },
    },
  })
}

type CaptureOptions = {
  /** Regroupement fin : `{ feature: 'blocking', op: 'shield-request' }`. */
  tags?: Record<string, string>
  /** Contexte additionnel — passe par le scrubbing avant l'envoi. */
  extra?: Record<string, unknown>
  level?: 'fatal' | 'error' | 'warning' | 'info'
  /**
   * Empreinte explicite : force le regroupement d'erreurs dont le message
   * varie (identifiants, dates) en une seule issue.
   */
  fingerprint?: string[]
}

/**
 * Erreur non fatale : l'app continue, mais quelque chose a échoué et
 * personne ne s'en plaindra. C'est ce que les `catch` muets avalaient.
 */
export function captureError(error: unknown, options?: CaptureOptions): void {
  if (!active) return
  const err = error instanceof Error ? error : new Error(safeStringify(error))
  Sentry.captureException(err, {
    tags: options?.tags,
    extra: options?.extra,
    level: options?.level ?? 'error',
    fingerprint: options?.fingerprint,
  })
}

/** Événement sans exception : « la permission a été refusée », etc. */
export function captureMessage(
  message: string,
  options?: CaptureOptions,
): void {
  if (!active) return
  Sentry.captureMessage(message, {
    tags: options?.tags,
    extra: options?.extra,
    level: options?.level ?? 'info',
    fingerprint: options?.fingerprint,
  })
}

/**
 * Une miette du fil d'Ariane. Ce n'est PAS un log : ça ne part que si un
 * événement survient ensuite, et ça raconte alors les 100 dernières actions
 * qui y ont mené. C'est ce qui rend un crash reproductible.
 */
export function addAppBreadcrumb(breadcrumb: {
  category: string
  message: string
  level?: 'debug' | 'info' | 'warning' | 'error'
  data?: Record<string, unknown>
}): void {
  if (!active) return
  Sentry.addBreadcrumb({
    category: breadcrumb.category,
    message: breadcrumb.message,
    level: breadcrumb.level ?? 'info',
    data: breadcrumb.data,
  })
}

/**
 * Identité de l'utilisateur : UNIQUEMENT l'id Supabase. Il permet de dire
 * « ce bug touche 3 personnes, pas 300 » sans jamais transporter d'e-mail.
 * `null` à la déconnexion (sans quoi le crash d'un compte serait attribué
 * au précédent).
 */
export function setSentryUser(userId: string | null): void {
  if (!active) return
  Sentry.setUser(userId ? { id: userId } : null)
}

/** Étiquettes filtrables dans le dashboard (env, abonnement, langue…). */
export function setSentryTags(tags: Record<string, string>): void {
  if (!active) return
  Sentry.setTags(tags)
}

/** Bloc de contexte nommé, visible sur chaque événement suivant. */
export function setSentryContext(
  key: string,
  context: Record<string, unknown> | null,
): void {
  if (!active) return
  Sentry.setContext(key, context)
}

/**
 * Vide la file d'envoi. À appeler avant une sortie volontaire du processus,
 * sinon les derniers événements meurent avec lui. (Le délai d'attente est
 * celui de `shutdownTimeout` — `flush()` du SDK React Native ne le prend pas
 * en argument, contrairement au SDK web.)
 */
export function flushSentry(): Promise<boolean> {
  if (!active) return Promise.resolve(true)
  return Sentry.flush()
}

/**
 * DEV uniquement : provoque un vrai crash NATIF pour vérifier de bout en
 * bout que dSYM et symbolication sont en place. Ne jamais appeler ailleurs
 * que depuis un écran de debug.
 */
export function triggerNativeCrashForTesting(): void {
  Sentry.nativeCrash()
}

function safeStringify(value: unknown): string {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value)
  } catch {
    return String(value)
  }
}
