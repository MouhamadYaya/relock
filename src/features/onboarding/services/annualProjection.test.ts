import {
  annualProjection,
  SCREEN_TIME_ESTIMATES,
} from '@/features/onboarding/services/annualProjection'

describe('annualProjection', () => {
  it.each([
    [1, 15, 8],
    [3, 46, 23],
    [5, 76, 38],
    [7, 106, 53],
    [9, 137, 68],
    [0, 0, 0],
    [24, 365, 183],
  ])('projects %s hours/day into 24-hour days', (hours, days, recovered) => {
    expect(annualProjection(hours)).toEqual({
      daysPerYear: days,
      recoverableDaysPerYear: recovered,
    })
  })

  it('uses the agreed representative estimates for the five choices', () => {
    expect(SCREEN_TIME_ESTIMATES.map(choice => choice.hours)).toEqual([
      1, 3, 5, 7, 9,
    ])
  })

  it.each([
    -1,
    25,
    Number.NaN,
    Number.POSITIVE_INFINITY,
  ])('rejects invalid daily usage %s', hours => {
    expect(() => annualProjection(hours)).toThrow(RangeError)
  })
})
