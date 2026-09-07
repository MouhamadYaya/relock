/**
 * Famille `activation` — amener au PREMIER blocage réel.
 *
 * Une installation sans protection armée est une désinstallation différée :
 * c'est la famille la plus prioritaire après `health`. Chaque nœud vise un
 * point d'arrêt précis du parcours, jamais « reviens dans l'app ».
 */
import type { NotifDefinition } from '@/features/notifications/types'
import {
  contentKeys,
  defineNode,
  HOUR,
  notBefore,
  relative,
  route,
  ruleStillExists,
  wallClock,
} from './helpers'

export const activationNodes: readonly NotifDefinition[] = [
  /**
   * Autorisation Temps d'écran jamais accordée : Relock ne peut rien bloquer,
   * quoi que l'utilisateur configure. Distinct de `health.screen_time_revoked`,
   * qui traite le cas — bien plus grave — d'une protection qui MARCHAIT.
   */
  defineNode({
    id: 'activation.screen_time_missing',
    family: 'activation',
    channel: 'reminders',
    budget: 'standard',
    enabled: true,
    priority: 90,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'adaptive',
    cooldownDays: 3,
    maxPerWeek: 2,
    detectability: {
      offlineSignal: 'no',
      observer: 'app',
      firesWithoutReopen: false,
      note: "L'autorisation Family Controls n'est lisible qu'en processus : le tir a lieu au premier retour dans l'app, pas à l'instant du refus.",
    },
    route: () => route('/(tabs)/home'),
    when: ctx =>
      ctx.engagement.onboardingDone &&
      !ctx.health.screenTimeAuthorized &&
      ctx.blocking.activeRulesCount === 0,
    schedule: ctx =>
      relative(notBefore(ctx.now + 2 * HOUR, ctx.now + 30 * 60_000)),
    content: (_ctx, meta) =>
      contentKeys('activation.screen_time_missing', meta.variant),
  }),

  /**
   * Règle active dont la sélection est vide : l'utilisateur croit être protégé
   * et ne l'est pas. Silencieux, invisible, et exactement le genre de panne qui
   * fait désinstaller sans jamais faire écrire.
   */
  defineNode({
    id: 'activation.selection_empty',
    family: 'activation',
    channel: 'reminders',
    budget: 'standard',
    enabled: true,
    priority: 88,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'adaptive',
    cooldownDays: 2,
    detectability: {
      offlineSignal: 'no',
      observer: 'app',
      firesWithoutReopen: false,
      note: "La sélection d'apps vit dans l'App Group ; seule l'app la relit.",
    },
    route: ctx =>
      route('/block-editor', {
        params: ctx.blocking.emptySelectionRuleId
          ? { id: ctx.blocking.emptySelectionRuleId }
          : undefined,
      }),
    routeGuard: ruleStillExists,
    routeFallback: '/(tabs)/blocks',
    when: ctx => ctx.blocking.emptySelectionRuleId !== null,
    schedule: ctx => relative(ctx.now + 3 * HOUR),
    content: (_ctx, meta) =>
      contentKeys('activation.selection_empty', meta.variant),
  }),

  /** Installé la veille, aucune règle : le produit n'a jamais commencé. */
  defineNode({
    id: 'activation.no_rule_d1',
    family: 'activation',
    channel: 'reminders',
    budget: 'standard',
    enabled: true,
    priority: 85,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 3,
    maxPerWeek: 2,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: 'Planifié dès la première ouverture ; part même si l’app n’est pas rouverte.',
    },
    route: () => route('/add-block'),
    when: ctx =>
      ctx.engagement.onboardingDone &&
      ctx.blocking.rulesCount === 0 &&
      ctx.engagement.daysSinceInstall >= 1,
    schedule: ctx => wallClock(ctx.now, { hour: 19, minute: 0 }),
    content: (_ctx, meta) => contentKeys('activation.no_rule_d1', meta.variant),
  }),

  /**
   * Une règle existe mais n'a JAMAIS protégé. Le pas manquant n'est pas la
   * création, c'est l'armement — le message doit donc parler de ça et pas
   * proposer d'en créer une deuxième.
   */
  defineNode({
    id: 'activation.rule_never_armed',
    family: 'activation',
    channel: 'reminders',
    budget: 'standard',
    enabled: true,
    priority: 80,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 3,
    maxPerWeek: 2,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: "Condition connue à la dernière ouverture ; le tir du soir est écrit d'avance.",
    },
    route: () => route('/(tabs)/blocks'),
    when: ctx =>
      ctx.blocking.rulesCount > 0 &&
      !ctx.blocking.hasEverArmed &&
      ctx.engagement.daysSinceInstall >= 1,
    schedule: ctx => wallClock(ctx.now, { hour: 20, minute: 0 }),
    content: (_ctx, meta) =>
      contentKeys('activation.rule_never_armed', meta.variant),
  }),

  /** Parcours d'accueil abandonné en route. */
  defineNode({
    id: 'activation.tutorial_incomplete',
    family: 'activation',
    channel: 'reminders',
    budget: 'standard',
    enabled: false,
    priority: 70,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 3,
    maxPerWeek: 1,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: "Le point d'arrêt du parcours est persisté ; le tir peut être écrit d'avance.",
    },
    route: () => route('/onboarding'),
    when: ctx =>
      !ctx.engagement.onboardingDone && ctx.engagement.daysSinceInstall >= 1,
    schedule: ctx => wallClock(ctx.now, { hour: 18, minute: 0 }),
    content: (_ctx, meta) =>
      contentKeys('activation.tutorial_incomplete', meta.variant),
  }),
]
