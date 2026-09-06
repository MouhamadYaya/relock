import type { PaywallPlan } from '@/features/onboarding/types/paywall'

export const MONTHS_PER_YEAR = 12
export const WEEKS_PER_YEAR = 365 / 7

/**
 * Réécrit un montant DÉRIVÉ dans l'écriture exacte du store.
 *
 * Le prix facturé (`plan.priceString`) est toujours affiché tel que le store
 * l'a écrit — on ne le reconstruit jamais. Mais un paywall montre aussi des
 * équivalents (« 1,35 $/semaine », « 2,92 $/mois ») qui, eux, se calculent.
 * Plutôt que de deviner devise, symbole, position du symbole et séparateur
 * décimal par pays, on recopie la mise en forme du store en remplaçant
 * seulement le nombre : « 69,99 $ » donne « 1,35 $ », « $69.99 » donne
 * « $1.35 », « ¥7000 » donne « ¥583 ». Zéro table de conversion à maintenir.
 */
export function formatLikeStore(sample: string, amount: number): string {
  const match = sample.match(/\d[\d\s\u00A0\u202F.,']*\d|\d/)
  if (!match) {
    return amount.toFixed(2)
  }
  const raw = match[0]
  const tail = /[.,](\d{1,2})$/.exec(raw)
  const separator = tail ? raw[raw.length - tail[1].length - 1] : '.'
  const decimals = tail ? tail[1].length : 0
  return sample.replace(raw, amount.toFixed(decimals).replace('.', separator))
}

/** Équivalent hebdomadaire d'une formule, dans l'écriture du store. */
export function pricePerWeek(plan: PaywallPlan): string {
  const weekly =
    plan.period === 'year' ? plan.price / WEEKS_PER_YEAR : plan.price
  return formatLikeStore(plan.priceString, weekly)
}

/** Équivalent mensuel d'une formule annuelle, dans l'écriture du store. */
export function pricePerMonth(plan: PaywallPlan): string {
  const monthly =
    plan.period === 'year' ? plan.price / MONTHS_PER_YEAR : plan.price
  return formatLikeStore(plan.priceString, monthly)
}

/**
 * La remise se CALCULE à partir des deux prix réels du store, elle ne s'écrit
 * pas. Une chaîne « −80 % » figée serait fausse dès que l'un des deux produits
 * change de tarif, et invisible pour celui qui fait le changement.
 */
export function offerReduction(regular: PaywallPlan, offer: PaywallPlan) {
  return Math.round((1 - offer.price / regular.price) * 100)
}
