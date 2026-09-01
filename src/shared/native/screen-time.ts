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

export interface SelectionInfo {
  apps: number
  categories: number
  webDomains: number
  total: number
}

interface BlocusScreenTimeNative {
  requestAuthorization(): Promise<AuthStatus>
  authorizationStatus(): Promise<AuthStatus>
  presentPicker(): Promise<{ count: number }>
  /** Lie la dernière sélection du picker à une règle (à la création). */
  bindSelection(ruleId: string): Promise<boolean>
  /**
   * Recopie la sélection d'une règle dans le brouillon global AVANT d'ouvrir
   * le sélecteur : en édition, il s'ouvre donc sur les apps de CETTE règle.
   * Résout le nombre d'éléments amorcés.
   */
  seedSelection(ruleId: string): Promise<number>
  /**
   * Ce que la règle bloque, en NOMBRES. Apple ne livre jamais l'identité des
   * apps : on sait seulement combien de tuiles dessiner, chacune rendue par
   * `BlockedAppIconsView` à son rang.
   */
  selectionInfo(ruleId: string): Promise<SelectionInfo>
  /** Débloque TEMPORAIREMENT l'app de rang `index` (la règle continue). */
  unblockApp(
    ruleId: string,
    index: number,
    minutes: number,
  ): Promise<{ until: number }>
  /** Sursis en cours pour une règle : rang de l'app (string) → fin (epoch s). */
  reprievedApps(ruleId: string): Promise<Record<string, number>>
  /**
   * Identités STABLES des apps d'une règle, triées. Un `Set` natif n'a pas
   * d'ordre garanti : indexer dedans faisait afficher deux fois la même app.
   */
  appKeys(ruleId: string): Promise<string[]>
  /**
   * Apps couvertes par une protection en cours, DÉDUPLIQUÉES. Inclut celles
   * en sursis : un déblocage temporaire n'exclut pas l'app de la protection.
   */
  blockedAppKeys(): Promise<string[]>
  /** Apps en sursis : clé stable → fin du sursis (epoch, secondes). */
  reprievedKeys(): Promise<Record<string, number>>
  /** Débloque temporairement l'app désignée par sa clé stable. */
  unblockAppKey(key: string, minutes: number): Promise<{ until: number }>
  /** Termine immédiatement le sursis d'une app et remet son bouclier. */
  reblockAppKey(key: string): Promise<boolean>
  /** Joue/arrête la nappe sonore locale du rituel respiratoire. */
  playCalmSound(): Promise<boolean>
  stopCalmSound(): Promise<boolean>
  /** Bloque maintenant pour `minutes` (min 15). strict = pas d'arrêt anticipé. */
  startTimedBlock(
    ruleId: string,
    minutes: number,
    strict: boolean,
  ): Promise<boolean>
  /**
   * Blocage récurrent sur une plage horaire.
   * `days` : 0 = dimanche … 6 = samedi. Vide ⇒ tous les jours.
   */
  startSchedule(
    ruleId: string,
    startHour: number,
    startMinute: number,
    endHour: number,
    endMinute: number,
    days: number[],
  ): Promise<boolean>
  /** Blocage quand l'usage quotidien des apps de la règle atteint `minutes`. */
  startDailyLimit(ruleId: string, minutes: number): Promise<boolean>
  /**
   * Avancement du quota du jour par règle (id → 0…1). Granularité : les paliers
   * 25/50/75/100 % — iOS ne notifie qu'un seuil franchi, jamais un compteur.
   */
  limitSteps(): Promise<Record<string, number>>
  /** Activités DeviceActivity réellement armées côté iOS (vérité système). */
  armedActivities(): Promise<string[]>
  /** Arrête UNE règle (pause) sans toucher aux autres blocages. */
  stopRule(ruleId: string, kind: NativeKind): Promise<boolean>
  /**
   * Suspend une règle : bouclier masqué, surveillance CONSERVÉE — c'est ce qui
   * permet à iOS de reprendre seul à l'échéance, app fermée.
   * `untilSec` : timestamp de reprise en secondes, 0 ⇒ jusqu'à reprise manuelle.
   */
  suspendRule(ruleId: string, untilSec: number): Promise<boolean>
  /** Reprise manuelle : lève le masque et annule le réveil programmé. */
  resumeRule(ruleId: string): Promise<boolean>
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
  /** Activités réellement armées côté iOS (la vérité système). */
  armedActivities: string[]
  /** Affichages du bouclier (= tentatives d'ouverture arrêtées). */
  shieldShownTotal: number
  shieldLastShownAt: string
  /** Paliers de quota franchis aujourd'hui, clé « limitProgress.<id> ». */
  limitProgress: Record<string, string>
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
  seedSelection: (ruleId: string) => ensure().seedSelection(ruleId),
  selectionInfo: (ruleId: string) => ensure().selectionInfo(ruleId),
  unblockApp: (ruleId: string, index: number, minutes: number) =>
    ensure().unblockApp(ruleId, index, minutes),
  reprievedApps: (ruleId: string) => ensure().reprievedApps(ruleId),
  appKeys: (ruleId: string) => ensure().appKeys(ruleId),
  blockedAppKeys: () => ensure().blockedAppKeys(),
  reprievedKeys: () => ensure().reprievedKeys(),
  unblockAppKey: (key: string, minutes: number) =>
    ensure().unblockAppKey(key, minutes),
  reblockAppKey: (key: string) => ensure().reblockAppKey(key),
  playCalmSound: () =>
    native ? native.playCalmSound() : Promise.resolve(false),
  stopCalmSound: () =>
    native ? native.stopCalmSound() : Promise.resolve(false),
  startTimedBlock: (ruleId: string, minutes: number, strict: boolean) =>
    ensure().startTimedBlock(ruleId, minutes, strict),
  startSchedule: (
    ruleId: string,
    startHour: number,
    startMinute: number,
    endHour: number,
    endMinute: number,
    days: number[] = [],
  ) =>
    ensure().startSchedule(
      ruleId,
      startHour,
      startMinute,
      endHour,
      endMinute,
      days,
    ),
  startDailyLimit: (ruleId: string, minutes: number) =>
    ensure().startDailyLimit(ruleId, minutes),
  limitSteps: () => (native ? native.limitSteps() : Promise.resolve({})),
  armedActivities: () =>
    native ? native.armedActivities() : Promise.resolve([]),
  stopRule: (ruleId: string, kind: NativeKind) =>
    ensure().stopRule(ruleId, kind),
  suspendRule: (ruleId: string, untilSec: number) =>
    ensure().suspendRule(ruleId, untilSec),
  resumeRule: (ruleId: string) => ensure().resumeRule(ruleId),
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
