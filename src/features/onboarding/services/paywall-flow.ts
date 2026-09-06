import type {
  PaywallPurchaseResult,
  PaywallPurchaseSource,
} from '@/features/onboarding/types/paywall'

export function shouldShowCancellationOffer(
  result: PaywallPurchaseResult,
  source: PaywallPurchaseSource,
  alreadyShown: boolean,
) {
  return (
    source === 'plans' &&
    !alreadyShown &&
    result.status === 'cancelled' &&
    result.storeSheetPresented
  )
}
