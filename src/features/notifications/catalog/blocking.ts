/**
 * Famille `blocking` — cycle de vie des protections.
 *
 * Tout se lit dans les sessions déjà calculées par `blocking/session.ts` :
 * aucune donnée nouvelle à produire, aucune source de vérité concurrente.
 */
import type { NotifDefinition } from '@/features/notifications/types'
import {
  contentKeys,
  DAY,
  defineNode,
  MINUTE,
  relative,
  route,
  wallClock,
} from './helpers'

export const blockingNodes: readonly NotifDefinition[] = [
  /** Plus rien ne protège depuis deux jours : la protection s'est éteinte
   *  sans que personne ne le décide. */
  defineNode({
    id: 'blocking.all_rules_expired',
    family: 'blocking',
    channel: 'reminders',
    budget: 'standard',
    enabled: true,
    priority: 75,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 4,
    maxPerWeek: 1,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: "L'absence de règle active est connue à la dernière ouverture.",
    },
    route: () => route('/(tabs)/blocks'),
    when: ctx =>
      ctx.blocking.rulesCount > 0 &&
      ctx.blocking.activeRulesCount === 0 &&
      ctx.blocking.noActiveRuleSince !== null &&
      ctx.now - ctx.blocking.noActiveRuleSince >= 2 * DAY,
    schedule: ctx => wallClock(ctx.now, { hour: 20, minute: 0 }),
    content: (_ctx, meta) =>
      contentKeys('blocking.all_rules_expired', meta.variant),
  }),

  /**
   * L'heure à risque que l'utilisateur a lui-même nommée à l'accueil, et rien
   * n'est armé. C'est le rappel le plus personnel du catalogue : deux variantes
   * pour qu'il ne devienne pas un bruit de fond.
   */
  defineNode({
    id: 'blocking.nothing_armed_tonight',
    family: 'blocking',
    channel: 'reminders',
    budget: 'standard',
    enabled: true,
    priority: 70,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 2,
    maxPerWeek: 3,
    variants: ['a', 'b'],
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: "L'heure à risque vient des réponses d'accueil ; elle ne bouge pas.",
    },
    route: () => route('/add-block'),
    when: ctx =>
      ctx.blocking.riskHourMinutes !== null &&
      ctx.blocking.runningCount === 0 &&
      !ctx.results.protectedToday,
    schedule: ctx => {
      const risk = ctx.blocking.riskHourMinutes
      if (risk === null) return null
      // Trente minutes AVANT : une protection s'arme avant le moment, pas
      // pendant. Prévenir à l'heure exacte, c'est arriver après.
      const target = Math.max(0, risk - 30)
      return wallClock(ctx.now, {
        hour: Math.floor(target / 60),
        minute: target % 60,
      })
    },
    content: (_ctx, meta) =>
      contentKeys('blocking.nothing_armed_tonight', meta.variant),
  }),

  /** Fin de session imminente — proposer de prolonger pendant que c'est utile. */
  defineNode({
    id: 'blocking.session_ending_soon',
    family: 'blocking',
    channel: 'reminders',
    budget: 'standard',
    enabled: true,
    priority: 65,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 0,
    maxPerWeek: 7,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: "La fin de session est une date connue dès l'armement.",
    },
    route: () => route('/(tabs)/home'),
    when: ctx =>
      ctx.blocking.runningEndsAt !== null &&
      ctx.blocking.runningEndsAt - ctx.now > 10 * MINUTE,
    schedule: ctx =>
      ctx.blocking.runningEndsAt === null
        ? null
        : relative(ctx.blocking.runningEndsAt - 10 * MINUTE),
    content: (_ctx, meta) =>
      contentKeys('blocking.session_ending_soon', meta.variant),
  }),

  /** Bilan de fin de session. */
  defineNode({
    id: 'blocking.session_ended',
    family: 'blocking',
    channel: 'progression',
    budget: 'standard',
    enabled: false,
    priority: 55,
    interruption: 'passive',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 0,
    maxPerWeek: 5,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: 'Instant connu ; les chiffres sont recalculés à l’ouverture.',
    },
    route: () => route('/(tabs)/activity'),
    when: ctx => ctx.blocking.runningEndsAt !== null,
    schedule: ctx =>
      ctx.blocking.runningEndsAt === null
        ? null
        : relative(ctx.blocking.runningEndsAt + MINUTE),
    content: (_ctx, meta) =>
      contentKeys('blocking.session_ended', meta.variant),
  }),

  /** Plage programmée imminente. Passive : information, pas sollicitation. */
  defineNode({
    id: 'blocking.schedule_starts_soon',
    family: 'blocking',
    channel: 'reminders',
    budget: 'standard',
    enabled: false,
    priority: 45,
    interruption: 'passive',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 0,
    maxPerWeek: 7,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: 'Le début de plage est une heure locale connue à l’avance.',
    },
    route: () => route('/(tabs)/home'),
    when: ctx =>
      ctx.blocking.nextSessionStartAt !== null &&
      ctx.blocking.nextSessionStartAt - ctx.now > 15 * MINUTE,
    schedule: ctx =>
      ctx.blocking.nextSessionStartAt === null
        ? null
        : relative(ctx.blocking.nextSessionStartAt - 15 * MINUTE),
    content: (_ctx, meta) =>
      contentKeys('blocking.schedule_starts_soon', meta.variant),
  }),

  /** Trois prolongations dans la semaine : la vraie réponse est une plage. */
  defineNode({
    id: 'blocking.extend_suggested',
    family: 'blocking',
    channel: 'reminders',
    budget: 'standard',
    enabled: false,
    priority: 40,
    interruption: 'passive',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 14,
    maxPerWeek: 1,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: 'Compteur de prolongations persisté localement.',
    },
    route: () => route('/add-block'),
    when: ctx => ctx.blocking.extensionsLast7d >= 3,
    schedule: ctx => wallClock(ctx.now, { hour: 11, minute: 0, weekday: 0 }),
    content: (_ctx, meta) =>
      contentKeys('blocking.extend_suggested', meta.variant),
  }),
]
