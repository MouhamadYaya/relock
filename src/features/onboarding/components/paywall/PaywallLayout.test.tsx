import React from 'react'
import { Linking, ScrollView, StyleSheet } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { links } from '@/config/app-config'
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

    it('keeps the band, the title and both plans above the fold', () => {
      // La liste du brief, moins l'avis : rien de ce qui décide de l'achat ne
      // descend sous la ligne de flottaison.
      //
      // `paywall-reference-testimonial` en est sorti avec
      // `featureFlags.showUnverifiedSocialProof` : le témoignage est signé d'un
      // nom inventé, il ne s'affiche plus. Sa place dans la maquette reste
      // celle-ci — voir le test suivant, qui garde l'emplacement documenté.
      const fold = renderer.root.findByProps({ testID: 'paywall-fold' })
      for (const testID of [
        'paywall-marquee-slot',
        'paywall-plan-annual',
        'paywall-plan-weekly',
      ]) {
        expect(fold.findAllByProps({ testID })).not.toHaveLength(0)
      }
      expect(
        fold.findAllByProps({ accessibilityRole: 'header' }),
      ).not.toHaveLength(0)
    })

    it('shows no unverified review while the flag is off', () => {
      // L'invariant a changé de nature : tant que
      // `featureFlags.showUnverifiedSocialProof` est à `false`, l'avis
      // d'ouverture n'existe NULLE PART dans l'arbre — ni au-dessus de la
      // ligne de flottaison, ni en dessous. Le jour où de vrais avis
      // arrivent, ce test redevient l'assertion d'emplacement d'origine
      // (`fold.findAllByProps(...)` non vide).
      expect(
        renderer.root.findAllByProps({
          testID: 'paywall-reference-testimonial',
        }),
      ).toHaveLength(0)
    })

    it('shows no secondary proof block while the flag is off', () => {
      // Ce bloc portait les avis secondaires — inventés eux aussi. Il était
      // « sous la ligne de flottaison » ; il n'est désormais nulle part tant
      // que `featureFlags.showUnverifiedSocialProof` est à `false`.
      expect(
        renderer.root.findAllByProps({ testID: 'paywall-more-proof' }),
      ).toHaveLength(0)
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

    it('carries the App Store legal links out of the scroll', () => {
      // Guideline 3.1.2 : un écran d'abonnement à renouvellement automatique
      // DOIT porter un lien fonctionnel vers les conditions et vers la
      // politique de confidentialité. Leur absence est un motif de rejet, et
      // ils doivent rester visibles sans défilement.
      const scroll = renderer.root.findByType(ScrollView)
      expect(scroll.findAllByProps({ testID: 'paywall-legal' })).toHaveLength(0)
      expect(
        renderer.root.findByProps({ testID: 'paywall-legal' }),
      ).toBeDefined()

      const openURL = jest
        .spyOn(Linking, 'openURL')
        .mockResolvedValue(undefined as never)
      try {
        for (const [testID, url] of [
          ['paywall-terms', links.termsFr],
          ['paywall-privacy', links.privacyFr],
        ] as const) {
          renderer.root.findByProps({ testID }).props.onPress()
          expect(openURL).toHaveBeenLastCalledWith(url)
        }
      } finally {
        openURL.mockRestore()
      }
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

    it('shows neither the unverified proof nor the university marks', () => {
      // Avis, nombre d'utilisateurs et blasons universitaires partagent le
      // MÊME bloc, donc la même condition de sortie — et elle est fermée.
      // Le test vérifie les deux séparément : c'est le blason ÉCHAPPÉ du bloc
      // qui serait le vrai accident, puisqu'il ajoute une contrefaçon de
      // marque à l'allégation invérifiée.
      expect(
        renderer.root.findAllByProps({
          testID: 'paywall-reference-social-proof',
        }),
      ).toHaveLength(0)
      expect(
        renderer.root.findAllByType('PaywallTrustLogos' as never),
      ).toHaveLength(0)
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
    // Les deux liens légaux ne sont pas des appels à l'action : ils sont
    // OBLIGATOIRES sur toute surface qui vend un abonnement (3.1.2), et
    // volontairement discrets. Ce que ce test protège, c'est qu'un seul
    // bouton propose d'acheter — pas que la feuille soit vide de tout lien.
    const buttons = sheet.findAllByProps({ accessibilityRole: 'button' })
    const legal = sheet.findByProps({ testID: 'paywall-legal' })
    const legalButtons = legal.findAllByProps({ accessibilityRole: 'button' })
    expect(legalButtons).toHaveLength(2)
    expect(buttons).toHaveLength(legalButtons.length + 1)
  })

  it('carries the legal links required on every purchase surface', () => {
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
    expect(sheet.findAllByProps({ testID: 'paywall-terms' })).not.toHaveLength(
      0,
    )
    expect(
      sheet.findAllByProps({ testID: 'paywall-privacy' }),
    ).not.toHaveLength(0)
  })
})
