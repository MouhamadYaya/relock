import type { BlockRuleView } from '@/features/blocking/types'
import {
  dayProtection,
  mergeSpans,
  startOfDay,
} from '@/features/home/services/protection-windows'

const rule = (over: Partial<BlockRuleView>): BlockRuleView => ({
  id: 'r1',
  type: 'schedule',
  appIds: [],
  isActive: true,
  ...over,
})

/** Une plage de nuit, 22 h → 8 h, tous les jours, créée il y a longtemps. */
const nightly = rule({
  config: { start_hour: 22, start_minute: 0, end_hour: 8, end_minute: 0 },
  createdAt: '2026-01-01T00:00:00.000Z',
})

describe('dayProtection', () => {
  it('counts the tail of a window that started yesterday', () => {
    // À midi, une plage 22 h → 8 h a déjà protégé les huit heures de la nuit.
    // Sans la fenêtre de la veille, la moitié la plus utile disparaîtrait.
    const day = new Date(2026, 0, 15, 12, 0)
    const result = dayProtection([nightly], day, day)
    expect(result.protectedMinutes).toBe(480)
    expect(result.elapsedMinutes).toBe(720)
    expect(result.hasWindows).toBe(true)
  })

  it('ignores a schedule that does not apply on that weekday', () => {
    // 2026-01-15 est un jeudi (4) ; la règle ne vise que le lundi.
    const monday = rule({
      config: {
        start_hour: 9,
        start_minute: 0,
        end_hour: 11,
        end_minute: 0,
        days: [1],
      },
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    const day = new Date(2026, 0, 15, 12, 0)
    expect(dayProtection([monday], day, day)).toMatchObject({
      protectedMinutes: 0,
      hasWindows: false,
    })
  })

  it('does not credit a rule before it existed', () => {
    const created = new Date(2026, 0, 15, 10, 0)
    const late = rule({
      config: { start_hour: 9, start_minute: 0, end_hour: 12, end_minute: 0 },
      createdAt: created.toISOString(),
    })
    const day = new Date(2026, 0, 15, 12, 0)
    // Fenêtre 9 h → 12 h, mais la règle n'existe que depuis 10 h : deux heures.
    expect(dayProtection([late], day, day).protectedMinutes).toBe(120)
  })

  it('measures a timed block from its creation, for its duration', () => {
    const created = new Date(2026, 0, 15, 9, 0)
    const timed = rule({
      type: 'progressive_delay',
      config: { duration_min: 90 },
      createdAt: created.toISOString(),
    })
    const day = new Date(2026, 0, 15, 12, 0)
    expect(dayProtection([timed], day, day).protectedMinutes).toBe(90)
  })

  it('never double-counts two overlapping rules', () => {
    const a = rule({
      id: 'a',
      config: { start_hour: 9, start_minute: 0, end_hour: 11, end_minute: 0 },
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    const b = rule({
      id: 'b',
      config: { start_hour: 10, start_minute: 0, end_hour: 12, end_minute: 0 },
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    const day = new Date(2026, 0, 15, 12, 0)
    // 9 h → 12 h en une seule couverture : trois heures, pas quatre.
    expect(dayProtection([a, b], day, day).protectedMinutes).toBe(180)
  })

  it('leaves a daily limit out — it defines no window', () => {
    const limit = rule({
      type: 'daily_limit',
      config: { limit_min: 60 },
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    const day = new Date(2026, 0, 15, 12, 0)
    expect(dayProtection([limit], day, day)).toMatchObject({
      protectedMinutes: 0,
      hasWindows: false,
    })
  })

  it('skips inactive rules entirely', () => {
    const day = new Date(2026, 0, 15, 12, 0)
    const off = { ...nightly, isActive: false }
    expect(dayProtection([off], day, day).hasWindows).toBe(false)
  })
})

describe('mergeSpans', () => {
  it('fuses touching intervals and keeps disjoint ones apart', () => {
    expect(
      mergeSpans([
        { start: 0, end: 10 },
        { start: 5, end: 20 },
        { start: 40, end: 50 },
      ]),
    ).toEqual([
      { start: 0, end: 20 },
      { start: 40, end: 50 },
    ])
  })
})

describe('startOfDay', () => {
  it('rewinds to local midnight, not UTC', () => {
    const midnight = startOfDay(new Date(2026, 0, 15, 23, 45))
    expect(midnight.getDate()).toBe(15)
    expect(midnight.getHours()).toBe(0)
  })
})
