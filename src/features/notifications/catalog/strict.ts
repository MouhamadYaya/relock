/**
 * Famille `strict` — le verrou irréversible.
 *
 * Le mode strict est un contrat que l'utilisateur passe avec lui-même. Il
 * mérite sa propre branche, et surtout une confirmation explicite de ce à quoi
 * il vient de s'engager : découvrir l'irréversibilité au moment où on voudrait
 * revenir en arrière est la pire façon de l'apprendre.
 *
 * Toute la famille est désactivée au lancement : elle ne devient utile qu'une
 * fois le mode strict réellement adopté, et une branche prématurée n'apporte
 * que du bruit.
 */
import type { NotifDefinition } from '@/features/notifications/types'
import {
  absolute,
  contentKeys,
  defineNode,
  HOUR,
  MINUTE,
  ONCE_EVER_DAYS,
  relative,
  route,
} from './helpers'

export const strictNodes: readonly NotifDefinition[] = [
  /**
   * Rafale de tentatives pendant un verrou. Ce n'est pas un rappel : c'est du
   * soutien au moment exact où il sert. Détecté par l'app au retour au premier
   * plan — l'extension n'émet pas encore ce signal, et le prétendre serait
   * annoncer une réactivité qui n'existe pas.
   */
  defineNode({
    id: 'strict.attempt_burst',
    family: 'strict',
    channel: 'reminders',
    budget: 'standard',
    enabled: false,
    priority: 85,
    interruption: 'timeSensitive',
    scheduling: 'rolling',
    delivery: 'adaptive',
    cooldownDays: 1,
    maxPerWeek: 3,
    detectability: {
      offlineSignal: 'no',
      observer: 'app',
      firesWithoutReopen: false,
      note: "Le compteur de tentatives est relevé par l'app à la synchronisation ; l'extension bouclier ne l'émet pas encore.",
    },
    route: () => route('/(tabs)/home'),
    when: ctx =>
      ctx.blocking.strictEndsAt !== null && ctx.results.resistedToday >= 5,
    schedule: ctx => relative(ctx.now + MINUTE),
    content: (_ctx, meta) => contentKeys('strict.attempt_burst', meta.variant),
  }),

  /** Première session stricte menée jusqu'au bout. Une seule fois dans la vie. */
  defineNode({
    id: 'strict.first_completed',
    family: 'strict',
    channel: 'progression',
    budget: 'standard',
    enabled: false,
    priority: 70,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: ONCE_EVER_DAYS,
    detectability: {
      offlineSignal: 'no',
      observer: 'app',
      firesWithoutReopen: false,
      note: "L'achèvement se constate en relisant les sessions, donc dans l'app.",
    },
    route: () => route('/(tabs)/activity'),
    when: ctx =>
      ctx.blocking.strictEverCompleted && ctx.blocking.strictEndsAt === null,
    schedule: ctx => relative(ctx.now + 2 * MINUTE),
    content: (_ctx, meta) =>
      contentKeys('strict.first_completed', meta.variant),
  }),

  /**
   * Confirmation du verrou. Passive : l'utilisateur vient d'agir, il n'a pas
   * besoin qu'on sonne — il a besoin d'une trace écrite de son engagement.
   */
  defineNode({
    id: 'strict.locked_confirmation',
    family: 'strict',
    channel: 'reminders',
    budget: 'standard',
    enabled: false,
    priority: 60,
    interruption: 'passive',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 0,
    maxPerWeek: 7,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: "L'armement est daté ; le tir suit de trente secondes.",
    },
    route: () => route('/(tabs)/home'),
    when: ctx =>
      ctx.blocking.strictEndsAt !== null &&
      ctx.blocking.strictStartedAt !== null &&
      ctx.now - ctx.blocking.strictStartedAt < 5 * MINUTE,
    schedule: ctx => relative(ctx.now + 30_000),
    content: (ctx, meta) => ({
      ...contentKeys('strict.locked_confirmation', meta.variant),
      params: { until: formatHour(ctx.blocking.strictEndsAt) },
    }),
  }),

  /**
   * Le verrou vient de se lever. `quietHours: 'ignore'` : ici l'instant EST le
   * message. Le décaler à 8h du matin annoncerait une libération vieille de
   * dix heures — une information fausse plutôt qu'une information tardive.
   */
  defineNode({
    id: 'strict.unlock_available',
    family: 'strict',
    channel: 'reminders',
    budget: 'standard',
    enabled: false,
    priority: 55,
    interruption: 'passive',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 0,
    maxPerWeek: 7,
    quietHours: 'ignore',
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: 'La fin du verrou est une date connue dès son armement.',
    },
    route: () => route('/(tabs)/home'),
    when: ctx => ctx.blocking.strictEndsAt !== null,
    schedule: ctx =>
      ctx.blocking.strictEndsAt === null
        ? null
        : absolute(ctx.blocking.strictEndsAt),
    content: (_ctx, meta) =>
      contentKeys('strict.unlock_available', meta.variant),
  }),

  /** Mi-parcours d'un long verrou : un encouragement au moment le plus dur. */
  defineNode({
    id: 'strict.midpoint',
    family: 'strict',
    channel: 'reminders',
    budget: 'standard',
    enabled: false,
    priority: 45,
    interruption: 'passive',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 0,
    maxPerWeek: 3,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: 'Point médian calculable dès l’armement.',
    },
    route: () => route('/(tabs)/home'),
    when: ctx => {
      const { strictStartedAt, strictEndsAt } = ctx.blocking
      if (strictStartedAt === null || strictEndsAt === null) return false
      return strictEndsAt - strictStartedAt > 4 * HOUR
    },
    schedule: ctx => {
      const { strictStartedAt, strictEndsAt } = ctx.blocking
      if (strictStartedAt === null || strictEndsAt === null) return null
      return absolute(strictStartedAt + (strictEndsAt - strictStartedAt) / 2)
    },
    content: (_ctx, meta) => contentKeys('strict.midpoint', meta.variant),
  }),
]

/** « 21:30 » — heure locale, sans dépendance à une bibliothèque de dates. */
function formatHour(at: number | null): string {
  if (at === null) return ''
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
