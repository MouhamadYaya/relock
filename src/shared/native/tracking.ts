/**
 * Pont JS vers ATT (App Tracking Transparency) — la feuille système iOS
 * « Autoriser "Relock" à suivre votre activité dans les apps et sur les
 * sites Web d'autres entreprises ? ».
 *
 * Sur Android, sur un build sans le module natif, ou sur iOS < 14,
 * `isTrackingPromptAvailable` vaut false et les appels résolvent
 * `'unavailable'` : aucun code appelant n'a besoin de tester la plateforme.
 *
 * Côté iOS la demande est à usage unique : une fois le statut déterminé,
 * `requestTrackingPermission()` résout immédiatement avec ce statut sans
 * rien afficher. Inutile de mémoriser « déjà demandé ».
 *
 * Voir ios/Relock/RelockTracking.swift.
 */
import { NativeModules, Platform } from 'react-native'

export type TrackingStatus =
  | 'authorized'
  | 'denied'
  | 'restricted'
  | 'notDetermined'
  | 'unavailable'

interface RelockTrackingNative {
  status(): Promise<TrackingStatus>
  request(): Promise<TrackingStatus>
}

const native: RelockTrackingNative | null =
  Platform.OS === 'ios'
    ? ((NativeModules.RelockTracking as RelockTrackingNative | undefined) ??
      null)
    : null

export const isTrackingPromptAvailable = native !== null

/** Statut ATT courant. Ne déclenche jamais d'alerte. */
export async function getTrackingStatus(): Promise<TrackingStatus> {
  if (!native) return 'unavailable'
  try {
    return await native.status()
  } catch {
    return 'unavailable'
  }
}

/**
 * Affiche la feuille ATT si le statut est encore indéterminé, et résout avec
 * le statut final. Le natif attend que l'app soit active : appelée trop tôt
 * après le lancement, la demande serait sinon consommée sans rien afficher.
 */
export async function requestTrackingPermission(): Promise<TrackingStatus> {
  if (!native) return 'unavailable'
  try {
    return await native.request()
  } catch {
    return 'unavailable'
  }
}
