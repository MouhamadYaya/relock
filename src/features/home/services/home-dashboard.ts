import type { HomeDashboardState, HomeScoreBand } from '@/features/home/types'
import type { ScreenTimeAuthorizationState } from '@/shared/native/useScreenTimeAuth'

function validScore(value: number | null | undefined): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100
  )
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
  authorization: ScreenTimeAuthorizationState
}): HomeDashboardState {
  // `denied` et `notDetermined` sont deux histoires différentes (l'une a une
  // fenêtre système à rouvrir, l'autre non), mais l'Accueil montre la même
  // chose des deux : il n'y a pas d'autorisation, donc rien ne bloque. La
  // distinction se joue au moment du geste, dans `requireScreenTime`.
  if (authorization === 'denied' || authorization === 'notDetermined')
    return 'permissionMissing'
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
