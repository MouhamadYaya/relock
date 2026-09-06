import { annualProjection } from '@/features/onboarding/services/annualProjection'

const ANNUAL_GOAL_FLOOR = 33

/** An aspirational cap, never a replacement for the measured/estimated usage. */
export function recoveryGoal(hoursPerDay: number) {
  const days = Math.max(
    ANNUAL_GOAL_FLOOR,
    annualProjection(hoursPerDay).recoverableDaysPerYear,
  )
  const minutes = Math.round((days * 24 * 60) / 365)
  const dailyTime = `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
  return {
    days,
    dailyTime,
    exceedsUsage: minutes > hoursPerDay * 60,
    note: `≈ ${dailyTime}/jour en moins. Un objectif à adapter à ton usage, pas un gain garanti.`,
  }
}
