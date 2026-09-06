import type { HomeMyAppsState } from '@/features/home/types/my-apps'
import type { HomeReferenceFixture } from '@/shared/native/screen-time'

/** Only used after the existing explicit Debug launch-argument fixture opt-in. */
export function referenceMyApps(
  fixture: HomeReferenceFixture,
  now: Date,
): HomeMyAppsState | null {
  if (fixture.myAppsScenario === 'none') return null
  const upcoming = fixture.myAppsScenario === 'upcoming'
  return {
    state: upcoming ? 'clear' : 'blocked',
    ruleTitles: upcoming ? [] : ['Décompression'],
    nextStart: upcoming ? new Date(now.getTime() + 6 * 60 * 60_000) : null,
    nextRuleTitle: upcoming ? 'Limite du week-end' : null,
    resuming: false,
    apps: upcoming
      ? []
      : ['fixture-a', 'fixture-b', 'fixture-c'].map(key => ({
          key,
          unlocked: false,
          ruleIds: ['fixture-rule'],
        })),
    blockedCount: upcoming ? 0 : 3,
  }
}
