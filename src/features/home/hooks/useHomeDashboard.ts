import { useFocusEffect } from '@react-navigation/native'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { AppState } from 'react-native'
import { useBlockedApps } from '@/features/blocking/hooks/useBlockedApps'
import { useBlockRulesQuery } from '@/features/blocking/hooks/useBlockRulesQuery'
import { useFreshInstallReset } from '@/features/blocking/hooks/useFreshInstallReset'
import { useHomeStats } from '@/features/blocking/hooks/useHomeStats'
import { useLimitSteps } from '@/features/blocking/hooks/useLimitSteps'
import { useRuleAutoCleanup } from '@/features/blocking/hooks/useRuleAutoCleanup'
import { useRuleReconciler } from '@/features/blocking/hooks/useRuleReconciler'
import { buildSessions } from '@/features/blocking/session'
import { useHomeScore } from '@/features/home/hooks/useHomeScore'
import {
  dashboardState,
  isHomeNewUser,
  minutesUntilTomorrow,
} from '@/features/home/services/home-dashboard'
import { buildHomeMyApps } from '@/features/home/services/home-my-apps'
import { referenceMyApps } from '@/features/home/services/home-reference-my-apps'
import {
  fixtureSnapshot,
  toHomeScores,
} from '@/features/home/services/home-score'
import { useNotificationReconciler } from '@/features/notifications/useNotificationReconciler'
import {
  type HomeReferenceFixture,
  ScreenTime,
} from '@/shared/native/screen-time'
import { useScreenTimeAuthorization } from '@/shared/native/useScreenTimeAuth'

/**
 * Single source of truth for Home. It combines only data the app can prove:
 * persisted rules, the native blocking authority and synced shield events.
 * Private Screen Time totals and app names remain rendered by the iOS report.
 */
export function useHomeDashboard() {
  const {
    rules,
    isPending: rulesPending,
    isError: rulesError,
  } = useBlockRulesQuery()
  const stats = useHomeStats()
  const authorization = useScreenTimeAuthorization()
  const limitSteps = useLimitSteps()
  const [now, setNow] = useState(() => new Date())
  const [referenceFixture, setReferenceFixture] =
    useState<HomeReferenceFixture | null>(null)

  useFreshInstallReset()
  useRuleReconciler(rules, !rulesPending)
  useRuleAutoCleanup(rules)

  useEffect(() => {
    const tick = () => setNow(new Date())
    const id = setInterval(tick, 30_000)
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') tick()
    })
    return () => {
      clearInterval(id)
      sub.remove()
    }
  }, [])

  useEffect(() => {
    if (!__DEV__) return
    let active = true
    ScreenTime.homeReferenceFixture().then(fixture => {
      if (active) setReferenceFixture(fixture)
    })
    return () => {
      active = false
    }
  }, [])

  const sessions = useMemo(
    () => buildSessions(rules, now, limitSteps),
    [limitSteps, now, rules],
  )
  const runningRules = useMemo(
    () =>
      sessions
        .filter(session => session.state === 'running')
        .map(session => session.rule),
    [sessions],
  )
  const blocked = useBlockedApps(runningRules)
  const blockedApps = useMemo(
    () => blocked.apps.filter(app => !app.unlocked),
    [blocked.apps],
  )
  const myApps = useMemo(
    () =>
      buildHomeMyApps({
        sessions,
        apps: blocked.apps,
        now,
        isLoading: blocked.isLoading,
      }),
    [blocked.apps, blocked.isLoading, now, sessions],
  )

  useFocusEffect(
    useCallback(() => {
      setNow(new Date())
      blocked.refresh('home-focused')
    }, [blocked.refresh]),
  )

  useNotificationReconciler(stats.streak, runningRules.length > 0)

  // Le score se calcule ICI, sur les données que l'app détient réellement :
  // le journal quotidien `daily_stats`, les règles et l'avancement des quotas.
  // L'extension de rapport ne peut pas écrire dans l'App Group (sandbox Apple,
  // cf. docs/ARCHITECTURE.md) : son score n'atteignait jamais le JS, et la
  // feuille de détail ne pouvait donc pas expliquer le chiffre de la carte.
  const reprievedApps = useMemo(
    () => blocked.apps.filter(app => app.unlocked).length,
    [blocked.apps],
  )
  const computed = useHomeScore({
    now,
    history: stats.recent,
    rules,
    limitSteps,
    reprievedApps,
  })
  // La fixture remplace le snapshot ENTIER (carte + feuille), pour que les
  // captures de comparaison restent identiques d'un lancement à l'autre.
  const score = referenceFixture
    ? fixtureSnapshot(referenceFixture, now)
    : computed
  const scores = useMemo(() => toHomeScores(score), [score])
  const state = dashboardState({
    rulesPending,
    statsPending: stats.isPending,
    statsError: stats.isError || rulesError,
    authorization: authorization.status,
  })

  return {
    now,
    state,
    scores,
    score,
    sessions,
    runningRules,
    myApps:
      __DEV__ && referenceFixture
        ? referenceMyApps(referenceFixture, now)
        : myApps,
    blockedApps,
    blockedAppsPending: blocked.isLoading,
    refreshBlockedApps: blocked.refresh,
    authorization,
    stats,
    streakMinutesRemaining: minutesUntilTomorrow(now),
    protectedToday: stats.week.some(day => day.today && day.done),
    isNewUser:
      !referenceFixture &&
      isHomeNewUser({ rulesPending, sessionCount: sessions.length }),
    referenceFixture,
  }
}
