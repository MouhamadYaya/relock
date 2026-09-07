/**
 * Famille `health` — « les protections ne fonctionnent plus ».
 *
 * Aucun de ces nœuds n'existait avant la v2, et ce sont les plus importants du
 * catalogue. Un utilisateur qui CROIT être protégé alors qu'il ne l'est plus
 * est le pire scénario de Relock : il ne se plaint pas, il ne signale rien, il
 * désinstalle en concluant que le produit ne marche pas.
 *
 * Trois propriétés spécifiques à cette famille :
 *
 *  • hors canal, hors interrupteur maître. Ce ne sont pas des messages
 *    marketing dont on se désabonne, ce sont des alertes de bon fonctionnement.
 *    L'écran Réglages le dit mot pour mot ;
 *  • DÉDUPLICATION obligatoire. `screen_time_revoked`, `rules_desync` et
 *    `selection_drift` sont souvent trois symptômes de la même panne : le
 *    groupe exclusif `health.incident` garantit un seul message ;
 *  • matrice de détectabilité contraignante. Un nœud dont l'observateur n'est
 *    pas VÉRIFIÉ ne peut pas être activé — le planner le refuse avec la raison
 *    `detectability`. « Immédiat » sans observateur est un mensonge, et un
 *    mensonge sur la protection est le pire de tous.
 */
import type { NotifDefinition } from '@/features/notifications/types'
import {
  contentKeys,
  DAY,
  defineNode,
  HOUR,
  relative,
  route,
  watchdog,
} from './helpers'

/** Un seul message par incident, quel que soit le nombre de symptômes. */
const INCIDENT = 'health.incident'

