import { Platform } from 'react-native'
import Purchases, {
  LOG_LEVEL,
  PACKAGE_TYPE,
  PURCHASES_ERROR_CODE,
  type PurchasesError,
  type PurchasesOffering,
  type PurchasesPackage,
} from 'react-native-purchases'
import RevenueCatUI from 'react-native-purchases-ui'

import { env } from '@/config/env'
import type {
  PaywallCatalog,
  PaywallPlan,
  PaywallPlanId,
  PaywallPurchase,
} from '@/features/onboarding/types/paywall'

const entitlementId = env.REVENUECAT_ENTITLEMENT_ID || 'relock_pro'
const discountOfferingId = env.REVENUECAT_DISCOUNT_OFFERING_ID || 'discount'
let isInitialized = false

function apiKeyForCurrentPlatform(): string {
  return Platform.OS === 'ios'
    ? env.REVENUECAT_IOS_API_KEY
    : env.REVENUECAT_ANDROID_API_KEY
}

function isConfigured() {
  return env.REVENUECAT_ENABLED && apiKeyForCurrentPlatform() !== ''
}

const debug = (message: string, data?: Record<string, unknown>) => {
  if (__DEV__) {
    // eslint-disable-next-line no-console
    console.log(`[RevenueCat] ${message}`, data)
  }
}

function isPurchasesError(
  error: unknown,
): error is { code: string } & Error & Partial<PurchasesError> {
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as { code?: unknown }).code === 'string'
  )
}

function isStorePackage(p: unknown): p is PurchasesPackage {
  return Boolean(
    p &&
      typeof (p as PurchasesPackage).identifier === 'string' &&
      typeof (p as PurchasesPackage).product === 'object',
  )
}

/**
 * Traduit un package RevenueCat en formule affichable.
 *
 * `priceString` et `price` viennent du store — c'est ce qui garantit que le
 * prix montré est celui qui sera débité, dans la devise du compte Apple de
 * l'utilisateur (un Français voit des euros, un Canadien des dollars canadiens)
 * sans qu'on ait la moindre table de conversion à tenir.
 */
function toPlan(
  id: PaywallPlanId,
  period: 'year' | 'week',
  offering: PurchasesOffering,
  storePackage: PurchasesPackage,
): PaywallPlan | null {
  const product = storePackage.product
  if (typeof product?.price !== 'number' || !product.priceString) {
    return null
  }
  return {
    id,
    price: product.price,
    priceString: product.priceString,
    currency: product.currencyCode ?? '',
    period,
    packageId: storePackage.identifier,
    offeringId: offering.identifier,
  }
}

function findPackage(
  offering: PurchasesOffering,
  period: 'year' | 'week',
): PurchasesPackage | null {
  const standard = period === 'year' ? offering.annual : offering.weekly
  if (isStorePackage(standard)) return standard

  const wanted = period === 'year' ? PACKAGE_TYPE.ANNUAL : PACKAGE_TYPE.WEEKLY
  return (
    offering.availablePackages.find(item => item.packageType === wanted) ?? null
  )
}

async function getOffering(
  identifier?: string,
): Promise<PurchasesOffering | null> {
  const offerings = await Purchases.getOfferings()
  if (identifier) {
    return offerings.all?.[identifier] ?? null
  }
  if (offerings.current) return offerings.current
  return (
    Object.values(offerings.all ?? {}).find(
      offering => offering.availablePackages.length > 0,
    ) ?? null
  )
}

/**
 * Le catalogue réel, lu au store à chaque ouverture du paywall.
 *
 * `plans` vient de l'offering courant (celui marqué « default » dans
 * RevenueCat), `offer` de l'offering de remise. Si cet offering de remise
 * n'existe pas, `offer` vaut `null` et AUCUN écran de remise ne s'affichera :
 * mieux vaut ne pas proposer de remise que d'en promettre une qu'on facturerait
 * au plein tarif.
 */
