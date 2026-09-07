/**
 * Allume pour de vrai les règles choisies pendant le tutoriel.
 *
 * Même séquence que `PresetRecapScreen` — id client d'abord, sélection liée,
 * mécanique native armée, ligne DB ensuite, et désarmement si l'insert
 * échoue : un blocage armé côté iOS que l'app ne connaît pas serait invisible
 * dans l'onglet Blocages, donc impossible à retirer.
 *
 * ⚠️ Une différence assumée avec `PresetRecapScreen`, qui refuse d'hériter
 * d'une sélection précédente : ici l'utilisateur vient de choisir ses apps
 * DEUX ÉCRANS plus tôt, dans le même parcours. `bindSelection` recopie le
 * brouillon global du sélecteur dans la règle — c'est exactement la sélection
 * qu'il vient de faire, pas celle d'une autre règle. Ne pas « corriger » ceci
 * en rajoutant un passage par le sélecteur : il aurait à le refaire deux fois.
 */
import { useCallback } from 'react'
import { useCreateRuleMutation } from '@/features/blocking/hooks/useCreateRuleMutation'
import { findPreset } from '@/features/blocking/presets'
import { armRule } from '@/features/blocking/services/arm'
import type { BlockRuleView } from '@/features/blocking/types'
import { nativeKindOf, ScreenTime } from '@/shared/native/screen-time'
import { genUUID } from '@/shared/utils/uuid'

export interface ActivateFirstRuleInput {
  /**
   * Ids des préréglages cochés dans le carrousel final. Armés un par un, dans
   * l'ordre : `bindSelection` recopie le brouillon du sélecteur dans CHAQUE
   * règle, donc les deux partent avec la même liste d'apps — celle qu'il vient
   * de choisir. Une erreur sur l'une n'annule pas les précédentes ; elle
   * remonte pour être affichée, l'app garde ce qui a réussi.
   */
  presetIds: string[]
  /** Nombre d'éléments retournés par le sélecteur d'Apple. */
  count: number
}

export function useActivateFirstRule() {
  const createRule = useCreateRuleMutation()

  return useCallback(
    async (input: ActivateFirstRuleInput): Promise<void> => {
      for (const presetId of input.presetIds) {
        const preset = findPreset(presetId)
        if (!preset) throw new Error('Préréglage introuvable')

        // Aucun `strict` posé ici : les premières règles naissent SOUPLES.
        // L'écran « Hard Mode » du tutoriel est une vitrine (voir
        // `SceneHardMode`) — il annonce la fonctionnalité, il ne l'arme pas.
        // Le verrou se demande dans l'app, blocage par blocage, derrière
        // `StrictCommitmentSheet`.
        const config: Record<string, unknown> = { ...preset.config }
        const id = genUUID()
        let armed = false

        try {
          if (ScreenTime.isAvailable) {
            const auth = await ScreenTime.authorizationStatus()
            if (auth !== 'approved') {
              throw new Error('Autorisation Temps d’écran manquante')
            }
            await ScreenTime.bindSelection(id)
            await armRule({ id, type: preset.type, config } as BlockRuleView)
            armed = true
          }
          await createRule.mutateAsync({
            id,
            type: preset.type,
            appIds: [],
            count: input.count,
            config,
          })
        } catch (e) {
          if (armed) {
            await ScreenTime.clearRuleData(id, nativeKindOf(preset.type)).catch(
              () => {},
            )
          }
          throw e
        }
      }
    },
    [createRule],
  )
}
