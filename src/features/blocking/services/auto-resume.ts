/**
 * Une suspension à durée déterminée doit se lever TOUTE SEULE : la carte
 * promet « Reprend à 15:00 » — sans ça, une pause d'une heure durerait pour
 * toujours et l'utilisateur se retrouverait sans protection sans l'avoir voulu.
 *
 * iOS reprend de son côté (réveil DeviceActivity « resume.<id> », app fermée).
 * Ici on remet la base d'accord avec lui au retour dans l'app : sinon la liste
 * afficherait « suspendue » pendant qu'iOS bloque déjà.
 */

import { armRule } from '@/features/blocking/services/arm'
import { BlockRulesService } from '@/features/blocking/services/block-rules/block-rules.service'
import { isFinished, suspendedUntil } from '@/features/blocking/session'
import type { BlockRuleView } from '@/features/blocking/types'
import { ScreenTime } from '@/shared/native/screen-time'

/** Retourne le nombre de suspensions levées (0 = rien à faire, cas courant). */
export async function resumeExpiredSuspensions(
  rules: BlockRuleView[],
  now = new Date(),
): Promise<number> {
  const due = rules.filter(r => {
    if (r.isActive || isFinished(r, now)) return false
    const until = suspendedUntil(r)
    // null ⇒ « jusqu'à ce que tu reprennes » : jamais levée d'office.
    return until !== null && until <= now
  })

  for (const rule of due) {
    if (ScreenTime.isAvailable) {
      // Ré-armer d'abord (idempotent, le masque tient encore), puis le lever :
      // dans l'autre ordre, le bouclier reviendrait avant sa surveillance.
      await armRule(rule).catch(() => {})
      await ScreenTime.resumeRule(rule.id).catch(() => {})
    }
    await BlockRulesService.resume(rule.id)
  }
  return due.length
}
