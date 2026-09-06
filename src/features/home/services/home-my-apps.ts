import type { BlockedApp } from '@/features/blocking/hooks/useBlockedApps'
import {
  expiresAt,
  isFinished,
  type RuleSession,
  scheduleNextStart,
} from '@/features/blocking/session'
import type { HomeMyAppsState } from '@/features/home/types/my-apps'

interface NextProtection {
  at: Date
  title: string
  resuming: boolean
}

function nextProtection(
  sessions: RuleSession[],
  apps: BlockedApp[],
  now: Date,
): NextProtection | null {
  const candidates: NextProtection[] = []
  for (const session of sessions) {
    const expiration = expiresAt(session.rule)
    if (session.state === 'upcoming' && session.rule.type === 'schedule') {
      const at = scheduleNextStart(session.rule, now)
      if (!expiration || at < expiration) {
        candidates.push({ at, title: session.title, resuming: false })
      }
    }
    if (session.state !== 'running') continue
    for (const app of apps) {
      if (
        !app.unlocked ||
        !app.ruleIds.includes(session.rule.id) ||
        app.reprievedUntil == null
      ) {
        continue
      }
      const at = new Date(app.reprievedUntil * 1000)
      // A reprieve ending after its session is not a future blocking event.
      if (
        at > now &&
        (!session.sessionEndsAt || at < session.sessionEndsAt) &&
        (!expiration || at < expiration)
      ) {
        candidates.push({ at, title: session.title, resuming: true })
      }
    }
  }
  return candidates.sort((a, b) => a.at.getTime() - b.at.getTime())[0] ?? null
}

/** Native lock state wins over a temporarily lagging rule-query response. */
export function buildHomeMyApps({
  sessions,
  apps,
  now,
  isLoading,
}: {
  sessions: RuleSession[]
  apps: BlockedApp[]
  now: Date
  isLoading: boolean
}): HomeMyAppsState | null {
  const eligible = sessions.filter(
    session => session.state !== 'suspended' && !isFinished(session.rule, now),
  )
  const locked = apps.filter(app => !app.unlocked)
  if (eligible.length === 0 && locked.length === 0) return null

  const covering = new Set(locked.flatMap(app => app.ruleIds))
  const titles = eligible
    .filter(session =>
      locked.length > 0
        ? session.state === 'running' && covering.has(session.rule.id)
        : session.state === 'running',
    )
    .map(session => session.title)
  const next = nextProtection(eligible, apps, now)

  return {
    state:
      locked.length > 0
        ? 'blocked'
        : isLoading && apps.length === 0
          ? 'loading'
          : 'clear',
    ruleTitles: [...new Set(titles)],
    nextStart: next?.at ?? null,
    nextRuleTitle: next?.title ?? null,
    resuming: next?.resuming ?? false,
    apps: locked,
    blockedCount: locked.length,
  }
}
