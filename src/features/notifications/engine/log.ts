/**
 * Journal d'instrumentation — anneau borné en MMKV.
 *
 * Sa raison d'être tient en une question : « pourquoi `retention.streak_at_risk`
 * n'est-elle pas partie hier soir ? ». Sans raison de suppression NOMMÉE, c'est
 * une enquête d'une heure dans six fichiers. Avec, c'est une ligne à lire.
 *
 * Chaque décision du moteur écrit ici, y compris — surtout — les refus.
 */
import { constants } from '@/config/constants'
import type {
  NotifEventKind,
  NotifFamily,
  NotifLogEntry,
  SuppressionReason,
} from '@/features/notifications/types'
import { kvStorage } from '@/shared/services/storage/mmkv'

/**
 * Assez pour couvrir plusieurs semaines de décisions (le moteur écrit surtout
 * des suppressions, quelques dizaines par passage au pire), assez peu pour
 * qu'une lecture-écriture MMKV reste instantanée.
 */
const MAX_ENTRIES = 200

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function readEntry(value: unknown): NotifLogEntry | null {
  if (!isRecord(value)) return null
  const { t, k, n, f } = value
  if (typeof t !== 'number' || typeof k !== 'string') return null
  if (typeof n !== 'string' || typeof f !== 'string') return null
  return {
    t,
    k: k as NotifEventKind,
    n,
    f: f as NotifFamily,
    va: typeof value.va === 'string' ? value.va : undefined,
    reason:
      typeof value.reason === 'string'
        ? (value.reason as SuppressionReason)
        : undefined,
    for: typeof value.for === 'number' ? value.for : undefined,
    at: typeof value.at === 'number' ? value.at : undefined,
  }
}

export function readNotifLog(): NotifLogEntry[] {
  const raw = kvStorage.getString(constants.NOTIF_LOG)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(readEntry)
      .filter((entry): entry is NotifLogEntry => entry !== null)
  } catch {
    return []
  }
}

function write(entries: NotifLogEntry[]): void {
  const bounded =
    entries.length > MAX_ENTRIES
      ? entries.slice(entries.length - MAX_ENTRIES)
      : entries
  kvStorage.setString(constants.NOTIF_LOG, JSON.stringify(bounded))
}

/** Ajoute une ou plusieurs entrées. Un seul aller-retour MMKV par appel. */
export function logNotifEvents(entries: NotifLogEntry[]): void {
  if (entries.length === 0) return
  write([...readNotifLog(), ...entries])
}

export function logNotifEvent(entry: NotifLogEntry): void {
  logNotifEvents([entry])
}

export function clearNotifLog(): void {
  kvStorage.delete(constants.NOTIF_LOG)
}

/**
 * Dernière décision connue pour un nœud — ce que l'écran de diagnostic affiche
 * en face de chaque ligne du catalogue.
 */
export function lastDecisionFor(
  nodeId: string,
  log: NotifLogEntry[] = readNotifLog(),
): NotifLogEntry | null {
  for (let i = log.length - 1; i >= 0; i -= 1) {
    if (log[i].n === nodeId) return log[i]
  }
  return null
}

/** Répartition des refus par raison, sur les `sinceMs` dernières millisecondes. */
export function suppressionBreakdown(
  now: number,
  sinceMs: number,
  log: NotifLogEntry[] = readNotifLog(),
): Record<string, number> {
  const out: Record<string, number> = {}
  for (const entry of log) {
    if (entry.k !== 'suppressed' || !entry.reason) continue
    if (now - entry.t > sinceMs) continue
    out[entry.reason] = (out[entry.reason] ?? 0) + 1
  }
  return out
}
