/**
 * Auto-suppression (§2) — deux cas, et seulement deux :
 *  • un TIMER terminé : éphémère, il a accompli sa mission ;
 *  • une règle dont la DURÉE DE VIE a expiré : le défi est allé au bout.
 *
 * ⚠️ Une règle récurrente « toujours » n'est JAMAIS supprimée d'office : c'est
 * une règle, pas un événement. On ne réinitialise rien toutes les 24 h.
 */

import { BlockRulesService } from '@/features/blocking/services/block-rules/block-rules.service'
import { isFinished, lifetimeDays } from '@/features/blocking/session'
import type { BlockRuleView } from '@/features/blocking/types'
import { noteChallengeCompleted } from '@/features/notifications/engine/signals'
import { NotificationService } from '@/features/notifications/notification.service'
import { nativeKindOf, ScreenTime } from '@/shared/native/screen-time'

/**
 * Félicite quand un DÉFI est allé au bout (jamais pour un simple timer).
 *
 * On dépose un SIGNAL, on n'envoie pas la notification ici : une félicitation
 * doit respecter le canal, les heures calmes et le budget comme n'importe quel
 * autre message. La version précédente écrivait directement dans iOS, en
 * français codé en dur — donc impossible à éteindre depuis les Réglages, alors
 * même que l'écran affichait un interrupteur qui prétendait le faire.
 */
function congratulate(rule: BlockRuleView): void {
  const days = lifetimeDays(rule)
  if (!days) return
  noteChallengeCompleted(Date.now(), days)
  NotificationService.runFromLastKnown().catch(() => {})
}

/**
 * Supprime les règles arrivées au bout (DB + mécanique native).
 * Retourne le nombre de règles retirées (0 = rien à faire, cas courant).
 */
export async function cleanupFinishedRules(
  rules: BlockRuleView[],
  now = new Date(),
): Promise<number> {
  const finished = rules.filter(r => isFinished(r, now))
  for (const rule of finished) {
    if (ScreenTime.isAvailable) {
      await ScreenTime.clearRuleData(rule.id, nativeKindOf(rule.type)).catch(
        () => {},
      )
    }
    await BlockRulesService.remove(rule.id)
    congratulate(rule)
  }
  return finished.length
}
