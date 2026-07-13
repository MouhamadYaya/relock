/**
 * QA — Simulation temporelle des statistiques (jours / semaines / mois).
 *
 * Fait « vivre » les fonctions de stats avec une horloge simulée
 * (jest.setSystemTime) pour vérifier que série, semaine, record, plages
 * horaires et anneaux évoluent correctement avec le temps — y compris les
 * cas limites : minuit, trous, changement de date, longues périodes.
 *
 * Lancer avec un fuseau fixe pour la reproductibilité :
 *   TZ=Europe/Paris npx jest __tests__/stats-simulation.test.ts
 */

jest.mock('@/shared/services/supabase/client', () => ({ supabase: {} }))
jest.mock('@/shared/native/screen-time', () => ({
  ScreenTime: { isAvailable: false },
}))

import {
  computeRecordStreak,
  computeStreak,
  computeWeek,
  ymd,
} from '@/features/blocking/services/stats/stats.service'
import {
  type BlockRuleView,
  blockEndDate,
  blockStatusLine,
  isLiveNow,
  isLocked,
  ringInfo,
  ringLabel,
  scheduleActive,
  timedRunning,
} from '@/features/blocking/types'
import type { DailyStats } from '@/shared/services/supabase/database.types'

// ── Aides ────────────────────────────────────────────────────────────────

const at = (iso: string) => new Date(iso)

/** Ligne daily_stats minimale pour un jour donné. */
function day(date: string, respected = true): DailyStats {
  return {
    id: date,
    user_id: 'u',
    date,
    interceptions_count: 1,
    opens_stopped: 1,
    time_saved_minutes: 5,
    streak_respected: respected,
  } as DailyStats
}

/** Génère n jours consécutifs finissant à `end` (inclus), récents en premier. */
function consecutiveDays(end: Date, n: number): DailyStats[] {
  const rows: DailyStats[] = []
  const d = new Date(end)
  for (let i = 0; i < n; i++) {
    rows.push(day(ymd(d)))
    d.setDate(d.getDate() - 1)
  }
  return rows
}

function timedRule(opts: {
  startedMinAgo: number
  durationMin: number
  strict?: boolean
}): BlockRuleView {
  return {
    id: 'r1',
    type: 'progressive_delay',
    appIds: [],
    isActive: true,
    count: 2,
    config: { duration_min: opts.durationMin, strict: !!opts.strict },
    createdAt: new Date(Date.now() - opts.startedMinAgo * 60_000).toISOString(),
  }
}

function scheduleRule(
  sh: number,
  sm: number,
  eh: number,
  em: number,
): BlockRuleView {
  return {
    id: 'r2',
    type: 'schedule',
    appIds: [],
    isActive: true,
    count: 1,
    config: {
      start_hour: sh,
      start_minute: sm,
      end_hour: eh,
      end_minute: em,
    },
  }
}

const limitRule = (min: number): BlockRuleView => ({
  id: 'r3',
  type: 'daily_limit',
  appIds: [],
  isActive: true,
  count: 1,
  config: { limit_min: min },
})

afterEach(() => {
  jest.useRealTimers()
})

// ── ymd : date LOCALE, pas UTC ───────────────────────────────────────────

describe('ymd (clé de jour locale)', () => {
  it('utilise la date locale même juste après minuit', () => {
    jest.useFakeTimers().setSystemTime(at('2026-07-05T00:30:00'))
    expect(ymd(new Date())).toBe('2026-07-05')
  })

  it('utilise la date locale juste avant minuit', () => {
    jest.useFakeTimers().setSystemTime(at('2026-07-04T23:59:00'))
    expect(ymd(new Date())).toBe('2026-07-04')
  })
})

// ── Série (streak) : évolution jour après jour ──────────────────────────

