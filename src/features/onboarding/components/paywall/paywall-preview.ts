import type { PaywallPlan } from '@/features/onboarding/types/paywall'

/**
 * Décors de développement UNIQUEMENT.
 *
 * Ces montants ne sont jamais montrés en production : `ScenePaywall` ne les
 * branche que dans un build de développement dépourvu de clés RevenueCat, pour
 * pouvoir travailler les quatre écrans sans store. Dès que RevenueCat répond,
 * le paywall n'affiche plus que des prix venus du store (`loadPaywallCatalog`).
 *
 * `packageId` / `offeringId` sont volontairement vides : aucun de ces plans
 * n'est achetable, et l'adaptateur d'aperçu ne facture rien.
 */
export const PREVIEW_PLANS: readonly PaywallPlan[] = [
  {
    id: 'annual',
    price: 69.99,
    priceString: '69,99 $',
    currency: 'USD',
    period: 'year',
    packageId: '',
    offeringId: '',
  },
  {
    id: 'weekly',
    price: 6.99,
    priceString: '6,99 $',
    currency: 'USD',
    period: 'week',
    packageId: '',
    offeringId: '',
  },
]

export const PREVIEW_OFFER: PaywallPlan = {
  id: 'annual-offer',
  price: 34.99,
  priceString: '34,99 $',
  currency: 'USD',
  period: 'year',
  packageId: '',
  offeringId: '',
}
