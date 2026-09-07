import { armRule } from '@/features/blocking/services/arm'
import { BlockRulesService } from '@/features/blocking/services/block-rules/block-rules.service'
import {
  currentDailyLimit,
  dailyLimitRules,
  setDailyLimit,
} from '@/features/blocking/services/daily-screen-time'
import type { BlockRuleView } from '@/features/blocking/types'

jest.mock('@/shared/native/screen-time', () => ({
  ScreenTime: { isAvailable: true },
}))
jest.mock('@/features/blocking/services/arm', () => ({
  armRule: jest.fn().mockResolvedValue(undefined),
}))
jest.mock(
  '@/features/blocking/services/block-rules/block-rules.service',
  () => ({ BlockRulesService: { update: jest.fn() } }),
)

const limitRule = (
  id: string,
  minutes: number,
  isActive = true,
): BlockRuleView => ({
  id,
  type: 'daily_limit',
  appIds: [],
  isActive,
  config: { limit_min: minutes },
})

const scheduleRule: BlockRuleView = {
  id: 's',
  type: 'schedule',
  appIds: [],
  isActive: true,
  config: { start_hour: 22 },
}

describe('temps d’écran par jour', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(BlockRulesService.update as jest.Mock).mockResolvedValue(undefined)
  })

  it('ne retient que les limites quotidiennes actives', () => {
    const rules = [limitRule('a', 120), limitRule('b', 60, false), scheduleRule]
    expect(dailyLimitRules(rules).map(r => r.id)).toEqual(['a'])
  })

  it('affiche le plafond le plus BAS, celui qu’on ressent', () => {
    // Afficher une moyenne, ou la première trouvée, décrirait un quotidien
    // qui n'est celui de personne.
    expect(currentDailyLimit([limitRule('a', 180), limitRule('b', 60)])).toBe(
      60,
    )
  })

  it('n’affiche rien quand aucune limite n’existe', () => {
    expect(currentDailyLimit([scheduleRule])).toBeNull()
    expect(currentDailyLimit([])).toBeNull()
  })

  it('retombe sur une heure quand la config n’a pas de plafond', () => {
    const orphan: BlockRuleView = {
      id: 'o',
      type: 'daily_limit',
      appIds: [],
      isActive: true,
    }
    expect(currentDailyLimit([orphan])).toBe(60)
  })

  it('écrit le compte AVANT de ré-armer iOS', async () => {
    const order: string[] = []
    ;(BlockRulesService.update as jest.Mock).mockImplementation(async () => {
      order.push('cloud')
    })
    ;(armRule as jest.Mock).mockImplementation(async () => {
      order.push('native')
    })

    const count = await setDailyLimit([limitRule('a', 120)], 90)

    expect(count).toBe(1)
    // L'inverse — iOS à jour, base périmée — donnerait un écran qui ment sur
    // ce qui protège.
    expect(order).toEqual(['cloud', 'native'])
  })

  it('applique le nouveau plafond à toutes les limites, et à elles seules', async () => {
    const rules = [limitRule('a', 120), limitRule('b', 60), scheduleRule]
    await setDailyLimit(rules, 30)

    expect(BlockRulesService.update).toHaveBeenCalledTimes(2)
    expect(BlockRulesService.update).toHaveBeenCalledWith('a', {
      type: 'daily_limit',
      count: undefined,
      config: { limit_min: 30 },
    })
    expect(armRule).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'b', config: { limit_min: 30 } }),
    )
  })

  it('garde le compte à jour même si le ré-armement échoue', async () => {
    ;(armRule as jest.Mock).mockRejectedValue(new Error('autorisation retirée'))
    await expect(setDailyLimit([limitRule('a', 120)], 90)).resolves.toBe(1)
    expect(BlockRulesService.update).toHaveBeenCalled()
  })
})
