/**
 * Famille `score` — focus, repos, paliers.
 *
 * Le score est produit par l'extension de rapport, seule à voir les mesures de
 * Temps d'écran. Aucun nœud ne recalcule quoi que ce soit : ils lisent `global`,
 * `delta`, `weakestAxis` et le rang de palier, exactement comme l'Accueil.
 *
 * Toute la famille attend : un score commenté trop tôt, sur un historique trop
 * court, dit n'importe quoi avec assurance.
 */
import type { NotifDefinition } from '@/features/notifications/types'
import {
  contentKeys,
  defineNode,
  ONCE_EVER_DAYS,
  relative,
  route,
  wallClock,
} from './helpers'

export const scoreNodes: readonly NotifDefinition[] = [
  /** Le score devient calculable pour la première fois. */
  defineNode({
    id: 'score.first_ready',
    family: 'score',
    channel: 'progression',
    budget: 'standard',
    enabled: false,
    priority: 75,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'adaptive',
    cooldownDays: ONCE_EVER_DAYS,
    detectability: {
      offlineSignal: 'no',
      observer: 'app',
      firesWithoutReopen: false,
      note: "Le score est déposé dans l'App Group par l'extension ; seule l'app le relit.",
    },
    route: () => route('/(tabs)/home'),
    when: ctx => ctx.score.status === 'ready' && ctx.score.global !== null,
    schedule: ctx => relative(ctx.now + 60_000),
    content: (ctx, meta) => ({
      ...contentKeys('score.first_ready', meta.variant),
      params: { score: ctx.score.global ?? 0 },
    }),
  }),

  /** Franchissement d'un palier (35 / 60 / 80). */
  defineNode({
    id: 'score.band_up',
    family: 'score',
    channel: 'progression',
    budget: 'standard',
    enabled: false,
    priority: 70,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 7,
    maxPerWeek: 1,
    detectability: {
      offlineSignal: 'no',
      observer: 'app',
      firesWithoutReopen: false,
      note: 'Comparaison de paliers faite dans l’app à partir du score déposé.',
    },
    route: () => route('/(tabs)/home'),
    when: ctx =>
      ctx.score.bandRank !== null &&
      ctx.score.previousBandRank !== null &&
      ctx.score.bandRank > ctx.score.previousBandRank,
    schedule: ctx => wallClock(ctx.now, { hour: 10, minute: 0 }),
    content: (ctx, meta) => ({
      ...contentKeys('score.band_up', meta.variant),
      params: { score: ctx.score.global ?? 0 },
    }),
  }),

  /**
   * Le score baisse nettement. Ton DESCRIPTIF, jamais culpabilisant : Relock
   * accompagne quelqu'un qui lutte déjà contre lui-même, il n'a pas besoin
   * d'un second procureur.
   */
  defineNode({
    id: 'score.dropped',
    family: 'score',
    channel: 'progression',
    budget: 'standard',
    enabled: false,
    priority: 55,
    interruption: 'passive',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 14,
    maxPerWeek: 1,
    detectability: {
      offlineSignal: 'no',
      observer: 'app',
      firesWithoutReopen: false,
      note: 'Delta hebdomadaire lu dans l’app.',
    },
    route: () => route('/(tabs)/activity'),
    when: ctx => ctx.score.delta !== null && ctx.score.delta <= -8,
    schedule: ctx => wallClock(ctx.now, { hour: 18, minute: 0, weekday: 1 }),
    content: (_ctx, meta) => contentKeys('score.dropped', meta.variant),
  }),

  /** Le score progresse nettement. Une fois par semaine, pas plus. */
  defineNode({
    id: 'score.improved',
    family: 'score',
    channel: 'progression',
    budget: 'standard',
    enabled: false,
    priority: 50,
    interruption: 'passive',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 7,
    maxPerWeek: 1,
    detectability: {
      offlineSignal: 'no',
      observer: 'app',
      firesWithoutReopen: false,
      note: 'Delta hebdomadaire lu dans l’app.',
    },
    route: () => route('/(tabs)/home'),
    when: ctx => ctx.score.delta !== null && ctx.score.delta >= 5,
    schedule: ctx => wallClock(ctx.now, { hour: 10, minute: 0, weekday: 1 }),
    content: (ctx, meta) => ({
      ...contentKeys('score.improved', meta.variant),
      params: { delta: ctx.score.delta ?? 0 },
    }),
  }),

  /**
   * L'axe le plus faible, et UNE action concrète pour cet axe. Un conseil sans
   * geste associé n'est qu'un constat de plus.
   */
  defineNode({
    id: 'score.weakest_axis_tip',
    family: 'score',
    channel: 'progression',
    budget: 'standard',
    enabled: false,
    priority: 45,
    interruption: 'passive',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 14,
    maxPerWeek: 1,
    detectability: {
      offlineSignal: 'no',
      observer: 'app',
      firesWithoutReopen: false,
      note: 'Axe faible lu dans le score déposé par l’extension.',
    },
    route: () => route('/add-block'),
    when: ctx => ctx.score.status === 'ready',
    schedule: ctx => wallClock(ctx.now, { hour: 11, minute: 0, weekday: 0 }),
    // Deux messages distincts : conseiller « coupe le soir » à quelqu'un dont
    // le problème est la concentration en journée serait un conseil au hasard.
    content: (ctx, meta) =>
      contentKeys(
        ctx.score.weakestAxis === 'rest'
          ? 'score.weakest_axis_tip_rest'
          : 'score.weakest_axis_tip_focus',
        meta.variant,
      ),
  }),
]
