/**
 * FILE: scrub.ts
 * LAYER: shared/services/monitoring
 * ---------------------------------------------------------------------
 * Dernier filet avant l'envoi à Sentry.
 *
 * POURQUOI :
 *   Un événement Sentry emporte bien plus que la stack : messages, URLs,
 *   fil d'Ariane (breadcrumbs), contextes, corps de requête. N'importe
 *   lequel peut contenir un JWT Supabase, une clé RevenueCat ou l'e-mail de
 *   l'utilisateur. `sendDefaultPii: false` couvre ce que le SDK ajoute
 *   LUI-MÊME ; il ne couvre pas ce que NOTRE code met dans un message.
 *
 *   Ces fonctions sont donc volontairement pures et sans dépendance : elles
 *   se testent seules, et c'est là que se vérifie la promesse « aucune
 *   donnée sensible ne quitte l'appareil ».
 *
 * RÈGLE : on masque par DÉFAUT, on n'autorise que ce qu'on reconnaît.
 * ---------------------------------------------------------------------
 */

import type { Breadcrumb, ErrorEvent } from '@sentry/react-native'

export const REDACTED = '[redacted]'

/** Clés dont la VALEUR ne doit jamais partir, quel que soit le contenu. */
const SENSITIVE_KEY =
  /(authorization|auth|token|jwt|password|passwd|secret|api[-_]?key|apikey|session|cookie|refresh|credential|signature|email|e[-_]?mail|phone|dsn)/i

/** Motifs reconnaissables d'un secret, même noyé dans une phrase libre. */
const SECRET_PATTERNS: readonly RegExp[] = [
  // JWT (Supabase access token, id_token Google) : trois segments base64url.
  /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\b/g,
  // "Bearer xxxx"
  /\bBearer\s+[A-Za-z0-9._~+/=-]{10,}/gi,
  // Adresses e-mail.
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g,
  // Clés RevenueCat (appl_… / goog_…) et clés Sentry/Supabase préfixées.
  /\b(?:appl|goog|amzn|rcb)_[A-Za-z0-9]{10,}\b/g,
  // Chaîne opaque très longue sans espace : probablement un secret.
  /\b[A-Za-z0-9_-]{40,}\b/g,
]

/** Masque tout secret reconnaissable à l'intérieur d'une chaîne libre. */
export function redactString(value: string): string {
  let out = value
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, REDACTED)
  }
  return out
}

/**
 * Retire la query string d'une URL : `?token=…` est le vecteur de fuite le
 * plus banal. Le chemin, lui, reste — c'est ce qui rend l'événement lisible.
 */
export function redactUrl(value: string): string {
  const cut = value.search(/[?#]/)
  const base = cut === -1 ? value : `${value.slice(0, cut)}?${REDACTED}`
  return redactString(base)
}

/**
 * Parcourt une structure quelconque et masque : toute valeur dont la CLÉ est
 * sensible, et tout secret reconnu dans les chaînes restantes.
 * `depth` borne la récursion (un objet cyclique ou géant ne doit pas coûter).
 */
export function redactDeep(input: unknown, depth = 4): unknown {
  if (depth < 0 || input == null) return input
  if (typeof input === 'string') return redactString(input)
  if (typeof input !== 'object') return input
  if (Array.isArray(input)) return input.map(v => redactDeep(v, depth - 1))

  const src = input as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const key of Object.keys(src)) {
    out[key] = SENSITIVE_KEY.test(key)
      ? REDACTED
      : redactDeep(src[key], depth - 1)
  }
  return out
}

/**
 * `beforeSend` : dernier passage sur l'événement complet.
 * Rendre `null` annulerait l'envoi — on ne le fait pas ici, le filtrage du
 * bruit se décide en amont (`ignoreErrors`, appelants).
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  // L'utilisateur : on garde l'id (un UUID Supabase, non identifiant en soi,
  // et indispensable pour dire « ce bug touche 3 personnes ») et RIEN d'autre.
  if (event.user) {
    event.user = { id: event.user.id }
  }

  // Requête : en-têtes et cookies dehors, query string coupée.
  if (event.request) {
    event.request.headers = undefined
    event.request.cookies = undefined
    if (event.request.url) event.request.url = redactUrl(event.request.url)
    if (event.request.data)
      event.request.data = redactDeep(
        event.request.data,
      ) as typeof event.request.data
  }

  // Messages et valeurs d'exception : du texte libre écrit par notre code.
  if (event.message) event.message = redactString(event.message)
  for (const ex of event.exception?.values ?? []) {
    if (ex.value) ex.value = redactString(ex.value)
  }

  if (event.extra) event.extra = redactDeep(event.extra) as typeof event.extra
  if (event.contexts)
    event.contexts = redactDeep(event.contexts) as typeof event.contexts
  if (event.breadcrumbs)
    event.breadcrumbs = event.breadcrumbs
      .map(scrubBreadcrumb)
      .filter((b): b is Breadcrumb => b !== null)

  return event
}

/**
 * `beforeBreadcrumb` : le fil d'Ariane est le plus gros contributeur de
 * volume — et le plus distrait. Rendre `null` jette la miette.
 */
export function scrubBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  // Les logs console de développement n'ont aucune valeur en production et
  // sont l'endroit où traînent le plus de secrets recopiés à la main.
  if (breadcrumb.category === 'console' && breadcrumb.level === 'debug') {
    return null
  }

  if (breadcrumb.message) {
    breadcrumb.message = redactString(breadcrumb.message)
  }
  if (breadcrumb.data) {
    const data = redactDeep(breadcrumb.data) as Record<string, unknown>
    if (typeof data.url === 'string') data.url = redactUrl(data.url)
    if (typeof data.to === 'string') data.to = redactUrl(data.to)
    if (typeof data.from === 'string') data.from = redactUrl(data.from)
    breadcrumb.data = data
  }

  return breadcrumb
}