describe('computeStreak — simulation multi-jours', () => {
  it('croît chaque jour pendant 3 semaines d’activité continue', () => {
    const start = at('2026-06-01T09:00:00')
    for (let j = 1; j <= 21; j++) {
      const today = new Date(start)
      today.setDate(start.getDate() + j - 1)
      jest.useFakeTimers().setSystemTime(today)
      const rows = consecutiveDays(today, j)
      expect(computeStreak(rows)).toBe(j)
    }
  })

  it('ne casse PAS la série si aujourd’hui est encore vide (regarde hier)', () => {
    jest.useFakeTimers().setSystemTime(at('2026-07-13T08:00:00'))
    const yesterday = at('2026-07-12T12:00:00')
    const rows = consecutiveDays(yesterday, 5) // s’arrête hier
    expect(computeStreak(rows)).toBe(5)
  })

  it('retombe à 0 après un jour COMPLET sans activité', () => {
    jest.useFakeTimers().setSystemTime(at('2026-07-13T08:00:00'))
    const rows = consecutiveDays(at('2026-07-11T12:00:00'), 5) // s’arrête avant-hier
    expect(computeStreak(rows)).toBe(0)
  })

  it('un trou au milieu limite la série aux jours récents', () => {
    jest.useFakeTimers().setSystemTime(at('2026-07-13T20:00:00'))
    const rows = [
      ...consecutiveDays(at('2026-07-13T12:00:00'), 3), // 11,12,13
      // trou le 10
      ...consecutiveDays(at('2026-07-09T12:00:00'), 4), // 6..9
    ]
    expect(computeStreak(rows)).toBe(3)
  })

  it('ignore les jours non "respectés"', () => {
    jest.useFakeTimers().setSystemTime(at('2026-07-13T20:00:00'))
    const rows = [
      day('2026-07-13'),
      day('2026-07-12', false), // présent mais non respecté → casse
      day('2026-07-11'),
    ]
    expect(computeStreak(rows)).toBe(1)
  })

  it('BUG DOCUMENTÉ — plafonné par recent(30) : 45 jours réels affichent 30', () => {
    jest.useFakeTimers().setSystemTime(at('2026-07-13T20:00:00'))
    const rows45 = consecutiveDays(at('2026-07-13T12:00:00'), 45)
    const asReturnedByRecent30 = rows45.slice(0, 30) // .limit(30), récents d’abord
    expect(computeStreak(rows45)).toBe(45) // la vraie série
    expect(computeStreak(asReturnedByRecent30)).toBe(30) // ce que voit l’app
  })
})

// ── Record ───────────────────────────────────────────────────────────────

describe('computeRecordStreak', () => {
  it('trouve la meilleure suite historique (pas forcément la courante)', () => {
    const rows = [
      // suite courante : 2 jours
      day('2026-07-13'),
      day('2026-07-12'),
      // ancienne suite : 4 jours
      day('2026-07-08'),
      day('2026-07-07'),
      day('2026-07-06'),
      day('2026-07-05'),
    ]
    expect(computeRecordStreak(rows)).toBe(4)
  })

  it('reste correct à travers un changement d’heure (DST mars 2026)', () => {
    // 28→31 mars 2026 : passage à l’heure d’été en Europe le 29.
    const rows = [
      day('2026-03-31'),
      day('2026-03-30'),
      day('2026-03-29'),
      day('2026-03-28'),
    ]
    expect(computeRecordStreak(rows)).toBe(4)
  })

  it('ordre d’entrée indifférent', () => {
    const rows = [day('2026-07-06'), day('2026-07-08'), day('2026-07-07')]
    expect(computeRecordStreak(rows)).toBe(3)
  })
})

// ── Semaine (7 barres de l’Accueil) ──────────────────────────────────────

describe('computeWeek — lundi→dimanche', () => {
  it('un mercredi : L/M/M actifs, le reste inactif, mercredi = today', () => {
    jest.useFakeTimers().setSystemTime(at('2026-07-15T10:00:00')) // mercredi
    const rows = [day('2026-07-13'), day('2026-07-14'), day('2026-07-15')]
    const week = computeWeek(rows)
    expect(week.map(w => w.done)).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ])
    expect(week[2].today).toBe(true)
    expect(week.filter(w => w.today)).toHaveLength(1)
  })

  it('un dimanche : la semaine ne glisse pas (dimanche = 7e case)', () => {
    jest.useFakeTimers().setSystemTime(at('2026-07-19T22:00:00')) // dimanche
    const week = computeWeek([day('2026-07-19')])
    expect(week[6].today).toBe(true)
    expect(week[6].done).toBe(true)
    expect(week[0].done).toBe(false) // lundi 13 non fourni
  })

  it('à cheval sur deux mois (jeu 30 avr → dim 3 mai 2026… semaine du 27 avr)', () => {
    jest.useFakeTimers().setSystemTime(at('2026-04-30T12:00:00')) // jeudi
    const rows = [day('2026-04-27'), day('2026-05-01')] // lundi + vendredi
    const week = computeWeek(rows)
    expect(week[0].done).toBe(true) // lun 27 avril
    expect(week[4].done).toBe(true) // ven 1er mai
  })
})

