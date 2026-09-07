/**
 * Construction du contexte — le SEUL endroit du moteur qui touche au monde
 * extérieur (natif, cache React Query, MMKV, stores).
 *
 * Tout le reste — éligibilité, supersession, budget, capacité — est pur et
 * consomme ce qui sort d'ici. Un signal manquant n'est pas une erreur : il rend
 * simplement inéligibles les nœuds qui en dépendaient, et le journal le dit.
 */

import { buildSessions, scheduleNextStart } from '@/features/blocking/session'
import type { BlockRuleView } from '@/features/blocking/types'
import { scoreBandRank } from '@/features/home/services/home-score'
import type { HomeScoreSnapshot } from '@/features/home/types'
import { getNotifPrefs } from '@/features/notifications/prefs/prefs'
import type { NotifContext } from '@/features/notifications/types'
import { Notif } from '@/shared/native/notifications'
import { ScreenTime } from '@/shared/native/screen-time'
import { readSignals } from './signals'
import { installedAt, readEngineState } from './state'

const DAY_MS = 86_400_000

/**
 * Dernier score connu, publié par l'Accueil.
 *
 * Le moteur est monté une seule fois, dans le layout racine ; le score, lui,
 * n'est calculé que par l'Accueil, à partir du journal quotidien et des règles.
 * Le recalculer ici créerait une SECONDE source de vérité sur le score —
 * exactement le défaut que le produit vient d'éliminer. On se contente donc de
 * relire ce que l'Accueil a déjà établi, et de ne rien dire tant qu'il ne l'a
 * pas fait.
 */
let lastKnownScore: HomeScoreSnapshot | null = null

export function noteHomeScore(snapshot: HomeScoreSnapshot | null): void {
  lastKnownScore = snapshot
}

/** Statistiques d'Accueil, telles que `useHomeStats` les expose. */
export interface NotifStatsInput {
  streak: number
  record: number
  resisted: number
  savedMinutesWeek: number
  recentRespectedYesterday: boolean
  resistedTotal: number
}

export interface NotifContextSources {
  now: number
  /** L'app est au premier plan à cet instant précis. */
  userActive: boolean
  rules: readonly BlockRuleView[] | null
  stats: NotifStatsInput | null
  entitled: boolean
  /**
   * Le score, tel que l'Accueil le calcule. Volontairement FOURNI et non
   * recalculé ici : le produit vient d'éliminer la double source de vérité sur
   * le score, en réintroduire une dans le moteur de notifications serait
   * refaire exactement le bug qu'on a payé pour corriger. Absent ⇒ les nœuds
   * `score.*` sont simplement inéligibles, et le journal le dit.
   */
  score?: HomeScoreSnapshot | null
}

function toIsoMs(value: string | undefined): number | null {
  if (!value) return null
  const at = new Date(value).getTime()
  return Number.isNaN(at) ? null : at
}

/**
 * Signal de vie d'une extension : le plus RÉCENT des réveils observés. Prendre
 * le plus ancien ferait crier au loup dès qu'une seule des cinq extensions
 * dort, ce qui est le cas normal.
 */
function extensionHeartbeat(
  monitorWake: string | undefined,
  shieldAction: string | undefined,
  shieldShown: string | undefined,
): number | null {
  const stamps = [monitorWake, shieldAction, shieldShown]
    .map(toIsoMs)
    .filter((at): at is number => at !== null)
  return stamps.length > 0 ? Math.max(...stamps) : null
}

