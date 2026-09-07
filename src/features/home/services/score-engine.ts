/**
 * Le moteur du score d'Accueil.
 *
 * POURQUOI IL VIT ICI, EN JAVASCRIPT
 * Le score était calculé par l'extension `RelockActivityReport`, seule à voir
 * les minutes de Temps d'écran système. Mais cette extension est sandboxée au
 * point de ne pas pouvoir écrire dans l'App Group (cf. docs/ARCHITECTURE.md) :
 * son résultat n'atteignait jamais le JS. La carte native affichait donc un
 * chiffre que la feuille de détail ne pouvait pas expliquer — deux surfaces,
 * deux vérités, et en DEV une paire de constantes en dur. Un score qu'on ne
 * peut ni retrouver ni justifier est indiscernable d'un score inventé.
 *
 * Ce moteur ne consomme QUE des mesures que l'app détient réellement et peut
 * ré-afficher au chiffre près : le journal quotidien `daily_stats` (alimenté
 * par les extensions de blocage via le protocole pull-ack), les règles et leur
 * configuration, et l'avancement des quotas du jour.
 *
 * LE PRINCIPE
 * Le score compare l'utilisateur à LUI-MÊME. 50 = « comme d'habitude », 100 =
 * « deux fois mieux », 0 = « deux fois pire ». Aucun absolu extérieur : deux
 * heures d'écran sont une victoire pour l'un et une rechute pour l'autre.
 *
 * CE QU'IL NE FAIT JAMAIS
 * Inventer une composante manquante. Une mesure absente est absente : son
 * poids est redistribué aux autres, et si plus rien ne reste, le score vaut
 * `null` et l'écran dit « calcul en cours ».
 */

import type { BlockRuleView } from '@/features/blocking/types'
import {
  dayProtection,
  startOfDay,
} from '@/features/home/services/protection-windows'
import type {
  HomeScoreAxis,
  HomeScoreComponent,
  HomeScoreDay,
  HomeScoreSnapshot,
  HomeScoreStatus,
} from '@/features/home/types'

/** Journée telle que `daily_stats` la conserve — le strict nécessaire. */
export interface ScoreDayStats {
  /** Date locale « YYYY-MM-DD ». */
  date: string
  /** Boucliers affichés = tentatives d'ouverture arrêtées. */
  interceptions_count: number
  /** Taps « Fermer » = renoncements explicites. */
  opens_stopped: number
  /** Une protection existait ce jour-là. */
  streak_respected: boolean
}

export interface ScoreInput {
  now: Date
  /** Historique quotidien, ordre indifférent. */
  history: ScoreDayStats[]
  /** Règles du compte, avec leur configuration et leur date de création. */
  rules: BlockRuleView[]
  /** Avancement des quotas du jour par règle (id → 0…1). */
  limitSteps: Record<string, number>
  /** Apps actuellement rouvertes par un sursis. */
  reprievedApps: number
}

// ── Constantes du modèle ─────────────────────────────────────────────
//
// Chacune est un choix de produit, pas un réglage technique : elles sont
// nommées pour pouvoir être discutées, et bornées pour ne jamais produire un
// chiffre qu'on ne saurait pas défendre à l'écran.

/**
 * Plancher d'heures écoulées. À 1 h du matin, diviser par une heure ferait
 * exploser tous les ratios sur deux gestes sans signification : le score
 * deviendrait un compte à rebours depuis minuit.
 */
const MIN_ELAPSED_HOURS = 4

/** Jours d'historique au-delà desquels le score est pleinement fiable. */
const CONFIDENCE_DAYS = 5

/** Profondeur de la référence personnelle : assez récente pour rester la sienne. */
const BASELINE_DAYS = 14

/** Fenêtre de la régularité et de la tendance affichée. */
const WEEK_DAYS = 7

/**
 * Plancher de la référence de pression, en tentatives par jour.
 *
 * Sans lui, un historique à zéro tentative rendrait le ratio incalculable et
 * la moindre tentative vaudrait un effondrement. Il dit : « en dessous de
 * quatre tentatives par jour, Relock te considère déjà au calme. »
 */
const MIN_PRESSURE_BASELINE = 4

/** Poids des composantes à l'intérieur de leur axe. */
const WEIGHTS = {
  pressure: 0.55,
  resistance: 0.25,
  breaches: 0.2,
  coverage: 0.4,
  regularity: 0.35,
  quota: 0.25,
} as const

const MINUTES_PER_DAY = 1440

export function boundedScore(value: number): number {
  return Math.min(Math.max(Math.round(value), 0), 100)
}