export const healthNodes: readonly NotifDefinition[] = [
  /**
   * Autorisation Temps d'écran retirée alors que des règles sont actives.
   * PLUS RIEN NE BLOQUE.
   *
   * Honnêteté sur l'instant : iOS n'expose pas ce changement à un processus
   * endormi. Le tir n'est donc pas « immédiat » mais « au premier retour dans
   * l'app ». Le filet pour le cas où l'app n'est jamais rouverte, c'est le
   * watchdog `extension_silent`, pas ce nœud-ci.
   */
  defineNode({
    id: 'health.screen_time_revoked',
    family: 'health',
    channel: 'protection',
    budget: 'protection',
    enabled: true,
    priority: 100,
    interruption: 'timeSensitive',
    scheduling: 'rolling',
    delivery: 'adaptive',
    adaptiveDeferMs: 6 * HOUR,
    cooldownDays: 1,
    exclusiveGroup: INCIDENT,
    detectability: {
      offlineSignal: 'no',
      observer: 'app',
      firesWithoutReopen: false,
      note: "L'autorisation Family Controls n'est lisible qu'en processus. Tir au premier retour dans l'app ; le filet app-fermée est `health.extension_silent`.",
    },
    route: () => route('/(tabs)/home'),
    when: ctx =>
      !ctx.health.screenTimeAuthorized && ctx.blocking.activeRulesCount > 0,
    schedule: ctx => relative(ctx.now + 5 * 60_000),
    // Un seul symptôme ⇒ on nomme la cause. Plusieurs ⇒ on dit la conséquence,
    // qui est la seule chose que l'utilisateur ait besoin de comprendre.
    content: (_ctx, meta) =>
      contentKeys(
        meta.groupSize > 1 ? 'health.incident' : 'health.screen_time_revoked',
        meta.variant,
      ),
  }),

  /**
   * Règle active en base, absente des activités réellement armées côté iOS.
   * `armedActivities()` est la vérité du système ; notre table ne l'est pas.
   */
  defineNode({
    id: 'health.rules_desync',
    family: 'health',
    channel: 'protection',
    budget: 'protection',
    enabled: true,
    priority: 95,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'adaptive',
    adaptiveDeferMs: 6 * HOUR,
    cooldownDays: 1,
    exclusiveGroup: INCIDENT,
    detectability: {
      offlineSignal: 'no',
      observer: 'app',
      firesWithoutReopen: false,
      note: "`armedActivities()` n'est interrogeable que depuis l'app.",
    },
    route: () => route('/(tabs)/blocks'),
    when: ctx => ctx.health.desyncCount > 0,
    schedule: ctx => relative(ctx.now + 2 * HOUR),
    content: (_ctx, meta) =>
      contentKeys(
        meta.groupSize > 1 ? 'health.incident' : 'health.rules_desync',
        meta.variant,
      ),
  }),

  /**
   * Aucun signe de vie d'une extension depuis deux jours alors que des règles
   * sont actives. WATCHDOG : armé à l'avance, désarmé à chaque passage sain.
   *
   * C'est le SEUL nœud de la famille capable de parler quand l'app n'est plus
   * jamais ouverte — et donc le seul filet réel contre une panne silencieuse.
   */
  defineNode({
    id: 'health.extension_silent',
    family: 'health',
    channel: 'protection',
    budget: 'protection',
    enabled: true,
    priority: 90,
    interruption: 'active',
    scheduling: 'anchor',
    delivery: 'notification',
    cooldownDays: 0,
    detectability: {
      offlineSignal: 'yes',
      observer: 'watchdog',
      firesWithoutReopen: true,
      note: 'Dead man’s switch : réécrit à chaque passage sain, part si plus personne ne le réarme.',
    },
    route: () => route('/(tabs)/home'),
    when: ctx =>
      ctx.blocking.activeRulesCount > 0 &&
      ctx.health.extensionLastSeenAt !== null,
    schedule: ctx =>
      ctx.health.extensionLastSeenAt === null
        ? null
        : watchdog(ctx.health.extensionLastSeenAt + 2 * DAY),
    content: (_ctx, meta) =>
      contentKeys('health.extension_silent', meta.variant),
  }),

  /** Sélection d'apps vidée sur une règle jusque-là peuplée. */
  defineNode({
    id: 'health.selection_drift',
    family: 'health',
    channel: 'protection',
    budget: 'protection',
    enabled: false,
    priority: 85,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'adaptive',
    adaptiveDeferMs: 6 * HOUR,
    cooldownDays: 2,
    exclusiveGroup: INCIDENT,
    detectability: {
      offlineSignal: 'unverified',
      observer: 'app',
      firesWithoutReopen: false,
      note: "Aucune preuve pour l'instant que la dérive soit distinguable d'une modification volontaire. Tant que ce n'est pas tranché, le nœud reste refusé par le garde de détectabilité.",
    },
    route: () => route('/(tabs)/blocks'),
    when: ctx => ctx.blocking.selectionDrift,
    schedule: ctx => relative(ctx.now + HOUR),
    content: (_ctx, meta) =>
      contentKeys(
        meta.groupSize > 1 ? 'health.incident' : 'health.selection_drift',
        meta.variant,
      ),
  }),

  /**
   * Journal d'événements non synchronisé depuis trois jours : les statistiques
   * affichées ne sont plus vraies. Watchdog, pour la même raison que ci-dessus.
   */
  defineNode({
    id: 'health.sync_stalled',
    family: 'health',
    channel: 'protection',
    budget: 'protection',
    // Des statistiques en retard ne mettent aucune protection en défaut :
    // `extension_silent` couvre déjà le cas grave. On garde un créneau
    // d'ancrage plutôt qu'une alerte de confort.
    enabled: false,
    priority: 70,
    interruption: 'passive',
    scheduling: 'anchor',
    delivery: 'notification',
    cooldownDays: 0,
    detectability: {
      offlineSignal: 'yes',
      observer: 'watchdog',
      firesWithoutReopen: true,
      note: 'Dead man’s switch armé sur la date de dernière synchronisation réussie.',
    },
    route: () => route('/(tabs)/activity'),
    when: ctx =>
      ctx.blocking.activeRulesCount > 0 && ctx.health.lastSyncAt !== null,
    schedule: ctx =>
      ctx.health.lastSyncAt === null
        ? null
        : watchdog(ctx.health.lastSyncAt + 3 * DAY),
    content: (_ctx, meta) => contentKeys('health.sync_stalled', meta.variant),
  }),
]
