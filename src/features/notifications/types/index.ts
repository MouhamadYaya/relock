/**
 * Modèle du système de notifications v2.
 *
 * PRINCIPE FONDATEUR — une notification Relock doit MÉRITER l'interruption
 * qu'elle crée. Relock vend moins d'écran : devenir soi-même une source de
 * sollicitation serait un reniement du produit, pas un compromis de croissance.
 *
 * Tout le catalogue est DÉCLARATIF : un nœud est une donnée, jamais du code
 * impératif. `when`, `schedule` et `content` sont des fonctions pures du
 * contexte — donc testables sans simulateur, sans natif et sans horloge réelle.
 */
import type { NotifPermission } from '@/shared/native/notifications'

// ─────────────────────────────────────────────────────────────────────
// Identité
// ─────────────────────────────────────────────────────────────────────

export const NOTIF_FAMILIES = [
  'activation',
  'blocking',
  'strict',
  'score',
  'progress',
  'retention',
  'billing',
  'health',
  'ritual',
] as const

export type NotifFamily = (typeof NOTIF_FAMILIES)[number]

/**
 * Canaux de préférence, tels que l'utilisateur les voit dans les Réglages.
 *
 * `protection` n'est PAS listé : les alertes de protection ne passent par
 * aucun canal, ne répondent qu'à l'autorisation système, et restent actives
 * même interrupteur maître coupé (dit explicitement dans l'écran Réglages —
 * un réglage qui ment est pire que l'absence de réglage).
 */
export const NOTIF_CHANNELS = [
  'reminders',
  'progression',
  'account',
  'offers',
  'ritual',
] as const

export type NotifChannel = (typeof NOTIF_CHANNELS)[number]

/** `protection` = hors canal. Les autres sont gouvernés par les Réglages. */
export type NotifChannelOrProtection = NotifChannel | 'protection'

// ─────────────────────────────────────────────────────────────────────
// Budgets
// ─────────────────────────────────────────────────────────────────────

/**
 * Trois budgets distincts, parce que trois natures de message différentes.
 *
 *  standard       le flux normal — 1 par jour, 5 par semaine, priorité arbitre ;
 *  protection     hors budget standard, mais DÉDUPLICATION obligatoire : trois
 *                 symptômes d'une même panne font une seule notification ;
 *  userRequested  ce que l'utilisateur a explicitement demandé (rituel). Il l'a
 *                 choisi : ça ne consomme pas le budget des messages qu'on lui
 *                 envoie de notre propre initiative.
 */
export type NotifBudgetClass = 'standard' | 'protection' | 'userRequested'

// ─────────────────────────────────────────────────────────────────────
// Interruption (Apple)
// ─────────────────────────────────────────────────────────────────────

/**
 * `critical` est volontairement absent du type : il exige un entitlement Apple
 * dédié et n'a aucune justification dans un produit de bien-être numérique.
 * Le rendre inexprimable vaut mieux qu'une règle écrite quelque part.
 */
export type NotifInterruption = 'passive' | 'active' | 'timeSensitive'

// ─────────────────────────────────────────────────────────────────────
// Temps — trois natures, jamais interchangeables
// ─────────────────────────────────────────────────────────────────────

/**
 *  wallClock   heure locale : « dimanche 19h » reste 19h après un vol
 *              Montréal → Paris. Trigger CALENDRIER côté iOS ;
 *  absolute    instant mondial : la fin d'un essai ou d'une offre ne se
 *              décale pas de six heures parce qu'on a changé de fuseau ;
 *  relative    délai depuis maintenant (« dans 2 h », « fin − 10 min ») ;
 *  watchdog    dead man's switch : armé à l'avance, DÉSARMÉ à chaque passage
 *              sain. C'est le seul mécanisme capable de parler quand l'app
 *              n'est plus jamais ouverte.
 */