/** Date locale « YYYY-MM-DD » — jamais UTC, sinon décalage d'un jour. */
export function dayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Traduit « combien de fois ta normale » en note.
 *
 * 50 = exactement ta normale, 100 = deux fois mieux, 0 = deux fois pire. La
 * courbe est volontairement linéaire par morceaux : elle doit tenir en une
 * phrase dans la feuille de détail, sinon personne ne peut vérifier son score.
 * Elle vaut pour toutes les mesures « moins il y en a, mieux c'est ».
 */
export function relativeScore(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0.5) return 100
  if (ratio >= 2) return 0
  if (ratio <= 1) return boundedScore(100 - 100 * (ratio - 0.5))
  return boundedScore(50 - 50 * (ratio - 1))
}

// ── Composantes ──────────────────────────────────────────────────────

interface DayContext {
  /** Minuit du jour noté. */
  day: Date
  /** Borne haute du calcul : maintenant pour aujourd'hui, minuit pour un jour clos. */
  until: Date
  stats: ScoreDayStats | null
  /** Jours strictement antérieurs, du plus récent au plus ancien. */
  history: ScoreDayStats[]
  rules: BlockRuleView[]
  /** Absent pour un jour passé : les quotas ne sont pas historisés. */
  limitSteps: Record<string, number> | null
  reprievedApps: number | null
}

function elapsedHours(ctx: DayContext): number {
  const raw = (ctx.until.getTime() - ctx.day.getTime()) / 3_600_000
  return Math.max(MIN_ELAPSED_HOURS, Math.min(24, raw))
}

/**
 * Pression : les tentatives d'ouverture d'apps bloquées, ramenées à l'heure
 * écoulée et comparées à ta médiane.
 *
 * C'est le signal le plus honnête dont dispose Relock sur la compulsion : un
 * bouclier ne s'affiche que parce que la main est allée chercher l'app. Il est
 * rapporté au temps écoulé pour qu'une consultation à 9 h et une à 22 h se
 * comparent à la même échelle.
 */
function pressureComponent(ctx: DayContext): HomeScoreComponent | null {
  if (!ctx.stats) return null
  const baselineDays = ctx.history.slice(0, BASELINE_DAYS)
  if (baselineDays.length === 0) return null

  const perDay = median(baselineDays.map(day => day.interceptions_count))
  const baselinePerHour = Math.max(perDay, MIN_PRESSURE_BASELINE) / 24
  const observedPerHour = ctx.stats.interceptions_count / elapsedHours(ctx)

  return {
    signal: 'pressure',
    axis: 'focus',
    score: relativeScore(observedPerHour / baselinePerHour),
    weight: WEIGHTS.pressure,
    observed: ctx.stats.interceptions_count,
    // Ce que ta normale aurait produit à cette heure-ci : le chiffre auquel la
    // note se compare, pas un total de journée qu'on n'a pas encore atteint.
    reference: Math.round(baselinePerHour * elapsedHours(ctx)),
    unit: 'count',
  }
}

/**
 * Résistance : quand tu butes sur un mur, tu renonces ou tu insistes ?
 *
 * `opens_stopped` ne compte que le tap « Fermer » explicite, alors que le
 * geste le plus courant devant le bouclier est de balayer sans rien toucher.
 * Ne jamais taper « Fermer » n'est donc pas une faute : l'échelle part de la
 * neutralité (50) et ne fait que récompenser le renoncement assumé.
 */
function resistanceComponent(ctx: DayContext): HomeScoreComponent | null {
  if (!ctx.stats || ctx.stats.interceptions_count <= 0) return null
  const ratio = Math.min(
    1,
    ctx.stats.opens_stopped / ctx.stats.interceptions_count,
  )
  return {
    signal: 'resistance',
    axis: 'focus',
    score: boundedScore(50 + 50 * ratio),
    weight: WEIGHTS.resistance,
    observed: ctx.stats.opens_stopped,
    reference: ctx.stats.interceptions_count,
    unit: 'count',
  }
}

/**
 * Brèches : les apps rouvertes par un sursis.
 *
 * Un sursis est légitime — c'est la soupape qui empêche l'app de devenir un
 * piège. Il reste que la protection est contournée pendant ce temps, et le
 * score doit le dire. La pénalité est franche mais bornée : trois brèches
 * simultanées mettent la composante au plancher, pas au-delà.
 */
function breachesComponent(ctx: DayContext): HomeScoreComponent | null {
  if (ctx.reprievedApps === null) return null
  const hasProtection = ctx.rules.some(rule => rule.isActive)
  if (!hasProtection) return null
  return {
    signal: 'breaches',
    axis: 'focus',
    score: boundedScore(100 - 30 * ctx.reprievedApps),
    weight: WEIGHTS.breaches,
    observed: ctx.reprievedApps,
    reference: null,
    unit: 'count',
  }
}

