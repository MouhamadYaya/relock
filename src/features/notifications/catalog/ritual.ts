/**
 * Famille `ritual` — la seule que l'utilisateur configure lui-même.
 *
 * Rien ne part tant qu'il n'a pas choisi son heure : un rituel imposé n'est pas
 * un rituel. C'est aussi pourquoi ces nœuds ont leur PROPRE budget — ce qu'on
 * a explicitement demandé ne doit pas consommer le quota des messages qu'on
 * envoie de notre propre initiative.
 *
 * Heures locales RÉCURRENTES : le trigger calendrier natif les répète tout
 * seul, ce qui coûte un unique créneau iOS au lieu d'un par jour.
 */
import type {
  NotifContext,
  NotifDefinition,
  NotifSchedule,
} from '@/features/notifications/types'
import { contentKeys, defineNode, route, wallClock } from './helpers'

function dailyAt(
  ctx: NotifContext,
  minutes: number | null,
): NotifSchedule | null {
  if (minutes === null) return null
  return wallClock(ctx.now, {
    hour: Math.floor(minutes / 60),
    minute: minutes % 60,
    repeats: true,
  })
}

export const ritualNodes: readonly NotifDefinition[] = [
  /** Coucher : proposé quand l'axe `rest` est le point faible. */
  defineNode({
    id: 'ritual.bedtime',
    family: 'ritual',
    channel: 'ritual',
    budget: 'userRequested',
    // Aucune UI ne permet encore de choisir l'heure du coucher : le nœud resterait inerte, autant le dire.
    enabled: false,
    priority: 45,
    interruption: 'passive',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 0,
    quietHours: 'ignore',
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: 'Trigger calendrier récurrent : un seul créneau iOS, répété par le système.',
    },
    route: () => route('/add-block'),
    when: ctx => ctx.ritual.bedtimeMinutes !== null,
    schedule: ctx => dailyAt(ctx, ctx.ritual.bedtimeMinutes),
    content: (_ctx, meta) => contentKeys('ritual.bedtime', meta.variant),
  }),

  /** Le rendez-vous quotidien choisi par l'utilisateur. */
  defineNode({
    id: 'ritual.my_moment',
    family: 'ritual',
    channel: 'ritual',
    budget: 'userRequested',
    enabled: true,
    priority: 40,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 0,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: 'Trigger calendrier récurrent.',
    },
    route: () => route('/add-block'),
    when: ctx => ctx.ritual.myMomentMinutes !== null,
    schedule: ctx => dailyAt(ctx, ctx.ritual.myMomentMinutes),
    content: (_ctx, meta) => contentKeys('ritual.my_moment', meta.variant),
  }),

  /** Première heure de la journée, si le réveil est un moment déclencheur. */
  defineNode({
    id: 'ritual.morning_no_scroll',
    family: 'ritual',
    channel: 'ritual',
    budget: 'userRequested',
    // Aucune UI ne permet encore de choisir l'heure du matin.
    enabled: false,
    priority: 35,
    interruption: 'passive',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 0,
    quietHours: 'ignore',
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: 'Trigger calendrier récurrent.',
    },
    route: () => route('/(tabs)/home'),
    when: ctx => ctx.ritual.morningMinutes !== null,
    schedule: ctx => dailyAt(ctx, ctx.ritual.morningMinutes),
    content: (_ctx, meta) =>
      contentKeys('ritual.morning_no_scroll', meta.variant),
  }),
]
