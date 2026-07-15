import { useMutation, useQueryClient } from '@tanstack/react-query'
import { BLOCKING_TAGS, blockingKeys } from '@/features/blocking/api/keys'
import { BlockRulesService } from '@/features/blocking/services/block-rules/block-rules.service'
import type { CreateRuleInput } from '@/features/blocking/types'
import { invalidateByTags } from '@/shared/services/api/query/helpers/invalidate-by-tags'
import { normalizeError } from '@/shared/utils/normalize-error'

export function useCreateRuleMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateRuleInput) => {
      try {
        return await BlockRulesService.create(input)
      } catch (e) {
        throw normalizeError(e)
      }
    },
    onSuccess: async () => {
      await invalidateByTags(qc, BLOCKING_TAGS, [blockingKeys.tagMap])
      // La série / le heartbeat dépendent des règles actives → rafraîchir.
      await qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
