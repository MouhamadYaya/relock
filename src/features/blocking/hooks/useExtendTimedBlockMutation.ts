import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BLOCKING_TAGS, blockingKeys } from '@/features/blocking/api/keys'
import { BlockRulesService } from '@/features/blocking/services/block-rules/block-rules.service'
import type { BlockRuleView } from '@/features/blocking/types'
import { ScreenTime } from '@/shared/native/screen-time'
import { invalidateByTags } from '@/shared/services/api/query/helpers/invalidate-by-tags'
import { normalizeError } from '@/shared/utils/normalize-error'

const num = (v: unknown, d: number): number => (typeof v === 'number' ? v : d)

/**
 * « +15 min » sur un « Bloquer maintenant » en cours. `duration_min` total
 * augmente de `addMinutes` (l'origine `created_at` ne bouge pas — la fin
 * reste `created_at + duration_min`) ; le natif est ré-armé pour le temps
 * RÉELLEMENT restant jusqu'à cette nouvelle fin, pas pour `addMinutes` à
 * partir de maintenant (sinon deux appels rapprochés dériveraient au-delà
 * de la somme demandée).
 */
export function useExtendTimedBlockMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (vars: { rule: BlockRuleView; addMinutes: number }) => {
      const { rule, addMinutes } = vars
      const c = rule.config ?? {}
      const newDuration = num(c.duration_min, 30) + addMinutes
      try {
        await BlockRulesService.extendTimedBlock(rule.id, newDuration)
      } catch (e) {
        throw normalizeError(e)
      }
      // Persistée : on invalide dès maintenant, sans attendre l'issue du
      // réarmement natif ci-dessous. Sinon un échec natif fait échouer toute
      // la mutation (`onSuccess` jamais appelé) alors que la BDD a déjà la
      // nouvelle durée — l'UI resterait figée sur l'ancien décompte tant
      // qu'un autre refetch ne survient pas, en plus de rejouer la
      // conservation volontaire de l'extension déjà persistée.
      await invalidateByTags(qc, BLOCKING_TAGS, [blockingKeys.tagMap])
      if (ScreenTime.isAvailable && rule.createdAt) {
        const end = new Date(rule.createdAt).getTime() + newDuration * 60_000
        const remainingMin = Math.max(1, Math.ceil((end - Date.now()) / 60_000))
        try {
          await ScreenTime.startTimedBlock(rule.id, remainingMin, !!c.strict)
        } catch (e) {
          // Échec natif distinct : remonté à l'appelant (toast d'erreur) —
          // mais l'extension BDD reste, et l'UI la reflète déjà ci-dessus.
          throw normalizeError(e)
        }
      }
    },
    onSuccess: async () => {
      await invalidateByTags(qc, BLOCKING_TAGS, [blockingKeys.tagMap])
    },
  })
}