export async function loadPaywallCatalog(): Promise<PaywallCatalog | null> {
  if (!(await initializeRevenueCat())) {
    return null
  }

  try {
    const current = await getOffering()
    if (!current) {
      debug(
        'aucun offering courant — vérifie l’offering « default » dans RevenueCat',
      )
      return null
    }

    const annualPackage = findPackage(current, 'year')
    const weeklyPackage = findPackage(current, 'week')
    const annualPlan = annualPackage
      ? toPlan('annual', 'year', current, annualPackage)
      : null
    const weeklyPlan = weeklyPackage
      ? toPlan('weekly', 'week', current, weeklyPackage)
      : null
    const plans = [annualPlan, weeklyPlan].filter(
      (plan): plan is PaywallPlan => plan !== null,
    )

    if (plans.length === 0) {
      debug('offering courant sans produit exploitable', {
        offeringIdentifier: current.identifier,
        packageIds: current.availablePackages.map(item => item.identifier),
      })
      return null
    }

    // La remise se compare TOUJOURS à l'annuel plein tarif : sans annuel au
    // catalogue, le barré comparerait deux périodes de facturation et
    // afficherait une réduction fausse.
    const discount = annualPlan ? await getOffering(discountOfferingId) : null
    const discountPackage = discount ? findPackage(discount, 'year') : null
    const offer =
      discount && discountPackage
        ? toPlan('annual-offer', 'year', discount, discountPackage)
        : null

    if (!offer) {
      debug(
        `aucune remise : offering « ${discountOfferingId} » absent ou sans produit annuel`,
      )
    }

    debug('catalogue chargé', {
      offering: current.identifier,
      plans: plans.map(plan => `${plan.id}=${plan.priceString}`),
      offer: offer ? `${offer.packageId}=${offer.priceString}` : 'aucune',
    })

    return { plans, offer }
  } catch (error) {
    debug('échec du chargement du catalogue', { error: String(error) })
    return null
  }
}

function hasRelockProEntitlementFromCustomerInfo(customerInfo: {
  entitlements: {
    active: Record<string, unknown>
  }
}) {
  return typeof customerInfo.entitlements.active[entitlementId] !== 'undefined'
}

export async function initializeRevenueCat(): Promise<boolean> {
  if (!isConfigured()) {
    return false
  }

  if (isInitialized) {
    return true
  }

  try {
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.VERBOSE : LOG_LEVEL.INFO)
    Purchases.configure({ apiKey: apiKeyForCurrentPlatform() })
    isInitialized = true
    return true
  } catch {
    return false
  }
}

export async function hasRelockProEntitlement(): Promise<boolean> {
  if (!(await initializeRevenueCat())) {
    return false
  }

  try {
    const customerInfo = await Purchases.getCustomerInfo()
    return hasRelockProEntitlementFromCustomerInfo(customerInfo)
  } catch {
    return false
  }
}

/**
 * Achète EXACTEMENT le package que la formule affichée désigne.
 *
 * Aucune déduction, aucun repli sur « le produit annuel le plus proche » : si
 * le package annoncé a disparu du store entre l'affichage et le tap, l'achat
 * échoue au lieu de facturer autre chose que ce que l'utilisateur a lu.
 */
export const paywallPurchaseWithRevenueCat: PaywallPurchase = async plan => {
  if (!(await initializeRevenueCat())) {
    return { status: 'failed' }
  }

  try {
    if (await hasRelockProEntitlement()) {
      return { status: 'purchased' }
    }

    const offering = await getOffering(plan.offeringId)
    const targetPackage = offering?.availablePackages.find(
      item => item.identifier === plan.packageId,
    )

    if (!targetPackage) {
      debug('package annoncé introuvable — achat refusé', {
        planId: plan.id,
        offeringId: plan.offeringId,
        packageId: plan.packageId,
      })
      return { status: 'failed' }
    }

    if (targetPackage.product.priceString !== plan.priceString) {
      debug('le prix du store a changé depuis l’affichage — achat refusé', {
        shown: plan.priceString,
        store: targetPackage.product.priceString,
      })
      return { status: 'failed' }
    }

    const purchaseResult = await Purchases.purchasePackage(targetPackage)
    return hasRelockProEntitlementFromCustomerInfo(purchaseResult.customerInfo)
      ? { status: 'purchased' }
      : { status: 'failed' }
  } catch (error) {
    if (isPurchasesError(error)) {
      debug('achat en échec', {
        code: String(error.code),
        readable: String(error.userInfo?.readableErrorCode ?? ''),
      })

      if (error.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
        return { status: 'cancelled', storeSheetPresented: true }
      }

      if (error.code === PURCHASES_ERROR_CODE.PAYMENT_PENDING_ERROR) {
        return { status: 'pending' }
      }
    }

    return { status: 'failed' }
  }
}

export async function restoreRevenueCatPurchases(): Promise<boolean> {
  if (!(await initializeRevenueCat())) {
    return false
  }

  try {
    await Purchases.restorePurchases()
    return hasRelockProEntitlement()
  } catch {
    return false
  }
}

export async function openRevenueCatCustomerCenter(): Promise<void> {
  if (!(await initializeRevenueCat())) {
    return
  }

  await RevenueCatUI.presentCustomerCenter()
}

export const isRevenueCatEnabled = isConfigured
