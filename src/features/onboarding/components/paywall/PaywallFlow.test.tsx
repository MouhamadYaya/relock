import React from 'react'
import { Alert, Modal, ScrollView, View } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { PaywallBenefits } from '@/features/onboarding/components/paywall/PaywallBenefits'
import { PaywallExitOffer } from '@/features/onboarding/components/paywall/PaywallExitOffer'
import { PaywallFlow } from '@/features/onboarding/components/paywall/PaywallFlow'
import { PaywallOffer } from '@/features/onboarding/components/paywall/PaywallOffer'
import { PaywallPlans } from '@/features/onboarding/components/paywall/PaywallPlans'
import {
  PREVIEW_OFFER,
  PREVIEW_PLANS,
} from '@/features/onboarding/components/paywall/paywall-preview'
import type {
  PaywallPurchase,
  PaywallPurchaseResult,
  PaywallRestore,
  PaywallRestoreResult,
} from '@/features/onboarding/types/paywall'

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
  PaywallBackdrop: 'PaywallBackdrop',
  PaywallField: 'PaywallField',
  PaywallSparkle: 'PaywallSparkle',
  PaywallTrustLogos: 'PaywallTrustLogos',
}))
jest.mock('@/features/onboarding/components/paywall/PaywallPrimitives', () => ({
  PaywallBanner: 'PaywallBanner',
  PaywallButton: 'PaywallButton',
  PaywallClose: 'PaywallClose',
  PaywallOutlineButton: 'PaywallOutlineButton',
  PaywallEyebrow: 'PaywallEyebrow',
  PaywallMark: 'PaywallMark',
  PaywallPrice: 'PaywallPrice',
  PaywallRibbon: 'PaywallRibbon',
  PaywallStars: 'PaywallStars',
  PaywallTextButton: 'PaywallTextButton',
  PaywallWordmark: 'PaywallWordmark',
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

describe('Reference paywall and strictly separated offers', () => {
  let renderer: ReactTestRenderer
  const skip = jest.fn()
  const success = jest.fn()
  const signIn = jest.fn()
  const originalDev = __DEV__
  const mount = (
    purchase?: PaywallPurchase,
    offer: typeof PREVIEW_OFFER | null = PREVIEW_OFFER,
  ) =>
    act(() => {
      renderer = create(
        <PaywallFlow
          plans={PREVIEW_PLANS}
          offer={offer}
          onSkip={skip}
          purchase={purchase}
          onPurchaseSuccess={success}
        />,
      )
    })
  const openPlans = () =>
    act(() => renderer.root.findByType(PaywallBenefits).props.onNext())
  const press = (label: string) =>
    act(() => renderer.root.findByProps({ label }).props.onPress())
  /**
   * La sortie de l'écran des formules est désormais une croix posée sur le
   * bandeau, plus un bouton « Passer ». Deux croix coexistent à l'écran (la
   * feuille d'offre a la sienne), d'où le testID.
   */
  /** Le bouton « Restaurer » de la barre, désormais hors de `PaywallPlans`. */
  const restoreButton = () =>
    renderer.root
      .findByProps({ testID: 'paywall-restore' })
      .findByType('PaywallTextButton' as never)
  const dismiss = () =>
    act(() =>
      renderer.root
        .findByProps({ testID: 'paywall-plans-close' })
        .props.onPress(),
    )
  const sheetVisible = () => renderer.root.findByType(Modal).props.visible
  const buy = () =>
    act(async () => {
      await renderer.root.findByType(PaywallPlans).props.onPurchase()
      await Promise.resolve()
    })

  beforeEach(() => {
    skip.mockClear()
    success.mockClear()
    signIn.mockClear()
    jest.spyOn(Alert, 'alert').mockImplementation(() => {})
  })
  afterEach(() => {
    act(() => renderer?.unmount())
    Object.defineProperty(global, '__DEV__', {
      value: originalDev,
      configurable: true,
      writable: true,
    })
    jest.restoreAllMocks()
  })

  it('keeps the selected weekly plan without opening either offer', () => {
    mount(jest.fn())
    openPlans()
    act(() =>
      renderer.root.findByType(PaywallPlans).props.onSelect(PREVIEW_PLANS[1]),
    )
    expect(renderer.root.findByType(PaywallPlans).props.selected.id).toBe(
      'weekly',
    )
    expect(sheetVisible()).toBe(false)
    expect(renderer.root.findAllByType(PaywallExitOffer)).toHaveLength(0)
  })

  it('shows the exit offer on dismiss in a production build too', () => {
    // Le garde-fou d'origine réservait cet écran à `__DEV__` : en production,
    // la croix sortait directement et l'offre de rattrapage n'existait pas.
    Object.defineProperty(global, '__DEV__', {
      value: false,
      configurable: true,
      writable: true,
    })
    act(() => {
      renderer = create(
        <PaywallFlow
          plans={PREVIEW_PLANS}
          offer={PREVIEW_OFFER}
          onSkip={skip}
          purchase={jest.fn()}
          onPurchaseSuccess={success}
          allowPurchases
        />,
      )
    })
    openPlans()
    dismiss()
    expect(renderer.root.findByType(PaywallExitOffer)).toBeDefined()
    expect(skip).not.toHaveBeenCalled()
  })

  it('leaves straight away when the store has no discounted product', () => {
    mount(jest.fn(), null)
    openPlans()
    dismiss()
    expect(renderer.root.findAllByType(PaywallExitOffer)).toHaveLength(0)
    expect(skip).toHaveBeenCalledTimes(1)
  })

  it('never opens the cancellation sheet without a discounted product', async () => {
    const purchase = jest
      .fn()
      .mockResolvedValue({ status: 'cancelled', storeSheetPresented: true })
    mount(purchase, null)
    openPlans()
    await buy()
    expect(sheetVisible()).toBe(false)
  })

  it('shows the full 80% reference only on dismiss; declining returns to the plans', () => {
    mount(jest.fn())
    openPlans()
    dismiss()
    expect(sheetVisible()).toBe(false)
    const offer = renderer.root.findByType(PaywallExitOffer)
    act(() => {
      offer.props.onClose()
      offer.props.onClose()
    })
    // Fermer l'offre ne fait pas sauter le paywall : on retombe sur les
    // formules, et personne n'est sorti de l'onboarding.
    expect(skip).not.toHaveBeenCalled()
    expect(renderer.root.findAllByType(PaywallExitOffer)).toHaveLength(0)
    expect(renderer.root.findByType(PaywallPlans)).toBeDefined()
  })

  it('leaves on the second dismiss, without replaying the offer', () => {
    mount(jest.fn())
    openPlans()
    dismiss()
    act(() => renderer.root.findByType(PaywallExitOffer).props.onClose())
    dismiss()
    expect(renderer.root.findAllByType(PaywallExitOffer)).toHaveLength(0)
    expect(skip).toHaveBeenCalledTimes(1)
  })

  it('keeps the full 80% offer on one non-scrollable screen', () => {
    let offerRenderer!: ReactTestRenderer
    act(() => {
      offerRenderer = create(
        <PaywallExitOffer
          regular={PREVIEW_PLANS[0]}
          offer={PREVIEW_OFFER}
          onClose={jest.fn()}
          onPurchase={jest.fn()}
        />,
      )
    })

    expect(
      offerRenderer.root.findByProps({ testID: 'paywall-offer-full' }).type,
    ).toBe(View)
    expect(offerRenderer.root.findAllByType(ScrollView)).toHaveLength(0)
    expect(
      offerRenderer.root.findByProps({ testID: 'paywall-exit-plan' }),
    ).toBeDefined()

    act(() => offerRenderer.unmount())
  })

  it('offers a development-only Fenêtre preview which closes back to the same plan', () => {
    mount(jest.fn())
    openPlans()
    press('Aperçu de l’offre')
    expect(sheetVisible()).toBe(true)
    expect(renderer.root.findAllByType(PaywallExitOffer)).toHaveLength(0)
    act(() => renderer.root.findByType(Modal).props.onRequestClose())
    expect(sheetVisible()).toBe(false)
    expect(skip).not.toHaveBeenCalled()
  })

  it('never renders a paywall at all when billing is absent', () => {
    // Sans adaptateur de facturation, l'écran ne se contente plus de refuser
    // l'achat : il ne montre NI tarif, NI preuve sociale, NI offre. Rien de
    // ce qui ressemble à une vente ne peut s'afficher sans branchement réel.
    mount()
    expect(
      renderer.root.findByProps({ testID: 'paywall-unavailable' }),
    ).toBeDefined()
    expect(renderer.root.findAllByType(PaywallPlans)).toHaveLength(0)
    expect(renderer.root.findAllByType(PaywallBenefits)).toHaveLength(0)
    expect(renderer.root.findAllByType(PaywallExitOffer)).toHaveLength(0)
    expect(renderer.root.findAllByType(Modal)).toHaveLength(0)
    expect(success).not.toHaveBeenCalled()
  })

  it('reports a restore as unavailable while no restore adapter is wired', async () => {
    mount(jest.fn())
    openPlans()
    // `handleRestore` est asynchrone : un `act` synchrone laisserait une
    // portée ouverte, et c'est le renderer du test SUIVANT que React
    // démonterait.
    await act(async () => {
      await renderer.root.findByProps({ label: 'Restaurer' }).props.onPress()
    })
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Relock',
      expect.stringContaining('La restauration n’est pas disponible'),
      expect.any(Array),
    )
  })

  it('keeps the restore action visible in a production build', () => {
    // La restauration vivait dans le bloc de preuve `__DEV__` : en production
    // elle disparaissait, alors que le store en exige une. Les témoignages et
    // l'aperçu d'offre, eux, restent réservés au développement.
    Object.defineProperty(global, '__DEV__', {
      value: false,
      configurable: true,
      writable: true,
    })
    act(() => {
      renderer = create(
        <PaywallFlow
          plans={PREVIEW_PLANS}
          offer={PREVIEW_OFFER}
          onSkip={skip}
          purchase={jest.fn()}
          onRestore={jest.fn()}
          allowPurchases
        />,
      )
    })
    openPlans()

    expect(
      renderer.root.findByProps({ testID: 'paywall-restore' }),
    ).toBeDefined()
    expect(renderer.root.findByProps({ label: 'Restaurer' })).toBeDefined()
    expect(
      renderer.root.findAllByProps({ testID: 'paywall-more-proof' }),
    ).toHaveLength(0)
    expect(
      renderer.root.findAllByProps({ label: 'Aperçu de l’offre' }),
    ).toHaveLength(0)
  })

  it('never runs a purchase while a restore is in flight, and says what came back', async () => {
    let release: (result: PaywallRestoreResult) => void = () => {}
    const restore = jest.fn(
      () =>
        new Promise<PaywallRestoreResult>(resolve => {
          release = resolve
        }),
    )
    const purchase = jest.fn()
    act(() => {
      renderer = create(
        <PaywallFlow
          plans={PREVIEW_PLANS}
          offer={PREVIEW_OFFER}
          onSkip={skip}
          purchase={purchase}
          onRestore={restore}
          allowPurchases
        />,
      )
    })
    openPlans()

    act(() => {
      restoreButton().props.onPress()
    })
    expect(restoreButton().props.disabled).toBe(true)
    expect(restoreButton().props.label).toBe('Traitement…')

    // Pendant la restauration : ni achat, ni seconde restauration.
    await act(async () => {
      await renderer.root.findByType(PaywallPlans).props.onPurchase()
      restoreButton().props.onPress()
    })
    expect(purchase).not.toHaveBeenCalled()
    expect(restore).toHaveBeenCalledTimes(1)

    await act(async () => {
      release('none')
      await Promise.resolve()
    })
    expect(restoreButton().props.disabled).toBe(false)
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Relock',
      expect.stringContaining('Aucun achat à restaurer'),
      expect.any(Array),
    )
  })

  it('reports a failed restore without leaving the screen stuck', async () => {
    const restore = jest.fn().mockRejectedValue(new Error('store down'))
    act(() => {
      renderer = create(
        <PaywallFlow
          plans={PREVIEW_PLANS}
          offer={PREVIEW_OFFER}
          onSkip={skip}
          purchase={jest.fn()}
          onRestore={restore}
          allowPurchases
        />,
      )
    })
    openPlans()

    await act(async () => {
      await restoreButton().props.onPress()
    })

    expect(restoreButton().props.disabled).toBe(false)
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Relock',
      expect.stringContaining('paiement'),
      expect.any(Array),
    )
  })

  const mountWithRestore = (onRestore: PaywallRestore) =>
    act(() => {
      renderer = create(
        <PaywallFlow
          plans={PREVIEW_PLANS}
          offer={PREVIEW_OFFER}
          onSkip={skip}
          purchase={jest.fn()}
          onPurchaseSuccess={success}
          onRestore={onRestore}
        />,
      )
    })
  const pressRestore = async () => {
    await act(async () => {
      await renderer.root.findByProps({ label: 'Restaurer' }).props.onPress()
    })
  }

  it('warns the user when the store restores no active subscription', async () => {
    const onRestore = jest.fn().mockResolvedValue('none')
    mountWithRestore(onRestore)
    openPlans()
    await pressRestore()
    expect(onRestore).toHaveBeenCalledTimes(1)
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Relock',
      expect.stringContaining('Aucun achat à restaurer'),
      expect.any(Array),
    )
  })

  it('stays silent when the restore succeeds', async () => {
    const onRestore = jest.fn().mockResolvedValue('restored')
    mountWithRestore(onRestore)
    openPlans()
    await pressRestore()
    expect(onRestore).toHaveBeenCalledTimes(1)
    expect(Alert.alert).not.toHaveBeenCalled()
  })

  it('reports a store failure as retryable instead of an empty account', async () => {
    const onRestore = jest.fn().mockResolvedValue('failed')
    mountWithRestore(onRestore)
    openPlans()
    await pressRestore()
    expect(Alert.alert).toHaveBeenLastCalledWith(
      'Relock',
      expect.not.stringContaining('Aucun achat à restaurer'),
      expect.any(Array),
    )
  })

  it('opens 50% only after a real-store-sheet cancellation and sends the selected plan', async () => {
    const purchase = jest
      .fn()
      .mockResolvedValue({ status: 'cancelled', storeSheetPresented: true })
    mount(purchase)
    openPlans()
    act(() =>
      renderer.root.findByType(PaywallPlans).props.onSelect(PREVIEW_PLANS[1]),
    )
    await buy()
    expect(purchase).toHaveBeenCalledWith(PREVIEW_PLANS[1], 'plans')
    expect(sheetVisible()).toBe(true)
    expect(renderer.root.findAllByType(PaywallExitOffer)).toHaveLength(0)
    expect(skip).not.toHaveBeenCalled()
  })

  it.each<PaywallPurchaseResult>([
    { status: 'cancelled', storeSheetPresented: false },
    { status: 'failed' },
    { status: 'pending' },
    { status: 'purchased' },
  ])('does not show a cancellation offer for %j', async result => {
    mount(jest.fn().mockResolvedValue(result))
    openPlans()
    await buy()
    expect(sheetVisible()).toBe(false)
    expect(renderer.root.findAllByType(PaywallExitOffer)).toHaveLength(0)
    expect(success).toHaveBeenCalledTimes(result.status === 'purchased' ? 1 : 0)
  })

  it('does not treat an exception as cancellation', async () => {
    mount(jest.fn().mockRejectedValue(new Error('offline')))
    openPlans()
    await buy()
    expect(sheetVisible()).toBe(false)
    expect(Alert.alert).toHaveBeenCalled()
  })

  it('does not show the offer repeatedly after another payment cancellation', async () => {
    mount(
      jest
        .fn()
        .mockResolvedValue({ status: 'cancelled', storeSheetPresented: true }),
    )
    openPlans()
    await buy()
    act(() => renderer.root.findByType(Modal).props.onRequestClose())
    await buy()
    expect(sheetVisible()).toBe(false)
  })

  it('cancelling purchase on the full offer does not open the 50% sheet', async () => {
    const purchase = jest
      .fn()
      .mockResolvedValue({ status: 'cancelled', storeSheetPresented: true })
    mount(purchase)
    openPlans()
    dismiss()
    await act(async () => {
      await renderer.root.findByType(PaywallExitOffer).props.onPurchase()
      await Promise.resolve()
    })
    // L'écran de sortie achète le produit remisé du store, pas une copie
    // retaguée : c'est ce qui garantit que le prix lu est le prix débité.
    expect(purchase).toHaveBeenCalledWith(PREVIEW_OFFER, 'exit-offer')
    expect(sheetVisible()).toBe(false)
    expect(skip).not.toHaveBeenCalled()
  })

  it('cancelling purchase on the sheet preserves it without adding another offer', async () => {
    const purchase = jest
      .fn()
      .mockResolvedValue({ status: 'cancelled', storeSheetPresented: true })
    mount(purchase)
    openPlans()
    press('Aperçu de l’offre')
    await act(async () => {
      await renderer.root.findByType(PaywallOffer).props.onPurchase()
      await Promise.resolve()
    })
    expect(purchase).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'annual-offer' }),
      'cancel-offer',
    )
    expect(sheetVisible()).toBe(true)
    expect(renderer.root.findAllByType(PaywallExitOffer)).toHaveLength(0)
  })

  it('locks duplicate purchases, selection and close while the sheet is pending', async () => {
    let resolve: (result: PaywallPurchaseResult) => void = () => {}
    const purchase = jest.fn(
      () =>
        new Promise<PaywallPurchaseResult>(done => {
          resolve = done
        }),
    )
    mount(purchase)
    openPlans()
    act(() => {
      renderer.root.findByType(PaywallPlans).props.onPurchase()
      renderer.root.findByType(PaywallPlans).props.onPurchase()
    })
    dismiss()
    expect(purchase).toHaveBeenCalledTimes(1)
    expect(renderer.root.findAllByType(PaywallExitOffer)).toHaveLength(0)
    await act(async () => {
      resolve({ status: 'cancelled', storeSheetPresented: true })
      await Promise.resolve()
    })
    expect(sheetVisible()).toBe(true)
  })

  it('does not expose prototype prices, social proof or offers in production', () => {
    Object.defineProperty(global, '__DEV__', {
      value: false,
      configurable: true,
      writable: true,
    })
    mount()
    expect(renderer.root.findAllByType(PaywallPlans)).toHaveLength(0)
    expect(renderer.root.findAllByType(PaywallBenefits)).toHaveLength(0)
    expect(renderer.root.findAllByType(PaywallOffer)).toHaveLength(0)
    expect(
      renderer.root.findByProps({ testID: 'paywall-unavailable' }),
    ).toBeDefined()
    press('Continuer')
    expect(skip).toHaveBeenCalledTimes(1)
  })

  /**
   * La porte dure. « Passer » et la croix restent à l'écran — c'est une
   * technique de conversion assumée : ils mènent à l'offre de rattrapage,
   * jamais dehors. Seuls un achat, une restauration ou la connexion à un
   * compte abonné ouvrent, et c'est le gate de `app/_layout.tsx` qui le fait.
   */
  describe('porte dure (escapable={false})', () => {
    const mountLocked = (initialScreen: 'benefits' | 'plans' = 'benefits') =>
      act(() => {
        renderer = create(
          <PaywallFlow
            plans={PREVIEW_PLANS}
            offer={PREVIEW_OFFER}
            onSkip={skip}
            purchase={jest.fn()}
            onPurchaseSuccess={success}
            onSignIn={signIn}
            initialScreen={initialScreen}
            escapable={false}
          />,
        )
      })

    it('ne laisse jamais sortir : « Passer » boucle sur l’offre puis le pitch', () => {
      mountLocked()
      openPlans()
      // 1er « Passer » → l'offre de rattrapage.
      dismiss()
      expect(renderer.root.findAllByType(PaywallExitOffer)).toHaveLength(1)
      // Refus → retour aux tarifs.
      act(() => renderer.root.findByType(PaywallExitOffer).props.onClose())
      expect(renderer.root.findAllByType(PaywallPlans)).toHaveLength(1)
      // 2e « Passer » → le pitch, PAS la sortie.
      dismiss()
      expect(renderer.root.findAllByType(PaywallBenefits)).toHaveLength(1)
      expect(skip).not.toHaveBeenCalled()

      // …et l'offre redevient disponible au tour suivant : sinon « Passer »
      // ne mènerait plus nulle part et l'illusion tomberait.
      openPlans()
      dismiss()
      expect(renderer.root.findAllByType(PaywallExitOffer)).toHaveLength(1)
      expect(skip).not.toHaveBeenCalled()
    })

    it('ouvre directement sur les tarifs à partir de la 2ᵉ présentation', () => {
      mountLocked('plans')
      expect(renderer.root.findAllByType(PaywallBenefits)).toHaveLength(0)
      expect(renderer.root.findAllByType(PaywallPlans)).toHaveLength(1)
    })

    it('offre une porte de sortie à l’abonné qui a réinstallé', () => {
      // Le lien vit sur l'écran « indisponible », pas dans la barre du
      // paywall : là-bas « Restaurer » couvre déjà ce besoin, et l'écran
      // sans catalogue est le seul vrai cul-de-sac du parcours.
      act(() => {
        renderer = create(
          <PaywallFlow
            plans={PREVIEW_PLANS}
            offer={PREVIEW_OFFER}
            onSkip={skip}
            onRestore={jest.fn()}
            onSignIn={signIn}
            escapable={false}
          />,
        )
      })
      expect(
        renderer.root.findByProps({ testID: 'paywall-unavailable' }),
      ).toBeDefined()
      act(() =>
        renderer.root
          .findByProps({ testID: 'paywall-sign-in' })
          .props.onPress(),
      )
      expect(signIn).toHaveBeenCalledTimes(1)
    })

    it('ne met aucun lien « J’ai déjà un compte » dans la barre du paywall', () => {
      mountLocked('plans')
      expect(
        renderer.root.findAllByProps({ testID: 'paywall-sign-in' }),
      ).toHaveLength(0)
    })
  })
})
