/**
 * Auto-suppression (§2) — deux cas, et seulement deux :
 *  • un TIMER terminé : éphémère, il a accompli sa mission ;
 *  • une règle dont la DURÉE DE VIE a expiré : le défi est allé au bout.
 *
 * ⚠️ Une règle récurrente « toujours » n'est JAMAIS supprimée d'office : c'est
 * une règle, pas un événement. On ne réinitialise rien toutes les 24 h.
 */

import { BlockRulesService } from '@/features/blocking/services/block-rules/block-rules.service'
import {
  isFinished,
  lifetimeDays,
  ruleTitle,
} from '@/features/blocking/session'
import type { BlockRuleView } from '@/features/blocking/types'
import { getNotifPrefs } from '@/features/notifications/prefs'
import { Notif } from '@/shared/native/notifications'
import { nativeKindOf, ScreenTime } from '@/shared/native/screen-time'

/** Félicite quand un DÉFI est allé au bout (jamais pour un simple timer). */
function congratulate(rule: BlockRuleView): void {
  const days = lifetimeDays(rule)
  if (!days) return
  const p = getNotifPrefs()
  if (!p.master || !p.progression) return
  Notif.schedule(
    `relock.challenge.${rule.id}`,
    Math.floor(Date.now() / 1000) + 2,
    `${days} jours tenus`,
    `« ${ruleTitle(rule)} » est allée au bout. Tu as tenu ${days} jours — c'est toi qui mènes.`,
  ).catch(() => {})
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
