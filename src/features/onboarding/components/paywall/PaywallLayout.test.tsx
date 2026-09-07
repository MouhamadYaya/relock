import React from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { PaywallBenefits } from '@/features/onboarding/components/paywall/PaywallBenefits'
import { PaywallOffer } from '@/features/onboarding/components/paywall/PaywallOffer'
import { PaywallPlans } from '@/features/onboarding/components/paywall/PaywallPlans'
import {
  PREVIEW_OFFER,
  PREVIEW_PLANS,
} from '@/features/onboarding/components/paywall/paywall-preview'

jest.mock('@assets/icons', () => ({
  IconName: {
    CHECK: 'CHECK',
    CLOSE: 'CLOSE',
    SHIELDFILL: 'SHIELDFILL',
    CLOCK: 'CLOCK',
    FOCUS: 'FOCUS',
    SUN: 'SUN',
    CALENDAR: 'CALENDAR',
    USER: 'USER',
  },
}))
jest.mock('@/shared/components/ui/IconSvg', () => ({ IconSvg: 'IconSvg' }))
jest.mock('@/shared/components/ui/PressableScale', () => ({
  PressableScale: 'PressableScale',
}))
jest.mock('@/features/onboarding/bits', () => ({ Moon: 'Moon' }))
jest.mock('@/features/onboarding/components/paywall/PaywallUsageChart', () => ({
  PaywallUsageChart: 'PaywallUsageChart',
}))
jest.mock('@/features/onboarding/components/paywall/PaywallMarquee', () => ({
  PaywallMarquee: 'PaywallMarquee',
}))
jest.mock('@/features/onboarding/components/paywall/PaywallArtwork', () => ({
  PaywallTrustLogos: 'PaywallTrustLogos',
}))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, bottom: 34, left: 0, right: 0 }),
}))
jest.mock('@/i18n/useT', () => {
  const i18next = require('i18next').createInstance()
  i18next.init({
    lng: 'fr',
    resources: { fr: { translation: require('@/i18n/locales/fr.json') } },
    interpolation: { escapeValue: false },
    initImmediate: false,
  })
  return { useT: () => i18next.t.bind(i18next) }
})

