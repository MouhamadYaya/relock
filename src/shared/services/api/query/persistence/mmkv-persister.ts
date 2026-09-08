// 2025 — infra/query/persistence/mmkv-persister.ts
/**
 * GUIDELINE: MMKV Query Cache Persistence
 * ------------------------------------------------------------------
 * STORAGE
 *   - Use infra/storage/mmkv.ts (KeyValueStorage)
 *   - Namespace: constants.RQ_CACHE
 *
 * WHAT TO PERSIST
 *   - Only non-sensitive normalized data (no tokens/PII)
 *   - Query data + timestamps
 *   - Do NOT persist raw transport responses or errors
 *
 * TTL / LIMITS → see persistence/limits.ts
 *
 * LIFECYCLE
 *   - Hydrate on app start
 *   - Persist (coalescé, cf. ci-dessous) puis vidé au passage en arrière-plan
 *   - Clear on logout / env switch
 */

// Persists React Query cache using your kvStorage + constants.RQ_CACHE
import type { Persister } from '@tanstack/react-query-persist-client'
import { AppState } from 'react-native'
import { constants } from '@/config/constants'
import { kvStorage } from '@/shared/services/storage/mmkv'

/**
 * PERFORMANCE — pourquoi l'écriture est regroupée.
 *
 * `persistQueryClientSubscribe` appelle `persistClient` à CHAQUE événement du
 * cache — et cette version n'applique aucun étranglement. Or « événement » ne
 * veut pas dire « nouvelle donnée » : un seul aller-retour réseau en produit
 * plusieurs (début de requête, succès, bascule de `isFetching`, arrivée et
 * départ d'un observateur, invalidation). Chacun déclenchait un
 * `JSON.stringify` du cache ENTIER — l'année d'historique quotidien comprise —
 * sur le thread JS, suivi d'une écriture MMKV synchrone. C'est exactement le
 * profil d'une app « parfois lente » : rien n'est lent en soi, mais le thread
 * qui rend l'interface part sérialiser quelques centaines de kilo-octets au
 * moment précis où une requête se termine, donc où l'écran se met à jour.
 *
 * On garde donc le DERNIER état et on n'écrit qu'une fois par fenêtre. Les
 * sémantiques sont inchangées : c'est toujours l'état le plus récent qui
 * atterrit sur le disque, simplement une fois au lieu de six.
 */
const WRITE_INTERVAL_MS = 4_000

let pendingClient: unknown = null
let timer: ReturnType<typeof setTimeout> | null = null

function cancelPendingWrite(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  pendingClient = null
}

function writeNow(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  const client = pendingClient
  pendingClient = null
  if (client === null) return
  try {
    kvStorage.setString(constants.RQ_CACHE, JSON.stringify(client))
  } catch {}
}

/**
 * L'app peut être tuée en arrière-plan sans autre préavis : un état en attente
 * y serait perdu, et le cache persisté prendrait du retard sur la réalité.
 * On vide donc la file au passage en arrière-plan — le seul instant où le
 * coût de la sérialisation ne se voit pas à l'écran.
 */
AppState.addEventListener('change', state => {
  if (state === 'background') writeNow()
})

export const mmkvPersister: Persister = {
  persistClient: async client => {
    pendingClient = client
    if (timer) return
    timer = setTimeout(writeNow, WRITE_INTERVAL_MS)
  },
  restoreClient: async () => {
    try {
      const raw = kvStorage.getString(constants.RQ_CACHE)
      return raw ? JSON.parse(raw) : undefined
    } catch {
      return undefined
    }
  },
  removeClient: async () => {
    // ⚠️ L'ordre compte. Une écriture encore en attente ferait RÉAPPARAÎTRE le
    // cache qu'on vient d'effacer — celui du compte qui vient de se
    // déconnecter, sous le compte suivant.
    cancelPendingWrite()
    try {
      kvStorage.delete(constants.RQ_CACHE)
    } catch {}
  },
}