export type NotifSchedule =
  | {
      kind: 'wallClock'
      hour: number
      minute: number
      /** 0 = dimanche … 6 = samedi. Absent ⇒ tous les jours. */
      weekday?: number
      /** Jour du mois (1-31). Absent ⇒ tous les mois. */
      day?: number
      /** Récurrence native (trigger calendrier répété). */
      repeats?: boolean
      /** Résolution en instant pour l'ordonnancement (epoch ms). */
      at: number
    }
  | { kind: 'absolute'; at: number }
  | { kind: 'relative'; at: number }
  | { kind: 'watchdog'; at: number }

export type NotifScheduleKind = NotifSchedule['kind']

/**
 * Deux files, et c'est LA correction structurelle de la v2.
 *
 *  rolling   horizon 7 jours, réécrit à chaque passage. Tout ce qui dépend
 *            d'un état qui bouge ;
 *  anchor    échéance future DÉJÀ CONNUE (fin d'essai, J+14 d'absence,
 *            watchdog). Écrit une fois, hors horizon, jamais purgé en masse.
 *
 * Sans la file `anchor`, une notification à J+14 planifiée sur un horizon de
 * 7 jours n'est JAMAIS écrite : personne n'est là pour la programmer le jour
 * où elle entre dans la fenêtre. C'était un bug d'architecture, pas un
 * arbitrage produit.
 */
export type NotifSchedulingClass = 'rolling' | 'anchor'

// ─────────────────────────────────────────────────────────────────────
// Livraison — événement produit ≠ notification
// ─────────────────────────────────────────────────────────────────────

/**
 *  notification  toujours une notification ;
 *  inApp         jamais de notification — bannière ou carte dans l'app ;
 *  adaptive      in-app si l'utilisateur est là MAINTENANT, notification
 *                différée s'il part sans avoir réglé le problème.
 *
 * Notifier quelqu'un qui a l'app ouverte sous les yeux est le degré zéro du
 * respect de son attention.
 */
export type NotifDelivery = 'notification' | 'inApp' | 'adaptive'

// ─────────────────────────────────────────────────────────────────────
// Détectabilité — obligatoire, et bloquante pour la famille `health`
// ─────────────────────────────────────────────────────────────────────

/**
 * Quatre questions auxquelles chaque nœud DOIT répondre avant d'exister.
 * En architecture local-only, « immédiat » est un mensonge tant qu'aucun
 * processus n'observe le signal quand l'app est fermée : la vérité est
 * « au prochain signal observable ».
 *
 * Garde-fou appliqué par `catalog/index.ts` et par un test : aucun nœud
 * `health` dont le signal est `unverified` ne peut être `enabled`.
 */
export interface NotifDetectability {
  /** Le signal est-il observable application fermée ? */
  offlineSignal: 'yes' | 'no' | 'unverified'
  /** Qui l'observe réellement. */
  observer:
    | 'app'
    | 'shieldExtension'
    | 'monitorExtension'
    | 'watchdog'
    | 'anchor'
  /** Peut partir sans que l'utilisateur ait rouvert Relock ? */
  firesWithoutReopen: boolean
  /** Ce qu'on sait, en une phrase — lu tel quel dans l'écran de diagnostic. */
  note: string
}

// ─────────────────────────────────────────────────────────────────────
// Contexte — le seul endroit qui touche au monde extérieur
// ─────────────────────────────────────────────────────────────────────

export interface NotifEngagementContext {
  /** Dernière ouverture de l'app (epoch ms). */
  lastOpenAt: number | null
  /** Jours entiers écoulés depuis l'installation. */
  daysSinceInstall: number
  /** Jours entiers écoulés depuis la dernière ouverture. */
  daysSinceLastOpen: number
  /** Nombre d'ouvertures sur les 7 derniers jours. */
  opensLast7d: number
  /** Le parcours d'accueil a-t-il été mené à son terme ? */
  onboardingDone: boolean
}

