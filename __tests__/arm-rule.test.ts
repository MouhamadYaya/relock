/**
 * `armRule` est le SEUL point où une règle stockée redevient une mécanique
 * native. Une erreur ici ne casse rien de visible : l'app affiche une
 * protection parfaitement normale, et iOS ne bloque simplement jamais — ou
 * bloque le mauvais jour. D'où ce verrou sur les trois types.
 */
jest.mock('@/shared/native/screen-time', () => ({
  __esModule: true,
  ScreenTime: {
    isAvailable: true,
    startTimedBlock: jest.fn().mockResolvedValue(true),
    startSchedule: jest.fn().mockResolvedValue(true),
    startDailyLimit: jest.fn().mockResolvedValue(true),
    armedActivities: jest.fn().mockResolvedValue([]),
  },
}))

import { armRule, armRuleIfNeeded } from '@/features/blocking/services/arm'
import type { BlockRuleView } from '@/features/blocking/types'
import { ScreenTime } from '@/shared/native/screen-time'

const rule = (over: Partial<BlockRuleView>): BlockRuleView =>
  ({
    id: 'r1',
    isActive: true,
    appIds: [],
    createdAt: '2026-09-01T00:00:00Z',
    ...over,
  }) as BlockRuleView

beforeEach(() => jest.clearAllMocks())

describe('armRule', () => {
  it('« Bloquer maintenant » → blocage minuté, mode strict transmis', async () => {
    await armRule(
      rule({
        type: 'progressive_delay',
        config: { duration_min: 45, strict: true },
      }),
    )
    expect(ScreenTime.startTimedBlock).toHaveBeenCalledWith('r1', 45, true)
    expect(ScreenTime.startSchedule).not.toHaveBeenCalled()
    expect(ScreenTime.startDailyLimit).not.toHaveBeenCalled()
  })

  it('durée absente → 30 min par défaut, jamais 0', async () => {
    await armRule(rule({ type: 'progressive_delay', config: {} }))
    expect(ScreenTime.startTimedBlock).toHaveBeenCalledWith('r1', 30, false)
  })

  it('plage horaire → bornes ET jours transmis au natif', async () => {
    await armRule(
      rule({
        type: 'schedule',
        config: {
          start_hour: 22,
          start_minute: 30,
          end_hour: 7,
          end_minute: 15,
          days: [1, 2, 3, 4, 5],
        },
      }),
    )
    expect(ScreenTime.startSchedule).toHaveBeenCalledWith(
      'r1',
      22,
      30,
      7,
      15,
      [1, 2, 3, 4, 5],
    )
  })

  it('plage sans jours → tableau vide (= tous les jours côté natif)', async () => {
    await armRule(
      rule({ type: 'schedule', config: { start_hour: 9, end_hour: 17 } }),
    )
    expect(ScreenTime.startSchedule).toHaveBeenCalledWith('r1', 9, 0, 17, 0, [])
  })

  it('limite quotidienne → seuil en minutes, 60 par défaut', async () => {
    await armRule(rule({ type: 'daily_limit', config: { limit_min: 20 } }))
    expect(ScreenTime.startDailyLimit).toHaveBeenCalledWith('r1', 20)

    jest.clearAllMocks()
    await armRule(rule({ type: 'daily_limit', config: {} }))
    expect(ScreenTime.startDailyLimit).toHaveBeenCalledWith('r1', 60)
  })

  it('config absente → la règle est quand même armée, jamais ignorée', async () => {
    await armRule(rule({ type: 'daily_limit' }))
    expect(ScreenTime.startDailyLimit).toHaveBeenCalledWith('r1', 60)
  })
})

/**
 * Une limite de temps compte à partir de son armement le jour de sa création :
 * la ré-armer ce jour-là rendrait à l'utilisateur le quota qu'il vient de
 * consommer. Une pause suivie d'une reprise deviendrait le moyen le plus simple
 * d'effacer sa matinée — d'où ce garde sur les chemins de simple reprise.
 */
describe('armRuleIfNeeded', () => {
  it('surveillance déjà armée côté iOS → on ne touche à rien', async () => {
    ;(ScreenTime.armedActivities as jest.Mock).mockResolvedValueOnce([
      'limit.r1',
    ])
    await armRuleIfNeeded(rule({ type: 'daily_limit', config: {} }))
    expect(ScreenTime.startDailyLimit).not.toHaveBeenCalled()
  })

  it('surveillance perdue (réinstallation) → la règle est ré-armée', async () => {
    ;(ScreenTime.armedActivities as jest.Mock).mockResolvedValueOnce([
      'limit.autre-regle',
    ])
    await armRuleIfNeeded(rule({ type: 'daily_limit', config: {} }))
    expect(ScreenTime.startDailyLimit).toHaveBeenCalledWith('r1', 60)
  })

  it('natif muet → on ré-arme plutôt que de laisser la règle sans surveillance', async () => {
    ;(ScreenTime.armedActivities as jest.Mock).mockRejectedValueOnce(
      new Error('nope'),
    )
    await armRuleIfNeeded(rule({ type: 'schedule', config: {} }))
    expect(ScreenTime.startSchedule).toHaveBeenCalled()
  })
})
