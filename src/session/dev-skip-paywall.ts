/**
 * DEV uniquement — « skip paywall ».
 *
 * Pourquoi un drapeau, et pas un simple `applyEntitlement(true)` : la porte
 * dure est un ÉTAT revérifié en permanence. RevenueCat répond « pas
 * d'abonnement » au démarrage suivant (et sur simulateur, où aucun achat
 * sandbox n'existe), et la porte se refermerait aussitôt derrière nous. Le
 * drapeau dit donc au parcours d'ignorer les fermetures tant qu'il est posé.
 *
 * Deux garanties :
 *  1. `__DEV__` — la lecture rend toujours `false` en Release, le drapeau y
 *     est donc sans effet même s'il traînait dans MMKV ;
 *  2. posé UNIQUEMENT par le bouton de dev du premier écran du parcours (ou
 *     le pont `relock://dev/paywall-skip/on`) — jamais par un chemin normal.
 */

import { constants } from '@/config/constants'
import { kvStorage } from '@/shared/services/storage/mmkv'

let cached: boolean | null = null

/** Le paywall est-il court-circuité sur cette installation de dev ? */
export function isPaywallSkipped(): boolean {
  if (!__DEV__) return false
  if (cached === null) {
    cached = kvStorage.getString(constants.DEV_SKIP_PAYWALL) === '1'
  }
  return cached
}

export function setPaywallSkipped(skipped: boolean): void {
  if (!__DEV__) return
  cached = skipped
  kvStorage.setString(constants.DEV_SKIP_PAYWALL, skipped ? '1' : '0')
}