// ── Plage horaire : minuit + bornes ──────────────────────────────────────

describe('scheduleActive — 22h→8h (traverse minuit)', () => {
  const rule = scheduleRule(22, 0, 8, 0)

  it.each([
    ['21:59', false],
    ['22:00', true],
    ['23:30', true],
    ['00:00', true],
    ['03:00', true],
    ['07:59', true],
    ['08:00', false],
    ['12:00', false],
  ])('à %s → %s', (hhmm, expected) => {
    expect(scheduleActive(rule, at(`2026-07-13T${hhmm}:00`))).toBe(expected)
  })

  it('plage simple 9h→17h', () => {
    const r = scheduleRule(9, 0, 17, 0)
    expect(scheduleActive(r, at('2026-07-13T08:59:00'))).toBe(false)
    expect(scheduleActive(r, at('2026-07-13T09:00:00'))).toBe(true)
    expect(scheduleActive(r, at('2026-07-13T16:59:00'))).toBe(true)
    expect(scheduleActive(r, at('2026-07-13T17:00:00'))).toBe(false)
  })
})

// ── Blocage minuté : cycle de vie complet ────────────────────────────────

describe('blocage minuté — début, cours, fin, strict', () => {
  it('en cours à T+29 sur 30 min ; fini à T+31', () => {
    jest.useFakeTimers().setSystemTime(at('2026-07-13T15:00:00'))
    expect(
      timedRunning(timedRule({ startedMinAgo: 29, durationMin: 30 })),
    ).toBe(true)
    expect(
      timedRunning(timedRule({ startedMinAgo: 31, durationMin: 30 })),
    ).toBe(false)
  })

  it('blockEndDate = createdAt + durée', () => {
    jest.useFakeTimers().setSystemTime(at('2026-07-13T15:00:00'))
    const r = timedRule({ startedMinAgo: 10, durationMin: 45 })
    expect(blockEndDate(r)?.toISOString()).toBe(
      at('2026-07-13T15:35:00').toISOString(),
    )
  })

  it('strict : verrouillé pendant, déverrouillé après la fin', () => {
    jest.useFakeTimers().setSystemTime(at('2026-07-13T15:00:00'))
    const locked = timedRule({
      startedMinAgo: 10,
      durationMin: 60,
      strict: true,
    })
    expect(isLocked(locked)).toBe(true)
    jest.setSystemTime(at('2026-07-13T16:01:00')) // 61 min plus tard
    expect(isLocked(locked)).toBe(false)
  })

  it('strict à cheval sur minuit : reste verrouillé après le changement de date', () => {
    jest.useFakeTimers().setSystemTime(at('2026-07-13T23:50:00'))
    const r = timedRule({ startedMinAgo: 5, durationMin: 60, strict: true })
    jest.setSystemTime(at('2026-07-14T00:30:00')) // date suivante, T+40
    expect(isLocked(r)).toBe(true)
    expect(timedRunning(r)).toBe(true)
  })
})

// ── Zonage Accueil (En ce moment / Mes règles) ───────────────────────────

describe('isLiveNow — zonage', () => {
  it('minuté en cours → live ; expiré → non', () => {
    jest.useFakeTimers().setSystemTime(at('2026-07-13T15:00:00'))
    expect(isLiveNow(timedRule({ startedMinAgo: 5, durationMin: 30 }))).toBe(
      true,
    )
    expect(isLiveNow(timedRule({ startedMinAgo: 60, durationMin: 30 }))).toBe(
      false,
    )
  })

  it('plage 22h→8h : live à 23h, pas à midi', () => {
    const r = scheduleRule(22, 0, 8, 0)
    expect(isLiveNow(r, at('2026-07-13T23:00:00'))).toBe(true)
    expect(isLiveNow(r, at('2026-07-13T12:00:00'))).toBe(false)
  })

  it('une règle en pause n’est jamais live', () => {
    const r = { ...scheduleRule(22, 0, 8, 0), isActive: false }
    expect(isLiveNow(r, at('2026-07-13T23:00:00'))).toBe(false)
  })

  it('une limite quotidienne ne va jamais dans « En ce moment »', () => {
    expect(isLiveNow(limitRule(60), at('2026-07-13T23:00:00'))).toBe(false)
  })
})

