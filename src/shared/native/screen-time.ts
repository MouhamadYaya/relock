/**
 * Pont JS vers le module natif Family Controls / DeviceActivity (iOS 16+).
 *
 * Sur simulateur / Android / build sans le module, `NativeModules.BlocusScreenTime`
 * est indéfini : `isScreenTimeAvailable` vaut false et l'app retombe sur le
 * comportement mock (aucun blocage réel). Voir ios/.../BlocusScreenTime.swift.
 */
import { NativeModules, Platform } from 'react-native'

export type AuthStatus = 'approved' | 'denied' | 'notDetermined' | 'unsupported'

export interface ScreenTimeStatus {
  supported: boolean
  authorized: boolean
  blocking: boolean
  count: number
  strict: boolean
}

export interface ScreenTimeEvent {
  kind: string
  activity: string
  at: string
}

interface BlocusScreenTimeNative {
  requestAuthorization(): Promise<AuthStatus>
  authorizationStatus(): Promise<AuthStatus>
  presentPicker(): Promise<{ count: number }>
  /** Bloque maintenant pour `minutes` (min 15). strict = pas d'arrêt anticipé. */
  startTimedBlock(minutes: number, strict: boolean): Promise<boolean>
  /** Blocage récurrent quotidien sur une plage horaire. */
  startSchedule(
    startHour: number,
    startMinute: number,
    endHour: number,
    endMinute: number,
  ): Promise<boolean>
  /** Blocage quand l'usage quotidien des apps atteint `minutes`. */
  startDailyLimit(minutes: number): Promise<boolean>
  stopBlocking(): Promise<boolean>
  getStatus(): Promise<ScreenTimeStatus>
  /** Récupère + vide le journal d'événements de l'extension. */
  pullEvents(): Promise<ScreenTimeEvent[]>
}

const native = NativeModules.BlocusScreenTime as
  | BlocusScreenTimeNative
  | undefined

/** True quand le module Family Controls natif est présent (iOS device). */
export const isScreenTimeAvailable = Platform.OS === 'ios' && native != null

function ensure(): BlocusScreenTimeNative {
  if (!native) {
    throw new Error(
      'Family Controls indisponible (simulateur ou module non lié).',
    )
  }
  return native
}

export const ScreenTime = {
  isAvailable: isScreenTimeAvailable,
  requestAuthorization: () => ensure().requestAuthorization(),
  authorizationStatus: () => ensure().authorizationStatus(),
  presentPicker: () => ensure().presentPicker(),
  startTimedBlock: (minutes: number, strict: boolean) =>
    ensure().startTimedBlock(minutes, strict),
  startSchedule: (
    startHour: number,
    startMinute: number,
    endHour: number,
    endMinute: number,
  ) => ensure().startSchedule(startHour, startMinute, endHour, endMinute),
  startDailyLimit: (minutes: number) => ensure().startDailyLimit(minutes),
  stopBlocking: () => ensure().stopBlocking(),
  getStatus: () => ensure().getStatus(),
  pullEvents: () => ensure().pullEvents(),
}
