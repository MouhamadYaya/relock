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

/**
 * Jour LOCAL d'un événement natif. L'extension horodate en ISO 8601 **UTC**
 * (« 2026-07-14T02:30:00Z ») : un simple `slice(0, 10)` prendrait la date UTC
 * et rangerait un tap de 22h30 (UTC-4) sur la ligne de DEMAIN — stats du jour
 * figées à 0 et case « demain » remplie. On convertit donc via Date → ymd local.
 */
export function eventDayLocal(at: string | undefined): string | null {
  if (!at) return null
  const d = new Date(at)
  return Number.isNaN(d.getTime()) ? null : ymd(d)
}

/** Un « Bloquer maintenant » (timed) est-il terminé (fin = création + durée) ? */
function isExpiredTimed(
  r: { config: unknown; created_at: string | null },
  now: number,
): boolean {
  if (!r.created_at) return false
  const cfg = (r.config ?? {}) as Record<string, unknown>
  const dur = typeof cfg.duration_min === 'number' ? cfg.duration_min : 30
  return new Date(r.created_at).getTime() + dur * 60_000 <= now
}

export const StatsService = {
  /**
   * Remonte les événements de l'extension vers `daily_stats`.
   *
   * Protocole PULL-ACK (aucune perte possible) :
   *  1. session vérifiée AVANT toute lecture ;
   *  2. lecture du journal natif SANS le vider ;
   *  3. upsert Supabase ;
   *  4. seulement alors, purge des événements synchronisés (`ackEvents`).
   * En cas d'échec (offline, erreur), le journal reste intact et sera
   * resynchronisé au prochain passage.
   */
  async syncFromDevice(): Promise<void> {
    if (!ScreenTime.isAvailable) return

    const { data: u, error: uErr } = await supabase.auth.getUser()
    if (uErr) throw normalizeError(uErr)
    const userId = u.user?.id
    if (!userId) return // pas de session → on ne touche PAS au journal

    const events = await ScreenTime.pullEvents()
    if (!events.length) return

    // Regroupe par jour EN PRÉSERVANT L'ORDRE (le journal est du plus ancien au
    // plus récent, donc les jours y sont contigus et croissants).
    //  • shownPerDay    : AFFICHAGES du bouclier = tentatives d'ouverture
    //    arrêtées. C'est LA mesure des « ouvertures évitées » : le geste
    //    naturel devant le mur est de balayer vers l'accueil sans toucher
    //    aucun bouton — seul l'affichage en garde la trace ;
    //  • resistedPerDay : tap « Fermer » (renoncement explicite) ;
    //  • countPerDay    : nb d'events du jour → sert à l'ack ciblé ;
    //  • dayOrder       : jours dans l'ordre chronologique.
    const shownPerDay: Record<string, number> = {}
    const resistedPerDay: Record<string, number> = {}
    const countPerDay: Record<string, number> = {}
    const dayOrder: string[] = []
    for (const e of events) {
      const day = eventDayLocal(e.at)
      if (!day) continue
      if (!(day in countPerDay)) {
        countPerDay[day] = 0
        dayOrder.push(day)
      }
      countPerDay[day] += 1
      if (e.kind === 'resisted') {
        resistedPerDay[day] = (resistedPerDay[day] ?? 0) + 1
      }
      if (e.kind === 'shield_shown') {
        shownPerDay[day] = (shownPerDay[day] ?? 0) + 1
      }
    }

    // ACK PAR JOUR, immédiatement après chaque upsert validé. L'écriture est un
    // read-modify-write NON idempotent (`existing + resisted`) : si on ackait
    // tout à la fin, une interruption entre un upsert validé et l'ack ferait
    // RE-COMPTER ces events au prochain passage. En purgeant jour par jour, un
    // jour déjà écrit ne peut plus être rejoué ; un échec laisse ce jour (et les
    // suivants) intacts pour un retry sûr. `ackEvents(n)` purge les n plus
    // anciens → comme on traite dans l'ordre chronologique, ce sont bien ceux
    // du jour courant.
    for (const date of dayOrder) {
      const resisted = resistedPerDay[date] ?? 0
      const shown = shownPerDay[date] ?? 0
      // Un tap « Fermer » arrive sur un bouclier affiché : ne pas compter
      // l'ouverture deux fois.
      const avoided = Math.max(shown, resisted)
      const { data: existing } = await supabase
        .from('daily_stats')
        .select('interceptions_count,opens_stopped,time_saved_minutes')
        .eq('date', date)
        .maybeSingle()
      const { error } = await supabase.from('daily_stats').upsert(
        {
          user_id: userId,
          date,
          interceptions_count: (existing?.interceptions_count ?? 0) + avoided,
          opens_stopped: (existing?.opens_stopped ?? 0) + resisted,
          time_saved_minutes:
            (existing?.time_saved_minutes ?? 0) +
            avoided * MIN_SAVED_PER_RESIST,
          streak_respected: true,
        },
        { onConflict: 'user_id,date' },
      )
      if (error) throw normalizeError(error) // jour non acké → retry plus tard
      await ScreenTime.ackEvents(countPerDay[date]) // purge CE jour uniquement
    }
  },

  /**
   * « Jour de contrôle » : marque AUJOURD'HUI comme respecté dès lors qu'une
   * VRAIE protection est active — même sans aucune tentative d'ouverture.
   *
   * Purge d'abord les « Bloquer maintenant » (timed) déjà expirés : un one-shot
   * terminé doit disparaître. Sinon il reste `is_active=true` indéfiniment,
   * gonfle la série alors qu'il ne bloque plus rien, et devient une ligne
   * orpheline impossible à supprimer depuis l'UI (filtrée de l'Accueil).
   */
  async heartbeatToday(): Promise<void> {
    const { data: u } = await supabase.auth.getUser()
    const userId = u.user?.id
    if (!userId) return

    // Auto-guérison : une ligne datée dans le FUTUR est impossible légitimement
    // (séquelle du bug UTC→local). On la purge pour que la semaine et la série
    // redeviennent exactes dès la prochaine ouverture.
    await supabase.from('daily_stats').delete().gt('date', today())

    const { data: active } = await supabase
      .from('block_rules')
      .select('id,type,config,created_at')
      .eq('is_active', true)
    const rows = active ?? []
    const now = Date.now()

    const expiredTimed = rows.filter(
      r => r.type === 'progressive_delay' && isExpiredTimed(r, now),
    )
    for (const r of expiredTimed) {
      await supabase.from('block_rules').delete().eq('id', r.id)
      if (ScreenTime.isAvailable) {
        await ScreenTime.clearRuleData(r.id, 'timed').catch(() => {})
      }
    }

    // Ne compte QUE les protections encore réelles (les timed expirés purgés
    // ci-dessus ne comptent plus).
    if (rows.length - expiredTimed.length <= 0) return

    // Un jour compte parce qu'un blocage EXISTAIT ce jour-là — pas parce que
    // l'app a été ouverte. Sans ce rattrapage, une journée où tout marchait
    // mais où l'utilisateur n'a pas lancé Relock cassait sa chaîne : le punir
    // de ne pas avoir ouvert l'app est exactement l'inverse du but.
    const live = rows.filter(r => !expiredTimed.some(e => e.id === r.id))
    const oldest = Math.min(
      ...live.map(r => new Date(r.created_at ?? Date.now()).getTime()),
    )

    // Les jours où au moins un blocage encore vivant existait déjà. Bornés à
    // 30 : au-delà, on ne réécrit pas l'histoire.
    const days: string[] = []
    for (let i = 0; i < 30; i++) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      d.setHours(23, 59, 59, 999)
      if (d.getTime() < oldest) break
      days.push(ymd(d))
    }
    if (days.length === 0) return

    const { data: known } = await supabase
      .from('daily_stats')
      .select('date,streak_respected')
      .in('date', days)
    const already = new Set(
      (known ?? []).filter(r => r.streak_respected).map(r => r.date),
    )
    const missing = days.filter(d => !already.has(d))
    if (missing.length === 0) return

    await supabase.from('daily_stats').upsert(
      missing.map(date => ({ user_id: userId, date, streak_respected: true })),
      { onConflict: 'user_id,date' },
    )
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

  /**
   * Derniers jours (récents en premier) pour la série + le graphe.
   * 365 par défaut : la série et le record ne sont plus plafonnés à 30 j.
   */
  async recent(days = 365): Promise<DailyStats[]> {
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
