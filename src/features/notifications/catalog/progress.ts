/**
 * Famille `progress` — célébrations et bilans.
 *
 * Deux nœuds ne sont PAS planifiés par le moteur : `first_resist` et
 * `milestone_resists` partent de `RelockShieldAction`, app fermée, à l'instant
 * exact du geste. Les planifier en plus enverrait deux notifications pour un
 * seul événement. Ils restent au catalogue parce que leur canal gouverne quand
 * même leur extinction et leur traduction — et parce qu'un message absent du
 * catalogue est un message que personne ne pense à compter.
 */
import type { NotifDefinition } from '@/features/notifications/types'
import {
  contentKeys,
  defineNode,
  HOUR,
  MINUTE,
  relative,
  route,
  wallClock,
} from './helpers'

/** Jalons de série. Assez espacés pour rester des événements. */
export const STREAK_MILESTONES = [3, 7, 14, 30, 100] as const

export const progressNodes: readonly NotifDefinition[] = [
  /** Première résistance — le moment fondateur du produit. */
  defineNode({
    id: 'progress.first_resist',
    family: 'progress',
    channel: 'progression',
    budget: 'standard',
    enabled: true,
    emitter: 'shieldExtension',
    priority: 90,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 0,
    detectability: {
      offlineSignal: 'yes',
      observer: 'shieldExtension',
      firesWithoutReopen: true,
      note: "Émis par l'extension bouclier à l'instant du geste, sans réveiller Relock.",
    },
    route: () => route('/(tabs)/activity'),
    when: () => true,
    schedule: () => null,
    content: (_ctx, meta) => contentKeys('progress.first_resist', meta.variant),
  }),

  /** Paliers de résistances (10, 50, 100, 250, 500, 1000). */
  defineNode({
    id: 'progress.milestone_resists',
    family: 'progress',
    channel: 'progression',
    budget: 'standard',
    enabled: true,
    emitter: 'shieldExtension',
    priority: 75,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 0,
    detectability: {
      offlineSignal: 'yes',
      observer: 'shieldExtension',
      firesWithoutReopen: true,
      note: "Émis par l'extension bouclier ; le compteur vit dans l'App Group.",
    },
    route: () => route('/(tabs)/activity'),
    when: () => true,
    schedule: () => null,
    content: (ctx, meta) => ({
      ...contentKeys('progress.milestone_resists', meta.variant),
      params: { total: ctx.results.resistedTotal },
    }),
  }),

  /** Jalon de série. Le matin : une bonne nouvelle ouvre mieux une journée. */
  defineNode({
    id: 'progress.streak_milestone',
    family: 'progress',
    channel: 'progression',
    budget: 'standard',
    enabled: true,
    priority: 80,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 2,
    maxPerWeek: 2,
    detectability: {
      offlineSignal: 'no',
      observer: 'app',
      firesWithoutReopen: false,
      note: 'La série se calcule sur les statistiques synchronisées, donc dans l’app.',
    },
    route: () => route('/(tabs)/activity'),
    when: ctx =>
      (STREAK_MILESTONES as readonly number[]).includes(ctx.results.streak),
    schedule: ctx => wallClock(ctx.now, { hour: 10, minute: 0 }),
    content: (ctx, meta) => ({
      ...contentKeys('progress.streak_milestone', meta.variant),
      // `count` en plus de `days` : c'est lui qui fait choisir la bonne forme
      // plurielle à i18next. Le russe en a trois — « 3 дня » et « 7 дней » ne
      // s'écrivent pas pareil, et nos jalons tombent des deux côtés.
      params: { days: ctx.results.streak, count: ctx.results.streak },
    }),
  }),

  /**
   * Meilleure semaine jamais atteinte. ABSORBE le bilan hebdomadaire : deux
   * messages à 19h le dimanche pour parler de la même semaine, c'est une
   * interruption de trop et un compliment dilué.
   */
  defineNode({
    id: 'progress.personal_best',
    family: 'progress',
    channel: 'progression',
    budget: 'standard',
    enabled: false,
    priority: 65,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 7,
    maxPerWeek: 1,
    exclusiveGroup: 'progress.digest',
    supersedes: ['progress.weekly_recap'],
    detectability: {
      offlineSignal: 'no',
      observer: 'app',
      firesWithoutReopen: false,
      note: 'Comparaison au record, faite sur les statistiques synchronisées.',
    },
    route: () => route('/(tabs)/activity'),
    when: ctx =>
      ctx.results.bestWeekMinutes > 0 &&
      ctx.results.savedMinutesWeek > ctx.results.bestWeekMinutes,
    schedule: ctx => wallClock(ctx.now, { hour: 19, minute: 0, weekday: 0 }),
    content: (ctx, meta) => ({
      ...contentKeys('progress.personal_best', meta.variant),
      params: { minutes: ctx.results.savedMinutesWeek },
    }),
  }),

  /**
   * Bilan hebdomadaire. Le texte reste GÉNÉRIQUE et renvoie vers l'app : les
   * vrais chiffres sont calculés à l'ouverture, jamais figés dans une
   * notification écrite six jours plus tôt.
   */
  defineNode({
    id: 'progress.weekly_recap',
    family: 'progress',
    channel: 'progression',
    budget: 'standard',
    enabled: true,
    priority: 60,
    interruption: 'passive',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 5,
    maxPerWeek: 1,
    exclusiveGroup: 'progress.digest',
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: 'Heure locale récurrente ; le contenu est générique par construction.',
    },
    route: () => route('/(tabs)/activity'),
    when: ctx => ctx.blocking.rulesCount > 0,
    schedule: ctx => wallClock(ctx.now, { hour: 19, minute: 0, weekday: 0 }),
    content: (_ctx, meta) => contentKeys('progress.weekly_recap', meta.variant),
  }),

  /**
   * Un défi (règle à durée de vie) est allé au bout. Remplace la notification
   * que `blocking/cleanup.ts` envoyait en direct, hors canal, hors heures
   * calmes et en français codé en dur — donc impossible à éteindre depuis les
   * Réglages, alors même que l'écran promettait le contraire.
   */
  defineNode({
    id: 'progress.challenge_completed',
    family: 'progress',
    channel: 'progression',
    budget: 'standard',
    enabled: true,
    priority: 78,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 0,
    maxPerWeek: 3,
    detectability: {
      offlineSignal: 'no',
      observer: 'app',
      firesWithoutReopen: false,
      note: "L'achèvement est constaté par le nettoyage des règles, donc dans l'app.",
    },
    route: () => route('/(tabs)/activity'),
    when: ctx =>
      ctx.results.challengeCompletedAt !== null &&
      ctx.now - ctx.results.challengeCompletedAt < 6 * HOUR,
    schedule: ctx => relative(ctx.now + 2 * MINUTE),
    content: (ctx, meta) => ({
      ...contentKeys('progress.challenge_completed', meta.variant),
      params: {
        days: ctx.results.challengeDays,
        count: ctx.results.challengeDays,
      },
    }),
  }),

  /** Bilan mensuel. */
  defineNode({
    id: 'progress.monthly_recap',
    family: 'progress',
    channel: 'progression',
    budget: 'standard',
    enabled: false,
    priority: 55,
    interruption: 'passive',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 20,
    maxPerWeek: 1,
    exclusiveGroup: 'progress.digest',
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: 'Heure locale récurrente ; contenu générique.',
    },
    route: () => route('/(tabs)/activity'),
    when: ctx => ctx.blocking.rulesCount > 0,
    schedule: ctx => wallClock(ctx.now, { hour: 19, minute: 0, day: 1 }),
    content: (_ctx, meta) =>
      contentKeys('progress.monthly_recap', meta.variant),
  }),
]
