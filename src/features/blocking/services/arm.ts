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
