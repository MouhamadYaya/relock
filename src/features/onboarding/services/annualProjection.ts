/** Representative estimates, not measurements of the user's actual usage. */
/**
 * Les tranches d'estimation. Le libellé vit dans les fichiers de langue
 * (`onboarding_survey.screen_time.<id>`) : ce tableau ne porte plus que
 * l'identifiant et la valeur retenue pour la suite du récit.
 */
export const SCREEN_TIME_ESTIMATES = [
  { id: 'lt2', hours: 1 },
  { id: '2to4', hours: 3 },
  { id: '4to6', hours: 5 },
  { id: '6to8', hours: 7 },
  { id: 'gt8', hours: 9 },
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
    // Erreur de programmation, jamais montrée : elle reste en anglais, comme
    // toutes les invariantes du code.
    throw new RangeError('Daily screen time must be between 0 and 24 hours.')
  }
  const annualDays = (hoursPerDay * DAYS_PER_YEAR) / HOURS_PER_DAY
  // Round each result only once, never halve an already rounded number of days.
  return {
    daysPerYear: Math.round(annualDays),
    recoverableDaysPerYear: Math.round(annualDays * HYPOTHETICAL_REDUCTION),
  }
}
