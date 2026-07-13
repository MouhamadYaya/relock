import type { BlockRuleView } from '@/features/blocking/types'
import { ScreenTime } from '@/shared/native/screen-time'

const n = (v: unknown, d = 0): number => (typeof v === 'number' ? v : d)

/** (Ré)arme la mécanique native d'une règle depuis son type + config. */
export async function armRule(rule: BlockRuleView): Promise<void> {
  const c = rule.config ?? {}
  if (rule.type === 'schedule') {
    await ScreenTime.startSchedule(
      n(c.start_hour),
      n(c.start_minute),
      n(c.end_hour),
      n(c.end_minute),
    )
  } else if (rule.type === 'daily_limit') {
    await ScreenTime.startDailyLimit(n(c.limit_min, 60))
  } else {
    await ScreenTime.startTimedBlock(n(c.duration_min, 30), !!c.strict)
  }
}
