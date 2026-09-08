import { useMemo } from 'react'
import type { BlockRuleView } from '@/features/blocking/types'
import {
  computeHomeScore,
  type ScoreDayStats,
} from '@/features/home/services/score-engine'
import type { HomeScoreSnapshot } from '@/features/home/types'
import type { DailyStats } from '@/shared/services/supabase/database.types'

interface Params {
  now: Date
  /** Journal quotidien du compte (`daily_stats`), récents en premier. */
  history: DailyStats[]
  rules: BlockRuleView[]
  /** Avancement des quotas du jour par règle (id → 0…1). */
  limitSteps: Record<string, number>
  /** Apps actuellement rouvertes par un sursis. */
  reprievedApps: number
}

/** Ne garde de `daily_stats` que ce que le score consomme. */
function toScoreDays(rows: DailyStats[]): ScoreDayStats[] {
  return rows.map(row => ({
    date: row.date,
    interceptions_count: row.interceptions_count ?? 0,
    opens_stopped: row.opens_stopped ?? 0,
    streak_respected: row.streak_respected ?? false,
  }))
}

/**
 * Le score d'Accueil, calculé sur les données réelles du compte.
 *
 * Il ne lit plus le conteneur App Group : l'extension `RelockActivityReport`
 * ne peut pas y écrire (sandbox Apple, cf. docs/ARCHITECTURE.md), si bien que
 * le score natif n'atteignait jamais le JS — la carte montrait un chiffre que
 * la feuille de détail était incapable de retrouver. Tout est désormais
 * calculé ici, à partir du journal quotidien et des règles, donc reproductible
 * et explicable au chiffre près.
 *
 * Le calcul est pur et bon marché : un `useMemo` suffit, la fraîcheur vient
 * des sources (`now` avance toutes les 30 s, React Query rafraîchit le
 * journal, les quotas sont relus à chaque retour au premier plan).
 */
export function useHomeScore({
  now,
  history,
  rules,
  limitSteps,
  reprievedApps,
}: Params): HomeScoreSnapshot {
  // `now` avance toutes les 30 s : sans ce découpage, l'année d'historique
  // était recopiée à chaque battement d'horloge alors qu'elle ne change qu'au
  // rafraîchissement du journal.
  const days = useMemo(() => toScoreDays(history), [history])

  return useMemo(
    () =>
      computeHomeScore({
        now,
        history: days,
        rules,
        limitSteps,
        reprievedApps,
      }),
    [now, days, rules, limitSteps, reprievedApps],
  )
}
