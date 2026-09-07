// src/session/logout.ts
/**
 * Centralized logout helper:
 * - removes tokens from storage (access + refresh)
 * - clears persisted React Query cache snapshot (MMKV)
 * - clears offline queue + in-memory snapshot cache
 * - clears QueryClient in-memory cache (if available)
 * - clears persisted navigation state
 *
 * Concurrent calls share one in-flight operation so rapid 401s + UI never skip cleanup.
 */

import type { QueryClient } from '@tanstack/react-query'
import { constants } from '@/config/constants'
import { clearNavigationPersistence } from '@/navigation/persistence/navigation-persistence'
import { detachBillingIdentity } from '@/session/billing-identity'
import { getSessionQueryClient } from '@/session/session-bridge'
import { offlineQueue } from '@/shared/services/api/offline/offline-queue'
import {
  addAppBreadcrumb,
  setSentryUser,
} from '@/shared/services/monitoring/sentry'
import { cacheEngine } from '@/shared/services/storage/cache-engine'
import { clearCredentials } from '@/shared/services/storage/credentials'
import { kvStorage } from '@/shared/services/storage/mmkv'

let inflightLogout: Promise<void> | null = null

/**
 * Call on user sign-out, token expiry, refresh failure, or 401-guard.
 * Optional QueryClient passed to clear in-memory cache too.
 * If qc not provided, it will use session-bridge QueryClient (if set).
 */
export function performLogout(qc?: QueryClient): Promise<void> {
  if (inflightLogout) {
    return inflightLogout
  }
  inflightLogout = runLogout(qc).finally(() => {
    inflightLogout = null
  })
  return inflightLogout
}

async function runLogout(qc?: QueryClient): Promise<void> {
  const client = qc ?? getSessionQueryClient() ?? undefined

  try {
    // 0) Detach the Sentry identity FIRST. `useSessionUser` le fait déjà sur
    // l'événement SIGNED_OUT de Supabase, mais un logout déclenché par un 401
    // ou par un échec de refresh n'en produit pas : sans ceci, les erreurs
    // suivantes resteraient attribuées au compte qu'on vient de quitter.
    addAppBreadcrumb({ category: 'session', message: 'logout' })
    setSentryUser(null)

    // 1) Remove sensitive credentials
    clearCredentials()

    // 2) Drop persisted RQ cache snapshot
    kvStorage.delete(constants.RQ_CACHE)

    // 3) Clear offline queue + in-memory snapshot cache
    offlineQueue.clear()
    cacheEngine.clear()

    // 3b) Detach purchases from the account (back to an anonymous RevenueCat
    // id). Deliberately does NOT re-check the entitlement — see
    // `detachBillingIdentity`.
    void detachBillingIdentity()

    // 4) Clear React Query in-memory cache (if available)
    if (client) {
      await client.cancelQueries().catch(() => undefined)
      client.clear()
    }
  } catch {
    // ignore: we still must reset navigation
  } finally {
    clearNavigationPersistence()
  }
}
