// src/infra/query/client/provider.tsx
/**
 * FILE: provider.tsx
 * LAYER: infra/query/client
 * ---------------------------------------------------------------------
 * PURPOSE:
 *   Centralize React Query bootstrapping:
 *   - PersistQueryClientProvider (MMKV persister)
 *   - NetInfo bridge
 *   - onlineManager + focusManager wiring (RQ v5)
 *   - transport offlineMode switching (online/offline)
 *   - sync-engine wiring: QueryClient + tagMaps for invalidate-by-tags
 *   - session-bridge wiring: QueryClient for logout/refresh flows
 *
 * RULES:
 *   - No feature imports here.
 *   - Features pass tagMaps from App root.
 * ---------------------------------------------------------------------
 */

import type { DehydrateOptions } from '@tanstack/react-query'
import { focusManager, onlineManager } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import React from 'react'
import { AppState } from 'react-native'
import { setSessionQueryClient } from '@/session/session-bridge'
import {
  initNetInfoBridge,
  isOffline,
  onNetworkChange,
} from '@/shared/services/api/network/netinfo'
import {
  setQueryClientForSync,
  setTagMapsForSync,
  syncEngine,
} from '@/shared/services/api/offline/sync-engine'
import {
  PersistencePolicy,
  PersistenceTTL,
} from '@/shared/services/api/query/persistence/limits'
import { mmkvPersister } from '@/shared/services/api/query/persistence/mmkv-persister'
import type { TagMap } from '@/shared/services/api/query/tags'
import { setOfflineMode } from '@/shared/services/api/transport/transport'
import { supabase } from '@/shared/services/supabase/client'
import { createQueryClient } from './query-client'

type Props = React.PropsWithChildren<{
  /** Feature tag maps: [authKeys.tagMap, userKeys.tagMap, ...] */
  tagMaps: TagMap[]
}>

// ✅ One QueryClient for the whole app lifetime
const queryClient = createQueryClient()

// Guard to avoid double-init in dev (Fast Refresh)
let didInit = false

export function QueryProvider({ children, tagMaps }: Props) {
  React.useEffect(() => {
    // Always keep tag maps up-to-date (App may re-render)
    setTagMapsForSync(tagMaps)

    if (!didInit) {
      didInit = true

      // 1) NetInfo bridge (safe no-op if package is absent)
      initNetInfoBridge()

      // 2) Wire QueryClient for non-React code (logout/refresh)
      setSessionQueryClient(queryClient)

      // 3) Wire sync engine
      setQueryClientForSync(queryClient)

      // 4) Initial offline/online state
      const offline = isOffline()
      setOfflineMode(offline)
      onlineManager.setOnline(!offline)

      // 5) Déconnexion : le cache (et sa copie persistée sur MMKV) appartient
      // au compte qui vient de partir — on le vide pour qu'il ne puisse pas
      // réapparaître sous le compte suivant. Les clés portent déjà l'id de
      // l'utilisateur ; ceci purge le stockage.
      supabase.auth.onAuthStateChange(event => {
        if (event === 'SIGNED_OUT') {
          queryClient.clear()
        }
      })
    }

    // Net changes -> update onlineManager + transport offlineMode + replay queue when online
    const unsubNet = onNetworkChange(async offline => {
      setOfflineMode(offline)
      onlineManager.setOnline(!offline)

      // when back online -> replay queued mutations
      if (!offline) {
        await syncEngine.onConnected()
      }
    })

    // AppState -> focusManager (refetchOnWindowFocus analogue)
    //
    // ⚠️ `state === 'active'` (le classique) est un piège sur iOS : l'état
    // 'inactive' couvre des surfaces système TRANSITOIRES pendant lesquelles
    // l'app reste visible — centre de contrôle, bannière de notification,
    // multitâche, et surtout le sélecteur d'apps / l'alerte Temps d'écran que
    // Relock ouvre en permanence. Marquer « non focalisé » y suspend TOUS les
    // refetch, y compris `refetchInterval` : les stats se figeaient sans que
    // rien ne l'explique, et chaque retour déclenchait une salve de refetch.
    // Seul 'background' est une vraie perte de focus.
    const sub = AppState.addEventListener('change', state => {
      focusManager.setFocused(state !== 'background')
    })

    return () => {
      unsubNet()
      sub.remove()
    }
  }, [tagMaps])

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister: mmkvPersister,
        buster: 'rq-cache-v1',
        // Sans `maxAge`, react-query-persist-client réhydrate un cache vieux
        // de 24 h (son défaut) : au lancement, l'écran affichait des chiffres
        // de la veille comme s'ils étaient d'aujourd'hui, le temps du refetch.
        // Le cache persisté n'est là que pour éviter un écran vide au
        // démarrage — au-delà de sa fraîcheur utile, mieux vaut ne rien
        // réafficher qu'afficher du faux.
        maxAge: PersistenceTTL.nearRealtime,
        dehydrateOptions: {
          shouldDehydrateQuery: query => {
            const meta = query.meta
            if (PersistencePolicy.isSensitive(meta)) return false

            const profile = PersistencePolicy.getProfile(meta)

            // do not persist profiles disallowed by policy
            if (!PersistencePolicy.allowedProfiles.has(profile)) return false

            // do not persist queries with no data
            const dataUpdatedAt = query.state.dataUpdatedAt ?? 0
            if (!dataUpdatedAt) return false

            // TTL: do not write stale data
            if (!PersistencePolicy.isFreshEnough(profile, dataUpdatedAt))
              return false

            return true
          },
        } satisfies DehydrateOptions,
      }}
      onSuccess={() => {
        queryClient.resumePausedMutations().catch(() => undefined)
      }}
    >
      {children}
    </PersistQueryClientProvider>
  )
}
