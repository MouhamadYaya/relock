/**
 * État persistant du moteur — tout ce qu'une décision doit savoir du passé.
 *
 * Volontairement UN seul document MMKV : le moteur lit son état une fois par
 * passage et l'écrit une fois. Éparpiller ces compteurs sur dix clés ferait
 * dériver leur cohérence dès le premier chemin d'erreur.
 */
import { constants } from '@/config/constants'
import { kvStorage } from '@/shared/services/storage/mmkv'

export interface NotifEngineState {
  /** nodeId → instant du dernier envoi RÉELLEMENT planifié (epoch ms). */
  lastSent: Record<string, number>
  /**
   * `<clé de semaine>|<nodeId>` → envois de ce nœud cette semaine-là.
   * Sans ce compteur, `maxPerWeek` serait un champ décoratif : le nœud le
   * déclarerait, personne ne l'appliquerait.
   */
  sentPerWeek: Record<string, number>
  /**
   * Dernier tap de notification (famille + instant). Permet de créditer une
   * ACTION réelle — armer un blocage juste après — et pas seulement la
   * curiosité que prouve le tap.
   */
  lastTap: { family: string; at: number } | null
  /** Identifiants d'ancres actuellement écrites côté iOS. */
  anchors: string[]
  /** Famille → score de fatigue (voir `fatigue.ts`). */
  fatigue: Record<string, number>
  /** Famille → notifications consécutives sans la moindre interaction. */
  silentStreak: Record<string, number>
  /** nodeId → dernière présentation IN-APP (epuis laquelle on peut différer). */
  inAppAt: Record<string, number>
  /** `YYYY-MM-DD` → notifications standard envoyées ce jour-là. */
  dailyCount: Record<string, number>
  /** `YYYY-Www` → notifications standard envoyées cette semaine-là. */
  weeklyCount: Record<string, number>
  /** Horodatages d'ouverture de l'app conservés (7 jours glissants). */
  opens: number[]
  /** Dernier palier de score déjà annoncé (évite d'annoncer deux fois). */
  lastScoreBand: number | null
  /** Dernière décroissance quotidienne appliquée à la fatigue (epoch ms). */
  lastDecayAt: number | null
  /** L'ancien préfixe `relock.sched.` a été purgé une bonne fois pour toutes. */
  legacyPurged: boolean
}

export const EMPTY_STATE: NotifEngineState = {
  lastSent: {},
  sentPerWeek: {},
  lastTap: null,
  anchors: [],
  fatigue: {},
  silentStreak: {},
  inAppAt: {},
  dailyCount: {},
  weeklyCount: {},
  opens: [],
  lastScoreBand: null,
  lastDecayAt: null,
  legacyPurged: false,
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function numberMap(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {}
  const out: Record<string, number> = {}
  for (const [key, raw] of Object.entries(value)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) out[key] = raw
  }
  return out
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function numberList(value: unknown): number[] {
  return Array.isArray(value)
    ? value.filter((item): item is number => typeof item === 'number')
    : []
}

export function readEngineState(): NotifEngineState {
  const raw = kvStorage.getString(constants.NOTIF_STATE)
  if (!raw) return { ...EMPTY_STATE }
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed)) return { ...EMPTY_STATE }
    const tap = isRecord(parsed.lastTap) ? parsed.lastTap : null
    return {
      lastSent: numberMap(parsed.lastSent),
      sentPerWeek: numberMap(parsed.sentPerWeek),
      lastTap:
        tap && typeof tap.family === 'string' && typeof tap.at === 'number'
          ? { family: tap.family, at: tap.at }
          : null,
      anchors: stringList(parsed.anchors),
      fatigue: numberMap(parsed.fatigue),
      silentStreak: numberMap(parsed.silentStreak),
      inAppAt: numberMap(parsed.inAppAt),
      dailyCount: numberMap(parsed.dailyCount),
      weeklyCount: numberMap(parsed.weeklyCount),
      opens: numberList(parsed.opens),
      lastScoreBand:
        typeof parsed.lastScoreBand === 'number' ? parsed.lastScoreBand : null,
      lastDecayAt:
        typeof parsed.lastDecayAt === 'number' ? parsed.lastDecayAt : null,
      legacyPurged: parsed.legacyPurged === true,
    }
  } catch {
    return { ...EMPTY_STATE }
  }
}

