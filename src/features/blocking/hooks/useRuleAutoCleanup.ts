import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { BLOCKING_TAGS, blockingKeys } from '@/features/blocking/api/keys'
import { resumeExpiredSuspensions } from '@/features/blocking/services/auto-resume'
import { cleanupFinishedRules } from '@/features/blocking/services/cleanup'
import type { BlockRuleView } from '@/features/blocking/types'
import { invalidateByTags } from '@/shared/services/api/query/helpers/invalidate-by-tags'

/**
 * Remet la liste d'accord avec le temps, au montage et à chaque retour au
 * premier plan : retire les règles arrivées au bout (timer terminé, défi
 * expiré) et lève les suspensions échues. La liste ne montre donc jamais un
 * état « terminé », ni une pause d'une heure vieille de trois jours.
 *
 * Un verrou évite les passes concurrentes : sans lui, deux déclenchements
 * rapprochés tenteraient de supprimer les mêmes lignes.
 */
export function useRuleAutoCleanup(rules: BlockRuleView[]): void {
  const qc = useQueryClient()
  const busy = useRef(false)
  // Les règles changent à chaque refetch : on lit la dernière version dans le
  // handler plutôt que de re-souscrire à AppState à chaque fois.
  const latest = useRef(rules)
  latest.current = rules

  useEffect(() => {
    const run = async () => {
      if (busy.current) return
      busy.current = true
      try {
        const removed = await cleanupFinishedRules(latest.current)
        const resumed = await resumeExpiredSuspensions(latest.current)
        if (removed + resumed > 0) {
          await invalidateByTags(qc, BLOCKING_TAGS, [blockingKeys.tagMap])
        }
      } catch {
        // best effort : on réessaiera au prochain passage
      } finally {
        busy.current = false
      }
    }
    run()
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') run()
    })
    return () => sub.remove()
  }, [qc])
}