export interface NotifBlockingContext {
  rulesCount: number
  activeRulesCount: number
  runningCount: number
  /** Au moins une règle a déjà réellement protégé une fois. */
  hasEverArmed: boolean
  /** Fin de la session en cours la plus proche (epoch ms). */
  runningEndsAt: number | null
  /** Début de la prochaine session programmée (epoch ms). */
  nextSessionStartAt: number | null
  /** Fin du verrou strict en cours (epoch ms). */
  strictEndsAt: number | null
  /** Début du verrou strict en cours (epoch ms) — sert au point médian. */
  strictStartedAt: number | null
  /** Une session stricte a déjà été menée jusqu'au bout. */
  strictEverCompleted: boolean
  /** Depuis quand plus aucune règle ne protège (epoch ms). */
  noActiveRuleSince: number | null
  /** Règle active dont la sélection d'apps est vide — elle ne bloque rien. */
  emptySelectionRuleId: string | null
  /** Une sélection jusque-là peuplée s'est vidée. */
  selectionDrift: boolean
  /** Heure à risque déclarée à l'accueil (minutes depuis minuit). */
  riskHourMinutes: number | null
  /** Prolongations manuelles sur les 7 derniers jours. */
  extensionsLast7d: number
}

export interface NotifResultsContext {
  streak: number
  record: number
  resistedToday: number
  resistedTotal: number
  savedMinutesWeek: number
  bestWeekMinutes: number
  /** Au moins une protection couvre réellement aujourd'hui. */
  protectedToday: boolean
  /** La série a été cassée hier (jour de contrôle manqué). */
  streakBrokenYesterday: boolean
  /** Défi mené à son terme (epoch ms), et sa durée en jours. */
  challengeCompletedAt: number | null
  challengeDays: number
}

export interface NotifScoreContext {
  status: 'pending' | 'provisional' | 'ready'
  global: number | null
  delta: number | null
  weakestAxis: 'focus' | 'rest'
  historyDays: number
  /** 0 → 3, mêmes bornes que l'extension. */
  bandRank: number | null
  /** Palier précédent connu, pour détecter un franchissement. */
  previousBandRank: number | null
}

export interface NotifHealthContext {
  screenTimeAuthorized: boolean
  /** Règles actives en base absentes des activités réellement armées. */
  desyncCount: number
  /** Dernier signe de vie d'une extension (epoch ms). */
  extensionLastSeenAt: number | null
  /** Dernière synchronisation réussie du journal d'événements (epoch ms). */
  lastSyncAt: number | null
}

export interface NotifBillingContext {
  entitled: boolean
  /** Fin de période d'essai (epoch ms) — instant absolu. */
  trialEndsAt: number | null
  /** Échéance de l'offre en cours (epoch ms) — instant absolu. */
  offerExpiresAt: number | null
  offerAvailable: boolean
  /** Problème de facturation lu dans `CustomerInfo`. */
  renewalIssue: boolean
  /** Abonnement perdu depuis (epoch ms). */
  entitlementLostAt: number | null
  /** Feuille de paiement présentée puis annulée (epoch ms). */
  paywallAbandonedAt: number | null
  paywallViews: number
}

export interface NotifRitualContext {
  /** Minutes depuis minuit, ou null si l'utilisateur n'a rien choisi. */
  myMomentMinutes: number | null
  bedtimeMinutes: number | null
  morningMinutes: number | null
}

export interface NotifContext {
  /** Epoch ms. Injecté, jamais lu depuis `Date.now()` dans un nœud. */
  now: number
  locale: string
  permission: NotifPermission
  prefs: NotifPrefs
  /** L'utilisateur a l'app au premier plan en ce moment même. */
  userActive: boolean
  engagement: NotifEngagementContext
  blocking: NotifBlockingContext
  results: NotifResultsContext
  score: NotifScoreContext
  health: NotifHealthContext
  billing: NotifBillingContext
  ritual: NotifRitualContext
}

// ─────────────────────────────────────────────────────────────────────
// Préférences
// ─────────────────────────────────────────────────────────────────────

/** Fenêtre de silence, en minutes depuis minuit. */
export interface QuietHours {
  startMinutes: number
  endMinutes: number
}

export interface NotifPrefs {
  version: 2
  /** Interrupteur maître. N'éteint PAS les alertes de protection. */
  master: boolean
  channels: Record<NotifChannel, boolean>
  /**
   * `null` ⇒ la fenêtre par défaut (22h–8h). Un réglage utilisateur la
   * REMPLACE — il ne s'y ajoute pas, sinon choisir 23h–7h ne changerait rien.
   */
  quietHours: QuietHours | null
  ritual: NotifRitualContext
}

