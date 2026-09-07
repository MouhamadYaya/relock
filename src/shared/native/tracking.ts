/**
 * Pont JS vers ATT (App Tracking Transparency) — la feuille système iOS
 * « Autoriser "Relock" à suivre votre activité dans les apps et sur les
 * sites Web d'autres entreprises ? ».
 *
 * ⚠️ RIEN N'APPELLE `requestTrackingPermission()` AUJOURD'HUI, ET C'EST
 * VOLONTAIRE. Relock n'embarque aucun SDK publicitaire et ne lit aucun
 * identifiant publicitaire : afficher la feuille ATT sans suivi réel est un
 * motif de rejet documenté à la revue App Store, et contredirait la
 * politique de confidentialité publiée, qui affirme « nous ne vous suivons
 * pas ». `NSUserTrackingUsageDescription` a donc été retiré d'Info.plist.
 *
 * Pour rétablir la demande le jour où une attribution réelle existe :
 * remettre la clé dans `ios/Relock/Info.plist`, puis appeler
 * `requestTrackingPermission()` depuis l'écran voulu — ET mettre à jour la
 * politique de confidentialité (site + fiche App Store) dans le même
 * changement.
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
