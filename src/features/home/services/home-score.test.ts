import {
  scoreBandKey,
  scoreBandRank,
  scoreFooterKey,
  toHomeScoreSnapshot,
} from '@/features/home/services/home-score'
import type { HomeScoreSnapshot } from '@/features/home/types'

const ready: HomeScoreSnapshot = {
  status: 'ready',
  global: 74,
  focus: 70,
  rest: 78,
  delta: 6,
  weakestAxis: 'focus',
  historyDays: 7,
}

describe('toHomeScoreSnapshot', () => {
  it('reports pending when the extension has published nothing', () => {
    expect(toHomeScoreSnapshot(null)).toMatchObject({
      status: 'pending',
      global: null,
      historyDays: 0,
    })
  })

  it('reports pending when the extension has no baseline yet', () => {
    expect(
      toHomeScoreSnapshot({ status: 'pending', historyDays: 0 }),
    ).toMatchObject({ status: 'pending', global: null })
  })

  it('refuses a ready status that carries no number', () => {
    // Un statut « prêt » sans chiffre est incohérent : mieux vaut « calcul en
    // cours » qu'un score partiel qui laisserait croire à une mesure.
    expect(
      toHomeScoreSnapshot({ status: 'ready', focus: 70, historyDays: 7 }),
    ).toMatchObject({ status: 'pending', global: null, focus: null })
  })

  it('keeps a provisional score and its confidence depth', () => {
    expect(
      toHomeScoreSnapshot({
        status: 'provisional',
        global: 52,
        focus: 50,
        rest: 54,
        weakestAxis: 'rest',
        historyDays: 2,
      }),
    ).toMatchObject({
      status: 'provisional',
      global: 52,
      weakestAxis: 'rest',
      historyDays: 2,
    })
  })

  it('clamps out-of-range values instead of trusting them', () => {
    expect(
      toHomeScoreSnapshot({
        status: 'ready',
        global: 140,
        focus: -20,
        rest: 60,
        historyDays: 7,
      }),
    ).toMatchObject({ global: 100, focus: 0, rest: 60 })
  })

  it('drops a delta that is not a finite number', () => {
    expect(
      toHomeScoreSnapshot({
        status: 'ready',
        global: 74,
        historyDays: 7,
        delta: Number.NaN,
      }),
    ).toMatchObject({ delta: null })
  })
})

describe('scoreBandRank', () => {
  it('maps each band to its rank', () => {
    expect(scoreBandRank(10)).toBe(0)
    expect(scoreBandRank(35)).toBe(1)
    expect(scoreBandRank(60)).toBe(2)
    expect(scoreBandRank(80)).toBe(3)
  })
})

describe('scoreBandKey', () => {
  it('announces the calculation while no score exists', () => {
    expect(scoreBandKey(toHomeScoreSnapshot(null))).toBe(
      'home.score_calculating',
    )
  })

  it('names the band once a score exists', () => {
    expect(scoreBandKey(ready)).toBe('home.score_band_good')
  })
})

describe('scoreFooterKey', () => {
  it('explains the wait rather than judging the day', () => {
    expect(scoreFooterKey(toHomeScoreSnapshot(null))).toBe(
      'home.score_footer_pending',
    )
  })

  it('flags an approximate score before the baseline is deep enough', () => {
    expect(scoreFooterKey({ ...ready, status: 'provisional' })).toBe(
      'home.score_footer_provisional',
    )
  })

  it('names the axis that is dragging the day down', () => {
    expect(scoreFooterKey(ready)).toBe('home.score_footer_focus_good')
    expect(scoreFooterKey({ ...ready, weakestAxis: 'rest' })).toBe(
      'home.score_footer_rest_good',
    )
  })

  it('follows the band, so the phrase changes with the score', () => {
    expect(scoreFooterKey({ ...ready, global: 20 })).toBe(
      'home.score_footer_focus_poor',
    )
    expect(scoreFooterKey({ ...ready, global: 90 })).toBe(
      'home.score_footer_focus_excellent',
    )
  })
})
