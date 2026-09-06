import type {
  HomeDashboardState,
  HomeScoreBand,
  HomeScores,
} from '@/features/home/types'

function validScore(value: number | null | undefined): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  )
}

/**
 * The global score has one public rule: it is the rounded arithmetic mean of
 * validated Focus and Rest scores. Missing inputs stay missing; Home must never
 * manufacture a score from unrelated telemetry.
 */
export function globalScore(
  focus: number | null | undefined,
  rest: number | null | undefined,
): number | null {
  if (!validScore(focus) || !validScore(rest)) return null
  return Math.round((focus + rest) / 2)
}

export function homeScores(
  focus: number | null | undefined,
  rest: number | null | undefined,
): HomeScores {
  const global = globalScore(focus, rest)
  return {
    focus: validScore(focus) ? focus : null,
    rest: validScore(rest) ? rest : null,
    global,
    available: global !== null,
  }
}

/**
 * Palier qualitatif d'un score. Purement descriptif : il nomme la valeur
 * affichée, il ne la recalcule pas et n'invente rien quand elle manque.
 */
export function scoreBand(value: number | null | undefined): HomeScoreBand {
  if (!validScore(value)) return 'unknown'
  if (value >= 80) return 'excellent'
  if (value >= 60) return 'good'
  if (value >= 35) return 'fair'
  return 'poor'
}

export function dashboardState({
  rulesPending,
  statsPending,
  statsError,
  authorization,
}: {
  rulesPending: boolean
  statsPending: boolean
  statsError: boolean
  authorization: 'checking' | 'approved' | 'denied' | 'unavailable' | 'error'
}): HomeDashboardState {
  if (authorization === 'denied') return 'permissionMissing'
  if (authorization === 'unavailable') return 'unavailable'
  if (authorization === 'error' || statsError) return 'error'
  if (authorization === 'checking' || rulesPending || statsPending)
    return 'loading'
  return 'ready'
}

export function minutesUntilTomorrow(now: Date): number {
  const tomorrow = new Date(now)
  tomorrow.setHours(24, 0, 0, 0)
  return Math.max(0, Math.ceil((tomorrow.getTime() - now.getTime()) / 60_000))
}

export type HomeDurationParts =
  | { unit: 'minutes'; minutes: number }
  | { unit: 'hours'; hours: number }
  | { unit: 'hoursMinutes'; hours: number; minutes: number }

/** Splits a duration for locale-aware rendering by the caller. */
export function durationParts(minutes: number): HomeDurationParts {
  const safe = Math.max(0, Math.round(minutes))
  const hours = Math.floor(safe / 60)
  const rest = safe % 60
  if (hours === 0) return { unit: 'minutes', minutes: rest }
  if (rest === 0) return { unit: 'hours', hours }
  return { unit: 'hoursMinutes', hours, minutes: rest }
}

export function isHomeNewUser({
  rulesPending,
  sessionCount,
}: {
  rulesPending: boolean
  sessionCount: number
}): boolean {
  return !rulesPending && sessionCount === 0
}
