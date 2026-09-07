import { BlockRulesService } from '@/features/blocking/services/block-rules/block-rules.service'
import { emergencyUnlock } from '@/features/blocking/services/emergency-unlock'
import type { BlockRuleView } from '@/features/blocking/types'
import { ScreenTime } from '@/shared/native/screen-time'

jest.mock('@/shared/native/screen-time', () => ({
  ScreenTime: {
    isAvailable: true,
    clearRuleData: jest.fn().mockResolvedValue(true),
    stopBlocking: jest.fn().mockResolvedValue(true),
  },
  nativeKindOf: (type: string) =>
    type === 'schedule'
      ? 'schedule'
      : type === 'daily_limit'
        ? 'limit'
        : 'timed',
}))

jest.mock(
  '@/features/blocking/services/block-rules/block-rules.service',
  () => ({ BlockRulesService: { remove: jest.fn() } }),
)

const rule = (id: string, type: BlockRuleView['type']): BlockRuleView => ({
  id,
  type,
  appIds: [],
  isActive: true,
})

const RULES = [
  rule('a', 'schedule'),
  rule('b', 'daily_limit'),
  rule('c', 'progressive_delay'),
]

describe('emergencyUnlock', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(BlockRulesService.remove as jest.Mock).mockResolvedValue(undefined)
  })

  it('désarme chaque règle côté iOS puis balaie ce qui resterait', async () => {
    await emergencyUnlock(RULES)

    expect(ScreenTime.clearRuleData).toHaveBeenCalledTimes(3)
    expect(ScreenTime.clearRuleData).toHaveBeenCalledWith('a', 'schedule')
    expect(ScreenTime.clearRuleData).toHaveBeenCalledWith('b', 'limit')
    expect(ScreenTime.clearRuleData).toHaveBeenCalledWith('c', 'timed')
    // Le balayage final attrape les activités qu'aucune règle connue ne
    // réclamait plus (arrêt hors ligne, plantage, réinstallation).
    expect(ScreenTime.stopBlocking).toHaveBeenCalled()
  })

  it('supprime les règles pour que la libération TIENNE', async () => {
    const result = await emergencyUnlock(RULES)

    // Une simple suspension serait ré-armée au prochain lancement par
    // `useRuleReconciler` : l'utilisateur retrouverait ses murs sans
    // comprendre pourquoi.
    expect(BlockRulesService.remove).toHaveBeenCalledTimes(3)
    expect(result).toEqual({ removed: 3, failed: 0 })
  })

  it('libère l’iPhone AVANT de toucher au compte', async () => {
    const order: string[] = []
    ;(ScreenTime.stopBlocking as jest.Mock).mockImplementation(async () => {
      order.push('native')
      return true
    })
    ;(BlockRulesService.remove as jest.Mock).mockImplementation(async () => {
      order.push('cloud')
    })

    await emergencyUnlock(RULES)

    // Une panne réseau au milieu doit laisser quelqu'un DÉBLOQUÉ avec des
    // règles orphelines — jamais bloqué sans moyen de lever le blocage.
    expect(order[0]).toBe('native')
  })

  it('compte les échecs au lieu de les avaler', async () => {
    ;(BlockRulesService.remove as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('hors ligne'))
      .mockResolvedValueOnce(undefined)

    const result = await emergencyUnlock(RULES)

    // L'écran doit pouvoir dire « libéré, mais compte pas à jour ».
    expect(result).toEqual({ removed: 2, failed: 1 })
  })

  it('reste sans effet quand il n’y a rien à lever', async () => {
    const result = await emergencyUnlock([])
    expect(result).toEqual({ removed: 0, failed: 0 })
    expect(ScreenTime.clearRuleData).not.toHaveBeenCalled()
  })
})
