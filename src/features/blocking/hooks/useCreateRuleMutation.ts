import { useMutation, useQueryClient } from '@tanstack/react-query'
import { blockingKeys } from '@/features/blocking/api/keys'
import { BlockRulesService } from '@/features/blocking/services/block-rules/block-rules.service'
import type { CreateRuleInput } from '@/features/blocking/types'
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
      // Invalidation par PRÉFIXE : les clés se terminent par l'id utilisateur
      // (['blocking','rules',<uid>]), qu'un tag exact ne matcherait pas.
      await qc.invalidateQueries({ queryKey: blockingKeys.prefixes.all() })
      // La série / le heartbeat dépendent des règles actives → rafraîchir.
      await qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
