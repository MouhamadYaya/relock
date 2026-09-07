import {
  dashboardState,
  durationParts,
  isHomeNewUser,
  minutesUntilTomorrow,
  scoreBand,
} from '@/features/home/services/home-dashboard'

describe('Home dashboard model', () => {
  it('distinguishes permission, loading, error and ready states', () => {
    expect(
      dashboardState({
        rulesPending: false,
        statsPending: false,
        statsError: false,
        authorization: 'denied',
      }),
    ).toBe('permissionMissing')
    expect(
      dashboardState({
        rulesPending: true,
        statsPending: false,
        statsError: false,
        authorization: 'approved',
      }),
    ).toBe('loading')
    expect(
      dashboardState({
        rulesPending: false,
        statsPending: false,
        statsError: true,
        authorization: 'approved',
      }),
    ).toBe('error')
    expect(
      dashboardState({
        rulesPending: false,
        statsPending: false,
        statsError: false,
        authorization: 'approved',
      }),
    ).toBe('ready')
  })

  it('counts down to the next local day', () => {
    expect(minutesUntilTomorrow(new Date(2026, 8, 4, 23, 30))).toBe(30)
  })

  it('splits durations for locale-aware labels', () => {
    expect(durationParts(52)).toEqual({ unit: 'minutes', minutes: 52 })
    expect(durationParts(120)).toEqual({ unit: 'hours', hours: 2 })
    expect(durationParts(148)).toEqual({
      unit: 'hoursMinutes',
      hours: 2,
      minutes: 28,
    })
  })

  it('names each score band without inventing a missing value', () => {
    expect(scoreBand(92)).toBe('excellent')
    expect(scoreBand(80)).toBe('excellent')
    expect(scoreBand(68)).toBe('good')
    expect(scoreBand(60)).toBe('good')
    expect(scoreBand(41)).toBe('fair')
    expect(scoreBand(35)).toBe('fair')
    expect(scoreBand(7)).toBe('poor')
    expect(scoreBand(0)).toBe('poor')
    expect(scoreBand(null)).toBe('unknown')
    expect(scoreBand(120)).toBe('unknown')
  })

  it('models new and active users as states of the same Home', () => {
    expect(isHomeNewUser({ rulesPending: false, sessionCount: 0 })).toBe(true)
    expect(isHomeNewUser({ rulesPending: false, sessionCount: 2 })).toBe(false)
    expect(isHomeNewUser({ rulesPending: true, sessionCount: 0 })).toBe(false)
  })
})
