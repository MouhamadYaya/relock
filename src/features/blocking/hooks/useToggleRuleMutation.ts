import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BLOCKING_TAGS, blockingKeys } from '@/features/blocking/api/keys'
import { BlockRulesService } from '@/features/blocking/services/block-rules/block-rules.service'
import { invalidateByTags } from '@/shared/services/api/query/helpers/invalidate-by-tags'
import { normalizeError } from '@/shared/utils/normalize-error'

export function useToggleRuleMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (vars: { id: string; isActive: boolean }) => {
      try {
        return await BlockRulesService.setActive(vars.id, vars.isActive)
      } catch (e) {
        throw normalizeError(e)
      }
    },
    onSuccess: async () => {
      await invalidateByTags(qc, BLOCKING_TAGS, [blockingKeys.tagMap])
      await qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
