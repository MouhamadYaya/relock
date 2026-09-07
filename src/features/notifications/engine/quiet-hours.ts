/**
 * Fenêtre de silence.
 *
 * Règle de fond : le réglage de l'utilisateur REMPLACE la fenêtre par défaut,
 * il ne s'y ajoute pas. Additionner les deux (22h–8h ∪ 23h–7h) rendrait le
 * réglage strictement inutile — l'utilisateur croirait avoir choisi quelque
 * chose sans que rien ne change jamais.
 */
import type { QuietHours } from '@/features/notifications/types'

const DAY_MINUTES = 1440

const minutesOfDay = (at: number): number => {
  const d = new Date(at)
  return d.getHours() * 60 + d.getMinutes()
}

/** La fenêtre traverse-t-elle minuit ? (22h → 8h : oui) */
export function crossesMidnight(quiet: QuietHours): boolean {
  return quiet.startMinutes > quiet.endMinutes
}

export function isQuietMinute(minutes: number, quiet: QuietHours): boolean {
  const normalised = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES
  return crossesMidnight(quiet)
    ? normalised >= quiet.startMinutes || normalised < quiet.endMinutes
    : normalised >= quiet.startMinutes && normalised < quiet.endMinutes
}

export function isWithinQuietHours(at: number, quiet: QuietHours): boolean {
  return isQuietMinute(minutesOfDay(at), quiet)
}

/**
 * Décale un instant hors de la fenêtre de silence, vers la SORTIE de fenêtre
 * la plus proche dans le futur.
 *
 * On décale plutôt qu'on ne supprime : un rappel qui tombe à 23h n'a pas perdu
 * son sens, il a perdu son heure. Les nœuds pour qui l'instant EST le message
 * (fin d'un verrou strict) déclarent `quietHours: 'ignore'` et ne passent
 * jamais ici.
 */
export function shiftOutOfQuietHours(at: number, quiet: QuietHours): number {
  if (!isWithinQuietHours(at, quiet)) return at
  const d = new Date(at)
  const current = d.getHours() * 60 + d.getMinutes()
  // Si on est déjà après la sortie de fenêtre dans la journée (cas d'une
  // fenêtre traversant minuit, ex. 23h30 pour 22h–8h), la sortie est demain.
  const nextDay = crossesMidnight(quiet) && current >= quiet.startMinutes
  d.setHours(0, quiet.endMinutes, 0, 0)
  if (nextDay) d.setDate(d.getDate() + 1)
  return d.getTime()
}
