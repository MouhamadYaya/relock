/**
 * Moteur règle / session — le cœur du modèle.
 *
 * ⚠️ Principe fondateur : **un blocage n'est pas un événement, c'est une règle.**
 * Ce qui « tourne » n'est pas la règle mais sa SESSION du jour. On ne réinitialise
 * donc jamais la liste : seul le compteur d'une session repart chaque jour.
 *
 * Propriété qui fait tenir tout le design : une règle récurrente est TOUJOURS
 * soit « en cours », soit « à venir » (une limite compte ou est atteinte → en
 * cours de la journée ; une plage tourne ou démarrera plus tard). Il n'existe
 * donc AUCUN état « terminé » / « inactif » à afficher. Deux sections couvrent
 * 100 % des règles — plus une troisième si quelque chose est suspendu.
 *
 * Les timers sont l'exception : éphémères, ils sont AUTO-SUPPRIMÉS une fois
 * terminés (ils ont accompli leur mission), comme les règles dont la durée de
 * vie expire.
 */
import type { BlockRuleView } from '@/features/blocking/types'

export type RuleState = 'running' | 'upcoming' | 'suspended'

/** Forme de l'indicateur : c'est ELLE qui dit le type — jamais un mot écrit. */
export type Indicator =
  | { kind: 'timer'; fraction: number; minutesLeft: number }
  | { kind: 'limit'; pct: number; reached: boolean }
  | { kind: 'schedule'; startMin: number; endMin: number; nowMin: number }
  | { kind: 'paused' }

export interface RuleSession {
  rule: BlockRuleView
  state: RuleState
  title: string
  indicator: Indicator
  strict: boolean
  /** Fin de la SESSION en cours (borne du verrou strict). Jamais la fin de vie. */
  sessionEndsAt: Date | null
  /** Défi en cours : « J 12 sur 30 ». Absent si la règle vit « toujours ». */
  lifetime: { day: number; total: number } | null
}

const num = (v: unknown, d = 0): number => (typeof v === 'number' ? v : d)
const cfg = (r: BlockRuleView): Record<string, unknown> => r.config ?? {}

const MIN = 60_000
const DAY_MIN = 1440

// ── Accès config (tout vit dans le JSONB `config` — aucune migration DB) ──

/**
 * Nom donné par l'utilisateur, sinon le nom COURT du type. « Protection »
 * ne disait rien : trois blocages sans nom étaient indiscernables.
 */
export function ruleTitle(r: BlockRuleView): string {
  const n = cfg(r).name
  if (typeof n === 'string' && n.trim()) return n.trim()
  if (r.type === 'daily_limit') return 'Limite du jour'
  if (r.type === 'schedule') return 'Plage horaire'
  return 'Blocage minuté'
}

/** Le mode strict s'applique désormais à TOUS les types. */
export function isStrictRule(r: BlockRuleView): boolean {
  return cfg(r).strict === true
}

/** Jours d'application (0=dim … 6=sam). Absent ⇒ tous les jours. */
export function ruleDays(r: BlockRuleView): number[] | null {
  const d = cfg(r).days
  return Array.isArray(d) && d.length > 0 ? (d as number[]) : null
}

/**
 * Libellé des jours, en clair. Source unique : les cartes, le récapitulatif et
 * le flow de création doivent dire exactement la même chose — sinon
 * l'utilisateur croit avoir créé autre chose que ce qu'il lit.
 */
export function daysLabel(days: number[] | null): string {
  if (!days || days.length === 0 || days.length === 7) return 'Tous les jours'
  const sorted = [...days].sort()
  const key = sorted.join(',')
  if (key === '1,2,3,4,5') return 'Du lundi au vendredi'
  if (key === '0,6') return 'Samedi et dimanche'
  const NAMES = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']
  return sorted.map(d => NAMES[d]).join(', ')
}

export function appliesOn(r: BlockRuleView, now: Date): boolean {
  const days = ruleDays(r)
  return !days || days.includes(now.getDay())
}

