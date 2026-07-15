/**
 * Préférences de notifications (persistées MMKV). Deux catégories simples +
 * interrupteur maître — appliquées immédiatement via le reconciler.
 */
import { kvStorage } from '@/shared/services/storage/mmkv'

export interface NotifPrefs {
  /** Interrupteur maître : off = aucune notification. */
  master: boolean
  /** Rappels : « série en danger » (soir), win-back après absence. */
  reminders: boolean
  /** Progression : bilan hebdo + célébrations (1ʳᵉ victoire, jalons). */
  progression: boolean
}

const KEY = 'notif.prefs'
const DEFAULT: NotifPrefs = { master: true, reminders: true, progression: true }

export function getNotifPrefs(): NotifPrefs {
  const raw = kvStorage.getString(KEY)
  if (!raw) return { ...DEFAULT }
  try {
    return { ...DEFAULT, ...(JSON.parse(raw) as Partial<NotifPrefs>) }
  } catch {
    return { ...DEFAULT }
  }
}

export function setNotifPrefs(prefs: NotifPrefs): void {
  kvStorage.setString(KEY, JSON.stringify(prefs))
}

// Soft-ask déjà proposé ? (pour ne demander la permission qu'une fois, au bon
// moment — après le 1ᵉʳ blocage, jamais au lancement.)
const ASKED = 'notif.permissionAsked'
export const hasAskedNotifPermission = (): boolean =>
  kvStorage.getString(ASKED) === '1'
export const markNotifPermissionAsked = (): void =>
  kvStorage.setString(ASKED, '1')
