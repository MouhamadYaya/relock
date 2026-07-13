import { useQuery } from '@tanstack/react-query'
import {
  computeRecordStreak,
  computeStreak,
  computeWeek,
  StatsService,
} from '@/features/blocking/services/stats/stats.service'
import { Freshness } from '@/shared/services/api/query/policy/freshness'

/** Stats réelles de l'Accueil : synchronise depuis l'extension puis lit Supabase. */
export function useHomeStats() {
  const query = useQuery({
    queryKey: ['stats', 'home'],
    queryFn: async () => {
      // Remonte d'abord les nouveaux événements de l'extension (best effort).
      await StatsService.syncFromDevice().catch(() => {})
      const [today, recent] = await Promise.all([
        StatsService.today(),
        StatsService.recent(30),
      ])
      return {
        today,
        recent,
        streak: computeStreak(recent),
        record: computeRecordStreak(recent),
        week: computeWeek(recent),
      }
    },
    staleTime: Freshness.nearRealtime.staleTime,
    gcTime: Freshness.nearRealtime.gcTime,
    refetchOnWindowFocus: true,
  })

  return {
    resisted: query.data?.today?.opens_stopped ?? 0,
    interceptions: query.data?.today?.interceptions_count ?? 0,
    savedMinutes: query.data?.today?.time_saved_minutes ?? 0,
    streak: query.data?.streak ?? 0,
    record: query.data?.record ?? 0,
    week: query.data?.week ?? computeWeek([]),
    recent: query.data?.recent ?? [],
    isLoading: query.isLoading,
  }
}