/** Échéance de reprise d'une suspension. null ⇒ « jusqu'à ce que tu reprennes ». */
export function suspendedUntil(r: BlockRuleView): Date | null {
  const s = cfg(r).suspended_until
  if (typeof s !== 'string') return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Durée de vie de la règle en jours. null ⇒ « toujours » (défaut, 90 % des cas). */
export function lifetimeDays(r: BlockRuleView): number | null {
  const v = cfg(r).lifetime_days
  return typeof v === 'number' && v > 0 ? v : null
}

// ── Bornes temporelles ────────────────────────────────────────────────

const minutesOfDay = (d: Date): number => d.getHours() * 60 + d.getMinutes()

function scheduleBounds(r: BlockRuleView): { start: number; end: number } {
  const c = cfg(r)
  return {
    start: num(c.start_hour, 22) * 60 + num(c.start_minute),
    end: num(c.end_hour, 8) * 60 + num(c.end_minute),
  }
}

/** Une plage tourne-t-elle maintenant ? (gère le passage de minuit) */
function scheduleRunning(r: BlockRuleView, now: Date): boolean {
  const { start, end } = scheduleBounds(r)
  const t = minutesOfDay(now)
  const inWindow = start <= end ? t >= start && t < end : t >= start || t < end
  if (!inWindow) return false
  // Fenêtre à cheval sur minuit : après minuit, c'est la session de LA VEILLE
  // qui tourne → c'est le jour de la veille qui doit être autorisé.
  if (start > end && t < end) {
    const y = new Date(now)
    y.setDate(y.getDate() - 1)
    return appliesOn(r, y)
  }
  return appliesOn(r, now)
}

/** Fin de la session de plage en cours (l'heure de fin, aujourd'hui ou demain). */
function scheduleSessionEnd(r: BlockRuleView, now: Date): Date {
  const { start, end } = scheduleBounds(r)
  const d = new Date(now)
  d.setHours(Math.floor(end / 60), end % 60, 0, 0)
  // Fenêtre à cheval sur minuit et on est encore avant minuit → fin demain.
  if (start > end && minutesOfDay(now) >= start) d.setDate(d.getDate() + 1)
  return d
}

/** Prochain démarrage d'une plage (aujourd'hui plus tard, ou le prochain jour actif). */
export function scheduleNextStart(r: BlockRuleView, now: Date): Date {
  const { start } = scheduleBounds(r)
  const d = new Date(now)
  d.setHours(Math.floor(start / 60), start % 60, 0, 0)
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1)
  // Avance jusqu'au prochain jour où la règle s'applique (max 7 essais).
  for (let i = 0; i < 7 && !appliesOn(r, d); i++) d.setDate(d.getDate() + 1)
  return d
}

/** Fin d'un timer = création + durée. */
export function timerEnd(r: BlockRuleView): Date | null {
  if (!r.createdAt) return null
  return new Date(
    new Date(r.createdAt).getTime() + num(cfg(r).duration_min, 30) * MIN,
  )
}

/** Minuit prochain — fin de session d'une limite quotidienne. */
function nextMidnight(now: Date): Date {
  const d = new Date(now)
  d.setHours(24, 0, 0, 0)
  return d
}

/**
 * Fin de la SESSION en cours — borne du verrou strict.
 * ⚠️ Jamais la durée de vie de la règle : une protection stricte de 30 jours
 * reste supprimable, simplement pas MAINTENANT.
 */
export function sessionEnd(r: BlockRuleView, now = new Date()): Date | null {
  if (r.type === 'progressive_delay') return timerEnd(r)
  if (r.type === 'schedule')
    return scheduleRunning(r, now) ? scheduleSessionEnd(r, now) : null
  if (r.type === 'daily_limit') return nextMidnight(now)
  return null
}

/** Le strict verrouille-t-il la règle à cet instant ? */
export function isSessionLocked(r: BlockRuleView, now = new Date()): boolean {
  if (!isStrictRule(r)) return false
  const end = sessionEnd(r, now)
  return !!end && end.getTime() > now.getTime()
}

// ── Cycle de vie ──────────────────────────────────────────────────────

/** Date d'expiration de la règle (création + durée de vie), sinon null. */
export function expiresAt(r: BlockRuleView): Date | null {
  const days = lifetimeDays(r)
  if (!days || !r.createdAt) return null
  return new Date(new Date(r.createdAt).getTime() + days * DAY_MIN * MIN)
}