export async function buildNotifContext(
  sources: NotifContextSources,
): Promise<NotifContext> {
  const { now, userActive, rules, stats, entitled } = sources
  const prefs = getNotifPrefs()
  const signals = readSignals()
  const state = readEngineState()

  const [permission, authStatus, diagnostics, limitSteps] = await Promise.all([
    Notif.permissionStatus().catch(() => 'denied' as const),
    ScreenTime.isAvailable
      ? ScreenTime.authorizationStatus().catch(() => 'notDetermined' as const)
      : Promise.resolve('unsupported' as const),
    ScreenTime.isAvailable
      ? ScreenTime.getDiagnostics().catch(() => null)
      : null,
    ScreenTime.isAvailable
      ? ScreenTime.limitSteps().catch(() => ({}) as Record<string, number>)
      : Promise.resolve({} as Record<string, number>),
  ])

  const ruleList = [...(rules ?? [])]
  const activeRules = ruleList.filter(rule => rule.isActive)
  const sessions = buildSessions(ruleList, new Date(now), limitSteps)
  const running = sessions.filter(session => session.state === 'running')
  const upcoming = sessions.filter(session => session.state === 'upcoming')

  const runningEnds = running
    .map(session => session.sessionEndsAt?.getTime() ?? null)
    .filter((at): at is number => at !== null && at > now)
  const nextStarts = upcoming
    .map(session => scheduleNextStart(session.rule, new Date(now)).getTime())
    .filter(at => at > now)

  const strictRunning = running.filter(session => session.strict)
  const strictEnds = strictRunning
    .map(session => session.sessionEndsAt?.getTime() ?? null)
    .filter((at): at is number => at !== null && at > now)

  // Vérité SYSTÈME contre vérité applicative : une règle « active » dont
  // l'activité n'est pas armée côté iOS ne bloque rien, quoi que dise la base.
  const armed = new Set(diagnostics?.armedActivities ?? [])
  const desyncCount =
    diagnostics === null
      ? 0
      : activeRules.filter(rule => !armed.has(rule.id)).length

  // Une règle active dont la sélection est vide protège de rien. On ne teste
  // que la première : un seul message, sur un seul coupable, est plus
  // actionnable qu'une liste.
  const emptySelectionRule =
    activeRules.find(rule => rule.count === 0) ??
    activeRules.find(
      rule => rule.appIds.length === 0 && rule.count === undefined,
    ) ??
    null

  const score = sources.score ?? lastKnownScore
  const bandRank =
    score && score.global !== null ? scoreBandRank(score.global) : null

  return {
    now,
    locale: 'fr',
    permission,
    prefs,
    userActive,
    engagement: {
      lastOpenAt:
        state.opens.length > 0 ? state.opens[state.opens.length - 1] : null,
      daysSinceInstall: Math.floor((now - installedAt(now)) / DAY_MS),
      daysSinceLastOpen:
        state.opens.length > 0
          ? Math.floor((now - state.opens[state.opens.length - 1]) / DAY_MS)
          : 0,
      opensLast7d: state.opens.length,
      onboardingDone: true,
    },
    blocking: {
      rulesCount: ruleList.length,
      activeRulesCount: activeRules.length,
      runningCount: running.length,
      hasEverArmed: signals.hasEverArmed || running.length > 0,
      runningEndsAt: runningEnds.length > 0 ? Math.min(...runningEnds) : null,
      nextSessionStartAt:
        nextStarts.length > 0 ? Math.min(...nextStarts) : null,
      strictEndsAt: strictEnds.length > 0 ? Math.min(...strictEnds) : null,
      strictStartedAt: signals.strictStartedAt,
      strictEverCompleted: signals.strictEverCompleted,
      noActiveRuleSince:
        activeRules.length === 0 ? signals.noActiveRuleSince : null,
      emptySelectionRuleId: emptySelectionRule?.id ?? null,
      selectionDrift: false,
      riskHourMinutes: signals.riskHourMinutes,
      extensionsLast7d: signals.extensions.filter(at => now - at <= 7 * DAY_MS)
        .length,
    },
    results: {
      streak: stats?.streak ?? 0,
      record: stats?.record ?? 0,
      resistedToday: stats?.resisted ?? 0,
      resistedTotal: stats?.resistedTotal ?? diagnostics?.totalResisted ?? 0,
      savedMinutesWeek: stats?.savedMinutesWeek ?? 0,
      bestWeekMinutes: signals.bestWeekMinutes,
      protectedToday: running.length > 0,
      streakBrokenYesterday:
        stats !== null && stats.streak === 0 && !stats.recentRespectedYesterday,
      challengeCompletedAt: signals.challengeCompletedAt,
      challengeDays: signals.challengeDays,
    },
    score: {
      status: score?.status ?? 'pending',
      global: score?.global ?? null,
      delta: score?.delta ?? null,
      weakestAxis: score?.weakestAxis ?? 'focus',
      historyDays: score?.historyDays ?? 0,
      bandRank,
      previousBandRank: signals.previousBandRank,
    },
    health: {
      screenTimeAuthorized: authStatus === 'approved',
      desyncCount,
      extensionLastSeenAt: extensionHeartbeat(
        diagnostics?.monitorLastWakeAt,
        diagnostics?.shieldLastActionAt,
        diagnostics?.shieldLastShownAt,
      ),
      lastSyncAt: signals.lastSyncAt,
    },
    billing: {
      entitled,
      trialEndsAt: signals.trialEndsAt,
      offerExpiresAt: signals.offerExpiresAt,
      offerAvailable: signals.offerAvailable,
      renewalIssue: signals.renewalIssue,
      entitlementLostAt: signals.entitlementLostAt,
      paywallAbandonedAt: signals.paywallAbandonedAt,
      paywallViews: 0,
    },
    ritual: prefs.ritual,
  }
}
