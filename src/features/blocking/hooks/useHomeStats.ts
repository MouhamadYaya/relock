import { useQuery } from '@tanstack/react-query'
import {
  computeRecordStreak,
  computeStreak,
  computeWeek,
  StatsService,
} from '@/features/blocking/services/stats/stats.service'
import { useSessionUserId } from '@/session/useSessionUser'

/** Stats réelles de l'Accueil : synchronise depuis l'extension puis lit Supabase. */
export function useHomeStats() {
  const userId = useSessionUserId()
  const query = useQuery({
    // La clé porte l'utilisateur : le cache persisté d'un compte ne peut pas
    // être réaffiché sous un autre.
    queryKey: ['stats', 'home', userId ?? 'anon'],
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
    // Sans session, RLS renvoie du VIDE sans erreur : interroger Supabase
    // maintenant mettrait en cache (et persisterait) de faux zéros. On attend.
    enabled: !!userId,
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

  const data = query.data
  return {
    resisted: data?.today?.opens_stopped ?? 0,
    interceptions: data?.today?.interceptions_count ?? 0,
    savedMinutes: data?.today?.time_saved_minutes ?? 0,
    streak: data?.streak ?? 0,
    record: data?.record ?? 0,
    week: data?.week ?? computeWeek([]),
    recent: data?.recent ?? [],
    /**
     * Vrai tant qu'aucune donnée n'est disponible (session non encore ouverte
     * ou premier chargement). Les écrans DOIVENT s'en servir : sans lui, les
     * `?? 0` ci-dessus rendent un chargement ou une panne réseau exactement
     * comme une journée réellement vide.
     */
    isPending: !data,
    isError: query.isError,
  }
}
