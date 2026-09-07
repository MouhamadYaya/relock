import type { BlockRuleView } from '@/features/blocking/types'
import {
  computeHomeScore,
  dayKey,
  relativeScore,
  type ScoreDayStats,
  type ScoreInput,
} from '@/features/home/services/score-engine'

const NOON = new Date(2026, 0, 15, 12, 0)

/** `count` jours pleins avant `NOON`, avec la même pression chaque jour. */
function history(
  count: number,
  interceptions = 24,
  opensStopped = 12,
  streak = true,
): ScoreDayStats[] {
  const days: ScoreDayStats[] = []
  for (let index = 1; index <= count; index += 1) {
    const day = new Date(NOON)
    day.setDate(day.getDate() - index)
    days.push({
      date: dayKey(day),
      interceptions_count: interceptions,
      opens_stopped: opensStopped,
      streak_respected: streak,
    })
  }
  return days
}

const today = (interceptions: number, opensStopped = 0): ScoreDayStats => ({
  date: dayKey(NOON),
  interceptions_count: interceptions,
  opens_stopped: opensStopped,
  streak_respected: true,
})

const nightly: BlockRuleView = {
  id: 'night',
  type: 'schedule',
  appIds: [],
  isActive: true,
  config: { start_hour: 22, start_minute: 0, end_hour: 8, end_minute: 0 },
  createdAt: '2025-12-01T00:00:00.000Z',
}

const input = (over: Partial<ScoreInput> = {}): ScoreInput => ({
  now: NOON,
  history: [],
  rules: [],
  limitSteps: {},
  reprievedApps: 0,
  ...over,
})

describe('relativeScore', () => {
  it('reads as “compared to your usual”', () => {
    expect(relativeScore(1)).toBe(50) // exactement ta normale
    expect(relativeScore(0.5)).toBe(100) // deux fois mieux
    expect(relativeScore(2)).toBe(0) // deux fois pire
    expect(relativeScore(0.75)).toBe(75)
    expect(relativeScore(1.5)).toBe(25)
  })
})