// ─────────────────────────────────────────────────────────────────────
// Contenu & route
// ─────────────────────────────────────────────────────────────────────

/**
 * Un nœud ne produit JAMAIS de texte : il produit des clés i18n et leurs
 * paramètres. C'est ce qui rend les quatre langues possibles, et ce qui
 * interdit qu'un chiffre soit figé dans une notification planifiée trois
 * jours à l'avance.
 */
export interface NotifContentSpec {
  titleKey: string
  bodyKey: string
  params?: Record<string, string | number>
  /** Regroupement iOS (fil de discussion). */
  threadId?: string
}

/** Ce que le nœud sait de sa propre planification au moment de composer. */
export interface NotifContentMeta {
  /** Nombre de nœuds éligibles dans le même groupe exclusif (≥ 1). */
  groupSize: number
  variant: string | null
}

/**
 * Contexte NARROW évalué au moment du TAP, pas de la planification.
 *
 * Une notification écrite lundi peut être touchée mercredi : entre-temps
 * l'utilisateur s'est abonné, ou la règle visée a été supprimée. Ouvrir le
 * paywall à un abonné, ou un éditeur sur une règle disparue, est une panne
 * visible. Le garde tranche avec l'état du moment.
 */
export interface RouteGuardContext {
  entitled: boolean
  ruleIds: readonly string[]
  screenTimeAuthorized: boolean
  offerActive: boolean
}

export interface NotifRoute {
  pathname: string
  params?: Record<string, string>
}

/**
 * Le garde est une propriété du NŒUD, pas de la route calculée.
 *
 * Deux raisons, et la seconde est une question de sécurité : une route est
 * calculée à la PLANIFICATION, avec le contexte de ce moment-là ; le garde doit
 * s'évaluer au TAP, avec l'état du moment. Et une règle de sécurité qui
 * voyagerait dans `userInfo` serait appliquée par un vieux binaire avec ses
 * vieilles conditions. Le garde reste donc dans le catalogue, et reçoit la
 * charge utile pour retrouver ce que la route visait.
 */
export type NotifRouteGuard = (
  ctx: RouteGuardContext,
  payload: NotifPayload,
) => boolean

// ─────────────────────────────────────────────────────────────────────
// Charge utile transportée par la notification iOS
// ─────────────────────────────────────────────────────────────────────

export const NOTIF_PAYLOAD_VERSION = 1

/**
 * Clés courtes : `userInfo` voyage dans le système et se relit dans six mois.
 * `v` rend les migrations possibles sans deviner ce qu'on lit.
 */
export interface NotifPayload {
  /** schemaVersion */
  v: number
  /** nodeId */
  n: string
  /** family */
  f: NotifFamily
  /** variant */
  va?: string
  /** scheduledAt, epoch SECONDES (le natif ne manipule que des secondes) */
  s: number
  /** eventId — corrèle une notification à l'événement qui l'a produite */
  e?: string
  /** route */
  r: { p: string; q?: Record<string, string> }
}

// ─────────────────────────────────────────────────────────────────────
// Définition d'un nœud
// ─────────────────────────────────────────────────────────────────────

/**
 * Qui émet réellement la notification.
 *
 * `shieldExtension` décrit un message que RelockShieldAction envoie tout seul,
 * app fermée. Le moteur ne le planifie JAMAIS — le planifier aussi enverrait
 * deux notifications pour un seul événement. Il reste au catalogue parce que
 * son canal gouverne quand même son extinction (`setCelebrationsEnabled`) et
 * sa traduction (`setCelebrationCopy`), et parce qu'un message invisible du
 * catalogue est un message que personne ne pense à compter.
 */
export type NotifEmitter = 'engine' | 'shieldExtension'