/**
 * Couverture : la part de la journée écoulée réellement passée sous protection.
 *
 * Barème délibérément clément — 0 % vaut 40, un tiers de la journée vaut 100.
 * Protéger sa journée entière n'est ni réaliste ni souhaitable ; l'objectif
 * est qu'il existe de vraies plages où le téléphone n'est pas une option.
 */
function coverageComponent(ctx: DayContext): HomeScoreComponent | null {
  const protection = dayProtection(ctx.rules, ctx.day, ctx.until)
  if (!protection.hasWindows || protection.elapsedMinutes <= 0) return null
  const ratio = protection.protectedMinutes / protection.elapsedMinutes
  return {
    signal: 'coverage',
    axis: 'rest',
    score: boundedScore(40 + 150 * ratio),
    weight: WEIGHTS.coverage,
    observed: Math.round(protection.protectedMinutes),
    reference: Math.round(protection.elapsedMinutes),
    unit: 'minutes',
  }
}

/**
 * Régularité : les jours protégés sur les sept précédents.
 *
 * Le seul signal de fond du score. Il change lentement, exprès : il mesure une
 * habitude, et une habitude ne se gagne ni ne se perd en une journée.
 */
function regularityComponent(ctx: DayContext): HomeScoreComponent | null {
  const week = ctx.history.slice(0, WEEK_DAYS)
  if (week.length === 0) return null
  const kept = week.filter(day => day.streak_respected).length
  return {
    signal: 'regularity',
    axis: 'rest',
    score: boundedScore((kept / week.length) * 100),
    weight: WEIGHTS.regularity,
    observed: kept,
    reference: week.length,
    unit: 'count',
  }
}

/**
 * Quota : où en sont tes limites journalières, comparé à l'heure qu'il est.
 *
 * Avoir consommé la moitié de son quota à la moitié de la journée, c'est être
 * exactement dans le rythme — donc 50. L'avoir épuisé à midi, c'est deux fois
 * trop vite — donc 0. La règle retenue est la plus avancée : c'est elle qui
 * fermera la porte en premier, donc la seule que l'utilisateur ressentira.
 */
function quotaComponent(ctx: DayContext): HomeScoreComponent | null {
  if (!ctx.limitSteps) return null
  const limits = ctx.rules.filter(
    rule => rule.type === 'daily_limit' && rule.isActive,
  )
  if (limits.length === 0) return null

  const progress = Math.max(
    0,
    ...limits.map(rule => ctx.limitSteps?.[rule.id] ?? 0),
  )
  const elapsedFraction = Math.max(
    MIN_ELAPSED_HOURS / 24,
    (ctx.until.getTime() - ctx.day.getTime()) / (MINUTES_PER_DAY * 60_000),
  )
  return {
    signal: 'quota',
    axis: 'rest',
    score: relativeScore(progress / elapsedFraction),
    weight: WEIGHTS.quota,
    observed: Math.round(progress * 100),
    reference: Math.round(elapsedFraction * 100),
    unit: 'percent',
  }
}

/**
 * Moyenne pondérée d'un axe. Les composantes absentes ne sont pas remplacées
 * par une valeur par défaut : leur poids est redistribué à celles qui restent.
 */
function axisScore(
  components: HomeScoreComponent[],
  axis: HomeScoreAxis,
): number | null {
  const own = components.filter(component => component.axis === axis)
  const total = own.reduce((sum, component) => sum + component.weight, 0)
  if (total <= 0) return null
  const weighted = own.reduce(
    (sum, component) => sum + component.score * component.weight,
    0,
  )
  return boundedScore(weighted / total)
}

interface DayResult {
  focus: number | null
  rest: number | null
  global: number | null
  components: HomeScoreComponent[]
  confidence: number
  historyDays: number
}

/** Note une journée. Le même code sert pour aujourd'hui, hier et la tendance. */
function scoreDay(ctx: DayContext): DayResult {
  const components = [
    pressureComponent(ctx),
    resistanceComponent(ctx),
    breachesComponent(ctx),
    coverageComponent(ctx),
    regularityComponent(ctx),
    quotaComponent(ctx),
  ].filter((component): component is HomeScoreComponent => component !== null)

  const historyDays = Math.min(ctx.history.length, BASELINE_DAYS)
  // Confiance progressive : dès le premier jour de recul le score existe, mais
  // reste proche de la neutralité et se précise ensuite. On ne fait jamais
  // croire à une précision qu'on n'a pas.
  const confidence = Math.min(1, historyDays / CONFIDENCE_DAYS)
  const blend = (value: number | null): number | null =>
    value === null ? null : boundedScore(50 + (value - 50) * confidence)

  const focus = blend(axisScore(components, 'focus'))
  const rest = blend(axisScore(components, 'rest'))
  // Deux axes, poids égaux. Quand un seul existe, il porte le score : c'est la
  // seule façon d'avoir un chiffre honnête chez qui n'a pas encore les deux.
  const present = [focus, rest].filter(
    (value): value is number => value !== null,
  )
  const global =
    present.length === 0
      ? null
      : boundedScore(present.reduce((a, b) => a + b, 0) / present.length)

  return { focus, rest, global, components, confidence, historyDays }
}

