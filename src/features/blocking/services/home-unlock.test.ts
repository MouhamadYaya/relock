import type { BlockedApp } from '@/features/blocking/hooks/useBlockedApps'
import {
  homeUnlockEntry,
  pendingHomeUnlockRequest,
  readNativeUnlockApps,
  unlockableProtectedApps,
} from '@/features/blocking/services/home-unlock'
import { buildSessions } from '@/features/blocking/session'
import type { BlockRuleView } from '@/features/blocking/types'
import { ScreenTime } from '@/shared/native/screen-time'

jest.mock('@/shared/native/screen-time', () => ({
  ScreenTime: {
    isAvailable: true,
    blockedAppKeys: jest.fn(),
    reprievedKeys: jest.fn(),
    appKeys: jest.fn(),
    unblockAppKey: jest.fn(),
  },
}))

const NOW = new Date(2026, 8, 4, 15)
function rule(id: string, strict = false): BlockRuleView {
  return {
    id,
    type: 'progressive_delay',
    appIds: [],
    isActive: true,
    config: { name: id, duration_min: 60, strict },
    createdAt: new Date(2026, 8, 4, 14, 30).toISOString(),
  }
}
function app(key: string, ruleIds: string[], unlocked = false): BlockedApp {
  return { key, ruleIds, unlocked }
}

describe('explicit Home unlock entry', () => {
  beforeEach(() => jest.resetAllMocks())

  it('waits for a focused ready destination and consumes each explicit request once', () => {
    expect(pendingHomeUnlockRequest('123', null, false, true)).toBeNull()
    expect(pendingHomeUnlockRequest('123', null, true, false)).toBeNull()
    expect(pendingHomeUnlockRequest('123', null, true, true)).toBe('123')
    expect(pendingHomeUnlockRequest('123', '123', true, true)).toBeNull()
    expect(pendingHomeUnlockRequest('124', '123', true, true)).toBe('124')
  })

  it('does not infer an unlock request from a shield redirect or missing/ambiguous params', () => {
    expect(pendingHomeUnlockRequest(undefined, null, true, true)).toBeNull()
    expect(pendingHomeUnlockRequest('', null, true, true)).toBeNull()
    expect(
      pendingHomeUnlockRequest(['123', '124'], null, true, true),
    ).toBeNull()
  })

  it('begins breathing for a permitted app without granting a reprieve', () => {
    expect(
      homeUnlockEntry(
        [app('a', ['soft'])],
        buildSessions([rule('soft')], NOW),
        NOW,
      ),
    ).toEqual({ kind: 'breathing' })
    expect(ScreenTime.unblockAppKey).not.toHaveBeenCalled()
  })

  it('shows the covering strict rule and deadline when nothing can be unlocked', () => {
    const sessions = buildSessions([rule('soft'), rule('strict', true)], NOW)
    const entry = homeUnlockEntry([app('a', ['soft', 'strict'])], sessions, NOW)
    expect(entry).toEqual({ kind: 'strict', session: sessions[1] })
    expect(ScreenTime.unblockAppKey).not.toHaveBeenCalled()
  })

  it('allows only soft apps in a mixed set and refuses every strict overlap', () => {
    const sessions = buildSessions([rule('soft'), rule('strict', true)], NOW)
    const apps = [
      app('a', ['soft']),
      app('b', ['soft', 'strict']),
      app('c', ['strict']),
    ]
    expect(unlockableProtectedApps(apps, sessions, NOW)).toEqual([apps[0]])
    expect(homeUnlockEntry(apps, sessions, NOW)).toEqual({ kind: 'breathing' })
  })

  it('fails closed when native token membership is unknown or partly unresolved', () => {
    const sessions = buildSessions([rule('soft')], NOW)
    expect(
      unlockableProtectedApps(
        [app('a', []), app('b', ['soft', 'missing'])],
        sessions,
        NOW,
      ),
    ).toEqual([])
    expect(homeUnlockEntry([app('a', [])], sessions, NOW)).toEqual({
      kind: 'none',
    })
  })

  it('does nothing when apps are already open or protection ended during the flow', () => {
    const sessions = buildSessions([rule('soft')], NOW)
    expect(homeUnlockEntry([], sessions, NOW)).toEqual({ kind: 'none' })
    expect(homeUnlockEntry([app('a', ['soft'], true)], sessions, NOW)).toEqual({
      kind: 'none',
    })
    const later = new Date(2026, 8, 4, 16)
    expect(
      unlockableProtectedApps(
        [app('a', ['soft'])],
        buildSessions([rule('soft')], later),
        later,
      ),
    ).toEqual([])
  })

  it('rereads actual keys, reprieves and covering rules without granting anything', async () => {
    jest.mocked(ScreenTime.blockedAppKeys).mockResolvedValue(['a', 'b'])
    jest.mocked(ScreenTime.reprievedKeys).mockResolvedValue({ b: 2_000 })
    jest.mocked(ScreenTime.appKeys).mockResolvedValue(['a', 'b'])
    expect(await readNativeUnlockApps([rule('soft')], NOW)).toEqual([
      {
        key: 'a',
        ruleIds: ['soft'],
        unlocked: false,
        reprievedUntil: undefined,
      },
      { key: 'b', ruleIds: ['soft'], unlocked: true, reprievedUntil: 2_000 },
    ])
    expect(ScreenTime.unblockAppKey).not.toHaveBeenCalled()
  })

  it('fails the authorization read if any rule membership cannot be resolved', async () => {
    jest.mocked(ScreenTime.blockedAppKeys).mockResolvedValue(['a'])
    jest.mocked(ScreenTime.reprievedKeys).mockResolvedValue({})
    jest
      .mocked(ScreenTime.appKeys)
      .mockRejectedValue(new Error('native read failed'))
    await expect(readNativeUnlockApps([rule('soft')], NOW)).rejects.toThrow(
      'native read failed',
    )
    expect(ScreenTime.unblockAppKey).not.toHaveBeenCalled()
  })
})
