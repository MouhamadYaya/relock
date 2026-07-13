/**
 * Stats réelles. Source de vérité : le journal d'événements de l'extension
 * (via App Group → `ScreenTime.pullEvents`), remonté dans Supabase `daily_stats`.
 *
 * « resisted » = l'utilisateur a buté sur l'écran de blocage et tapé « Fermer »
 * (proxy fiable des ouvertures évitées ; iOS ne donne pas le nb d'ouvertures).
 */

import { ScreenTime } from '@/shared/native/screen-time'
import { supabase } from '@/shared/services/supabase/client'
import type { DailyStats } from '@/shared/services/supabase/database.types'
import { normalizeError } from '@/shared/utils/normalize-error'

/** Estimation : minutes regagnées par ouverture évitée (hypothèse produit). */
export const MIN_SAVED_PER_RESIST = 5

/** Date locale « YYYY-MM-DD » (pas UTC — sinon décalage d'un jour selon le fuseau). */
export function ymd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const today = () => ymd(new Date())

export const StatsService = {
  /** Remonte les événements de l'extension vers `daily_stats` (idempotent-ish). */
  async syncFromDevice(): Promise<void> {
    if (!ScreenTime.isAvailable) return
    const events = await ScreenTime.pullEvents()
    if (!events.length) return

    const { data: u, error: uErr } = await supabase.auth.getUser()
    if (uErr) throw normalizeError(uErr)
    const userId = u.user?.id
    if (!userId) return

    // Compte les « résistances » par jour.
    const perDay: Record<string, number> = {}
    for (const e of events) {
      if (e.kind !== 'resisted') continue
      const day = (e.at ?? '').slice(0, 10)
      if (day) perDay[day] = (perDay[day] ?? 0) + 1
    }

    for (const [date, resisted] of Object.entries(perDay)) {
      const { data: existing } = await supabase
        .from('daily_stats')
        .select('interceptions_count,opens_stopped,time_saved_minutes')
        .eq('date', date)
        .maybeSingle()
      await supabase.from('daily_stats').upsert(
        {
          user_id: userId,
          date,
          interceptions_count: (existing?.interceptions_count ?? 0) + resisted,
          opens_stopped: (existing?.opens_stopped ?? 0) + resisted,
          time_saved_minutes:
            (existing?.time_saved_minutes ?? 0) + resisted * MIN_SAVED_PER_RESIST,
          streak_respected: true,
        },
        { onConflict: 'user_id,date' },
      )
    }
  },

  async today(): Promise<DailyStats | null> {
    const { data, error } = await supabase
      .from('daily_stats')
      .select('*')
      .eq('date', today())
      .maybeSingle()
    if (error) throw normalizeError(error)
    return data
  },

  /** Derniers jours (récents en premier) pour la série + le graphe. */
  async recent(days = 30): Promise<DailyStats[]> {
    const { data, error } = await supabase
      .from('daily_stats')
      .select('*')
      .order('date', { ascending: false })
      .limit(days)
    if (error) throw normalizeError(error)
    return data ?? []
  },
}

/** Semaine courante (lun→dim) : chaque jour actif ou non (pour l'Accueil). */
export function computeWeek(
  rows: DailyStats[],
): { d: string; done: boolean; today: boolean }[] {
  const set = new Set(rows.filter(r => r.streak_respected).map(r => r.date))
  const labels = ['L', 'M', 'M', 'J', 'V', 'S', 'D']
  const now = new Date()
  const todayKey = ymd(now)
  const dow = (now.getDay() + 6) % 7 // 0 = lundi
  const monday = new Date(now)
  monday.setDate(now.getDate() - dow)
  return labels.map((d, i) => {
    const day = new Date(monday)
    day.setDate(monday.getDate() + i)
    const key = ymd(day)
    return { d, done: set.has(key), today: key === todayKey }
  })
}

/** Record = plus longue suite de jours consécutifs jamais atteinte. */
export function computeRecordStreak(rows: DailyStats[]): number {
  const dates = rows
    .filter(r => r.streak_respected)
    .map(r => r.date)
    .sort()
  let best = 0
  let cur = 0
  let prev: number | null = null
  for (const ds of dates) {
    const t = new Date(ds).getTime()
    cur = prev !== null && t - prev === 86_400_000 ? cur + 1 : 1
    best = Math.max(best, cur)
    prev = t
  }
  return best
}

/** Série = nb de jours consécutifs (jusqu'à aujourd'hui) avec une activité. */
export function computeStreak(rows: DailyStats[]): number {
  const byDate = new Set(rows.filter(r => r.streak_respected).map(r => r.date))
  let streak = 0
  const d = new Date()
  // Autorise que « aujourd'hui » soit encore vide sans casser la série.
  if (!byDate.has(ymd(d))) d.setDate(d.getDate() - 1)
  for (;;) {
    const key = ymd(d)
    if (!byDate.has(key)) break
    streak += 1
    d.setDate(d.getDate() - 1)
  }
  return streak
}
