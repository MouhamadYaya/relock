/**
 * FILE: logging.interceptor.ts
 * LAYER: infra/http/interceptors
 * ---------------------------------------------------------------------
 * Dev-time HTTP logging without leaking secrets. Uses apisauce
 * addRequestTransform and addMonitor. Redacts sensitive fields.
 * ---------------------------------------------------------------------
 */

import { create } from 'apisauce'
import type {
  ApiResponse,
  RequestConfig,
} from '@/shared/services/api/http/http.types'
import { addAppBreadcrumb } from '@/shared/services/monitoring/sentry'

const SENSITIVE_KEYS = new Set(
  ['authorization', 'auth', 'token', 'password', 'secret', 'apiKey'].map(s =>
    s.toLowerCase(),
  ),
)
const SENSITIVE_REGEX =
  /(authorization|auth|token|password|secret|api[-_]?key)/i

function maskHeaders(
  h: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!h || typeof h !== 'object') return h ?? {}
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(h)) {
    const v = h[k]
    if (SENSITIVE_KEYS.has(k.toLowerCase()) || SENSITIVE_REGEX.test(k)) {
      out[k] =
        typeof v === 'string' && v.length > 16
          ? `${(v as string).slice(0, 8)}…(masked)`
          : '***'
    } else {
      out[k] = v
    }
  }
  return out
}

function maskData(data: unknown, depth = 2): unknown {
  if (depth < 0 || data == null) return data
  if (typeof data !== 'object') return data
  if (Array.isArray(data)) return data.map(v => maskData(v, depth - 1))
  const src = data as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of Object.keys(src)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase()) || SENSITIVE_REGEX.test(k)) {
      out[k] = '***'
    } else {
      out[k] = maskData(src[k], depth - 1)
    }
  }
  return out
}

type RequestConfigWithTs = RequestConfig & { __ts?: number }

/**
 * Fil d'Ariane réseau, EN PRODUCTION AUSSI.
 *
 * Ce n'est pas du log : rien ne part tant qu'aucun événement ne survient.
 * Mais quand un crash arrive, le rapport porte alors les dernières requêtes
 * qui y ont mené — le seul moyen de distinguer « l'app plante » de « le
 * backend a renvoyé un 500 et l'app n'a pas su quoi en faire ».
 *
 * Aucun corps de requête, aucun en-tête : juste méthode, chemin, statut,
 * durée. Le `beforeBreadcrumb` de Sentry coupe encore la query string.
 */
export function attachSentryBreadcrumbs(api: ReturnType<typeof create>): void {
  // Horodatage de départ. `attachLogging` pose déjà `__ts`, mais seulement en
  // __DEV__ : sans ce transform, la durée manquerait précisément là où elle
  // sert, en production.
  api.addRequestTransform((config: RequestConfig) => {
    if (!config) return
    const c = config as RequestConfigWithTs
    if (c.__ts == null) c.__ts = Date.now()
  })

  api.addMonitor((res: ApiResponse) => {
    const config = res.config as RequestConfigWithTs | undefined
    addAppBreadcrumb({
      category: 'http',
      message: `${(config?.method ?? 'GET').toUpperCase()} ${config?.url ?? ''}`,
      level: res.ok ? 'info' : 'warning',
      data: {
        url: config?.url,
        status: res.status ?? undefined,
        problem: res.problem ?? undefined,
        duration_ms:
          config?.__ts != null ? Date.now() - config.__ts : undefined,
      },
    })
  })
}

export function attachLogging(api: ReturnType<typeof create>): void {
  if (__DEV__ !== true) return

  api.addRequestTransform((config: RequestConfig) => {
    if (!config) return
    ;(config as RequestConfigWithTs).__ts = Date.now()
    console.log(
      '[HTTP][REQUEST]',
      (config.method ?? '').toUpperCase(),
      config.url,
      {
        params: maskData(config.params),
        data: maskData(config.data),
        headers: maskHeaders(config.headers as Record<string, unknown>),
      },
    )
  })

  api.addMonitor((res: ApiResponse) => {
    if (__DEV__ !== true) return
    const config = res.config as RequestConfigWithTs | undefined
    const elapsed =
      config?.__ts != null ? `${Date.now() - config.__ts}ms` : undefined
    if (res.ok) {
      console.log('[HTTP][RESPONSE]', res.status, config?.url, elapsed)
    } else {
      console.log('[HTTP][ERROR]', res.status, config?.url, elapsed, {
        data:
          typeof res.data === 'string'
            ? (res.data as string).slice(0, 200)
            : maskData(res.data),
        headers: maskHeaders(
          (res as { headers?: Record<string, unknown> }).headers,
        ),
      })
    }
  })
}
