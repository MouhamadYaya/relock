import { useMutation, useQueryClient } from '@tanstack/react-query'
import { blockingKeys } from '@/features/blocking/api/keys'
import { BlockRulesService } from '@/features/blocking/services/block-rules/block-rules.service'
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
      // Invalidation par PRÉFIXE : les clés se terminent par l'id utilisateur
      // (['blocking','rules',<uid>]), qu'un tag exact ne matcherait pas.
      await qc.invalidateQueries({ queryKey: blockingKeys.prefixes.all() })
      await qc.invalidateQueries({ queryKey: ['stats'] })
    },
  })
}
