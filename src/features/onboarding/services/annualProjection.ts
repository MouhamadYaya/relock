/** Representative estimates, not measurements of the user's actual usage. */
export const SCREEN_TIME_ESTIMATES = [
  { id: 'lt2', label: 'Moins de 2 heures', hours: 1 },
  { id: '2to4', label: '2 à 4 heures', hours: 3 },
  { id: '4to6', label: '4 à 6 heures', hours: 5 },
  { id: '6to8', label: '6 à 8 heures', hours: 7 },
  { id: 'gt8', label: 'Plus de 8 heures', hours: 9 },
] as const

const DAYS_PER_YEAR = 365
const HOURS_PER_DAY = 24
const HYPOTHETICAL_REDUCTION = 0.5

export function annualProjection(hoursPerDay: number) {
  if (
    !Number.isFinite(hoursPerDay) ||
    hoursPerDay < 0 ||
    hoursPerDay > HOURS_PER_DAY
  ) {
    throw new RangeError(
      'Le temps quotidien doit être compris entre 0 et 24 heures.',
    )
  }
  const annualDays = (hoursPerDay * DAYS_PER_YEAR) / HOURS_PER_DAY
  // Round each result only once, never halve an already rounded number of days.
  return {
    daysPerYear: Math.round(annualDays),
    recoverableDaysPerYear: Math.round(annualDays * HYPOTHETICAL_REDUCTION),
  }
}
