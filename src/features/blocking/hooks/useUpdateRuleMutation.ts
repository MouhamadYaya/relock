import { useMutation, useQueryClient } from '@tanstack/react-query'
import { blockingKeys } from '@/features/blocking/api/keys'
import { BlockRulesService } from '@/features/blocking/services/block-rules/block-rules.service'
import type { BlockRuleType } from '@/shared/services/supabase/database.types'
import { normalizeError } from '@/shared/utils/normalize-error'

export interface UpdateRuleInput {
  id: string
  type: BlockRuleType
  count?: number
  config: Record<string, unknown>
}

/**
 * Modifier une règle existante — action « Modifier » de la fiche.
 *
 * La mécanique NATIVE est ré-armée par l'appelant (l'éditeur) AVANT l'écriture
 * DB : si la base refuse, on ne veut pas d'un bouclier réglé sur des valeurs
 * que personne n'a enregistrées. Le repli appartient donc à l'appelant, seul
 * à connaître la configuration native précédente — cf. `AddScreen.onSubmitEdit`,
 * qui réarme la règle d'origine quand cette mutation rejette.
 */
export function useUpdateRuleMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (vars: UpdateRuleInput) => {
      try {
        return await BlockRulesService.update(vars.id, {
          type: vars.type,
          count: vars.count,
          config: vars.config,
        })
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
