import { useMutation, useQueryClient } from '@tanstack/react-query'
import { blockingKeys } from '@/features/blocking/api/keys'
import { BlockRulesService } from '@/features/blocking/services/block-rules/block-rules.service'
import { normalizeError } from '@/shared/utils/normalize-error'

/** Suppression définitive d'une règle — action « Arrêter le blocage ». */
export function useDeleteRuleMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (vars: { id: string }) => {
      try {
        return await BlockRulesService.remove(vars.id)
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
