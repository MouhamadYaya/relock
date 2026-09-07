/**
 * Pont JS vers les notifications locales natives (méthodes greffées sur le
 * module `BlocusScreenTime`). 100 % local — aucun APNs.
 *
 * Deux planificateurs, et le choix entre les deux est une décision de fond :
 *  • `schedule`         instant ABSOLU (fin d'essai, échéance d'offre, délai
 *                       relatif) — trigger par intervalle ;
 *  • `scheduleCalendar` heure LOCALE récurrente (« dimanche 19h ») — trigger
 *                       calendrier, qui suit le fuseau du téléphone.
 *
 * Les célébrations TEMPS RÉEL (1ʳᵉ victoire, jalons) partent de l'extension
 * bouclier — voir RelockShieldAction.swift.
 */
import { NativeModules, Platform } from 'react-native'

export type NotifPermission = 'granted' | 'denied' | 'notDetermined'

/** Options natives d'une notification. Toutes facultatives. */
export interface NotifOptions {
  /** Devient `userInfo.relock` — c'est elle qui porte la destination au tap. */
  payload?: Record<string, unknown>
  /** Regroupement iOS dans le centre de notifications. */
  threadId?: string
  categoryId?: string
  /**
   * `critical` est volontairement absent : entitlement Apple dédié, et aucune
   * justification dans un produit de bien-être numérique.
   */
  interruptionLevel?: 'passive' | 'active' | 'timeSensitive'
  /** 0 → 1. Ordonne la pile du centre de notifications. */
  relevanceScore?: number
}

/** Composantes d'une heure LOCALE. `weekday` suit Apple : 1 = dimanche. */
export interface NotifCalendarComponents {
  hour: number
  minute: number
  weekday?: number
  day?: number
}

/** Un tap enregistré par le délégué natif, en attente de traitement. */
export interface NotifResponse {
  id: string
  actionIdentifier: string
  /** Secondes depuis epoch. */
  respondedAt: number
  payload?: Record<string, unknown>
}

interface NotifNative {
  requestNotifPermission(): Promise<NotifPermission>
  notifPermissionStatus(): Promise<NotifPermission>
  scheduleNotif(
    id: string,
    timestamp: number,
    title: string,
    body: string,
    options: NotifOptions | null,
  ): Promise<boolean>
  scheduleNotifCalendar(
    id: string,
    components: NotifCalendarComponents,
    repeats: boolean,
    title: string,
    body: string,
    options: NotifOptions | null,
  ): Promise<boolean>
  cancelNotifs(ids: string[]): Promise<boolean>
  cancelNotifsWithPrefix(prefix: string): Promise<boolean>
  pendingNotifIds(): Promise<string[]>
  deliveredNotifIds(): Promise<string[]>
  consumeNotifResponses(): Promise<NotifResponse[]>
  setCelebrationsEnabled(enabled: boolean): Promise<boolean>
  setCelebrationCopy(copy: Record<string, string>): Promise<boolean>
}

const native = NativeModules.BlocusScreenTime as
  | Partial<NotifNative>
  | undefined

export const isNotifAvailable =
  Platform.OS === 'ios' && typeof native?.scheduleNotif === 'function'

/** Le natif étendu est-il présent ? (build antérieure au socle v2 ⇒ faux) */
const hasV2 = typeof native?.scheduleNotifCalendar === 'function'

export const Notif = {
  isAvailable: isNotifAvailable,
  /**
   * Vrai seulement si le binaire embarque le socle v2. Un JS à jour sur un
   * binaire périmé (dev-client non reconstruit) doit se taire plutôt que de
   * planifier des notifications sans destination.
   */
  hasRoutingSupport: isNotifAvailable && hasV2,

  requestPermission: (): Promise<NotifPermission> =>
    isNotifAvailable
      ? native!.requestNotifPermission!()
      : Promise.resolve('denied'),

  permissionStatus: (): Promise<NotifPermission> =>
    isNotifAvailable
      ? native!.notifPermissionStatus!()
      : Promise.resolve('denied'),

  /** Planifie (ou remplace) une notif à un instant absolu (Unix, secondes). */
  schedule: (
    id: string,
    timestamp: number,
    title: string,
    body: string,
    options?: NotifOptions,
  ): Promise<boolean> =>
    isNotifAvailable
      ? native!.scheduleNotif!(id, timestamp, title, body, options ?? null)
      : Promise.resolve(false),

  /** Planifie (ou remplace) une notif à une heure locale (trigger calendrier). */
  scheduleCalendar: (
    id: string,
    components: NotifCalendarComponents,
    repeats: boolean,
    title: string,
    body: string,
    options?: NotifOptions,
  ): Promise<boolean> =>
    hasV2
      ? native!.scheduleNotifCalendar!(
          id,
          components,
          repeats,
          title,
          body,
          options ?? null,
        )
      : Promise.resolve(false),

  /** Annule des notifs par identifiant exact. */
  cancel: (ids: string[]): Promise<boolean> =>
    hasV2 && ids.length > 0
      ? native!.cancelNotifs!(ids)
      : Promise.resolve(false),

  /** Annule toutes les notifs planifiées dont l'id commence par `prefix`. */
  cancelWithPrefix: (prefix: string): Promise<boolean> =>
    isNotifAvailable
      ? native!.cancelNotifsWithPrefix!(prefix)
      : Promise.resolve(false),

  /** Ce qu'iOS a RÉELLEMENT en attente — la seule vérité du garde de capacité. */
  pendingIds: (): Promise<string[]> =>
    hasV2 ? native!.pendingNotifIds!() : Promise.resolve([]),

  /** Notifications livrées encore présentes dans le centre de notifications. */
  deliveredIds: (): Promise<string[]> =>
    hasV2 ? native!.deliveredNotifIds!() : Promise.resolve([]),

  /** Lecture DESTRUCTIVE des taps en attente. */
  consumeResponses: (): Promise<NotifResponse[]> =>
    hasV2 ? native!.consumeNotifResponses!() : Promise.resolve([]),

  /** Active/désactive les célébrations temps réel (lues par l'extension). */
  setCelebrationsEnabled: (enabled: boolean): Promise<boolean> =>
    isNotifAvailable
      ? native!.setCelebrationsEnabled!(enabled)
      : Promise.resolve(false),

  /** Publie les textes traduits des célébrations dans l'App Group. */
  setCelebrationCopy: (copy: Record<string, string>): Promise<boolean> =>
    hasV2 ? native!.setCelebrationCopy!(copy) : Promise.resolve(false),
}
