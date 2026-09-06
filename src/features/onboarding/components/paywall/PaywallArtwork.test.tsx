import {
  PREVIEW_OFFER,
  PREVIEW_PLANS,
} from '@/features/onboarding/components/paywall/paywall-preview'
import {
  formatLikeStore,
  MONTHS_PER_YEAR,
  offerReduction,
  pricePerMonth,
} from '@/features/onboarding/components/paywall/paywall-pricing'
import de from '@/i18n/locales/de.json'
import en from '@/i18n/locales/en.json'
import fr from '@/i18n/locales/fr.json'
import ru from '@/i18n/locales/ru.json'

const LOCALES = [en, fr, de, ru]

describe('Paywall copy and offer arithmetic', () => {
  it.each(LOCALES)('removes competitor wording from every locale', locale => {
    expect(
      JSON.stringify(locale.paywall_reference).toLowerCase(),
    ).not.toContain('brainrot')
  })

  it.each(LOCALES)('never hard-codes a discount or a price', locale => {
    // Les montants et le pourcentage se calculent depuis les deux prix : une
    // remise écrite en dur avait déjà dérivé une fois (« −80 % » pour 69,99 →
    // 34,99, qui vaut −50 %).
    const copy = JSON.stringify(locale.paywall_reference)
    expect(copy).toMatch(/\{\{percent\}\}/)
    expect(copy).not.toMatch(/\d\s?[$€£]|[$€£]\s?\d/)
    expect(copy).not.toMatch(/\d\s?%/)
  })

  it('states a reduction that matches the two prices', () => {
    expect(offerReduction(PREVIEW_PLANS[0], PREVIEW_OFFER)).toBe(50)
  })

  it('derives the monthly equivalent from the yearly amount', () => {
    const monthly = PREVIEW_OFFER.price / MONTHS_PER_YEAR
    expect(monthly * MONTHS_PER_YEAR).toBeCloseTo(PREVIEW_OFFER.price, 10)
    expect(pricePerMonth(PREVIEW_OFFER)).toBe('2,92 $')
  })

  // Les équivalents /semaine et /mois se recopient sur l'écriture du store,
  // symbole, position et séparateur compris : c'est ce qui évite d'avoir à
  // tenir une table de devises alors qu'Apple facture déjà dans la monnaie du
  // compte de l'utilisateur.
  it.each([
    ['69,99 $', 5.8325, '5,83 $'],
    ['$69.99', 5.8325, '$5.83'],
    ['69,99 €', 5.8325, '5,83 €'],
    ['￥7000', 583.33, '￥583'],
    ['R$ 349,90', 29.15, 'R$ 29,15'],
  ])('keeps the store spelling of %s', (sample, amount, expected) => {
    expect(formatLikeStore(sample, amount)).toBe(expected)
  })
})
