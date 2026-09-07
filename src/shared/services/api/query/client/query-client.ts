// src/infra/query/client/query-client.ts
import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { Freshness } from '@/shared/services/api/query/policy/freshness'
import { captureError } from '@/shared/services/monitoring/sentry'
import type { NormalizedError } from '@/shared/utils/normalize-error'
import { normalizeError } from '@/shared/utils/normalize-error'
import { showErrorToast } from '@/shared/utils/toast'

/**
 * Remonte une erreur serveur à Sentry.
 *
 * L'EMPREINTE est le point clé : sans elle, Sentry regroupe par message, et
 * un message qui contient un identifiant (« bloc 4f2a… introuvable ») crée
 * une issue PAR utilisateur. On regroupe donc par (source, code, statut) —
 * une ligne dans le dashboard, un compteur qui a du sens.
 *
 * Hors ligne = non événement : c'est l'usage normal d'une app de blocage,
 * pas une panne. On ne l'envoie pas, exactement comme on ne l'affiche pas.
 */
function reportQueryError(
  source: 'query' | 'mutation',
  e: NormalizedError,
  extra: Record<string, unknown>,
): void {
  if (e.code === 'NETWORK_OFFLINE') return
  captureError(new Error(`[${source}] ${e.message}`), {
    // Une lecture qui échoue se retente ; une action utilisateur qui échoue
    // est une promesse non tenue.
    level: source === 'mutation' ? 'error' : 'warning',
    tags: {
      source,
      error_code: e.code ?? 'unknown',
      http_status: String(e.status ?? 'none'),
    },
    extra,
    fingerprint: [source, e.code ?? 'unknown', String(e.status ?? 'none')],
  })
}

export function createQueryClient() {
  const queryCache = new QueryCache({
    onError: (error, query) => {
      const e = normalizeError(error)

      // avoid spamming toasts when offline
      if (e.code === 'NETWORK_OFFLINE') return

      if (__DEV__) console.log('[RQ][QUERY][ERROR]', e)
      reportQueryError('query', e, { queryKey: query.queryKey })
      showErrorToast(e)
    },
  })

  const mutationCache = new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const e = normalizeError(error)

      // avoid spamming toasts when offline
      if (e.code === 'NETWORK_OFFLINE') return

      if (__DEV__) console.log('[RQ][MUTATION][ERROR]', e)
      // Les variables de la mutation NE sont PAS envoyées : ce sont les
      // données saisies par l'utilisateur. Les tags d'invalidation, eux,
      // identifient l'opération sans rien révéler.
      reportQueryError('mutation', e, {
        mutationKey: mutation.options.mutationKey,
        tags: mutation.meta?.tags,
      })
      showErrorToast(e)
    },
  })

  return new QueryClient({
    queryCache,
    mutationCache,
    defaultOptions: {
      queries: {
        // nearRealtime profile by default
        staleTime: Freshness.nearRealtime.staleTime,
        gcTime: Freshness.nearRealtime.gcTime,

        refetchOnReconnect: true,
        throwOnError: false,

        retry: (failureCount, error: unknown) => {
          const e = normalizeError(error)

          // never retry when offline
          if (e.code === 'NETWORK_OFFLINE') return false

          // retry only on 5xx/429
          if (e.status && (e.status >= 500 || e.status === 429)) {
            return failureCount < 2
          }
          return false
        },
      },

      mutations: {
        throwOnError: false,

        retry: (failureCount, error: unknown) => {
          const e = normalizeError(error)

          // never retry when offline
          if (e.code === 'NETWORK_OFFLINE') return false

          if (e.status && (e.status >= 500 || e.status === 429)) {
            return failureCount < 2
          }
          return false
        },
      },
    },
  })
}
