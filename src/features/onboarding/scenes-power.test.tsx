import React from 'react'
import { Linking } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { ScenePermission } from '@/features/onboarding/scenes-power'
import { translate } from '@/i18n/translate'
import { ScreenTime } from '@/shared/native/screen-time'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))
jest.mock('react-native-gesture-handler', () => ({}))
jest.mock('@/features/onboarding/motion', () => ({ Reveal: 'Reveal' }))
jest.mock('@/features/onboarding/bits', () => ({
  GhostLink: 'GhostLink',
  GuideCard: 'GuideCard',
  RedAlert: 'RedAlert',
  Pill: 'Pill',
  StudyLine: 'StudyLine',
  HaloBackdrop: 'HaloBackdrop',
}))
// La scène importe le paywall par le même module ; il tire RevenueCat, que
// Jest ne transforme pas. Rien de ce qui suit n'est exercé par ces tests.
jest.mock('@/features/onboarding/components/paywall/PaywallFlow', () => ({
  PaywallFlow: 'PaywallFlow',
}))
jest.mock('@/features/onboarding/services/revenuecat', () => ({
  hasRelockProEntitlement: jest.fn(),
  isRevenueCatEnabled: jest.fn(() => false),
  loadPaywallCatalog: jest.fn(),
  paywallPurchaseWithRevenueCat: jest.fn(),
  restoreRevenueCatPurchases: jest.fn(),
}))
jest.mock('@/features/notifications/notification.service', () => ({
  NotificationService: { ensurePermission: jest.fn() },
}))
jest.mock('@/shared/native/screen-time', () => ({
  ScreenTime: {
    isAvailable: true,
    authorizationStatus: jest.fn(),
    requestAuthorization: jest.fn(),
  },
}))

const screenTime = ScreenTime as unknown as {
  authorizationStatus: jest.Mock
  requestAuthorization: jest.Mock
}

/** Le bouton « autoriser » de la carte-guide, celui qui ouvre la fenêtre iOS. */
function pressAllow(renderer: ReactTestRenderer) {
  const card = renderer.root.findByType(
    'GuideCard' as unknown as React.ElementType,
  )
  return act(async () => {
    await card.props.onActivePress()
  })
}

/** Le libellé du bouton lumineux de la carte-guide. */
function allowLabel(renderer: ReactTestRenderer) {
  return renderer.root.findByType('GuideCard' as unknown as React.ElementType)
    .props.leftLabel
}

/** Le lien de sortie, s'il est monté. */
function escapeLinks(renderer: ReactTestRenderer) {
  return renderer.root.findAllByType(
    'GhostLink' as unknown as React.ElementType,
  )
}

/**
 * L'écran d'autorisation Temps d'écran ne doit JAMAIS enfermer.
 *
 * Ce qui rend ces tests nécessaires : on arrive ici APRÈS le paiement, et
 * l'écran n'a ni barre de navigation ni bouton retour. Tant qu'il n'exposait
 * qu'une action — « Réessayer », puis « Ouvrir les Réglages » en boucle —
 * quiconque refusait deux fois était coincé dans une app qu'il venait
 * d'acheter. Un reviewer Apple qui éprouve les chemins d'erreur tombe
 * exactement là, et ça se solde par un rejet 2.1.
 *
 * La sortie n'apparaît qu'au SECOND refus, et c'est délibéré : au premier,
 * iOS represente son dialogue, donc insister a encore un sens.
 */
/**
 * Le bouton ne doit JAMAIS devenir « Ouvrir Réglages ».
 *
 * Il l'est devenu au second refus, et c'est là que le parcours cassait :
 * `Linking.openSettings()` ouvre la fiche Réglages de Relock, où l'accès
 * Temps d'écran ne figure pas — il vit dans Réglages › Temps d'écran. On
 * arrivait donc sur une page d'autorisations toutes déjà accordées, sans
 * savoir quoi y activer. Redemander l'autorisation est la seule action qui
 * puisse encore aboutir ; on la garde à chaque appui.
 */
