import { router } from 'expo-router'
import React from 'react'
import { Image, StyleSheet } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { useHomeDashboard } from '@/features/home/hooks/useHomeDashboard'
import HomeScreen from '@/features/home/screens/HomeScreen'
import { relockMaterial } from '@/shared/theme'

jest.mock('expo-router', () => ({
  router: {
    push: jest.fn(),
    navigate: jest.fn(),
  },
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock('@/features/home/hooks/useHomeDashboard', () => ({
  useHomeDashboard: jest.fn(),
}))

jest.mock('@/i18n/useT', () => ({
  useT: () => (key: string) => key,
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

jest.mock('@/features/home/components/HomeDetailSheet', () => {
  const { View } = require('react-native')
  return {
    HomeDetailSheet: ({
      visible,
      children,
    }: {
      visible: boolean
      children: React.ReactNode
    }) => (visible ? <View>{children}</View> : null),
  }
})

jest.mock('@/features/home/components/HomeDashboardSurface', () => {
  const { Pressable, View } = require('react-native')
  return {
    HomeDashboardSurface: ({
      heroAccessibilityLabel,
      onPressHero,
      scoreCard,
      blockedAppsCard,
    }: {
      heroAccessibilityLabel: string
      onPressHero: () => void
      scoreCard: React.ReactNode
      blockedAppsCard: React.ReactNode
    }) => (
      <View>
        <Pressable
          accessibilityLabel={heroAccessibilityLabel}
          onPress={onPressHero}
        />
        {scoreCard}
        {blockedAppsCard}
      </View>
    ),
  }
})

function dashboardFixture(isNewUser: boolean, hasBlockedApp = false) {
  return {
    now: new Date(2026, 8, 4, 12),
    state: 'ready',
    scores: { focus: null, rest: null, global: null, available: false },
    score: {
      status: 'pending',
      global: null,
      focus: null,
      rest: null,
      delta: null,
      weakestAxis: 'focus',
      historyDays: 0,
    },
    sessions: [],
    runningRules: [],
    blockedApps: hasBlockedApp
      ? [{ key: 'app-1', unlocked: false, ruleIds: ['rule-1'] }]
      : [],
    blockedAppsPending: false,
    myApps: hasBlockedApp
      ? {
          state: 'blocked',
          ruleTitles: ['Décompression'],
          nextStart: null,
          nextRuleTitle: null,
          resuming: false,
          apps: [{ key: 'app-1', unlocked: false, ruleIds: ['rule-1'] }],
          blockedCount: 1,
        }
      : null,
    authorization: {
      status: 'approved',
      authorized: true,
      refresh: jest.fn().mockResolvedValue('approved'),
    },
    stats: {
      streak: 0,
      record: 0,
      week: [],
      isPending: false,
      isError: false,
    },
    streakMinutesRemaining: 90,
    protectedToday: false,
    isNewUser,
  } as unknown as ReturnType<typeof useHomeDashboard>
}

describe('HomeScreen navigation', () => {
  let renderer: ReactTestRenderer | undefined
  const mockDashboard = jest.mocked(useHomeDashboard)

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
  })

  it('keeps native vertical elasticity and edge-to-edge content enabled', () => {
    mockDashboard.mockReturnValue(dashboardFixture(false))
    act(() => {
      renderer = create(<HomeScreen />)
    })
    const scroll = renderer!.root.findAllByProps({ testID: 'home-scroll' })[0]
    expect(scroll.props.bounces).toBe(true)
    expect(scroll.props.alwaysBounceVertical).toBe(true)
    expect(scroll.props.contentInsetAdjustmentBehavior).toBe('never')
    expect(scroll.props.removeClippedSubviews).toBe(false)
    // Le décor reste ancré à l'écran, hors du conteneur défilant. On vise le
    // décor par son testID plutôt que de compter les Image de tout l'arbre :
    // les cartes en ont désormais aussi (l'anneau du score).
    const backdrop = renderer!.root.findByProps({
      testID: 'home-fixed-backdrop',
    })
    expect(
      scroll.findAllByProps({ testID: 'home-fixed-backdrop' }),
    ).toHaveLength(0)
    // L'entête est une barre fixe de l'écran, pas le haut du contenu : hors
    // du `ScrollView`, elle ne peut pas défiler. `box-none` laisse malgré
    // tout passer le geste de défilement sous la bande.
    const header = renderer!.root.findByProps({ testID: 'home-header' })
    expect(header.props.pointerEvents).toBe('box-none')
    expect(scroll.findAllByProps({ testID: 'home-header' })).toHaveLength(0)
    // Le voile va DERRIÈRE l'entête (z 3 contre z 4) et hors du défilement :
    // sans lui, le contenu qui remonte traverse le logotype.
    const scrim = renderer!.root.findByProps({ testID: 'home-header-scrim' })
    expect(StyleSheet.flatten(scrim.props.style).zIndex).toBeLessThan(
      StyleSheet.flatten(header.props.style).zIndex,
    )
    expect(scroll.findAllByProps({ testID: 'home-header-scrim' })).toHaveLength(
      0,
    )
    // Le décor empile deux images : le globe (la source de lumière) et la
    // tuile de grain qui casse le banding des dégradés. Les deux couvrent la
    // scène entière — le fond ne s'arrête jamais.
    const layers = backdrop.findAllByType(Image)
    expect(layers).toHaveLength(2)
    for (const layer of layers) {
      expect(StyleSheet.flatten(layer.props.style)).toMatchObject({
        width: '100%',
        height: '100%',
      })
    }
    const grain = StyleSheet.flatten(layers[1].props.style)
    expect(grain.mixBlendMode).toBe('overlay')
    expect(grain.opacity).toBe(relockMaterial.opacity.homeGrain)
  })

  it('opens the existing Settings and Activity destinations', () => {
    mockDashboard.mockReturnValue(dashboardFixture(false))
    act(() => {
      renderer = create(<HomeScreen />)
    })

    act(() => {
      renderer?.root
        .findByProps({
          accessibilityLabel: 'home.settings_accessibility',
        })
        .props.onPress()
      renderer?.root
        .findByProps({
          accessibilityLabel: 'home.screen_time_open_activity',
        })
        .props.onPress()
    })

    expect(router.push).toHaveBeenCalledWith('/settings')
    expect(router.navigate).toHaveBeenCalledTimes(1)
    expect(router.navigate).toHaveBeenCalledWith('/(tabs)/activity')
  })

  it('does not mount the blocked-app card when no app is blocked', () => {
    mockDashboard.mockReturnValue(dashboardFixture(true))
    act(() => {
      renderer = create(<HomeScreen />)
    })
    expect(
      renderer?.root.findAllByProps({
        accessibilityLabel: 'home.my_apps.open',
      }),
    ).toHaveLength(0)
  })

  it('opens Blocages when at least one blocked app is visible', () => {
    mockDashboard.mockReturnValue(dashboardFixture(false, true))
    act(() => {
      renderer = create(<HomeScreen />)
    })
    act(() => {
      renderer?.root
        .findByProps({
          accessibilityLabel: 'home.my_apps.open',
        })
        .props.onPress()
    })
    expect(router.navigate).toHaveBeenCalledWith('/(tabs)/blocks')
  })

  it('starts the existing unlock flow through an explicit navigation request', () => {
    mockDashboard.mockReturnValue(dashboardFixture(false, true))
    act(() => {
      renderer = create(<HomeScreen />)
    })
    act(() =>
      renderer!.root
        .findAllByProps({ testID: 'home-unlock-apps' })
        .find(node => node.props.onPress)!
        .props.onPress(),
    )
    expect(router.navigate).toHaveBeenCalledWith({
      pathname: '/(tabs)/blocks',
      params: { homeUnlockRequest: expect.any(String) },
    })
  })
})
