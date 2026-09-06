import type { BlockedApp } from '@/features/blocking/hooks/useBlockedApps'
import { buildSessions, deriveSession } from '@/features/blocking/session'
import type { BlockRuleView } from '@/features/blocking/types'
import { buildHomeMyApps } from '@/features/home/services/home-my-apps'

const NOW = new Date(2026, 8, 4, 15, 0) // Friday, local time.

function rule(
  id: string,
  config: Record<string, unknown> = {},
  overrides: Partial<BlockRuleView> = {},
): BlockRuleView {
  return {
    id,
    type: 'schedule',
    isActive: true,
    appIds: [],
    config: { name: id, start_hour: 18, end_hour: 22, ...config },
    ...overrides,
  }
}

function app(
  key: string,
  ruleIds: string[] = [],
  reprievedUntil?: number,
): BlockedApp {
  return {
    key,
    ruleIds,
    unlocked: reprievedUntil != null,
    reprievedUntil,
  }
}

function model(
  rules: BlockRuleView[],
  apps: BlockedApp[] = [],
  now = NOW,
  isLoading = false,
) {
  return buildHomeMyApps({
    sessions: buildSessions(rules, now),
    apps,
    now,
    isLoading,
  })
}

describe('Home Mes apps state', () => {
  it('reserves no card for absent or suspended protection, even while loading', () => {
    expect(model([], [], NOW, true)).toBeNull()
    expect(model([rule('paused', {}, { isActive: false })])).toBeNull()
  })

  it('excludes an expired timer even when given a stale derived session', () => {
    const timer = rule(
      'old',
      { duration_min: 30 },
      {
        type: 'progressive_delay',
        createdAt: new Date(2026, 8, 4, 14).toISOString(),
      },
    )
    expect(
      buildHomeMyApps({
        sessions: [deriveSession(timer, new Date(2026, 8, 4, 14, 5))],
        apps: [],
        now: NOW,
        isLoading: false,
      }),
    ).toBeNull()
  })

  it('chooses the nearest upcoming schedule regardless of storage order', () => {
    expect(
      model([rule('later', { start_hour: 22 }), rule('soon')]),
    ).toMatchObject({
      state: 'clear',
      nextStart: new Date(2026, 8, 4, 18),
      nextRuleTitle: 'soon',
      resuming: false,
      blockedCount: 0,
      apps: [],
    })
  })

  it('uses the scheduled weekdays, including the next weekend day', () => {
    expect(
      model([rule('weekend', { days: [0, 6], start_hour: 9 })])?.nextStart,
    ).toEqual(new Date(2026, 8, 5, 9))
  })

  it('does not announce a schedule that starts at or after its lifetime ends', () => {
    const createdAt = new Date(2026, 8, 3, 18).toISOString()
    expect(
      model([rule('expires', { lifetime_days: 1 }, { createdAt })])?.nextStart,
    ).toBeNull()
  })

  it('does not call a currently running overnight schedule upcoming', () => {
    const now = new Date(2026, 8, 5, 1)
    expect(
      model(
        [rule('night', { days: [5], start_hour: 22, end_hour: 8 })],
        [],
        now,
      ),
    ).toMatchObject({ state: 'clear', ruleTitles: ['night'], nextStart: null })
  })

  it('keeps an unreached daily limit clear without inventing a start time', () => {
    expect(
      model([rule('daily', { limit_min: 60 }, { type: 'daily_limit' })]),
    ).toMatchObject({ state: 'clear', ruleTitles: ['daily'], nextStart: null })
  })

  it('waits for the first native result rather than announcing no blocked apps', () => {
    expect(model([rule('soon')], [], NOW, true)?.state).toBe('loading')
  })

  it('shows native-confirmed apps even while the rule query is behind', () => {
    expect(model([], [app('opaque', ['missing'])], NOW, true)).toMatchObject({
      state: 'blocked',
      blockedCount: 1,
      ruleTitles: [],
      apps: [app('opaque', ['missing'])],
    })
  })

  it('uses only matching running rule titles across overlapping protections', () => {
    expect(
      model(
        [
          rule('first', { start_hour: 12 }),
          rule('second', { start_hour: 13 }),
          rule('unrelated', { start_hour: 14 }),
          rule('future'),
        ],
        [app('a', ['first', 'second', 'future']), app('b', ['second'])],
      ),
    ).toMatchObject({
      state: 'blocked',
      blockedCount: 2,
      ruleTitles: ['first', 'second'],
    })
  })

  it('does not attach an arbitrary existing rule name to unknown native keys', () => {
    expect(
      model([rule('other', { start_hour: 12 })], [app('unknown')])?.ruleTitles,
    ).toEqual([])
  })

  it('shows clear and the earliest actual reprieve expiration for temporarily open apps', () => {
    const resume = new Date(2026, 8, 4, 15, 10)
    expect(
      model(
        [rule('running', { start_hour: 12 }), rule('future')],
        [app('a', ['running'], resume.getTime() / 1000)],
      ),
    ).toMatchObject({
      state: 'clear',
      apps: [],
      blockedCount: 0,
      nextStart: resume,
      nextRuleTitle: 'running',
      resuming: true,
    })
  })

  it('chooses a future schedule when it starts before a reprieve expires', () => {
    expect(
      model(
        [
          rule('running', { start_hour: 12 }),
          rule('soon', { start_hour: 15, start_minute: 5 }),
        ],
        [app('a', ['running'], new Date(2026, 8, 4, 15, 10).getTime() / 1000)],
      ),
    ).toMatchObject({ nextRuleTitle: 'soon', resuming: false })
  })

  it('does not announce expired, unmapped or out-of-session reprieves', () => {
    const ending = rule('ending', {
      start_hour: 12,
      end_hour: 15,
      end_minute: 5,
    })
    expect(
      model(
        [ending],
        [
          app(
            'after',
            ['ending'],
            new Date(2026, 8, 4, 15, 10).getTime() / 1000,
          ),
          app(
            'past',
            ['ending'],
            new Date(2026, 8, 4, 14, 59).getTime() / 1000,
          ),
          app(
            'unknown',
            ['missing'],
            new Date(2026, 8, 4, 15, 2).getTime() / 1000,
          ),
        ],
      )?.nextStart,
    ).toBeNull()
  })

  it('removes reprieved apps from the displayed count while other apps remain blocked', () => {
    expect(
      model(
        [rule('running', { start_hour: 12 })],
        [
          app('locked', ['running']),
          app(
            'open',
            ['running'],
            new Date(2026, 8, 4, 15, 10).getTime() / 1000,
          ),
        ],
      ),
    ).toMatchObject({
      state: 'blocked',
      apps: [app('locked', ['running'])],
      blockedCount: 1,
    })
  })
})
