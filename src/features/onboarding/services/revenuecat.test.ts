import { PACKAGE_TYPE } from 'react-native-purchases'

jest.mock('@/config/env', () => ({
  env: {
    REVENUECAT_ENABLED: true,
    REVENUECAT_IOS_API_KEY: 'ios-key',
    REVENUECAT_ANDROID_API_KEY: '',
    REVENUECAT_ENTITLEMENT_ID: 'relock_pro',
    REVENUECAT_DISCOUNT_OFFERING_ID: 'discount',
  },
}))

const mockGetOfferings = jest.fn()
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    setLogLevel: jest.fn(),
    configure: jest.fn(),
    getOfferings: (...args: unknown[]) => mockGetOfferings(...args),
  },
  LOG_LEVEL: { VERBOSE: 'verbose', INFO: 'info' },
  PACKAGE_TYPE: { ANNUAL: 'ANNUAL', WEEKLY: 'WEEKLY' },
  PURCHASES_ERROR_CODE: {
    PURCHASE_CANCELLED_ERROR: 'PURCHASE_CANCELLED_ERROR',
    PAYMENT_PENDING_ERROR: 'PAYMENT_PENDING_ERROR',
  },
}))
jest.mock('react-native-purchases-ui', () => ({
  __esModule: true,
  default: { presentCustomerCenter: jest.fn() },
}))

const storePackage = (
  identifier: string,
  packageType: string,
  product: Record<string, unknown> | null,
) => ({ identifier, packageType, product })

const offering = (
  identifier: string,
  packages: ReturnType<typeof storePackage>[],
) => ({ identifier, availablePackages: packages })

const priced = (price: number) => ({
  price,
  priceString: `${price} €`,
  currencyCode: 'EUR',
})

const discountOffering = offering('discount', [
  storePackage('annual-discount', PACKAGE_TYPE.ANNUAL, priced(29)),
])

describe('loadPaywallCatalog discount gating', () => {
  let loadPaywallCatalog: typeof import('./revenuecat').loadPaywallCatalog

  beforeEach(() => {
    jest.resetModules()
    mockGetOfferings.mockReset()
    loadPaywallCatalog = require('./revenuecat').loadPaywallCatalog
  })

  const mockOfferings = (current: ReturnType<typeof offering>) =>
    mockGetOfferings.mockResolvedValue({
      current,
      all: { [current.identifier]: current, discount: discountOffering },
    })

  it('loads the discount when the annual full price maps to a plan', async () => {
    mockOfferings(
      offering('default', [
        storePackage('annual', PACKAGE_TYPE.ANNUAL, priced(59)),
        storePackage('weekly', PACKAGE_TYPE.WEEKLY, priced(6)),
      ]),
    )
    const catalog = await loadPaywallCatalog()
    expect(catalog?.plans.map(plan => plan.id)).toEqual(['annual', 'weekly'])
    expect(catalog?.offer?.packageId).toBe('annual-discount')
  })

  it('offers no discount when the annual package has no usable price', async () => {
    // Un annuel sans prix exploitable ne produit aucune formule : la remise
    // n'aurait plus que l'hebdomadaire comme référence de comparaison.
    mockOfferings(
      offering('default', [
        storePackage('annual', PACKAGE_TYPE.ANNUAL, { price: null }),
        storePackage('weekly', PACKAGE_TYPE.WEEKLY, priced(6)),
      ]),
    )
    const catalog = await loadPaywallCatalog()
    expect(catalog?.plans.map(plan => plan.id)).toEqual(['weekly'])
    expect(catalog?.offer).toBeNull()
  })

  it('keeps a weekly-only catalog valid without any discount', async () => {
    mockOfferings(
      offering('default', [
        storePackage('weekly', PACKAGE_TYPE.WEEKLY, priced(6)),
      ]),
    )
    const catalog = await loadPaywallCatalog()
    expect(catalog?.plans.map(plan => plan.id)).toEqual(['weekly'])
    expect(catalog?.offer).toBeNull()
  })
})