describe('ScenePermission — on redemande, on n’envoie pas aux Réglages', () => {
  let renderer: ReactTestRenderer
  const openSettings = jest
    .spyOn(Linking, 'openSettings')
    .mockResolvedValue(undefined)

  beforeEach(() => {
    jest.clearAllMocks()
    screenTime.authorizationStatus.mockResolvedValue('notDetermined')
    screenTime.requestAuthorization.mockResolvedValue('denied')
  })

  afterEach(() => {
    act(() => renderer.unmount())
  })

  it('redemande l’autorisation à chaque appui, sans jamais ouvrir Réglages', async () => {
    act(() => {
      renderer = create(
        <ScenePermission onNext={jest.fn()} onSkip={jest.fn()} />,
      )
    })

    await pressAllow(renderer)
    await pressAllow(renderer)
    await pressAllow(renderer)
    await pressAllow(renderer)

    expect(screenTime.requestAuthorization).toHaveBeenCalledTimes(4)
    expect(openSettings).not.toHaveBeenCalled()
  })

  it('bascule sur « Réessayer » au premier refus et n’en bouge plus', async () => {
    act(() => {
      renderer = create(
        <ScenePermission onNext={jest.fn()} onSkip={jest.fn()} />,
      )
    })
    expect(allowLabel(renderer)).toBe(translate('paywall.continue'))

    await pressAllow(renderer)
    expect(allowLabel(renderer)).toBe(translate('common.retry'))

    await pressAllow(renderer)
    await pressAllow(renderer)
    expect(allowLabel(renderer)).toBe(translate('common.retry'))
    expect(allowLabel(renderer)).not.toBe(
      translate('home.permission_open_settings'),
    )
  })

  it('avance encore si l’autorisation est accordée au troisième essai', async () => {
    const onNext = jest.fn()
    act(() => {
      renderer = create(<ScenePermission onNext={onNext} onSkip={jest.fn()} />)
    })
    await pressAllow(renderer)
    await pressAllow(renderer)
    screenTime.requestAuthorization.mockResolvedValue('approved')
    await pressAllow(renderer)

    expect(onNext).toHaveBeenCalledTimes(1)
  })
})

describe('ScenePermission — la porte de sortie', () => {
  let renderer: ReactTestRenderer

  beforeEach(() => {
    jest.clearAllMocks()
    screenTime.authorizationStatus.mockResolvedValue('notDetermined')
    screenTime.requestAuthorization.mockResolvedValue('denied')
  })

  afterEach(() => {
    act(() => renderer.unmount())
  })

  it('ne propose aucune sortie tant que rien n’a été refusé', () => {
    act(() => {
      renderer = create(
        <ScenePermission onNext={jest.fn()} onSkip={jest.fn()} />,
      )
    })
    // Seul « En savoir plus » vit sur cet écran au repos.
    expect(escapeLinks(renderer)).toHaveLength(1)
  })

  it('ne propose toujours pas de sortie après UN seul refus', async () => {
    act(() => {
      renderer = create(
        <ScenePermission onNext={jest.fn()} onSkip={jest.fn()} />,
      )
    })
    await pressAllow(renderer)
    expect(escapeLinks(renderer)).toHaveLength(1)
  })

  it('ouvre la sortie au SECOND refus, et elle appelle onSkip', async () => {
    const onSkip = jest.fn()
    act(() => {
      renderer = create(<ScenePermission onNext={jest.fn()} onSkip={onSkip} />)
    })
    await pressAllow(renderer)
    await pressAllow(renderer)

    const links = escapeLinks(renderer)
    expect(links).toHaveLength(2)

    act(() => {
      // Le premier lien est la sortie ; « En savoir plus » reste en bas.
      links[0].props.onPress()
    })
    expect(onSkip).toHaveBeenCalledTimes(1)
  })

  it('reste un cul-de-sac assumé quand aucun onSkip n’est fourni', async () => {
    // Le garde-fou du garde-fou : si un appelant oublie de câbler la sortie,
    // rien ne doit s'afficher à moitié (un lien mort vaut moins que pas de
    // lien). C'est aussi ce qui laisse la scène réutilisable ailleurs.
    act(() => {
      renderer = create(<ScenePermission onNext={jest.fn()} />)
    })
    await pressAllow(renderer)
    await pressAllow(renderer)
    expect(escapeLinks(renderer)).toHaveLength(1)
  })

  it('avance normalement dès que l’autorisation est accordée', async () => {
    const onNext = jest.fn()
    screenTime.requestAuthorization.mockResolvedValue('approved')
    act(() => {
      renderer = create(<ScenePermission onNext={onNext} onSkip={jest.fn()} />)
    })
    await pressAllow(renderer)
    expect(onNext).toHaveBeenCalledTimes(1)
    expect(escapeLinks(renderer)).toHaveLength(1)
  })
})
