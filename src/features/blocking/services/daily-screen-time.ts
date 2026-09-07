/**
 * Le temps d'écran quotidien autorisé, vu comme un réglage.
 *
 * Une règle « limite / jour » plafonne l'usage quotidien des apps qu'elle
 * protège : au-delà, iOS ferme la porte tout seul. Ce plafond se choisissait
 * jusqu'ici uniquement à la création de la règle — or c'est précisément le
 * genre de valeur qu'on veut ajuster après coup, quand on découvre que deux
 * heures c'était trop, ou pas assez.
 *
 * Ce module ne crée PAS de règle : il modifie celles qui existent. Créer un
 * blocage demande de choisir des applications, ce qui passe par le sélecteur
 * système d'Apple et n'a pas sa place dans une liste de réglages.
 */

import { armRule } from '@/features/blocking/services/arm'
import { BlockRulesService } from '@/features/blocking/services/block-rules/block-rules.service'
import type { BlockRuleView } from '@/features/blocking/types'
import { ScreenTime } from '@/shared/native/screen-time'

/** Plafonds proposés, en minutes. */
export const DAILY_LIMIT_CHOICES = [30, 60, 90, 120, 180, 240, 360] as const

const DEFAULT_LIMIT_MIN = 60

const minutesOf = (rule: BlockRuleView): number => {
  const raw = rule.config?.limit_min
  return typeof raw === 'number' ? raw : DEFAULT_LIMIT_MIN
}

/** Les règles « limite / jour » actives, seules concernées par ce réglage. */
export function dailyLimitRules(rules: BlockRuleView[]): BlockRuleView[] {
  return rules.filter(r => r.type === 'daily_limit' && r.isActive)
}

/**
 * Le plafond en vigueur : le PLUS PETIT de toutes les limites actives.
 *
 * C'est celui qui se déclenche en premier, donc celui que l'utilisateur
 * ressent. Afficher une moyenne, ou la première trouvée, décrirait un
 * quotidien qui n'est celui de personne.
 */
export function currentDailyLimit(rules: BlockRuleView[]): number | null {
  const limits = dailyLimitRules(rules).map(minutesOf)
  return limits.length > 0 ? Math.min(...limits) : null
}

/**
 * Applique un nouveau plafond à toutes les règles « limite / jour ».
 *
 * La base d'abord, la mécanique iOS ensuite : si le ré-armement échoue
 * (autorisation retirée entre-temps), la valeur reste juste côté compte et
 * `useRuleReconciler` la réarmera au prochain lancement. L'inverse — iOS à
 * jour, base périmée — donnerait un écran qui ment sur ce qui protège.
 */
export async function setDailyLimit(
  rules: BlockRuleView[],
  minutes: number,
): Promise<number> {
  const targets = dailyLimitRules(rules)
  for (const rule of targets) {
    await BlockRulesService.update(rule.id, {
      type: rule.type,
      count: rule.count,
      config: { ...rule.config, limit_min: minutes },
    })
    if (ScreenTime.isAvailable) {
      await armRule({
        ...rule,
        config: { ...rule.config, limit_min: minutes },
      }).catch(() => undefined)
    }
  }
  return targets.length
}
