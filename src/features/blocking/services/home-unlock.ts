import {
  type BlockedApp,
  mergeBlockedApps,
} from '@/features/blocking/hooks/useBlockedApps'
import {
  buildSessions,
  type RuleSession,
  strictSessionFor,
} from '@/features/blocking/session'
import type { BlockRuleView } from '@/features/blocking/types'
import { ScreenTime } from '@/shared/native/screen-time'

/** Unknown membership cannot prove that no strict rule covers this app. */
export function unlockableProtectedApps(
  apps: BlockedApp[],
  sessions: RuleSession[],
  now: Date,
): BlockedApp[] {
  const running = sessions.filter(session => session.state === 'running')
  const known = new Set(running.map(session => session.rule.id))
  return apps.filter(
    app =>
      !app.unlocked &&
      app.ruleIds.length > 0 &&
      app.ruleIds.every(id => known.has(id)) &&
      !strictSessionFor(running, app.ruleIds, now),
  )
}

export function pendingHomeUnlockRequest(
  request: string | string[] | undefined,
  consumed: string | null,
  focused: boolean,
  ready: boolean,
): string | null {
  return focused &&
    ready &&
    typeof request === 'string' &&
    request.length > 0 &&
    request !== consumed
    ? request
    : null
}

export function homeUnlockEntry(
  apps: BlockedApp[],
  sessions: RuleSession[],
  now: Date,
):
  | { kind: 'breathing' }
  | { kind: 'strict'; session: RuleSession }
  | { kind: 'none' } {
  if (unlockableProtectedApps(apps, sessions, now).length > 0) {
    return { kind: 'breathing' }
  }
  for (const app of apps) {
    if (app.unlocked) continue
    const strict = strictSessionFor(sessions, app.ruleIds, now)
    if (strict) return { kind: 'strict', session: strict }
  }
  return { kind: 'none' }
}

/** Unlike passive display reads, an authorization read fails closed on error. */
export async function readNativeUnlockApps(
  rules: BlockRuleView[],
  now: Date,
): Promise<BlockedApp[]> {
  if (!ScreenTime.isAvailable) return []
  const running = buildSessions(rules, now).filter(
    session => session.state === 'running',
  )
  const [keys, reprieved, ruleKeys] = await Promise.all([
    ScreenTime.blockedAppKeys(),
    ScreenTime.reprievedKeys(),
    Promise.all(
      running.map(async session => ({
        ruleId: session.rule.id,
        keys: await ScreenTime.appKeys(session.rule.id),
      })),
    ),
  ])
  return mergeBlockedApps(keys, reprieved, ruleKeys)
}