/**
 * La règle doit-elle être AUTO-SUPPRIMÉE ?
 *  • un timer terminé → il a accompli sa mission ;
 *  • une règle dont la durée de vie a expiré → défi terminé.
 * Les règles récurrentes « toujours » ne s'auto-suppriment jamais.
 */
export function isFinished(r: BlockRuleView, now = new Date()): boolean {
  if (r.type === 'progressive_delay') {
    const end = timerEnd(r)
    return !!end && end.getTime() <= now.getTime()
  }
  const exp = expiresAt(r)
  return !!exp && exp.getTime() <= now.getTime()
}

/** Progression du défi : « J 12 sur 30 ». null si la règle vit « toujours ». */
export function lifetimeProgress(
  r: BlockRuleView,
  now = new Date(),
): { day: number; total: number } | null {
  const total = lifetimeDays(r)
  if (!total || !r.createdAt) return null
  const elapsed =
    (now.getTime() - new Date(r.createdAt).getTime()) / (DAY_MIN * MIN)
  return { day: Math.min(total, Math.floor(elapsed) + 1), total }
}

// ── État dérivé ───────────────────────────────────────────────────────

/**
 * Progression d'un quota (0→1). iOS ne fournit PAS la conso en continu : le
 * monitor natif écrit des PALIERS (25/50/75/100 %) dans l'App Group. Tant qu'on
 * n'a rien reçu, on affiche 0 — jamais un chiffre inventé.
 */
export function limitProgress(
  r: BlockRuleView,
  steps: Record<string, number>,
): number {
  const p = steps[r.id]
  return typeof p === 'number' ? Math.max(0, Math.min(1, p)) : 0
}

/**
 * État d'une règle à l'instant T. Trois états, pas plus.
 * `limitSteps` : paliers de quota remontés par le natif (id → 0..1).
 */
export function deriveSession(
  rule: BlockRuleView,
  now = new Date(),
  limitSteps: Record<string, number> = {},
): RuleSession {
  const strict = isStrictRule(rule)
  const base = {
    rule,
    title: ruleTitle(rule),
    strict,
    sessionEndsAt: sessionEnd(rule, now),
    lifetime: lifetimeProgress(rule, now),
  }

  // Suspendue : l'utilisateur l'a mise en pause (jamais un état « inactif »).
  if (!rule.isActive) {
    return { ...base, state: 'suspended', indicator: { kind: 'paused' } }
  }

  if (rule.type === 'progressive_delay') {
    const end = timerEnd(rule)
    const total = num(cfg(rule).duration_min, 30)
    const leftMs = end ? end.getTime() - now.getTime() : 0
    return {
      ...base,
      state: 'running', // un timer terminé est auto-supprimé, jamais affiché
      indicator: {
        kind: 'timer',
        fraction:
          total > 0 ? Math.max(0, Math.min(1, leftMs / (total * MIN))) : 0,
        minutesLeft: Math.max(0, Math.ceil(leftMs / MIN)),
      },
    }
  }

  if (rule.type === 'daily_limit') {
    const pct = limitProgress(rule, limitSteps)
    return {
      ...base,
      state: 'running', // une limite compte ou est atteinte → toujours en cours
      indicator: { kind: 'limit', pct, reached: pct >= 1 },
    }
  }

  // Plage horaire
  const { start, end } = scheduleBounds(rule)
  return {
    ...base,
    state: scheduleRunning(rule, now) ? 'running' : 'upcoming',
    indicator: {
      kind: 'schedule',
      startMin: start,
      endMin: end,
      nowMin: minutesOfDay(now),
    },
  }
}

/** Les règles affichables, triées : en cours → à venir → suspendues. */
export function buildSessions(
  rules: BlockRuleView[],
  now = new Date(),
  limitSteps: Record<string, number> = {},
): RuleSession[] {
  return rules
    .filter(r => !isFinished(r, now)) // terminé = auto-supprimé, jamais listé
    .map(r => deriveSession(r, now, limitSteps))
}