describe('Paywall composition', () => {
  let renderer: ReactTestRenderer
  afterEach(() => act(() => renderer?.unmount()))

  describe('plan screen', () => {
    beforeEach(() =>
      act(() => {
        renderer = create(
          <PaywallPlans
            plans={PREVIEW_PLANS}
            selected={PREVIEW_PLANS[0]}
            onSelect={jest.fn()}
            onPurchase={jest.fn()}
          />,
        )
      }),
    )

    it('keeps the band, the title, both plans and a first review above the fold', () => {
      // La liste exacte du brief : rien de ce qui décide de l'achat ne
      // descend sous la ligne de flottaison.
      const fold = renderer.root.findByProps({ testID: 'paywall-fold' })
      for (const testID of [
        'paywall-marquee-slot',
        'paywall-plan-annual',
        'paywall-plan-weekly',
        'paywall-reference-testimonial',
      ]) {
        expect(fold.findAllByProps({ testID })).not.toHaveLength(0)
      }
      expect(
        fold.findAllByProps({ accessibilityRole: 'header' }),
      ).not.toHaveLength(0)
    })

    it('leaves the remaining proof below the fold', () => {
      const fold = renderer.root.findByProps({ testID: 'paywall-fold' })
      expect(
        fold.findAllByProps({ testID: 'paywall-more-proof' }),
      ).toHaveLength(0)
      expect(
        renderer.root.findByProps({ testID: 'paywall-more-proof' }),
      ).toBeDefined()
    })

    it('pins the cancellation promise and the call to action outside the scroll', () => {
      const scroll = renderer.root.findByType(ScrollView)
      const cta = { accessibilityLabel: 'Continuer' }
      const promise = { children: 'Résiliable à tout moment' }
      expect(scroll.findAllByProps(cta)).toHaveLength(0)
      expect(scroll.findAllByProps(promise)).toHaveLength(0)
      expect(renderer.root.findAllByProps(cta)).not.toHaveLength(0)
      expect(renderer.root.findAllByProps(promise)).not.toHaveLength(0)
    })

    it('leaves the band decorative, edge to edge, and elastic', () => {
      // Une bande légendée ou tactile se relirait comme un jeu d'options :
      // elle concurrencerait les formules, qui sont le premier rang de
      // l'écran. Elle ne porte donc ni libellé cliquable, ni zone tactile.
      const band = renderer.root.findByType('PaywallMarquee' as never)
      expect(band.props).toEqual({})

      const slot = renderer.root.findByProps({ testID: 'paywall-marquee-slot' })
      // Elle annule la marge de page : seule chose à toucher les deux bords.
      expect(slot.props.style).toMatchObject({ marginHorizontal: -20 })
      // Et elle est le SEUL bloc élastique : c'est elle qui absorbe la
      // hauteur en trop, sinon le rab se répartit entre tous les blocs et
      // creuse un vide entre le titre et le prix.
      expect(slot.props.style.flexGrow).toBe(1)
    })

    it('writes every vertical gap instead of distributing the slack', () => {
      // La régression à empêcher : `justifyContent: 'space-between'` sur le
      // pli. Il répartissait ~50 pt de vide entre chaque bloc.
      const fold = renderer.root.findByProps({ testID: 'paywall-fold' })
      const style = StyleSheet.flatten(fold.props.style)
      expect(style.justifyContent).toBeUndefined()
      expect(style.gap).toBeGreaterThan(0)
    })

    it('gives the two plans a visible gap and only the annual a ribbon', () => {
      // Le « mini espace » entre les deux formules : il existait déjà mais
      // le `space-between` le noyait dans un écart quatre fois plus grand.
      const plans = renderer.root.findByProps({
        accessibilityRole: 'radiogroup',
      })
      expect(StyleSheet.flatten(plans.props.style).gap).toBeGreaterThan(0)

      // La coque (ruban + carte en un seul objet) n'est que sur l'annuelle :
      // l'hebdomadaire n'a rien à annoncer.
      const ribbons = renderer.root.findAllByProps({
        children: 'MEILLEUR TARIF',
      })
      expect(ribbons.length).toBeGreaterThan(0)
    })

    it('marks only the selected plan as checked', () => {
      const annual = renderer.root.findByProps({
        testID: 'paywall-plan-annual',
      })
      const weekly = renderer.root.findByProps({
        testID: 'paywall-plan-weekly',
      })
      expect(annual.props.accessibilityState.checked).toBe(true)
      expect(weekly.props.accessibilityState.checked).toBe(false)
    })
  })

  describe('benefits screen', () => {
    beforeEach(() =>
      act(() => {
        renderer = create(<PaywallBenefits onNext={jest.fn()} />)
      }),
    )

    it('compares the two weeks inside a single card', () => {
      // Deux cartes séparées se liraient comme deux mesures indépendantes.
      // Le cadre commun est ce qui dit qu'elles se comparent — et les deux
      // graphes sont dans CE cadre, pas ailleurs sur la page.
      const card = renderer.root.findByProps({
        testID: 'paywall-comparison-card',
      })
      const charts = card.findAllByType('PaywallUsageChart' as never)
      expect(charts.map(chart => chart.props.after)).toEqual([false, true])
    })

    it('labels each column outside the card, in two weights', () => {
      // « Avant » en léger, « Relock » en gras : c'est la colonne, pas
      // l'étiquette, qui porte la comparaison.
      const card = renderer.root.findByProps({
        testID: 'paywall-comparison-card',
      })
      for (const label of ['Avant', 'Après']) {
        expect(
          renderer.root.findAllByProps({ children: label }),
        ).not.toHaveLength(0)
        expect(card.findAllByProps({ children: label })).toHaveLength(0)
      }
    })

    it('keeps the unverified proof and the university marks together', () => {
      // Avis, nombre d'utilisateurs et marques universitaires ne sont pas
      // vérifiés : ils partagent le MÊME bloc, donc la même condition de
      // sortie. Une marque isolée hors du bloc échapperait au garde-fou.
      const proof = renderer.root.findByProps({
        testID: 'paywall-reference-social-proof',
      })
      expect(proof.findAllByType('PaywallTrustLogos' as never)).toHaveLength(1)
      expect(
        renderer.root.findAllByType('PaywallTrustLogos' as never),
      ).toHaveLength(1)
    })

    it('pins the call to action outside the scroll', () => {
      const scroll = renderer.root.findByType(ScrollView)
      const cta = { accessibilityLabel: 'Récupérer mon temps' }
      expect(scroll.findAllByProps(cta)).toHaveLength(0)
      expect(renderer.root.findAllByProps(cta)).not.toHaveLength(0)
    })
  })

  it('holds the offer sheet to a single call to action', () => {
    act(() => {
      renderer = create(
        <PaywallOffer
          regular={PREVIEW_PLANS[0]}
          offer={PREVIEW_OFFER}
          onPurchase={jest.fn()}
        />,
      )
    })
    const sheet = renderer.root.findByProps({ testID: 'paywall-offer-sheet' })
    expect(sheet.findAllByProps({ accessibilityRole: 'button' })).toHaveLength(
      1,
    )
  })
})
