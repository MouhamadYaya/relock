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

/**
 * Une ligne du journal partagé des extensions.
 *
 * Les extensions Family Controls sont des processus séparés : leurs erreurs
 * n'apparaissent PAS dans le rapport de crash de l'app. Deux d'entre elles ne
 * peuvent même pas héberger de SDK — `RelockActivityReport` n'a aucun accès
 * réseau (Apple), et `RelockShield` est trop sensible à la latence. Elles
 * écrivent donc ici, et l'app draine au démarrage suivant.
 */
export type ExtensionLogEntry = {
  /** Secondes depuis epoch. */
  ts: number
  /** Cible émettrice : `shield`, `monitor`, `report`, `widgets`, `action`. */
  source: string
  /** `error` ou `info`. */
  kind: string
  /** Message stable, sans identifiant — sert d'empreinte de regroupement. */
  message: string
  data?: Record<string, string>
  /** Présent sur la 1re entrée quand le tampon a débordé. */
  droppedBefore?: number
}

export type AuthStatus = 'approved' | 'denied' | 'notDetermined' | 'unsupported'

/**
 * Score d'Accueil calculé par l'extension `RelockActivityReport`, lu via le
 * conteneur App Group. Les mesures brutes de Temps d'écran ne quittent jamais
 * le bac à sable Apple : seul ce résultat agrégé traverse.
 *
 * `pending` n'est pas un score bas, c'est l'absence de score — un nouvel
 * utilisateur n'a aucun historique auquel se comparer.
 */
export interface NativeHomeScore {
  status: 'pending' | 'provisional' | 'ready'
  global?: number
  focus?: number
  rest?: number
  delta?: number
  weakestAxis?: 'focus' | 'rest'
  historyDays: number
  updatedAt?: number
}

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

/** Contexte à usage unique transmis par le mur iOS avant d'ouvrir Relock. */
export interface PendingShieldRequest {
  id: string
  /** Contexte facultatif : la redirection vers Blocages n'en dépend pas. */
  applicationKey: string | null
  applicationName: string | null
  /** Timestamp Unix en secondes. */
  requestedAt: number
}

/**
 * Le choix de l'utilisateur, et ce qu'iOS applique réellement.
 *
 * Les deux divergent normalement : la protection n'est ARMÉE que pendant
 * qu'un blocage protège. Case cochée + aucun blocage en cours = `enabled`
 * vrai, `active` faux, et l'iPhone se comporte normalement.
 */
export interface UninstallProtection {
  /** La case est cochée dans les Réglages. */
  enabled: boolean
  /** La restriction iOS est posée en ce moment même. */
  active: boolean
}

export interface SelectionInfo {
  apps: number
  categories: number
  webDomains: number
  total: number
}

export interface HomeReferenceFixture {
  enabled: true
  streak: number
  focusScore: number
  restScore: number
  blockedCount: number
  blockedOverflow: number
  myAppsScenario?: 'blocked' | 'upcoming' | 'none'
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
  /** Consomme le contexte du dernier bouton « Ouvrir Relock ». */
  consumePendingShieldRequest(): Promise<PendingShieldRequest | null>
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
  /** Score d'Accueil déposé par l'extension de rapport. */
  homeScore(): Promise<NativeHomeScore>
  /** Lit le journal d'événements SANS le vider (protocole pull-ack). */
  pullEvents(): Promise<ScreenTimeEvent[]>
  /** Purge les `count` premiers événements une fois la synchro réussie. */
  ackEvents(count: number): Promise<boolean>
  /** 1er lancement après (ré)install : purge le blocage système. true si frais. */
  /**
   * Protection contre la désinstallation. Rend `true` si la restriction a pu
   * être appliquée (iOS 16+), `false` sinon — le choix reste enregistré.
   */
  setUninstallProtection(enabled: boolean): Promise<boolean>
  uninstallProtection(): Promise<UninstallProtection>
  resetIfFreshInstall(): Promise<boolean>
  /** Vide le journal partagé écrit par les 5 extensions (voir ExtensionLog.swift). */
  drainExtensionLog?(): Promise<ExtensionLogEntry[]>
  /** Dépose le DSN Sentry dans le groupe d'app, pour les extensions. */
  publishSentryDSN?(dsn: string): Promise<boolean>
  /** Bilan de santé natif : build, autorisation, journal, vie des extensions. */
  getDiagnostics(): Promise<ScreenTimeDiagnostics>
  /** DEBUG uniquement, et uniquement après `-HomeReferenceFixture YES`. */
  homeReferenceFixture?(): Promise<HomeReferenceFixture | null>
  /**
   * DEV uniquement (absent des builds Release) : rejoue l'effet d'un quota
   * quotidien atteint, pour vérifier que le bouclier tombe bien en pleine
   * session sans avoir à consommer de vraies minutes d'écran.
   */
  simulateLimitReached?(
    ruleId: string,
    reached: boolean,
  ): Promise<{ activeWindows: string[]; shieldApplications: number }>
}

