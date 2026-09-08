import { annualProjection } from '@/features/onboarding/services/annualProjection'
import { translate } from '@/i18n/translate'

const ANNUAL_GOAL_FLOOR = 33

/** An aspirational cap, never a replacement for the measured/estimated usage. */
export function recoveryGoal(hoursPerDay: number) {
  const days = Math.max(
    ANNUAL_GOAL_FLOOR,
    annualProjection(hoursPerDay).recoverableDaysPerYear,
  )
  const minutes = Math.round((days * 24 * 60) / 365)
  const dailyTime = translate('blocking.duration.hours_minutes', {
    hours: Math.floor(minutes / 60),
    minutes: String(minutes % 60).padStart(2, '0'),
  })
  return {
    days,
    dailyTime,
    exceedsUsage: minutes > hoursPerDay * 60,
    note: translate('onboarding_plan_actions.goal_note', { time: dailyTime }),
  }
}
