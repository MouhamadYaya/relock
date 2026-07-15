import { useQuery } from '@tanstack/react-query'
import {
  computeRecordStreak,
  computeStreak,
  computeWeek,
  StatsService,
} from '@/features/blocking/services/stats/stats.service'

/** Stats réelles de l'Accueil : synchronise depuis l'extension puis lit Supabase. */
export function useHomeStats() {
  const query = useQuery({
    queryKey: ['stats', 'home'],
    queryFn: async () => {
      // Remonte les nouveaux événements de l'extension (best effort) et
      // marque « jour de contrôle » si au moins un blocage est actif.
      await StatsService.syncFromDevice().catch(() => {})
      await StatsService.heartbeatToday().catch(() => {})
      const [today, recent] = await Promise.all([
        StatsService.today(),
        StatsService.recent(365),
      ])
      return {
        today,
        recent,
        streak: computeStreak(recent),
        record: computeRecordStreak(recent),
        week: computeWeek(recent),
      }
    },
    // L'Accueil est LE tableau de bord : après une résistance (« Fermer » sur
    // le bouclier), l'utilisateur revient souvent dans la minute. Avec le
    // staleTime standard (60 s), le retour au premier plan ne rejouait PAS la
    // synchro → compteurs figés à leur ancienne valeur. Ici : re-sync dès
    // 5 s de staleness + filet périodique tant que l'écran est ouvert.
    staleTime: 5_000,
    gcTime: 5 * 60_000,
    refetchInterval: 60_000,
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