export interface NotifDefinition {
  id: string
  family: NotifFamily
  channel: NotifChannelOrProtection
  budget: NotifBudgetClass
  /**
   * Rampe de lancement. Les 50 nœuds vivent dans le catalogue ; une vingtaine
   * seulement part en production. Livrer 50 sollicitations d'un coup ferait
   * exactement de Relock ce contre quoi Relock est vendu.
   */
  enabled: boolean
  /** 0 → 100. Arbitre quand le budget du jour est saturé. */
  priority: number
  interruption: NotifInterruption
  scheduling: NotifSchedulingClass
  delivery: NotifDelivery
  /** Délai avant de retenter en notification ce qui a été montré in-app (ms). */
  adaptiveDeferMs?: number
  /** Jours avant de pouvoir renvoyer ce même nœud. 0 ⇒ pas de cooldown. */
  cooldownDays: number
  maxPerWeek?: number
  /** `ignore` réservé aux nœuds dont l'instant EST le message (fin de verrou). */
  quietHours: 'strict' | 'ignore'
  /** Un seul nœud du groupe peut partir : le plus prioritaire gagne. */
  exclusiveGroup?: string
  /** Nœuds explicitement absorbés par celui-ci le même jour. */
  supersedes?: readonly string[]
  /** Défaut : `engine`. */
  emitter?: NotifEmitter
  detectability: NotifDetectability
  variants?: readonly string[]
  /**
   * Fonction, et non valeur : une destination porte souvent un identifiant
   * (« ouvre l'éditeur de CETTE règle ») qui n'existe qu'au moment du calcul.
   */
  route: (ctx: NotifContext) => NotifRoute
  /** Faux au moment du tap ⇒ on ouvre `routeFallback` plutôt que la route. */
  routeGuard?: NotifRouteGuard
  routeFallback?: string
  when: (ctx: NotifContext) => boolean
  schedule: (ctx: NotifContext) => NotifSchedule | null
  content: (ctx: NotifContext, meta: NotifContentMeta) => NotifContentSpec
}

// ─────────────────────────────────────────────────────────────────────
// Intentions & plan
// ─────────────────────────────────────────────────────────────────────

/** Ce que le moteur VEUT dire, avant de savoir comment il le dira. */
export interface NotifIntent {
  definition: NotifDefinition
  schedule: NotifSchedule
  content: NotifContentSpec
  variant: string | null
  groupSize: number
}

export interface PlannedNotification {
  id: string
  nodeId: string
  family: NotifFamily
  priority: number
  scheduling: NotifSchedulingClass
  schedule: NotifSchedule
  content: NotifContentSpec
  interruption: NotifInterruption
  payload: NotifPayload
  route: NotifRoute
}

export interface SuppressedNotification {
  nodeId: string
  family: NotifFamily
  reason: SuppressionReason
}

export interface NotifPlan {
  /** Messages à afficher DANS l'app, pas à notifier. */
  inApp: NotifIntent[]
  rolling: PlannedNotification[]
  anchors: PlannedNotification[]
  suppressed: SuppressedNotification[]
}

// ─────────────────────────────────────────────────────────────────────
// Instrumentation
// ─────────────────────────────────────────────────────────────────────

export type NotifEventKind =
  | 'eligible'
  | 'suppressed'
  | 'scheduled'
  | 'cancelled'
  | 'responded'
  | 'route_opened'
  | 'in_app'

/**
 * Sans raison de suppression nommée, « pourquoi streak_at_risk n'est pas
 * partie ? » devient une enquête. Avec, c'est une ligne de journal.
 */
export type SuppressionReason =
  | 'node_disabled'
  | 'master_off'
  | 'channel_off'
  | 'permission'
  | 'condition_changed'
  | 'cooldown'
  | 'budget_daily'
  | 'budget_weekly'
  | 'quiet_hours'
  | 'superseded'
  | 'exclusive_group'
  | 'outside_horizon'
  | 'capacity'
  | 'fatigue'
  | 'delivered_in_app'
  | 'detectability'
  | 'past'
  /** Émis par une extension : ce n'est pas au moteur de le planifier. */
  | 'external_emitter'

export interface NotifLogEntry {
  /** Epoch ms. */
  t: number
  k: NotifEventKind
  n: string
  f: NotifFamily
  va?: string
  reason?: SuppressionReason
  /** Instant visé (epoch ms). */
  for?: number
  /** Instant de la réponse réelle (epoch ms). */
  at?: number
}
