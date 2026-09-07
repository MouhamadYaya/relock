/**
 * Famille `billing` — deux canaux, et la distinction n'est pas cosmétique.
 *
 *  `account`  transactionnel : fin d'essai, échec de prélèvement, abonnement
 *             perdu. Ce sont des faits qui concernent l'argent de
 *             l'utilisateur ; il a le droit de les connaître, et les taire
 *             produit des remboursements et des avis à une étoile ;
 *  `offers`   promotionnel : offres, relances de paywall. OPT-IN strict, faux
 *             par défaut. Notifier une promotion sans accord explicite est
 *             exactement ce qu'Apple sanctionne, et ce que personne n'aime.
 *
 * L'échéance d'offre est une URGENCE MARKETING assumée, mais bornée : la
 * deadline est propre à l'utilisateur, l'offre disparaît RÉELLEMENT de la
 * notification à l'échéance et ne revient qu'au cycle suivant. Un compte à
 * rebours démenti par l'écran qui suit ne trompe personne deux fois.
 */
import type { NotifDefinition } from '@/features/notifications/types'
import {
  absolute,
  contentKeys,
  DAY,
  defineNode,
  HOUR,
  notEntitled,
  relative,
  route,
} from './helpers'

const paywall = () => route('/paywall')

const discountPaywall = () =>
  route('/paywall', { params: { offer: 'discount' } })

/** Tous les nœuds commerciaux partagent le même garde et le même repli. */
const COMMERCIAL_GUARD = {
  routeGuard: notEntitled,
  routeFallback: '/(tabs)/home',
} as const