/** Rapport de diagnostic natif (dev + debug device). */
export interface ScreenTimeDiagnostics {
  /** Date du dernier VRAI build natif (mtime du binaire, ISO). */
  nativeBuiltAt: string
  authorized: boolean
  appGroupOK: boolean
  /** Canal persistant utilisé par les extensions du Shield. */
  shieldStateTransport: string
  eventLogCount: number
  eventLogTail: ScreenTimeEvent[]
  totalResisted: number
  activeWindows: string[]
  monitorLastWakeAt: string
  monitorLastWakeWhat: string
  shieldLastActionAt: string
  shieldLastOpenRequestStatus: string
  shieldLastActionResponse: string
  pendingShieldRequest: PendingShieldRequest | null
  /** Activités réellement armées côté iOS (la vérité système). */
  armedActivities: string[]
  /** Affichages du bouclier (= tentatives d'ouverture arrêtées). */
  shieldShownTotal: number
  shieldLastShownAt: string
  /** Sonde de diagnostic écrite par le mur lui-même (voir RelockShield). */
  shieldProbeAt: string
  shieldProbeWhat: string
  /** Nom système de la dernière app arrêtée par le mur (« — » si aucune). */
  shieldLastApplicationName: string
  /** Nombre d'arrêts de cette app aujourd'hui. */
  shieldLastApplicationCount: number
  /**
   * VÉRITÉ SYSTÈME : ce que ManagedSettings applique vraiment, relu depuis le
   * magasin. `-1` quand l'API n'est pas disponible. À distinguer de
   * `activeWindows`, qui dit seulement ce que Relock CROIT avoir armé.
   */
  shieldApplications: number
  shieldWebDomains: number
  shieldCategories: string
  /** Nombre de sursis (déblocages temporaires) encore en cours. */
  reprievedCount: number
  /** Filtre de jours par règle (0 = dimanche). Absent ⇒ tous les jours. */
  ruleDays: Record<string, number[]>
  /** Règles masquées : id → reprise (epoch s), 0 = jusqu'à reprise manuelle. */
  suspendedRules: Record<string, number>
  /** Paliers de quota franchis aujourd'hui, clé « limitProgress.<id> ». */
  limitProgress: Record<string, string>
}

const native = NativeModules.BlocusScreenTime as
  | BlocusScreenTimeNative
  | undefined

/** True quand le module Family Controls natif est présent (iOS device). */
export const isScreenTimeAvailable = Platform.OS === 'ios' && native != null

/**
 * Les méthodes qui ont un repli utile se gardent **par méthode**, jamais par
 * module : `native ? native.x() : repli` ne teste que la présence du module.
 * Le binaire installé peut être plus ancien que le bundle JS servi par Metro —
 * c'est le cas normal quand on ajoute une méthode native sans relancer
 * `npm run ios`. Le module existe alors, la méthode non, et l'appel jetait un
 * `TypeError` synchrone qui échappait au `.catch()` de l'appelant et tuait
 * l'écran entier au lieu de dégrader vers l'état vide prévu.
 */
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
    native?.playCalmSound ? native.playCalmSound() : Promise.resolve(false),
  stopCalmSound: () =>
    native?.stopCalmSound ? native.stopCalmSound() : Promise.resolve(false),
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
  limitSteps: () =>
    native?.limitSteps ? native.limitSteps() : Promise.resolve({}),
  armedActivities: () =>
    native?.armedActivities ? native.armedActivities() : Promise.resolve([]),
  consumePendingShieldRequest: () =>
    native?.consumePendingShieldRequest
      ? native.consumePendingShieldRequest()
      : Promise.resolve(null),
  stopRule: (ruleId: string, kind: NativeKind) =>
    ensure().stopRule(ruleId, kind),
  suspendRule: (ruleId: string, untilSec: number) =>
    ensure().suspendRule(ruleId, untilSec),
  resumeRule: (ruleId: string) => ensure().resumeRule(ruleId),
  clearRuleData: (ruleId: string, kind: NativeKind) =>
    ensure().clearRuleData(ruleId, kind),
  stopBlocking: () => ensure().stopBlocking(),
  getStatus: () => ensure().getStatus(),
  homeScore: (): Promise<NativeHomeScore> =>
    native?.homeScore
      ? native.homeScore()
      : Promise.resolve({ status: 'pending', historyDays: 0 }),
  pullEvents: () => ensure().pullEvents(),
  ackEvents: (count: number) => ensure().ackEvents(count),
  setUninstallProtection: (enabled: boolean) =>
    native?.setUninstallProtection
      ? native.setUninstallProtection(enabled)
      : Promise.resolve(false),
  /**
   * Sans module natif (simulateur, Android), la protection n'existe pas : on
   * répond « ni demandée, ni active » plutôt que de laisser l'écran afficher
   * un interrupteur qui ne commande rien.
   */
  uninstallProtection: (): Promise<UninstallProtection> =>
    native?.uninstallProtection
      ? native.uninstallProtection()
      : Promise.resolve({ enabled: false, active: false }),
  resetIfFreshInstall: () =>
    native?.resetIfFreshInstall
      ? native.resetIfFreshInstall()
      : Promise.resolve(false),
  getDiagnostics: () => ensure().getDiagnostics(),
  /**
   * Résout `[]` quand le module natif est absent (simulateur sans le module,
   * Android) : la télémétrie ne doit jamais faire échouer un démarrage.
   */
  drainExtensionLog: (): Promise<ExtensionLogEntry[]> =>
    native?.drainExtensionLog
      ? native.drainExtensionLog()
      : Promise.resolve([]),
  publishSentryDSN: (dsn: string): Promise<boolean> =>
    native?.publishSentryDSN
      ? native.publishSentryDSN(dsn)
      : Promise.resolve(false),
  homeReferenceFixture: () =>
    __DEV__ && native?.homeReferenceFixture
      ? native.homeReferenceFixture()
      : Promise.resolve(null),
  /** Résout `null` quand la build n'expose pas la simulation (Release). */
  simulateLimitReached: (ruleId: string, reached: boolean) =>
    native?.simulateLimitReached
      ? native.simulateLimitReached(ruleId, reached)
      : Promise.resolve(null),
}

/** Kind natif d'un type de règle DB. */
export function nativeKindOf(
  type: 'progressive_delay' | 'schedule' | 'daily_limit',
): NativeKind {
  if (type === 'schedule') return 'schedule'
  if (type === 'daily_limit') return 'limit'
  return 'timed'
}
