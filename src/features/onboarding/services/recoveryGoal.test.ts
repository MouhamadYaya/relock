import { annualProjection } from '@/features/onboarding/services/annualProjection'
import { recoveryGoal } from '@/features/onboarding/services/recoveryGoal'

describe('annual recovery goal', () => {
  it.each([
    [1, 33],
    [3, 33],
    [5, 38],
    [7, 53],
    [9, 68],
  ])('uses an explicit goal for %s hours/day', (hours, days) => {
    expect(recoveryGoal(hours).days).toBe(days)
    expect(recoveryGoal(hours).note).toContain('pas un gain garanti')
  })
  it('does not inflate the actual projection or disguise an unreachable goal', () => {
    expect(annualProjection(1).recoverableDaysPerYear).toBe(8)
    expect(recoveryGoal(1)).toMatchObject({
      days: 33,
      dailyTime: '2 h 10',
      exceedsUsage: true,
    })
    expect(recoveryGoal(5).exceedsUsage).toBe(false)
  })
})
