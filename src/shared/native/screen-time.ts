/**
 * Pont JS vers le module natif Family Controls / DeviceActivity (iOS 16+).
 *
 * Multi-blocages : chaque règle a sa propre activité DeviceActivity et sa
 * propre sélection d'apps côté natif (App Group). Le bouclier système est
 * l'union des sélections des fenêtres actives — arrêter une règle n'affecte
 * jamais les autres.
 *
 * Sur simulateur / Android / build sans le module, `NativeModules.BlocusScreenTime`
 * est indéfini : `isScreenTimeAvailable` vaut false et l'app retombe sur le
 * comportement mock (aucun blocage réel). Voir ios/.../BlocusScreenTime.swift.
 */
import { NativeModules, Platform } from 'react-native'

export type AuthStatus = 'approved' | 'denied' | 'notDetermined' | 'unsupported'

/** Type de mécanique natif — mappe un `BlockRuleType` DB. */
export type NativeKind = 'timed' | 'schedule' | 'limit'

export interface ScreenTimeStatus {
  supported: boolean
  authorized: boolean
  blocking: boolean
  count: number
  /** Déprécié : le mode strict est géré par règle côté JS. Toujours false. */
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
  /** Lie la dernière sélection du picker à une règle (à la création). */
  bindSelection(ruleId: string): Promise<boolean>
  /** Bloque maintenant pour `minutes` (min 15). strict = pas d'arrêt anticipé. */
  startTimedBlock(
    ruleId: string,
    minutes: number,
    strict: boolean,
  ): Promise<boolean>
  /** Blocage récurrent quotidien sur une plage horaire. */
  startSchedule(
    ruleId: string,
    startHour: number,
    startMinute: number,
    endHour: number,
    endMinute: number,
  ): Promise<boolean>
  /** Blocage quand l'usage quotidien des apps de la règle atteint `minutes`. */
  startDailyLimit(ruleId: string, minutes: number): Promise<boolean>
  /** Arrête UNE règle (pause) sans toucher aux autres blocages. */
  stopRule(ruleId: string, kind: NativeKind): Promise<boolean>
  /** Suppression définitive : stop + oubli de la sélection de la règle. */
  clearRuleData(ruleId: string, kind: NativeKind): Promise<boolean>
  /** Réinitialisation globale (réservé au reset d'installation). */
  stopBlocking(): Promise<boolean>
  getStatus(): Promise<ScreenTimeStatus>
  /** Lit le journal d'événements SANS le vider (protocole pull-ack). */
  pullEvents(): Promise<ScreenTimeEvent[]>
  /** Purge les `count` premiers événements une fois la synchro réussie. */
  ackEvents(count: number): Promise<boolean>
  /** 1er lancement après (ré)install : purge le blocage système. true si frais. */
  resetIfFreshInstall(): Promise<boolean>
  /** Bilan de santé natif : build, autorisation, journal, vie des extensions. */
  getDiagnostics(): Promise<ScreenTimeDiagnostics>
}

/** Rapport de diagnostic natif (dev + debug device). */
export interface ScreenTimeDiagnostics {
  /** Date du dernier VRAI build natif (mtime du binaire, ISO). */
  nativeBuiltAt: string
  authorized: boolean
  appGroupOK: boolean
  eventLogCount: number
  eventLogTail: ScreenTimeEvent[]
  totalResisted: number
  activeWindows: string[]
  monitorLastWakeAt: string
  monitorLastWakeWhat: string
  shieldLastActionAt: string
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
  bindSelection: (ruleId: string) => ensure().bindSelection(ruleId),
  startTimedBlock: (ruleId: string, minutes: number, strict: boolean) =>
    ensure().startTimedBlock(ruleId, minutes, strict),
  startSchedule: (
    ruleId: string,
    startHour: number,
    startMinute: number,
    endHour: number,
    endMinute: number,
  ) =>
    ensure().startSchedule(ruleId, startHour, startMinute, endHour, endMinute),
  startDailyLimit: (ruleId: string, minutes: number) =>
    ensure().startDailyLimit(ruleId, minutes),
  stopRule: (ruleId: string, kind: NativeKind) =>
    ensure().stopRule(ruleId, kind),
  clearRuleData: (ruleId: string, kind: NativeKind) =>
    ensure().clearRuleData(ruleId, kind),
  stopBlocking: () => ensure().stopBlocking(),
  getStatus: () => ensure().getStatus(),
  pullEvents: () => ensure().pullEvents(),
  ackEvents: (count: number) => ensure().ackEvents(count),
  resetIfFreshInstall: () =>
    native ? native.resetIfFreshInstall() : Promise.resolve(false),
  getDiagnostics: () => ensure().getDiagnostics(),
}

/** Kind natif d'un type de règle DB. */
export function nativeKindOf(
  type: 'progressive_delay' | 'schedule' | 'daily_limit',
): NativeKind {
  if (type === 'schedule') return 'schedule'
  if (type === 'daily_limit') return 'limit'
  return 'timed'
}