const DAY_MS = 86_400_000
/** Au-delà, un compteur de budget ne sert plus qu'à faire grossir le document. */
const COUNTER_RETENTION_DAYS = 21

/** Clé de jour LOCAL (`YYYY-MM-DD`) — jamais UTC, sinon un tir de 22h30 en
 *  UTC-4 compterait sur le budget de demain. */
export function dayKey(at: number): string {
  const d = new Date(at)
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${month}-${day}`
}

/** Clé de semaine ISO (`YYYY-Www`) — la semaine bascule le lundi. */
export function weekKey(at: number): string {
  const d = new Date(at)
  d.setHours(0, 0, 0, 0)
  // Jeudi de la semaine courante : c'est lui qui porte l'année ISO.
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const firstThursday = new Date(d.getFullYear(), 0, 4)
  firstThursday.setDate(
    firstThursday.getDate() + 3 - ((firstThursday.getDay() + 6) % 7),
  )
  const week =
    1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * DAY_MS))
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Élague ce qui ne peut plus influencer aucune décision. */
function prune(state: NotifEngineState, now: number): NotifEngineState {
  const horizon = now - COUNTER_RETENTION_DAYS * DAY_MS
  const keepCounters = (counters: Record<string, number>, isWeek: boolean) => {
    const out: Record<string, number> = {}
    for (const [key, value] of Object.entries(counters)) {
      const reference = isWeek ? weekKey(horizon) : dayKey(horizon)
      if (key >= reference) out[key] = value
    }
    return out
  }
  const currentWeek = weekKey(now)
  const previousWeek = weekKey(now - 7 * DAY_MS)
  const sentPerWeek: Record<string, number> = {}
  for (const [key, value] of Object.entries(state.sentPerWeek)) {
    const week = key.split('|')[0]
    if (week === currentWeek || week === previousWeek) sentPerWeek[key] = value
  }
  return {
    ...state,
    dailyCount: keepCounters(state.dailyCount, false),
    weeklyCount: keepCounters(state.weeklyCount, true),
    sentPerWeek,
    opens: state.opens.filter(at => now - at <= 7 * DAY_MS),
  }
}

export function writeEngineState(state: NotifEngineState, now: number): void {
  kvStorage.setString(constants.NOTIF_STATE, JSON.stringify(prune(state, now)))
}

export function updateEngineState(
  now: number,
  patch: (state: NotifEngineState) => NotifEngineState,
): NotifEngineState {
  const next = patch(readEngineState())
  writeEngineState(next, now)
  return next
}

/** Enregistre une ouverture de l'app (alimente engagement + fatigue). */
export function recordAppOpen(now: number): void {
  updateEngineState(now, state => ({
    ...state,
    opens: [...state.opens, now],
  }))
  if (!kvStorage.getString(constants.NOTIF_INSTALLED_AT)) {
    kvStorage.setString(constants.NOTIF_INSTALLED_AT, String(now))
  }
}

/** Première ouverture connue. Sert de base à `daysSinceInstall`. */
export function installedAt(now: number): number {
  const raw = kvStorage.getString(constants.NOTIF_INSTALLED_AT)
  const parsed = raw ? Number(raw) : Number.NaN
  if (Number.isFinite(parsed)) return parsed
  kvStorage.setString(constants.NOTIF_INSTALLED_AT, String(now))
  return now
}

/** Clé du compteur hebdomadaire d'un nœud. */
export function nodeWeekKey(nodeId: string, at: number): string {
  return `${weekKey(at)}|${nodeId}`
}
