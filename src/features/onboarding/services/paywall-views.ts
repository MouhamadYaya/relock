import { constants } from '@/config/constants'
import { kvStorage } from '@/shared/services/storage/mmkv'

/**
 * Combien de fois le paywall a été présenté à cet appareil.
 *
 * Sert à deux choses : choisir la variante (la première vue argumente, les
 * suivantes vont droit au prix — voir `PaywallScreen`) et savoir combien de
 * présentations il faut en moyenne pour convertir.
 */
export function readPaywallViews(): number {
  const raw = kvStorage.getString(constants.PAYWALL_VIEWS)
  const parsed = raw === null ? Number.NaN : Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

/** Incrémente et rend le rang de CETTE présentation (1 = la première). */
export function countPaywallView(): number {
  const next = readPaywallViews() + 1
  kvStorage.setString(constants.PAYWALL_VIEWS, String(next))
  return next
}

export function resetPaywallViews(): void {
  kvStorage.delete(constants.PAYWALL_VIEWS)
}
