import React from 'react'
import { ScrollView } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
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
  },
}))
jest.mock('@/shared/components/ui/IconSvg', () => ({ IconSvg: 'IconSvg' }))
jest.mock('@/shared/components/ui/PressableScale', () => ({
  PressableScale: 'PressableScale',
}))
jest.mock('@/features/onboarding/bits', () => ({ Moon: 'Moon' }))
jest.mock('@/features/onboarding/components/paywall/PaywallArtwork', () => ({
  PaywallTiles: 'PaywallTiles',
  PaywallComparisonPhoto: 'PaywallComparisonPhoto',
  PaywallBenefitThumb: 'PaywallBenefitThumb',
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
            onRestore={jest.fn()}
          />,
        )
      }),
    )

    it('keeps the title, the four visuals, both plans and a first review above the fold', () => {
      // La liste exacte du brief : rien de ce qui décide de l'achat ne
      // descend sous la ligne de flottaison.
      const fold = renderer.root.findByProps({ testID: 'paywall-fold' })
      for (const testID of [
        'paywall-tiles-slot',
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

    it('leaves the four visuals decorative', () => {
      // Quatre visuels légendés ou tactiles se reliraient comme quatre
      // options : ils concurrenceraient les formules, qui sont le premier
      // rang de l'écran. La grille ne porte donc ni libellé ni rappel.
      const tiles = renderer.root.findByType('PaywallTiles' as never)
      expect(tiles.props).toEqual({})
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
