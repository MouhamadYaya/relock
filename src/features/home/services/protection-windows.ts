/**
 * Les fenêtres de protection d'une journée, reconstruites depuis les règles.
 *
 * Le score a besoin de savoir COMBIEN de temps une journée a réellement été
 * protégée — pas seulement si une règle existe. Une plage 22 h → 8 h ne
 * protège pas la même chose à midi qu'à 7 h du matin, et une règle créée hier
 * n'a rien protégé avant-hier.
 *
 * Tout se déduit de la configuration des règles (`config` + `createdAt`), donc
 * n'importe quel jour passé est calculable — c'est ce qui permet de noter hier
 * exactement comme aujourd'hui, condition sine qua non d'un écart honnête.
 *
 * ⚠️ Une suspension n'est pas historisée (seule `suspended_until`, l'échéance
 * courante, existe). Les minutes déjà écoulées sont donc comptées comme
 * tenues : on préfère surestimer légèrement le passé plutôt qu'inventer une
 * interruption dont rien ne garde la trace.
 */
import type { BlockRuleView } from '@/features/blocking/types'

const MINUTE = 60_000
const DAY_MIN = 1440

export interface TimeSpan {
  start: number
  end: number
}

const num = (value: unknown, fallback = 0): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback

const config = (rule: BlockRuleView): Record<string, unknown> =>
  rule.config ?? {}

/** Minuit local du jour qui contient `date`. */
export function startOfDay(date: Date): Date {
  const day = new Date(date)
  day.setHours(0, 0, 0, 0)
  return day
}

/** Jours d'application (0 = dimanche). `null` ⇒ tous les jours. */
function ruleDays(rule: BlockRuleView): number[] | null {
  const days = config(rule).days
  return Array.isArray(days) && days.length > 0 ? (days as number[]) : null
}

function appliesOn(rule: BlockRuleView, day: Date): boolean {
  const days = ruleDays(rule)
  return !days || days.includes(day.getDay())
}

/** Instant de création de la règle. Absent ⇒ « a toujours existé ». */
function createdAt(rule: BlockRuleView): number {
  if (!rule.createdAt) return Number.NEGATIVE_INFINITY
  const time = new Date(rule.createdAt).getTime()
  return Number.isNaN(time) ? Number.NEGATIVE_INFINITY : time
}

/**
 * Les fenêtres d'UNE règle susceptibles de toucher le jour `day`.
 *
 * Une plage à cheval sur minuit est produite deux fois : celle qui démarre ce
 * jour-là et déborde sur le lendemain, et celle de la veille dont la queue
 * tombe dans ce jour. Sans la seconde, une plage 22 h → 8 h ne compterait
 * jamais ses huit heures de nuit — la moitié la plus utile.
 */
function ruleSpans(rule: BlockRuleView, day: Date): TimeSpan[] {
  const dayStart = day.getTime()
  const born = createdAt(rule)

  if (rule.type === 'progressive_delay') {
    // Blocage minuté : une seule fenêtre, ancrée sur sa création.
    if (born === Number.NEGATIVE_INFINITY) return []
    const duration = num(config(rule).duration_min, 30)
    return [{ start: born, end: born + duration * MINUTE }]
  }

  if (rule.type !== 'schedule') return []

  const start =
    num(config(rule).start_hour, 22) * 60 + num(config(rule).start_minute)
  const end = num(config(rule).end_hour, 8) * 60 + num(config(rule).end_minute)
  const crossesMidnight = start > end
  const spans: TimeSpan[] = []

  if (appliesOn(rule, day)) {
    const from = dayStart + start * MINUTE
    const to = dayStart + (crossesMidnight ? DAY_MIN + end : end) * MINUTE
    if (to > from) spans.push({ start: from, end: to })
  }

  if (crossesMidnight) {
    const yesterday = new Date(day)
    yesterday.setDate(yesterday.getDate() - 1)
    if (appliesOn(rule, yesterday)) {
      spans.push({
        start: yesterday.getTime() + start * MINUTE,
        end: dayStart + end * MINUTE,
      })
    }
  }

  // Une règle ne protège pas avant d'exister : on tronque, on ne jette pas —
  // la plage du soir même de la création a bien protégé sa fin.
  return spans
    .map(span => ({ start: Math.max(span.start, born), end: span.end }))
    .filter(span => span.end > span.start)
}

/** Union d'intervalles, fusionnés : deux règles qui se recouvrent = un temps. */
export function mergeSpans(spans: TimeSpan[]): TimeSpan[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start)
  const merged: TimeSpan[] = []
  for (const span of sorted) {
    const last = merged[merged.length - 1]
    if (last && span.start <= last.end) last.end = Math.max(last.end, span.end)
    else merged.push({ ...span })
  }
  return merged
}

export interface DayProtection {
  /** Minutes réellement protégées entre minuit et `until`. */
  protectedMinutes: number
  /** Minutes écoulées entre minuit et `until` — le dénominateur. */
  elapsedMinutes: number
  /** Une règle à fenêtre couvrait-elle ce jour ? Sinon rien n'est jugé. */
  hasWindows: boolean
}

/**
 * Combien de ce jour a été passé sous protection, jusqu'à `until`.
 *
 * Les limites journalières n'entrent PAS ici : elles ne définissent aucune
 * fenêtre (elles ferment la porte quand le quota tombe, à une heure qu'on ne
 * connaît qu'après coup). Elles ont leur propre composante dans le score,
 * pour qu'aucun signal ne soit compté deux fois.
 */
export function dayProtection(
  rules: BlockRuleView[],
  day: Date,
  until: Date,
): DayProtection {
  const dayStart = startOfDay(day).getTime()
  const bound = Math.min(until.getTime(), dayStart + DAY_MIN * MINUTE)
  const elapsedMinutes = Math.max(0, (bound - dayStart) / MINUTE)

  const spans = rules
    .filter(rule => rule.isActive)
    .flatMap(rule => ruleSpans(rule, startOfDay(day)))
  const clipped = spans
    .map(span => ({
      start: Math.max(span.start, dayStart),
      end: Math.min(span.end, bound),
    }))
    .filter(span => span.end > span.start)

  const protectedMinutes = mergeSpans(clipped).reduce(
    (total, span) => total + (span.end - span.start) / MINUTE,
    0,
  )
  return {
    protectedMinutes,
    elapsedMinutes,
    // La question posée est « une fenêtre existait-elle ce jour-là ? », pas
    // « en reste-t-il une avant l'heure qu'il est ? » : sans ça, une plage du
    // soir ferait disparaître la composante toute la journée.
    hasWindows: spans.some(span => span.end > dayStart),
  }
}
