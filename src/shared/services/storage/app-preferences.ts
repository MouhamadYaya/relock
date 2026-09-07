/**
 * Préférences d'app réglables par l'utilisateur — lecture/écriture PURES.
 *
 * Aucune dépendance à React ni à Zustand, volontairement : `haptics` et le
 * module Sentry les consultent hors de tout rendu, parfois avant qu'un seul
 * composant ne soit monté. Le store réactif qui pilote l'UI
 * (`src/shared/stores/preferences.store.ts`) s'appuie sur ces fonctions ; il
 * n'en est jamais la source de vérité.
 *
 * Convention d'écriture : `'1'` / `'0'`, jamais l'absence de clé pour dire
 * « faux ». Une clé absente signifie « l'utilisateur n'a jamais tranché »,
 * ce qui laisse la valeur par défaut libre d'évoluer.
 */
import { constants } from '@/config/constants'
import { kvStorage } from '@/shared/services/storage/mmkv'

export interface AppPreferences {
  /** Retours haptiques dans toute l'app. */
  haptics: boolean
  /** Nappe sonore du rituel de respiration, à l'ouverture de la pause. */
  pauseSound: boolean
  /** Envoi des rapports d'anomalie (Sentry). */
  crashReports: boolean
}

export const DEFAULT_PREFERENCES: AppPreferences = {
  haptics: true,
  pauseSound: true,
  crashReports: true,
}

/**
 * Heure des rappels du soir, en minutes depuis minuit (20 h 30 par défaut).
 *
 * Bornée à la fenêtre utile : un rappel « ta série est en danger » n'a de
 * sens qu'entre le retour du travail et le coucher. En dehors, il réveille
 * ou il arrive trop tôt pour qu'on puisse encore agir.
 */
export const DEFAULT_REMINDER_MINUTES = 20 * 60 + 30
export const REMINDER_MIN_MINUTES = 17 * 60
export const REMINDER_MAX_MINUTES = 22 * 60 + 30

/** Ramène une heure quelconque dans la fenêtre utile. */
export function clampReminderMinutes(minutes: number): number {
  if (!Number.isFinite(minutes)) return DEFAULT_REMINDER_MINUTES
  const rounded = Math.round(minutes)
  if (rounded < REMINDER_MIN_MINUTES) return REMINDER_MIN_MINUTES
  if (rounded > REMINDER_MAX_MINUTES) return REMINDER_MAX_MINUTES
  return rounded
}

/**
 * L'heure des rappels, toujours dans la fenêtre utile — y compris si une
 * version antérieure a écrit autre chose.
 */
export function getReminderMinutes(): number {
  try {
    const raw = kvStorage.getString(constants.PREF_REMINDER_MINUTES)
    if (raw === null) return DEFAULT_REMINDER_MINUTES
    return clampReminderMinutes(Number.parseInt(raw, 10))
  } catch {
    return DEFAULT_REMINDER_MINUTES
  }
}

export function setReminderMinutes(minutes: number): void {
  try {
    kvStorage.setString(
      constants.PREF_REMINDER_MINUTES,
      String(clampReminderMinutes(minutes)),
    )
  } catch {
    // Idem : ne jamais faire échouer un réglage de confort.
  }
}

/**
 * Le rituel exigé avant d'ouvrir la porte.
 *
 * Trois frictions de nature différente, pour trois façons de se reprendre :
 * `breathing` apaise, `math` occupe la tête, `transcribe` occupe les mains.
 * Le choix est une préférence d'app et non un réglage par règle : la friction
 * doit être une habitude stable, pas un paramètre qu'on ajuste règle par
 * règle jusqu'à trouver la plus facile.
 */
export const PAUSE_RITUALS = ['breathing', 'math', 'transcribe'] as const
export type PauseRitual = (typeof PAUSE_RITUALS)[number]

export const DEFAULT_PAUSE_RITUAL: PauseRitual = 'breathing'

function isPauseRitual(value: string | null): value is PauseRitual {
  return (PAUSE_RITUALS as readonly string[]).includes(value ?? '')
}

/**
 * Le rituel choisi. Toute valeur inconnue — écrite par une version plus
 * récente, puis rétrogradée — retombe sur la respiration plutôt que de
 * laisser l'écran de blocage sans contenu.
 */
export function getPauseRitual(): PauseRitual {
  try {
    const raw = kvStorage.getString(constants.PREF_PAUSE_RITUAL)
    return isPauseRitual(raw) ? raw : DEFAULT_PAUSE_RITUAL
  } catch {
    return DEFAULT_PAUSE_RITUAL
  }
}

export function setPauseRitual(ritual: PauseRitual): void {
  try {
    kvStorage.setString(constants.PREF_PAUSE_RITUAL, ritual)
  } catch {
    // Idem : ne jamais faire échouer un choix de confort.
  }
}

const KEYS: Record<keyof AppPreferences, string> = {
  haptics: constants.PREF_HAPTICS,
  pauseSound: constants.PREF_PAUSE_SOUND,
  crashReports: constants.PREF_CRASH_REPORTS,
}

function readFlag(key: keyof AppPreferences): boolean {
  const raw = kvStorage.getString(KEYS[key])
  if (raw !== '0' && raw !== '1') return DEFAULT_PREFERENCES[key]
  return raw === '1'
}

/** Une préférence, lue à la source. Sûr à appeler à n'importe quel instant. */
export function getPreference(key: keyof AppPreferences): boolean {
  try {
    return readFlag(key)
  } catch {
    // MMKV indisponible (tests, tout premier démarrage) : la valeur par
    // défaut vaut mieux qu'une exception dans un chemin décoratif.
    return DEFAULT_PREFERENCES[key]
  }
}

/** L'état complet, pour amorcer le store réactif. */
export function getPreferences(): AppPreferences {
  return {
    haptics: getPreference('haptics'),
    pauseSound: getPreference('pauseSound'),
    crashReports: getPreference('crashReports'),
  }
}

export function setPreference(key: keyof AppPreferences, value: boolean): void {
  try {
    kvStorage.setString(KEYS[key], value ? '1' : '0')
  } catch {
    // Idem : ne jamais faire échouer une bascule d'interrupteur.
  }
}
