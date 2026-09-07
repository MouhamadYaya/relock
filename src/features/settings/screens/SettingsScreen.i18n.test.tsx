import React from 'react'
import { StyleSheet, Text } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import SettingsScreen from '@/features/settings/screens/SettingsScreen'
import i18n from '@/i18n/i18n'
import { settingsTheme } from '@/shared/theme'

/**
 * Le filet contre l'écran « cassé » le plus courant : une clé i18n absente.
 *
 * `t('settings.foo')` sans traduction ne lève rien — il rend la clé
 * elle-même. À l'écran, une rangée affiche alors littéralement
 * « settings.foo », et le bug traverse la revue, les tests unitaires (qui
 * neutralisent `useT`) et la recette, parce que rien n'échoue.
 *
 * Ce test monte l'écran avec les VRAIES traductions et refuse tout texte qui
 * ressemble à une clé. Il le fait pour les quatre langues : une clé oubliée
 * dans `ru.json` seulement se verrait sinon uniquement chez les
 * russophones.
 */

jest.mock('expo-router', () => {
  const { useEffect } = require('react')
  return {
    router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn() },
    // Le vrai hook se déclenche à chaque prise de focus, montage compris :
    // le reproduire par un `useEffect` conserve la lecture au montage.
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  }
})

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock('@/shared/components/ui/IconSvg', () => {
  const { View } = require('react-native')
  return { IconSvg: () => <View /> }
})

jest.mock('@/shared/components/ui/ScreenWrapper', () => {
  const { View } = require('react-native')
  return {
    ScreenWrapper: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  }
})

jest.mock('@/shared/components/ui/RelockWordmark', () => {
  const { View } = require('react-native')
  return { RelockWordmark: () => <View /> }
})

jest.mock('@/features/user/hooks/useProfile', () => ({
  useProfile: () => ({
    name: 'Yaya',
    displayName: 'Yaya',
    email: 'yaya@example.com',
    avatar: null,
    birthDate: null,
    createdAt: null,
    isLoading: false,
  }),
}))

jest.mock('@/features/onboarding/services/revenuecat', () => ({
  isRevenueCatEnabled: () => true,
  openRevenueCatCustomerCenter: jest.fn(),
  restoreRevenueCatPurchases: jest.fn(),
}))

jest.mock('@/features/auth/services/auth/auth.service', () => ({
  AuthService: { logout: jest.fn() },
}))

jest.mock('@/session/bootstrap', () => ({
  resetOnboarding: jest.fn(),
  syncEntitlement: jest.fn(),
  signOutToAuth: jest.fn(),
}))

jest.mock('@/features/notifications/notification.service', () => ({
  NotificationService: {
    ensurePermission: jest.fn().mockResolvedValue(true),
    reconcileFromLast: jest.fn().mockResolvedValue(undefined),
  },
}))

jest.mock('@/shared/native/notifications', () => ({
  Notif: {
    isAvailable: true,
    // « refusée » : c'est l'état qui fait APPARAÎTRE la ligne de permission,
    // donc celui qui met le plus de texte à l'écran.
    permissionStatus: jest.fn().mockResolvedValue('denied'),
  },
}))

jest.mock('@/shared/native/screen-time', () => ({
  ScreenTime: {
    isAvailable: true,
    authorizationStatus: jest.fn().mockResolvedValue('approved'),
    requestAuthorization: jest.fn(),
    uninstallProtection: jest
      .fn()
      .mockResolvedValue({ enabled: true, active: true }),
    setUninstallProtection: jest.fn(),
    getDiagnostics: jest.fn(),
  },
}))

jest.mock('@/features/blocking/hooks/useBlockRulesQuery', () => ({
  useBlockRulesQuery: () => ({
    rules: [
      {
        id: 'r1',
        type: 'daily_limit',
        appIds: [],
        isActive: true,
        config: { limit_min: 120 },
      },
    ],
    isPending: false,
    isError: false,
    isRefetching: false,
    refetch: jest.fn(),
  }),
}))

/** Tout le texte réellement rendu, aplati. */
function visibleText(tree: ReactTestRenderer): string[] {
  return tree.root
    .findAllByType(Text)
    .flatMap(node =>
      React.Children.toArray(node.props.children).filter(
        (child): child is string => typeof child === 'string',
      ),
    )
}

const LANGUAGES = ['fr', 'en', 'de', 'ru'] as const

describe('SettingsScreen — traductions réellement rendues', () => {
  let mounted: ReactTestRenderer | null = null

  afterEach(async () => {
    await act(async () => {
      mounted?.unmount()
    })
    mounted = null
    await act(async () => {
      await i18n.changeLanguage('fr')
    })
  })

  it.each(LANGUAGES)('n’affiche aucune clé brute en %s', async language => {
    await act(async () => {
      await i18n.changeLanguage(language)
    })
    await act(async () => {
      mounted = create(<SettingsScreen />)
    })

    const texts = visibleText(mounted as unknown as ReactTestRenderer)
    // Un écran de réglages complet : si le rendu s'arrêtait en chemin, ce
    // seuil tomberait bien avant que les clés manquantes ne soient cherchées.
    expect(texts.length).toBeGreaterThan(30)

    const rawKeys = texts.filter(text => /^[a-z_]+\.[a-z_.]+$/.test(text))
    expect(rawKeys).toEqual([])
  })

  it.each(
    LANGUAGES,
  )('garde chaque ligne sur UNE ligne en %s, libellés longs compris', async language => {
    await act(async () => {
      await i18n.changeLanguage(language)
    })
    await act(async () => {
      mounted = create(<SettingsScreen />)
    })
    const tree = mounted as unknown as ReactTestRenderer

    // Toute vue dotée d'une hauteur minimale de ligne EST une ligne de
    // réglage : elle doit être horizontale et ne jamais revenir à la ligne,
    // quelle que soit la longueur du libellé allemand ou russe.
    const rows = tree.root.findAll(n => {
      const style = StyleSheet.flatten(n.props?.style)
      return (
        typeof n.type === 'string' &&
        style?.minHeight === settingsTheme.size.rowMinHeight
      )
    })

    expect(rows.length).toBeGreaterThan(10)
    for (const row of rows) {
      const style = StyleSheet.flatten(row.props.style)
      expect(style.flexDirection).toBe('row')
      expect(style.alignItems).toBe('center')
      expect(style.flexWrap).toBe('nowrap')
    }
  })

  it('interpole la version au lieu de laisser le gabarit', async () => {
    await act(async () => {
      mounted = create(<SettingsScreen />)
    })
    const texts = visibleText(mounted as unknown as ReactTestRenderer)

    // `{{version}}` visible à l'écran = interpolation oubliée côté appelant.
    expect(texts.some(t => t.includes('{{'))).toBe(false)
    expect(texts.some(t => /^Version /.test(t))).toBe(true)
  })
})
