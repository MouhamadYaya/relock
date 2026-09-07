import {
  fixtureSnapshot,
  scoreBandKey,
  scoreBandRank,
  scoreFooterKey,
  toHomeScores,
  weakestComponent,
} from '@/features/home/services/home-score'
import type {
  HomeScoreComponent,
  HomeScoreSnapshot,
} from '@/features/home/types'

const component = (
  over: Partial<HomeScoreComponent> & Pick<HomeScoreComponent, 'signal'>,
): HomeScoreComponent => ({
  axis: 'focus',
  score: 50,
  weight: 0.5,
  observed: 0,
  reference: null,
  unit: 'count',
  ...over,
})

const snapshot = (
  over: Partial<HomeScoreSnapshot> = {},
): HomeScoreSnapshot => ({
  status: 'ready',
  global: 74,
  focus: 70,
  rest: 78,
  delta: 6,
  weakestAxis: 'focus',
  historyDays: 7,
  confidence: 1,
  components: [],
  trend: [],
  elapsedMinutes: 720,
  protectedMinutes: 0,
  ...over,
})

describe('scoreBandRank', () => {
  it('uses the same four bands everywhere', () => {
    expect(scoreBandRank(92)).toBe(3)
    expect(scoreBandRank(80)).toBe(3)
    expect(scoreBandRank(60)).toBe(2)
    expect(scoreBandRank(35)).toBe(1)
    expect(scoreBandRank(34)).toBe(0)
  })
})

describe('scoreBandKey', () => {
  it('says “calculating” rather than naming a band it has not measured', () => {
    expect(scoreBandKey(snapshot({ global: null }))).toBe(
      'home.score_calculating',
    )
  })

  it('names the band of the number on screen', () => {
    expect(scoreBandKey(snapshot({ global: 74 }))).toBe('home.score_band_good')
    expect(scoreBandKey(snapshot({ global: 20 }))).toBe('home.score_band_poor')
  })
})

describe('weakestComponent', () => {
  it('weighs the drop by how much it actually costs', () => {
    // La brèche a la note la plus basse, mais la pression pèse deux fois plus
    // lourd : c'est elle qu'il faut nommer, sinon on envoie l'utilisateur
    // corriger ce qui ne changera presque rien à son score.
    const weakest = weakestComponent(
      snapshot({
        components: [
          component({ signal: 'pressure', score: 40, weight: 0.55 }),
          component({ signal: 'breaches', score: 30, weight: 0.2 }),
        ],
      }),
    )
    expect(weakest?.signal).toBe('pressure')
  })

  it('has nothing to name when nothing was measured', () => {
    expect(weakestComponent(snapshot({ components: [] }))).toBeNull()
  })
})

describe('scoreFooterKey', () => {
  it('waits rather than encouraging a score that does not exist', () => {
    expect(scoreFooterKey(snapshot({ global: null }))).toBe(
      'home.score_footer_pending',
    )
  })

  it('says the score is still settling while confidence is partial', () => {
    expect(scoreFooterKey(snapshot({ status: 'provisional' }))).toBe(
      'home.score_footer_provisional',
    )
  })

  it('names the measure that is dragging the day down', () => {
    expect(
      scoreFooterKey(
        snapshot({
          global: 52,
          components: [
            component({
              signal: 'coverage',
              axis: 'rest',
              score: 30,
              weight: 0.4,
            }),
            component({ signal: 'pressure', score: 90, weight: 0.55 }),
          ],
        }),
      ),
    ).toBe('home.score_weak_coverage')
  })

  it('congratulates rather than nitpicking an excellent day', () => {
    expect(
      scoreFooterKey(
        snapshot({
          global: 88,
          components: [component({ signal: 'pressure', score: 84 })],
        }),
      ),
    ).toBe('home.score_footer_excellent')
  })
})

describe('toHomeScores', () => {
  it('marks the card unavailable when there is no global score', () => {
    expect(toHomeScores(snapshot({ global: null }))).toEqual({
      focus: 70,
      rest: 78,
      global: null,
      available: false,
    })
  })
})

describe('fixtureSnapshot', () => {
  it('replaces the whole snapshot so card and sheet cannot diverge', () => {
    const fixture = fixtureSnapshot(
      {
        enabled: true,
        streak: 4,
        focusScore: 78,
        restScore: 66,
        blockedCount: 3,
        blockedOverflow: 0,
      },
      new Date(2026, 0, 15, 12, 0),
    )
    expect(fixture).toMatchObject({
      status: 'ready',
      focus: 78,
      rest: 66,
      global: 72,
      weakestAxis: 'rest',
      delta: null,
    })
  })
})
