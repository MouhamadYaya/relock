import type { BlockedApp } from '@/features/blocking/hooks/useBlockedApps'

/** Only native-confirmed locked apps are exposed for display and unlocking. */
export interface HomeMyAppsState {
  state: 'blocked' | 'clear' | 'loading'
  ruleTitles: string[]
  nextStart: Date | null
  nextRuleTitle: string | null
  resuming: boolean
  apps: BlockedApp[]
  blockedCount: number
}