describe('computeHomeScore', () => {
  it('refuses to score a day it has measured nothing about', () => {
    // Aucun historique, aucune règle : rien à comparer, donc pas de score.
    // Inventer un 100 (ou un 0) serait la seule vraie faute possible ici.
    const snapshot = computeHomeScore(input())
    expect(snapshot).toMatchObject({
      status: 'pending',
      global: null,
      focus: null,
      rest: null,
      components: [],
      trend: [],
    })
  })

  it('rewards a day with fewer attempts than the personal median', () => {
    const snapshot = computeHomeScore(
      input({ history: [today(6, 3), ...history(14)] }),
    )
    const pressure = snapshot.components.find(c => c.signal === 'pressure')
    // 6 tentatives en 12 h contre une normale de 24/jour, soit 12 à cette
    // heure-ci : moitié moins que d'habitude → la note plafonne.
    expect(pressure).toMatchObject({ score: 100, observed: 6, reference: 12 })
    expect(snapshot.focus).toBeGreaterThan(80)
    expect(snapshot.status).toBe('ready')
  })

  it('punishes a day with far more attempts than usual', () => {
    const snapshot = computeHomeScore(
      input({ history: [today(48), ...history(14)] }),
    )
    const pressure = snapshot.components.find(c => c.signal === 'pressure')
    // 48 en 12 h = 4/h contre 1/h de référence : quatre fois pire.
    expect(pressure?.score).toBe(0)
    expect(snapshot.focus).toBeLessThan(50)
  })

  it('moves the score when — and only when — the day actually moves', () => {
    const calm = computeHomeScore(
      input({ history: [today(6), ...history(14)] }),
    )
    const busy = computeHomeScore(
      input({ history: [today(36), ...history(14)] }),
    )
    expect(calm.global).not.toBeNull()
    expect(busy.global).not.toBeNull()
    expect(calm.global!).toBeGreaterThan(busy.global!)
  })

  it('credits backing off at the wall', () => {
    const gaveIn = computeHomeScore(
      input({ history: [today(20, 0), ...history(14)] }),
    )
    const backedOff = computeHomeScore(
      input({ history: [today(20, 20), ...history(14)] }),
    )
    expect(gaveIn.components.find(c => c.signal === 'resistance')?.score).toBe(
      50,
    )
    expect(
      backedOff.components.find(c => c.signal === 'resistance')?.score,
    ).toBe(100)
    expect(backedOff.focus!).toBeGreaterThan(gaveIn.focus!)
  })

  it('leaves resistance out of the day when nothing was attempted', () => {
    const snapshot = computeHomeScore(
      input({ history: [today(0), ...history(14)] }),
    )
    // Sans tentative, « as-tu renoncé ? » n'a pas de réponse : la composante
    // est absente, pas neutralisée à 50 — son poids revient aux autres.
    expect(snapshot.components.map(c => c.signal)).not.toContain('resistance')
    expect(snapshot.components.map(c => c.signal)).toContain('pressure')
  })

  it('counts the protected part of the day', () => {
    const snapshot = computeHomeScore(
      input({ history: [today(6), ...history(14)], rules: [nightly] }),
    )
    const coverage = snapshot.components.find(c => c.signal === 'coverage')
    expect(coverage).toMatchObject({ observed: 480, reference: 720 })
    expect(snapshot.protectedMinutes).toBe(480)
    expect(snapshot.elapsedMinutes).toBe(720)
  })

  it('drops coverage when no window covered that day', () => {
    const snapshot = computeHomeScore(
      input({ history: [today(6), ...history(14)] }),
    )
    expect(snapshot.components.map(c => c.signal)).not.toContain('coverage')
    expect(snapshot.components.map(c => c.signal)).toContain('regularity')
  })

  it('reads a quota against the time of day, not against zero', () => {
    const limit: BlockRuleView = {
      id: 'limit',
      type: 'daily_limit',
      appIds: [],
      isActive: true,
      config: { limit_min: 60 },
      createdAt: '2025-12-01T00:00:00.000Z',
    }
    // À midi, la moitié de la journée est passée. Avoir consommé la moitié du
    // quota, c'est être exactement dans le rythme.
    const onPace = computeHomeScore(
      input({
        history: [today(6), ...history(14)],
        rules: [limit],
        limitSteps: { limit: 0.5 },
      }),
    )
    const burned = computeHomeScore(
      input({
        history: [today(6), ...history(14)],
        rules: [limit],
        limitSteps: { limit: 1 },
      }),
    )
    expect(onPace.components.find(c => c.signal === 'quota')).toMatchObject({
      score: 50,
      observed: 50,
      reference: 50,
    })
    expect(burned.components.find(c => c.signal === 'quota')?.score).toBe(0)
  })

  it('marks reprieves as a bypassed protection', () => {
    const sealed = computeHomeScore(
      input({
        history: [today(6), ...history(14)],
        rules: [nightly],
        reprievedApps: 0,
      }),
    )
    const breached = computeHomeScore(
      input({
        history: [today(6), ...history(14)],
        rules: [nightly],
        reprievedApps: 2,
      }),
    )
    expect(sealed.components.find(c => c.signal === 'breaches')?.score).toBe(
      100,
    )
    expect(breached.components.find(c => c.signal === 'breaches')?.score).toBe(
      40,
    )
    expect(breached.focus!).toBeLessThan(sealed.focus!)
  })

  it('stays provisional and close to neutral on thin history', () => {
    const thin = computeHomeScore(input({ history: [today(0), ...history(1)] }))
    expect(thin.status).toBe('provisional')
    expect(thin.confidence).toBeCloseTo(0.2)
    // Une seule journée de recul ne justifie pas un 100 : le résultat est tiré
    // vers 50 au prorata de ce qu'on sait réellement.
    expect(thin.global!).toBeGreaterThan(45)
    expect(thin.global!).toBeLessThan(65)
  })

  it('compares today to yesterday, scored the same way', () => {
    // Hier : 24 tentatives sur une journée pleine — sa propre normale.
    // Aujourd'hui : 6 en 12 h, soit deux fois mieux. L'écart doit être positif.
    const snapshot = computeHomeScore(
      input({ history: [today(6), ...history(14)] }),
    )
    expect(snapshot.delta).not.toBeNull()
    expect(snapshot.delta!).toBeGreaterThan(0)
  })

  it('returns seven trend points, ending on today', () => {
    const snapshot = computeHomeScore(
      input({ history: [today(6), ...history(14)] }),
    )
    expect(snapshot.trend).toHaveLength(7)
    expect(snapshot.trend[6]).toEqual({
      date: dayKey(NOON),
      score: snapshot.global,
    })
    expect(snapshot.trend[0].date).toBe(dayKey(new Date(2026, 0, 9)))
  })

  it('keeps the published formula true: the mean of the two axes', () => {
    // La carte annonce « Score global = (Focus + Repos) ÷ 2 ». C'est un
    // engagement affiché à l'utilisateur : il doit pouvoir refaire le calcul.
    const snapshot = computeHomeScore(
      input({ history: [today(9, 4), ...history(14)], rules: [nightly] }),
    )
    expect(snapshot.global).toBe(
      Math.round((snapshot.focus! + snapshot.rest!) / 2),
    )
  })

  it('names the weaker axis so the copy can act on it', () => {
    const snapshot = computeHomeScore(
      input({
        history: [today(48), ...history(14)],
        rules: [nightly],
      }),
    )
    expect(snapshot.focus!).toBeLessThan(snapshot.rest!)
    expect(snapshot.weakestAxis).toBe('focus')
  })

  it('treats a quiet history as a calm baseline, not a division by zero', () => {
    // Aucun jour de référence n'a la moindre tentative : sans plancher, le
    // ratio serait infini et la moindre tentative vaudrait un effondrement.
    const snapshot = computeHomeScore(
      input({ history: [today(1), ...history(14, 0, 0)] }),
    )
    const pressure = snapshot.components.find(c => c.signal === 'pressure')
    expect(pressure?.score).toBe(100)
    expect(Number.isFinite(pressure!.score)).toBe(true)
  })
})
