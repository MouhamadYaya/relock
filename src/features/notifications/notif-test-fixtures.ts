/**
 * Fixtures du moteur. Tout est explicite et daté : un test de notifications
 * qui dépend de l'heure réelle est un test qui passe le matin et échoue le soir.
 */

import {
  EMPTY_STATE,
  type NotifEngineState,
} from '@/features/notifications/engine/state'
import type {
  NotifContext,
  NotifDefinition,
  NotifPrefs,
} from '@/features/notifications/types'

/** Lundi 13 juillet 2026, 9h00 locales. */
export const NOW = new Date(2026, 6, 13, 9, 0, 0, 0).getTime()

export const DAY = 86_400_000
export const HOUR = 3_600_000

export const prefs = (patch: Partial<NotifPrefs> = {}): NotifPrefs => ({
  version: 2,
  master: true,
  channels: {
    reminders: true,
    progression: true,
    account: true,
    offers: false,
    ritual: false,
  },
  quietHours: null,
  ritual: { myMomentMinutes: null, bedtimeMinutes: null, morningMinutes: null },
  ...patch,
})

export function context(patch: Partial<NotifContext> = {}): NotifContext {
  return {
    now: NOW,
    locale: 'fr',
    permission: 'granted',
    prefs: prefs(),
    userActive: false,
    engagement: {
      lastOpenAt: NOW,
      daysSinceInstall: 30,
      daysSinceLastOpen: 0,
      opensLast7d: 5,
      onboardingDone: true,
    },
    blocking: {
      rulesCount: 2,
      activeRulesCount: 2,
      runningCount: 1,
      hasEverArmed: true,
      runningEndsAt: null,
      nextSessionStartAt: null,
      strictEndsAt: null,
      strictStartedAt: null,
      strictEverCompleted: false,
      noActiveRuleSince: null,
      emptySelectionRuleId: null,
      selectionDrift: false,
      riskHourMinutes: null,
      extensionsLast7d: 0,
    },
    results: {
      streak: 4,
      record: 9,
      resistedToday: 2,
      resistedTotal: 40,
      savedMinutesWeek: 120,
      bestWeekMinutes: 200,
      protectedToday: true,
      streakBrokenYesterday: false,
      challengeCompletedAt: null,
      challengeDays: 0,
    },
    score: {
      status: 'pending',
      global: null,
      delta: null,
      weakestAxis: 'focus',
      historyDays: 0,
      bandRank: null,
      previousBandRank: null,
    },
    health: {
      screenTimeAuthorized: true,
      desyncCount: 0,
      extensionLastSeenAt: NOW,
      lastSyncAt: NOW,
    },
    billing: {
      entitled: true,
      trialEndsAt: null,
      offerExpiresAt: null,
      offerAvailable: false,
      renewalIssue: false,
      entitlementLostAt: null,
      paywallAbandonedAt: null,
      paywallViews: 0,
    },
    ritual: {
      myMomentMinutes: null,
      bedtimeMinutes: null,
      morningMinutes: null,
    },
    ...patch,
  }
}

export const state = (
  patch: Partial<NotifEngineState> = {},
): NotifEngineState => ({
  ...EMPTY_STATE,
  ...patch,
})

/** Nœud minimal : on ne déclare que ce que le test regarde. */
export function node(patch: Partial<NotifDefinition> = {}): NotifDefinition {
  return {
    id: 'blocking.test_node',
    family: 'blocking',
    channel: 'reminders',
    budget: 'standard',
    enabled: true,
    priority: 50,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 0,
    quietHours: 'strict',
    emitter: 'engine',
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: 'fixture',
    },
    route: () => ({ pathname: '/(tabs)/home' }),
    when: () => true,
    schedule: ctx => ({ kind: 'relative', at: ctx.now + HOUR }),
    content: () => ({ titleKey: 'x.title', bodyKey: 'x.body' }),
    ...patch,
  }
}

export const idsOf = (list: { nodeId: string }[]): string[] =>
  list.map(item => item.nodeId)

export const reasonFor = (
  suppressed: { nodeId: string; reason: string }[],
  nodeId: string,
): string | undefined =>
  suppressed.find(entry => entry.nodeId === nodeId)?.reason
