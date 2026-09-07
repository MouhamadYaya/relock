/**
 * Famille `retention` — un ESCALIER, pas une répétition.
 *
 * Chaque marche change de registre et de ton, et l'escalier a une DERNIÈRE
 * marche : après `absent_14d`, plus aucune notification de rétention n'est
 * jamais planifiée. C'est ce qui distingue un rappel d'un harcèlement, et c'est
 * une propriété structurelle — il n'existe simplement aucun nœud au-delà.
 *
 * `absent_14d` est une ANCRE, et c'est la correction structurelle de la v2 :
 * un horizon roulant de 7 jours ne peut par construction jamais écrire un tir à
 * J+14, puisque personne n'est là pour le programmer le jour où il entre dans
 * la fenêtre.
 */
import type { NotifDefinition } from '@/features/notifications/types'
import {
  absolute,
  contentKeys,
  DAY,
  defineNode,
  notEntitled,
  route,
  wallClock,
} from './helpers'

/** Instant du tir d'absence : dernière ouverture + N jours, ramené à 19h. */
function absenceAt(lastOpenAt: number, days: number): number {
  const d = new Date(lastOpenAt + days * DAY)
  d.setHours(19, 0, 0, 0)
  return d.getTime()
}

export const retentionNodes: readonly NotifDefinition[] = [
  /**
   * Série en jeu et rien ne protège aujourd'hui. Replanifié à chaque passage :
   * armer un blocage dans la soirée l'annule automatiquement, donc aucun faux
   * rappel n'est possible.
   */
  defineNode({
    id: 'retention.streak_at_risk',
    family: 'retention',
    channel: 'reminders',
    budget: 'standard',
    enabled: true,
    priority: 80,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 0,
    maxPerWeek: 5,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: 'Écrit pour le soir même dès le passage du matin ; annulé si un blocage est armé.',
    },
    route: () => route('/add-block'),
    when: ctx => ctx.results.streak >= 1 && !ctx.results.protectedToday,
    schedule: ctx => wallClock(ctx.now, { hour: 20, minute: 30 }),
    content: (ctx, meta) => ({
      ...contentKeys('retention.streak_at_risk', meta.variant),
      params: { days: ctx.results.streak },
    }),
  }),

  /** Série cassée hier. « On repart de 1, pas de 0. » */
  defineNode({
    id: 'retention.streak_broken_recover',
    family: 'retention',
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
      offlineSignal: 'no',
      observer: 'app',
      firesWithoutReopen: false,
      note: 'La rupture se constate en relisant les statistiques synchronisées.',
    },
    route: () => route('/add-block'),
    when: ctx => ctx.results.streakBrokenYesterday,
    schedule: ctx => wallClock(ctx.now, { hour: 19, minute: 0 }),
    content: (_ctx, meta) =>
      contentKeys('retention.streak_broken_recover', meta.variant),
  }),

  /**
   * DERNIÈRE marche. Ancre : sans elle, ce tir ne serait jamais écrit — c'était
   * le bug d'architecture de la v1. Après lui, plus rien.
   */
  defineNode({
    id: 'retention.absent_14d',
    family: 'retention',
    channel: 'reminders',
    budget: 'standard',
    enabled: true,
    priority: 65,
    interruption: 'active',
    scheduling: 'anchor',
    delivery: 'notification',
    cooldownDays: 0,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: "Écrite à chaque ouverture pour J+14 ; ne part QUE si l'app n'est jamais rouverte.",
    },
    route: () => route('/(tabs)/home'),
    when: ctx => ctx.engagement.lastOpenAt !== null,
    schedule: ctx =>
      ctx.engagement.lastOpenAt === null
        ? null
        : absolute(absenceAt(ctx.engagement.lastOpenAt, 14)),
    content: (_ctx, meta) => contentKeys('retention.absent_14d', meta.variant),
  }),

  /**
   * Rappelle son POURQUOI — le déclencheur qu'il a lui-même nommé à l'accueil.
   * Générique tant qu'on n'a rien de personnel à lui rappeler.
   */
  defineNode({
    id: 'retention.absent_5d',
    family: 'retention',
    channel: 'reminders',
    budget: 'standard',
    enabled: true,
    priority: 60,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 0,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: 'Dans la fenêtre de 7 jours : la file roulante suffit.',
    },
    route: () => route('/(tabs)/home'),
    when: ctx => ctx.engagement.lastOpenAt !== null,
    schedule: ctx =>
      ctx.engagement.lastOpenAt === null
        ? null
        : absolute(absenceAt(ctx.engagement.lastOpenAt, 5)),
    content: (_ctx, meta) => contentKeys('retention.absent_5d', meta.variant),
  }),

  /** Sept jours d'absence et pas d'abonnement : la main passe au commercial. */
  defineNode({
    id: 'retention.win_back_offer',
    family: 'retention',
    channel: 'offers',
    budget: 'standard',
    enabled: false,
    priority: 55,
    interruption: 'passive',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 30,
    maxPerWeek: 1,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: 'Dans la fenêtre de 7 jours.',
    },
    route: () => route('/paywall'),
    routeGuard: notEntitled,
    routeFallback: '/(tabs)/home',
    when: ctx => !ctx.billing.entitled && ctx.engagement.lastOpenAt !== null,
    schedule: ctx =>
      ctx.engagement.lastOpenAt === null
        ? null
        : absolute(absenceAt(ctx.engagement.lastOpenAt, 7)),
    content: (_ctx, meta) =>
      contentKeys('retention.win_back_offer', meta.variant),
  }),

  /** Première marche : léger, sans reproche. Deux variantes. */
  defineNode({
    id: 'retention.absent_2d',
    family: 'retention',
    channel: 'reminders',
    budget: 'standard',
    // Deux jours d'absence n'est pas une absence : c'est un week-end. On
    // démarre l'escalier à J+5, quitte à l'avancer si les chiffres le disent.
    enabled: false,
    priority: 50,
    interruption: 'passive',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 0,
    variants: ['a', 'b'],
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: 'Dans la fenêtre de 7 jours.',
    },
    route: () => route('/(tabs)/home'),
    when: ctx => ctx.engagement.lastOpenAt !== null,
    schedule: ctx =>
      ctx.engagement.lastOpenAt === null
        ? null
        : absolute(absenceAt(ctx.engagement.lastOpenAt, 2)),
    content: (_ctx, meta) => contentKeys('retention.absent_2d', meta.variant),
  }),
]
