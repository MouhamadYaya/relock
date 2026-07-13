/**
 * Pont JS vers le module natif Family Controls (iOS 16+, iPhone physique).
 *
 * Sur simulateur / Android / build sans le module, `NativeModules.BlocusScreenTime`
 * est indéfini : `isScreenTimeAvailable` vaut false et l'app retombe sur le
 * comportement mock (aucun blocage réel). Voir ios/.../BlocusScreenTime.swift.
 */
import { NativeModules, Platform } from 'react-native'

export type AuthStatus =
  | 'approved'
  | 'denied'
  | 'notDetermined'
  | 'unsupported'

export interface ScreenTimeStatus {
  supported: boolean
  authorized: boolean
  blocking: boolean
  count: number
}

interface BlocusScreenTimeNative {
  requestAuthorization(): Promise<AuthStatus>
  authorizationStatus(): Promise<AuthStatus>
  presentPicker(): Promise<{ count: number }>
  startBlocking(): Promise<boolean>
  stopBlocking(): Promise<boolean>
  getStatus(): Promise<ScreenTimeStatus>
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
  startBlocking: () => ensure().startBlocking(),
  stopBlocking: () => ensure().stopBlocking(),
  getStatus: () => ensure().getStatus(),
}
