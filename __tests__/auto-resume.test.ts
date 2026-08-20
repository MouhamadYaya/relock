/**
 * Verrouille la levée automatique des suspensions : ce qui doit reprendre
 * reprend, et surtout ce qui ne doit PAS reprendre reste en pause.
 */
jest.mock('@/shared/native/screen-time', () => ({
  __esModule: true,
  ScreenTime: {
    isAvailable: true,
    resumeRule: jest.fn().mockResolvedValue(true),
  },
  nativeKindOf: () => 'schedule',
}))
jest.mock('@/features/blocking/services/arm', () => ({
  armRule: jest.fn().mockResolvedValue(undefined),
}))
jest.mock(
  '@/features/blocking/services/block-rules/block-rules.service',
  () => ({
    BlockRulesService: { resume: jest.fn().mockResolvedValue(undefined) },
  }),
)

import { armRule } from '@/features/blocking/services/arm'
import { resumeExpiredSuspensions } from '@/features/blocking/services/auto-resume'
import { BlockRulesService } from '@/features/blocking/services/block-rules/block-rules.service'
import type { BlockRuleView } from '@/features/blocking/types'
import { ScreenTime } from '@/shared/native/screen-time'

const NOW = new Date('2026-07-16T12:00:00Z')

const rule = (over: Partial<BlockRuleView> = {}): BlockRuleView =>
  ({
    id: 'r1',
    type: 'schedule',
    isActive: false,
    createdAt: '2026-07-01T00:00:00Z',
    config: { start_hour: 22, end_hour: 8 },
    ...over,
  }) as BlockRuleView

const suspendedUntil = (
  iso: string | null,
  over: Partial<BlockRuleView> = {},
) =>
  rule({
    config: { start_hour: 22, end_hour: 8, suspended_until: iso },
    ...over,
  })

beforeEach(() => jest.clearAllMocks())

describe('resumeExpiredSuspensions', () => {
  it('lève une suspension dont l’échéance est passée', async () => {
    const n = await resumeExpiredSuspensions(
      [suspendedUntil('2026-07-16T11:00:00Z')],
      NOW,
    )
    expect(n).toBe(1)
    expect(BlockRulesService.resume).toHaveBeenCalledWith('r1')
    // Ré-armer AVANT de lever le masque, jamais l'inverse.
    expect(armRule).toHaveBeenCalled()
    expect(ScreenTime.resumeRule).toHaveBeenCalledWith('r1')
  })

  it('ne touche pas à une suspension encore en cours', async () => {
    const n = await resumeExpiredSuspensions(
      [suspendedUntil('2026-07-16T13:00:00Z')],
      NOW,
    )
    expect(n).toBe(0)
    expect(BlockRulesService.resume).not.toHaveBeenCalled()
  })

  it('ne lève JAMAIS une pause « jusqu’à ce que tu reprennes »', async () => {
    const n = await resumeExpiredSuspensions([suspendedUntil(null)], NOW)
    expect(n).toBe(0)
    expect(BlockRulesService.resume).not.toHaveBeenCalled()
  })

  it('ignore une règle déjà active', async () => {
    const n = await resumeExpiredSuspensions(
      [suspendedUntil('2026-07-16T11:00:00Z', { isActive: true })],
      NOW,
    )
    expect(n).toBe(0)
  })
})
