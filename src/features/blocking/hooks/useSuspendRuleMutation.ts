import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BLOCKING_TAGS, blockingKeys } from '@/features/blocking/api/keys'
import { armRule } from '@/features/blocking/services/arm'
import { BlockRulesService } from '@/features/blocking/services/block-rules/block-rules.service'
import type { BlockRuleView } from '@/features/blocking/types'
import { ScreenTime } from '@/shared/native/screen-time'
import { invalidateByTags } from '@/shared/services/api/query/helpers/invalidate-by-tags'
import { normalizeError } from '@/shared/utils/normalize-error'

/**
 * Suspendre / reprendre une protection — la règle est TOUJOURS conservée.
 * Le natif MASQUE le bouclier sans arrêter la surveillance : à échéance, iOS
 * lève le masque tout seul (app fermée) et la protection revient.
 * Une suspension n'est jamais une suppression.
 */
export function useSuspendRuleMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (vars: { rule: BlockRuleView; until: Date | null }) => {
      try {
        if (ScreenTime.isAvailable) {
          await ScreenTime.suspendRule(
            vars.rule.id,
            // 0 ⇒ « jusqu'à ce que tu reprennes » : aucun réveil programmé.
            vars.until ? Math.floor(vars.until.getTime() / 1000) : 0,
          )
        }
        return await BlockRulesService.suspend(vars.rule.id, vars.until)
      } catch (e) {
        throw normalizeError(e)
      }
    },
    onSuccess: async () => {
      await invalidateByTags(qc, BLOCKING_TAGS, [blockingKeys.tagMap])
    },
  })
}

export function useResumeRuleMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (vars: { rule: BlockRuleView }) => {
      try {
        if (ScreenTime.isAvailable) {
          await armRule(vars.rule)
          await ScreenTime.resumeRule(vars.rule.id)
        }
        return await BlockRulesService.resume(vars.rule.id)
      } catch (e) {
        throw normalizeError(e)
      }
    },
    onSuccess: async () => {
      await invalidateByTags(qc, BLOCKING_TAGS, [blockingKeys.tagMap])
    },
  })
}
