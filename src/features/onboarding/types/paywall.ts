export type PaywallPlanId = 'annual' | 'weekly' | 'annual-offer'

/**
 * Une formule affichable ET achetable.
 *
 * Règle non négociable : `priceString` vient du store (App Store / Play), déjà
 * écrit dans la devise et le format du pays du compte de l'utilisateur, et
 * `packageId` désigne le produit que l'achat va réellement facturer. On
 * n'écrit JAMAIS un prix à la main : ce qui est affiché est ce qui est débité.
 */
export type PaywallPlan = {
  id: PaywallPlanId
  /** Prix numérique exact du store. Sert uniquement aux valeurs dérivées (%, /semaine, /mois). */
  price: number
  /** Prix déjà localisé par le store. Affiché tel quel, jamais reconstruit. */
  priceString: string
  /** Code ISO de la devise du store (USD, EUR, CAD…). */
  currency: string
  period: 'year' | 'week'
  /** Package RevenueCat à acheter — c'est lui qui décide de ce qui est facturé. */
  packageId: string
  /** Offering RevenueCat qui contient ce package. */
  offeringId: string
}

/**
 * Ce que le paywall a le droit de montrer, tel que le store le renvoie.
 *
 * `offer` est `null` quand l'offering de remise n'existe pas ou ne contient
 * aucun produit annuel : dans ce cas aucun écran de remise ne s'affiche, plutôt
 * que d'afficher une remise qu'on ne saurait pas facturer.
 */
export type PaywallCatalog = {
  plans: readonly PaywallPlan[]
  offer: PaywallPlan | null
}

export type PaywallPreviewScreen = 'benefits' | 'plans' | 'offer' | 'offer-full'

export type PaywallPurchaseSource = 'plans' | 'exit-offer' | 'cancel-offer'

/** The billing adapter must distinguish an actual store-sheet cancellation from other failures. */
export type PaywallPurchaseResult =
  | { status: 'purchased' }
  | { status: 'cancelled'; storeSheetPresented: boolean }
  | { status: 'pending' }
  | { status: 'failed' }

/**
 * Une restauration doit séparer « le store a répondu, ce compte n'a aucun
 * abonnement » d'une panne (init, réseau, store injoignable) : le premier est un
 * diagnostic de compte, le second est réessayable.
 */
export type PaywallRestoreResult = 'restored' | 'none' | 'failed'

export type PaywallRestore = () => Promise<PaywallRestoreResult>

export type PaywallPurchase = (
  plan: PaywallPlan,
  source: PaywallPurchaseSource,
) => Promise<PaywallPurchaseResult>
