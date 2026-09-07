/**
 * Déblocage d'urgence — la sortie de secours.
 *
 * POURQUOI ELLE EXISTE
 * Tout le produit est bâti pour rendre l'arrêt d'un blocage difficile : mode
 * strict, rituel de respiration, délais. C'est ce qui le rend efficace. Mais
 * une protection qu'on ne peut PAS lever devient un piège le jour où la vraie
 * vie l'exige — un entretien, une urgence médicale, un vol à prendre avec
 * l'app de la compagnie bloquée par catégorie. Une app qui prend en otage le
 * téléphone de quelqu'un n'est plus un outil.
 *
 * CE QU'ELLE FAIT
 * Elle court-circuite TOUT : ni rituel, ni délai, ni mode strict. Elle
 * supprime les règles et lève le bouclier, immédiatement.
 *
 * POURQUOI ELLE SUPPRIME AU LIEU DE SUSPENDRE
 * Une simple suspension serait ré-armée au prochain lancement par
 * `useRuleReconciler`, qui ré-arme toute règle persistante encore `isActive`.
 * L'utilisateur croirait être libéré et retrouverait ses murs quelques
 * minutes plus tard, sans comprendre pourquoi. Une sortie de secours qui ne
 * tient pas est pire que pas de sortie du tout.
 *
 * C'est aussi ce qui en fait une action à confirmer explicitement : elle
 * coûte la configuration, et c'est le prix qui la garde exceptionnelle.
 */

import { BlockRulesService } from '@/features/blocking/services/block-rules/block-rules.service'
import type { BlockRuleView } from '@/features/blocking/types'
import { nativeKindOf, ScreenTime } from '@/shared/native/screen-time'

export interface EmergencyUnlockResult {
  /** Règles supprimées. */
  removed: number
  /** Règles dont la suppression a échoué (réseau coupé, par exemple). */
  failed: number
}

/**
 * Lève tout, maintenant.
 *
 * L'ordre compte : on désarme d'abord côté iOS, ensuite seulement on efface
 * côté base. Une panne réseau au milieu laisse alors l'utilisateur DÉBLOQUÉ
 * avec des règles orphelines — l'inverse le laisserait bloqué sans plus aucun
 * moyen de lever le blocage depuis l'app.
 */
export async function emergencyUnlock(
  rules: BlockRuleView[],
): Promise<EmergencyUnlockResult> {
  if (ScreenTime.isAvailable) {
    for (const rule of rules) {
      await ScreenTime.clearRuleData(rule.id, nativeKindOf(rule.type)).catch(
        () => undefined,
      )
    }
    // Coup de balai final : purge les fenêtres actives et les surveillances
    // qu'aucune règle connue ne réclamait plus (résidus d'une règle supprimée
    // hors ligne, d'une réinstallation, d'un plantage). C'est lui qui garantit
    // qu'il ne reste RIEN, y compris la restriction de désinstallation.
    await ScreenTime.stopBlocking().catch(() => undefined)
  }

  let removed = 0
  let failed = 0
  for (const rule of rules) {
    try {
      await BlockRulesService.remove(rule.id)
      removed += 1
    } catch {
      // Compté, jamais avalé : l'écran doit pouvoir dire que la libération
      // côté iPhone a bien eu lieu mais que le compte n'est pas encore à jour.
      failed += 1
    }
  }
  return { removed, failed }
}
