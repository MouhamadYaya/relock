/**
 * Branchement du moteur sur la vie de l'app.
 *
 * UN SEUL point de montage, dans `app/_layout.tsx`. Deux passages concurrents
 * avec des sources différentes se détruiraient l'un l'autre : la file roulante
 * est purgée puis réécrite intégralement, donc un passage sans statistiques
 * effacerait ce qu'un passage avec statistiques venait d'écrire.
 *
 * Les statistiques sont LUES DANS LE CACHE, jamais redemandées : monter
 * `useHomeStats` ici imposerait son sondage de 60 s à toute l'application, pour
 * des données que l'Accueil a déjà. Cache vide (Accueil jamais ouvert) ⇒ les
 * nœuds qui dépendent de la série sont inéligibles, ce qui est exact.
 */
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef } from 'react'
import { AppState } from 'react-native'
import { blockingKeys } from '@/features/blocking/api/keys'
import type { BlockRuleView } from '@/features/blocking/types'
import type { NotifStatsInput } from '@/features/notifications/engine/context'
import { NotificationService } from '@/features/notifications/notification.service'
import { useSessionUserId } from '@/session/useSessionUser'
import type { DailyStats } from '@/shared/services/supabase/database.types'
import { useAppGateStore } from '@/shared/stores/app-gate.store'

interface CachedStats {
  today?: DailyStats | null
  recent?: DailyStats[]
  streak?: number
  record?: number
  savedMinutesWeek?: number
}

const DAY_MS = 86_400_000

function ymdLocal(at: number): string {
  const d = new Date(at)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

function toStatsInput(
  cached: CachedStats | undefined,
  now: number,
): NotifStatsInput | null {
  if (!cached) return null
  const recent = cached.recent ?? []
  const yesterday = ymdLocal(now - DAY_MS)
  return {
    streak: cached.streak ?? 0,
    record: cached.record ?? 0,
    resisted: cached.today?.opens_stopped ?? 0,
    savedMinutesWeek: cached.savedMinutesWeek ?? 0,
    recentRespectedYesterday: recent.some(
      row => row.date === yesterday && row.streak_respected === true,
    ),
    resistedTotal: recent.reduce(
      (sum, row) => sum + (row.opens_stopped ?? 0),
      0,
    ),
  }
}

export function useNotificationEngine(enabled: boolean): void {
  const queryClient = useQueryClient()
  const userId = useSessionUserId()
  const entitled = useAppGateStore(state => state.entitled)
  // Un passage à la fois : le moteur écrit dans MMKV et dans iOS, deux
  // exécutions entrelacées produiraient un état incohérent sans erreur visible.
  const running = useRef(false)

  const run = useCallback(
    async (userActive: boolean): Promise<void> => {
      if (!enabled || running.current) return
      running.current = true
      try {
        const now = Date.now()
        const rules = queryClient.getQueryData<BlockRuleView[]>([
          ...blockingKeys.rules(),
          userId ?? 'anon',
        ])
        const stats = queryClient.getQueryData<CachedStats>([
          'stats',
          'home',
          userId ?? 'anon',
        ])
        await NotificationService.run({
          now,
          userActive,
          rules: rules ?? null,
          stats: toStatsInput(stats, now),
          entitled,
        })
      } catch {
        // Le moteur est un confort, jamais un chemin critique : une panne ici
        // ne doit pas empêcher l'app de démarrer ni de fonctionner.
      } finally {
        running.current = false
      }
    },
    [enabled, entitled, queryClient, userId],
  )

  useEffect(() => {
    if (!enabled) return
    NotificationService.noteOpen()
    void run(true)

    const subscription = AppState.addEventListener('change', status => {
      if (status === 'active') {
        // Un retour au premier plan EST une ouverture : c'est ce qui repousse
        // les ancres d'absence, et donc ce qui évite d'écrire à quelqu'un qui
        // vient tout juste d'utiliser l'app.
        NotificationService.noteOpen()
        void run(true)
        return
      }
      // L'app part en arrière-plan : c'est le moment où « l'utilisateur est
      // présent » cesse d'être vrai, et où les intentions adaptatives doivent
      // pouvoir redevenir des notifications.
      if (status === 'background') void run(false)
    })
    return () => subscription.remove()
  }, [enabled, run])
}