export const billingNodes: readonly NotifDefinition[] = [
  /**
   * Prélèvement en échec. Adaptatif : si l'utilisateur est dans l'app, une
   * carte suffit — il peut régler le problème tout de suite. La notification
   * n'arrive que s'il repart sans l'avoir fait.
   */
  defineNode({
    id: 'billing.renewal_failed',
    family: 'billing',
    channel: 'account',
    budget: 'standard',
    enabled: true,
    priority: 90,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'adaptive',
    adaptiveDeferMs: 6 * HOUR,
    cooldownDays: 2,
    maxPerWeek: 2,
    detectability: {
      offlineSignal: 'no',
      observer: 'app',
      firesWithoutReopen: false,
      note: "L'état de facturation vient de RevenueCat, interrogé au lancement de l'app.",
    },
    route: () => route('/settings'),
    when: ctx => ctx.billing.renewalIssue,
    schedule: ctx => relative(ctx.now + 15 * 60_000),
    content: (_ctx, meta) =>
      contentKeys('billing.renewal_failed', meta.variant),
  }),

  /**
   * Abonnement perdu. Le message dit ce qui TOMBE, pas ce qu'il faut racheter :
   * l'utilisateur mérite de savoir quelles protections viennent de s'éteindre.
   */
  defineNode({
    id: 'billing.entitlement_lost',
    family: 'billing',
    channel: 'account',
    budget: 'standard',
    enabled: true,
    priority: 85,
    interruption: 'active',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 7,
    maxPerWeek: 1,
    detectability: {
      offlineSignal: 'no',
      observer: 'app',
      firesWithoutReopen: false,
      note: "L'expiration est lue dans CustomerInfo au lancement.",
    },
    route: paywall,
    ...COMMERCIAL_GUARD,
    when: ctx =>
      !ctx.billing.entitled &&
      ctx.billing.entitlementLostAt !== null &&
      ctx.now - ctx.billing.entitlementLostAt < 7 * DAY,
    schedule: ctx => relative(ctx.now + HOUR),
    content: (_ctx, meta) =>
      contentKeys('billing.entitlement_lost', meta.variant),
  }),

  /**
   * Fin d'essai à 48h. ANCRE : un essai de 14 ou 30 jours a son échéance très
   * au-delà de l'horizon roulant. Sans ancre, cette notification — la plus
   * importante du produit sur le plan de la confiance — ne serait jamais écrite.
   */
  defineNode({
    id: 'billing.trial_ends_2d',
    family: 'billing',
    channel: 'account',
    budget: 'standard',
    enabled: true,
    priority: 80,
    interruption: 'active',
    scheduling: 'anchor',
    delivery: 'notification',
    cooldownDays: 0,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: "L'échéance d'essai est un instant absolu connu dès la souscription.",
    },
    route: () => route('/settings'),
    // Pendant un essai l'utilisateur EST abonné : la condition porte sur
    // l'échéance, jamais sur l'absence d'abonnement.
    when: ctx =>
      ctx.billing.trialEndsAt !== null &&
      ctx.billing.trialEndsAt - ctx.now > 2 * DAY,
    schedule: ctx =>
      ctx.billing.trialEndsAt === null
        ? null
        : absolute(ctx.billing.trialEndsAt - 2 * DAY),
    content: (_ctx, meta) => contentKeys('billing.trial_ends_2d', meta.variant),
  }),

  /** Dernier rappel avant prélèvement. Ancre, pour la même raison. */
  defineNode({
    id: 'billing.trial_ends_1d',
    family: 'billing',
    channel: 'account',
    budget: 'standard',
    enabled: true,
    priority: 80,
    interruption: 'active',
    scheduling: 'anchor',
    delivery: 'notification',
    cooldownDays: 0,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: 'Instant absolu, écrit dès que l’essai est connu.',
    },
    route: () => route('/settings'),
    when: ctx =>
      ctx.billing.trialEndsAt !== null &&
      ctx.billing.trialEndsAt - ctx.now > DAY,
    schedule: ctx =>
      ctx.billing.trialEndsAt === null
        ? null
        : absolute(ctx.billing.trialEndsAt - DAY),
    content: (_ctx, meta) => contentKeys('billing.trial_ends_1d', meta.variant),
  }),

  /** Dernière heure utile de l'offre. */
  defineNode({
    id: 'billing.offer_expires_2h',
    family: 'billing',
    channel: 'offers',
    budget: 'standard',
    enabled: false,
    priority: 75,
    interruption: 'active',
    scheduling: 'anchor',
    delivery: 'notification',
    cooldownDays: 14,
    maxPerWeek: 1,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: "L'échéance d'offre est un instant absolu stocké localement.",
    },
    route: discountPaywall,
    ...COMMERCIAL_GUARD,
    when: ctx =>
      !ctx.billing.entitled &&
      ctx.billing.offerExpiresAt !== null &&
      ctx.billing.offerExpiresAt - ctx.now > 2 * HOUR,
    schedule: ctx =>
      ctx.billing.offerExpiresAt === null
        ? null
        : absolute(ctx.billing.offerExpiresAt - 2 * HOUR),
    content: (_ctx, meta) =>
      contentKeys('billing.offer_expires_2h', meta.variant),
  }),

  /** L'offre court encore un jour. */
  defineNode({
    id: 'billing.offer_expires_24h',
    family: 'billing',
    channel: 'offers',
    budget: 'standard',
    enabled: false,
    priority: 70,
    interruption: 'active',
    scheduling: 'anchor',
    delivery: 'notification',
    cooldownDays: 14,
    maxPerWeek: 1,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: 'Instant absolu stocké localement à l’ouverture du cycle d’offre.',
    },
    route: discountPaywall,
    ...COMMERCIAL_GUARD,
    when: ctx =>
      !ctx.billing.entitled &&
      ctx.billing.offerExpiresAt !== null &&
      ctx.billing.offerExpiresAt - ctx.now > DAY,
    schedule: ctx =>
      ctx.billing.offerExpiresAt === null
        ? null
        : absolute(ctx.billing.offerExpiresAt - DAY),
    content: (_ctx, meta) =>
      contentKeys('billing.offer_expires_24h', meta.variant),
  }),

  /**
   * Ouverture d'une offre. Adaptatif : si l'utilisateur vient justement
   * d'ouvrir Relock et voit l'offre à l'écran, lui envoyer une notification
   * pour la lui annoncer serait absurde.
   */
  defineNode({
    id: 'billing.offer_available',
    family: 'billing',
    channel: 'offers',
    budget: 'standard',
    enabled: false,
    priority: 65,
    interruption: 'passive',
    scheduling: 'rolling',
    delivery: 'adaptive',
    adaptiveDeferMs: 4 * HOUR,
    cooldownDays: 14,
    maxPerWeek: 1,
    detectability: {
      offlineSignal: 'no',
      observer: 'app',
      firesWithoutReopen: false,
      note: 'Les offres RevenueCat sont résolues par l’app au lancement.',
    },
    route: discountPaywall,
    ...COMMERCIAL_GUARD,
    when: ctx => !ctx.billing.entitled && ctx.billing.offerAvailable,
    schedule: ctx => relative(ctx.now + 30 * 60_000),
    content: (_ctx, meta) =>
      contentKeys('billing.offer_available', meta.variant),
  }),

  /** Toujours pas d'achat le lendemain. */
  defineNode({
    id: 'billing.paywall_abandoned_d1',
    family: 'billing',
    channel: 'offers',
    budget: 'standard',
    enabled: false,
    priority: 60,
    interruption: 'passive',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 14,
    maxPerWeek: 1,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: 'L’abandon est daté localement ; le tir du lendemain est écrit d’avance.',
    },
    route: paywall,
    ...COMMERCIAL_GUARD,
    when: ctx =>
      !ctx.billing.entitled && ctx.billing.paywallAbandonedAt !== null,
    schedule: ctx => {
      const at = ctx.billing.paywallAbandonedAt
      if (at === null) return null
      const d = new Date(at + DAY)
      d.setHours(20, 0, 0, 0)
      return absolute(d.getTime())
    },
    content: (_ctx, meta) =>
      contentKeys('billing.paywall_abandoned_d1', meta.variant),
  }),

  /** Feuille de paiement présentée puis annulée. Une relance courte, une seule. */
  defineNode({
    id: 'billing.paywall_abandoned_1h',
    family: 'billing',
    channel: 'offers',
    budget: 'standard',
    enabled: false,
    priority: 55,
    interruption: 'passive',
    scheduling: 'rolling',
    delivery: 'notification',
    cooldownDays: 7,
    maxPerWeek: 1,
    detectability: {
      offlineSignal: 'yes',
      observer: 'anchor',
      firesWithoutReopen: true,
      note: 'L’abandon est daté localement au moment où la feuille se referme.',
    },
    route: paywall,
    ...COMMERCIAL_GUARD,
    when: ctx =>
      !ctx.billing.entitled && ctx.billing.paywallAbandonedAt !== null,
    schedule: ctx =>
      ctx.billing.paywallAbandonedAt === null
        ? null
        : absolute(ctx.billing.paywallAbandonedAt + HOUR),
    content: (_ctx, meta) =>
      contentKeys('billing.paywall_abandoned_1h', meta.variant),
  }),
]
