import { ruleDays } from '@/features/blocking/session'
import type { BlockRuleView } from '@/features/blocking/types'
import { ScreenTime } from '@/shared/native/screen-time'

const n = (v: unknown, d = 0): number => (typeof v === 'number' ? v : d)

/**
 * (Ré)arme la mécanique native d'une règle depuis son type + config.
 * La sélection d'apps de la règle doit avoir été liée à la création
 * (`ScreenTime.bindSelection`) — le natif la retrouve par `rule.id`.
 */
export async function armRule(rule: BlockRuleView): Promise<void> {
  const c = rule.config ?? {}
  if (rule.type === 'schedule') {
    await ScreenTime.startSchedule(
      rule.id,
      n(c.start_hour),
      n(c.start_minute),
      n(c.end_hour),
      n(c.end_minute),
      ruleDays(rule) ?? [],
    )
  } else if (rule.type === 'daily_limit') {
    await ScreenTime.startDailyLimit(rule.id, n(c.limit_min, 60))
  } else {
    await ScreenTime.startTimedBlock(rule.id, n(c.duration_min, 30), !!c.strict)
  }
}

/**
 * Ré-arme une règle SAUF si sa mécanique tourne déjà côté iOS.
 *
 * À réserver aux chemins de simple reprise (fin de pause), où le seul but est
 * de réparer une surveillance perdue. Une limite de temps compte à partir de
 * son armement le jour de sa création : la ré-armer ce jour-là rendrait à
 * l'utilisateur le quota qu'il vient de consommer — il suffirait de mettre en
 * pause et de reprendre pour effacer sa matinée.
 *
 * Les autres types n'ont pas ce défaut, mais le garde ne coûte rien : une
 * plage horaire déjà armée n'a rien à réapprendre non plus.
 */
export async function armRuleIfNeeded(rule: BlockRuleView): Promise<void> {
  const armed = await ScreenTime.armedActivities().catch(() => [] as string[])
  if (armed.some(name => name.endsWith(`.${rule.id}`))) return
  await armRule(rule)
}
