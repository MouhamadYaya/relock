/**
 * Service de notifications — reconciler IDEMPOTENT.
 *
 * À chaque appel : on annule TOUTES les notifs planifiées par l'app, puis on
 * replanifie exactement celles qui sont pertinentes maintenant. Conséquence :
 *  • aucun doublon possible (id stable + purge préalable) ;
 *  • annulation automatique dès qu'une notif n'a plus lieu d'être (ex. un
 *    blocage armé aujourd'hui supprime le rappel « série en danger » du soir).
 *
 * Toutes les heures de tir tombent dans la fenêtre utile (jamais 22h–8h).
 */
import { Notif } from '@/shared/native/notifications'
import { NotifContent } from './content'
import { getNotifPrefs } from './prefs'

/** Préfixe commun aux notifs PLANIFIÉES par l'app (≠ célébrations natives). */
const PREFIX = 'relock.sched.'

export interface NotifState {
  /** Série en cours (jours). */
  streak: number
  /** Au moins un blocage protège réellement aujourd'hui. */
  protectedToday: boolean
}

const unix = (d: Date): number => Math.floor(d.getTime() / 1000)

// Dernier état connu (mis à jour par le reconciler de l'Accueil) — permet aux
// Réglages de RÉAPPLIQUER immédiatement après un changement de préférence sans
// avoir à re-calculer la série / la protection du jour.
let lastState: NotifState = { streak: 0, protectedToday: false }

/** Timestamp Unix (s) d'aujourd'hui à h:m. */
function todayAt(h: number, m: number): number {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return unix(d)
}

/** Timestamp du prochain dimanche à h:m (aujourd'hui si dimanche avant l'heure). */
function nextSundayAt(h: number, m: number): number {
  const d = new Date()
  const isSundayBefore =
    d.getDay() === 0 &&
    (d.getHours() < h || (d.getHours() === h && d.getMinutes() < m))
  const add = isSundayBefore ? 0 : (7 - d.getDay()) % 7 || 7
  d.setDate(d.getDate() + add)
  d.setHours(h, m, 0, 0)
  return unix(d)
}

/** Timestamp dans `days` jours à h:m. */
function inDaysAt(days: number, h: number, m: number): number {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(h, m, 0, 0)
  return unix(d)
}

export const NotificationService = {
  async reconcile(state: NotifState): Promise<void> {
    lastState = state
    if (!Notif.isAvailable) return
    const p = getNotifPrefs()

    // Les célébrations temps réel (extension) suivent master && progression.
    await Notif.setCelebrationsEnabled(p.master && p.progression)

    // Ardoise propre pour toutes les notifs planifiées.
    await Notif.cancelWithPrefix(PREFIX)
    if (!p.master) return

    const now = unix(new Date())

    if (p.reminders) {
      // Rappel « série en danger » : ce soir 20h30, si une série est en jeu et
      // que rien ne protège aujourd'hui. (Ré-annulé au prochain reconcile si
      // l'utilisateur arme un blocage → jamais de faux rappel.)
      if (state.streak >= 1 && !state.protectedToday) {
        const t = todayAt(20, 30)
        if (t > now) {
          const c = NotifContent.streakRisk(state.streak)
          await Notif.schedule(`${PREFIX}streakRisk`, t, c.title, c.body)
        }
      }
      // Win-back : dans 3 jours à 20h. Replanifié à chaque ouverture → ne tire
      // que si l'utilisateur reste réellement absent 3 jours d'affilée.
      const c = NotifContent.winback()
      await Notif.schedule(
        `${PREFIX}winback`,
        inDaysAt(3, 20, 0),
        c.title,
        c.body,
      )
    }

    if (p.progression) {
      // Bilan hebdo : dimanche 19h (générique → renvoie vers l'app).
      const c = NotifContent.weekly()
      await Notif.schedule(
        `${PREFIX}weekly`,
        nextSundayAt(19, 0),
        c.title,
        c.body,
      )
    }
  },

  /** Réapplique la stratégie avec le dernier état connu (après un changement
   *  de préférence dans les Réglages → effet immédiat). */
  async reconcileFromLast(): Promise<void> {
    return this.reconcile(lastState)
  },

  /** Demande la permission SEULEMENT si non encore déterminée. */
  async ensurePermission(): Promise<boolean> {
    if (!Notif.isAvailable) return false
    const status = await Notif.permissionStatus()
    if (status === 'granted') return true
    if (status === 'notDetermined') {
      return (await Notif.requestPermission()) === 'granted'
    }
    return false
  },
}