// ── Anneaux : bornes + libellés ──────────────────────────────────────────

describe('ringInfo / ringLabel', () => {
  it('fraction bornée [0,1] même très en retard', () => {
    jest.useFakeTimers().setSystemTime(at('2026-07-13T15:00:00'))
    const stale = timedRule({ startedMinAgo: 500, durationMin: 30 })
    expect(ringInfo(stale).fraction).toBe(0)
    const fresh = timedRule({ startedMinAgo: 0, durationMin: 30 })
    expect(ringInfo(fresh).fraction).toBeLessThanOrEqual(1)
  })

  it('minuté à mi-course → ~0,5', () => {
    jest.useFakeTimers().setSystemTime(at('2026-07-13T15:00:00'))
    const r = timedRule({ startedMinAgo: 15, durationMin: 30 })
    expect(ringInfo(r).fraction).toBeCloseTo(0.5, 1)
  })

  it('plage 22h→8h à 3h du matin : moitié écoulée', () => {
    const r = scheduleRule(22, 0, 8, 0)
    const { fraction, color } = ringInfo(r, at('2026-07-14T03:00:00'))
    expect(color).toBe('accent')
    expect(fraction).toBeCloseTo(0.5, 1)
  })

  it('limite : couleur ambre (quota), fraction pleine (placeholder documenté)', () => {
    const { color, fraction } = ringInfo(limitRule(60))
    expect(color).toBe('amber')
    expect(fraction).toBe(1)
  })

  it('libellés : 74 min → “1h14”, 45 min → “45m”, limites 90/45', () => {
    jest.useFakeTimers().setSystemTime(at('2026-07-13T15:00:00'))
    expect(ringLabel(timedRule({ startedMinAgo: 0, durationMin: 74 }))).toBe(
      '1h14',
    )
    expect(ringLabel(timedRule({ startedMinAgo: 0, durationMin: 45 }))).toBe(
      '45m',
    )
    expect(ringLabel(limitRule(90))).toBe('1h30')
    expect(ringLabel(limitRule(45))).toBe('45m')
  })
})

// ── Ligne de statut des cartes ───────────────────────────────────────────

describe('blockStatusLine', () => {
  it('minuté en cours / terminé', () => {
    jest.useFakeTimers().setSystemTime(at('2026-07-13T15:00:00'))
    expect(
      blockStatusLine(timedRule({ startedMinAgo: 16, durationMin: 90 })),
    ).toContain('encore 1 h 14')
    expect(
      blockStatusLine(timedRule({ startedMinAgo: 91, durationMin: 90 })),
    ).toContain('terminé')
  })

  it('plage + limite lisibles', () => {
    expect(blockStatusLine(scheduleRule(22, 0, 8, 0))).toContain('22h → 8h')
    expect(blockStatusLine(limitRule(60))).toContain('limite 1 h / jour')
  })
})

// ── Simulation longue durée : 6 mois d’usage réaliste ────────────────────

describe('simulation 6 mois (usage réaliste avec pauses)', () => {
  it('série/record/semaine restent cohérents à chaque jalon', () => {
    // Profil simulé : 20 j actifs, 2 j de pause, 40 j actifs, 1 j de pause,
    // puis 10 j actifs (le tout consécutif jusqu’à « aujourd’hui »).
    const END = at('2026-12-01T20:00:00')
    jest.useFakeTimers().setSystemTime(END)

    const rows: DailyStats[] = []
    const d = new Date(END)
    const push = (n: number, respected: boolean) => {
      for (let i = 0; i < n; i++) {
        rows.push(day(ymd(d), respected))
        d.setDate(d.getDate() - 1)
      }
    }
    push(10, true) // 10 derniers jours actifs
    push(1, false) // 1 jour de pause
    push(40, true) // 40 jours actifs
    push(2, false) // 2 jours de pause
    push(20, true) // 20 jours actifs

    // Série courante = 10 (jusqu’au trou d’il y a 11 jours).
    expect(computeStreak(rows)).toBe(10)
    // Record historique = 40.
    expect(computeRecordStreak(rows)).toBe(40)
    // La semaine courante (mar 1er déc) : lundi + mardi actifs seulement.
    const week = computeWeek(rows)
    expect(week[0].done).toBe(true)
    expect(week[1].done).toBe(true)
    expect(week[1].today).toBe(true)
    expect(week.slice(2).every(w => !w.done)).toBe(true)
  })
})
