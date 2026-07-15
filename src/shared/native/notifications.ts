/**
 * Pont JS vers les notifications locales natives (méthodes greffées sur le
 * module `BlocusScreenTime`). 100 % local — aucun APNs.
 *
 * Les notifs DIFFÉRÉES (rappel série, bilan hebdo, win-back) sont planifiées
 * ici par le reconciler. Les célébrations TEMPS RÉEL (1ʳᵉ victoire, jalons)
 * partent de l'extension bouclier — voir RelockShieldAction.swift.
 */
import { NativeModules, Platform } from 'react-native'

export type NotifPermission = 'granted' | 'denied' | 'notDetermined'

interface NotifNative {
  requestNotifPermission(): Promise<NotifPermission>
  notifPermissionStatus(): Promise<NotifPermission>
  scheduleNotif(
    id: string,
    timestamp: number,
    title: string,
    body: string,
  ): Promise<boolean>
  cancelNotifsWithPrefix(prefix: string): Promise<boolean>
  setCelebrationsEnabled(enabled: boolean): Promise<boolean>
}

const native = NativeModules.BlocusScreenTime as
  | Partial<NotifNative>
  | undefined

export const isNotifAvailable =
  Platform.OS === 'ios' && typeof native?.scheduleNotif === 'function'

export const Notif = {
  isAvailable: isNotifAvailable,
  requestPermission: (): Promise<NotifPermission> =>
    isNotifAvailable
      ? native!.requestNotifPermission!()
      : Promise.resolve('denied'),
  permissionStatus: (): Promise<NotifPermission> =>
    isNotifAvailable
      ? native!.notifPermissionStatus!()
      : Promise.resolve('denied'),
  /** Planifie (ou remplace) une notif à un timestamp Unix (secondes). */
  schedule: (
    id: string,
    timestamp: number,
    title: string,
    body: string,
  ): Promise<boolean> =>
    isNotifAvailable
      ? native!.scheduleNotif!(id, timestamp, title, body)
      : Promise.resolve(false),
  /** Annule toutes les notifs planifiées dont l'id commence par `prefix`. */
  cancelWithPrefix: (prefix: string): Promise<boolean> =>
    isNotifAvailable
      ? native!.cancelNotifsWithPrefix!(prefix)
      : Promise.resolve(false),
  /** Active/désactive les célébrations temps réel (lues par l'extension). */
  setCelebrationsEnabled: (enabled: boolean): Promise<boolean> =>
    isNotifAvailable
      ? native!.setCelebrationsEnabled!(enabled)
      : Promise.resolve(false),
}