/** L'historique strictement antérieur à `day`, du plus récent au plus ancien. */
function historyBefore(
  history: Map<string, ScoreDayStats>,
  day: Date,
  depth: number,
): ScoreDayStats[] {
  const days: ScoreDayStats[] = []
  const cursor = new Date(day)
  for (let index = 0; index < depth; index += 1) {
    cursor.setDate(cursor.getDate() - 1)
    const row = history.get(dayKey(cursor))
    // Une journée sans ligne est une absence de mesure, pas une journée
    // exemplaire : elle ne doit pas entrer dans la médiane. Mais elle ne doit
    // pas non plus interrompre la remontée — un trou de synchro ne raccourcit
    // pas la référence des jours qui l'entourent.
    if (row) days.push(row)
  }
  return days
}

const emptySnapshot = (now: Date): HomeScoreSnapshot => ({
  status: 'pending',
  global: null,
  focus: null,
  rest: null,
  delta: null,
  weakestAxis: 'focus',
  historyDays: 0,
  confidence: 0,
  components: [],
  trend: [],
  elapsedMinutes: Math.round(
    (now.getTime() - startOfDay(now).getTime()) / 60_000,
  ),
  protectedMinutes: 0,
})

/**
 * Le score du jour, son écart avec hier et la tendance de la semaine.
 *
 * Hier est noté par le MÊME code, sur une journée pleine et son propre
 * historique : c'est la seule façon d'obtenir un écart qui veut dire quelque
 * chose. Comparer un aujourd'hui partiel à un hier complet produirait un
 * effondrement chaque matin.
 */
export function computeHomeScore(input: ScoreInput): HomeScoreSnapshot {
  const { now, rules, limitSteps, reprievedApps } = input
  const byDate = new Map(input.history.map(day => [day.date, day]))
  const today = startOfDay(now)

  const todayResult = scoreDay({
    day: today,
    until: now,
    stats: byDate.get(dayKey(today)) ?? null,
    history: historyBefore(byDate, today, BASELINE_DAYS),
    rules,
    limitSteps,
    reprievedApps,
  })

  if (todayResult.global === null) return emptySnapshot(now)

  /** Note un jour CLOS : journée pleine, sans quota ni sursis historisés. */
  const closedDay = (day: Date): number | null => {
    const end = new Date(day)
    end.setDate(end.getDate() + 1)
    return scoreDay({
      day,
      until: end,
      stats: byDate.get(dayKey(day)) ?? null,
      history: historyBefore(byDate, day, BASELINE_DAYS),
      rules,
      limitSteps: null,
      reprievedApps: null,
    }).global
  }

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const previousGlobal = closedDay(yesterday)

  // Tendance : les six jours clos précédents, puis aujourd'hui. Le dernier
  // point est donc le score affiché sur la carte — la courbe se termine
  // exactement là où l'œil vient de lire le chiffre.
  const trend: HomeScoreDay[] = []
  for (let offset = WEEK_DAYS - 1; offset >= 1; offset -= 1) {
    const day = new Date(today)
    day.setDate(day.getDate() - offset)
    trend.push({ date: dayKey(day), score: closedDay(day) })
  }
  trend.push({ date: dayKey(today), score: todayResult.global })

  const protection = dayProtection(rules, today, now)
  const status: HomeScoreStatus =
    todayResult.confidence >= 1 ? 'ready' : 'provisional'
  const weakestAxis: HomeScoreAxis =
    todayResult.rest !== null &&
    (todayResult.focus === null || todayResult.rest < todayResult.focus)
      ? 'rest'
      : 'focus'

  return {
    status,
    global: todayResult.global,
    focus: todayResult.focus,
    rest: todayResult.rest,
    delta: previousGlobal === null ? null : todayResult.global - previousGlobal,
    weakestAxis,
    historyDays: todayResult.historyDays,
    confidence: todayResult.confidence,
    components: todayResult.components,
    trend,
    elapsedMinutes: Math.round((now.getTime() - today.getTime()) / 60_000),
    protectedMinutes: Math.round(protection.protectedMinutes),
  }
}
