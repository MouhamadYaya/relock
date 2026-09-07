import React from 'react'
import { Text } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { HomeDashboardSurface } from '@/features/home/components/HomeDashboardSurface'

let mockFocused = true
jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
}))

jest.mock('@/shared/native/ScreenTimeReport', () => {
  const { View } = require('react-native')
  return {
    isScreenTimeReportAvailable: true,
    ScreenTimeReport: (props: Record<string, unknown>) => (
      <View testID="screen-time-report" {...props} />
    ),
  }
})

jest.mock('@/shared/utils/platform/haptics', () => ({
  haptics: { selectionTick: jest.fn() },
}))

function renderSurface(
  authorization: 'checking' | 'denied' | 'unavailable' | 'approved',
  onRequestPermission = jest.fn(),
  onPressHero = jest.fn(),
  blockedAppsCard: React.ReactNode = <Text>Blocages</Text>,
) {
  return create(
    <HomeDashboardSurface
      authorization={authorization}
      heroAccessibilityLabel="Ouvrir l'activité"
      topAppsAccessibilityLabel="Ouvrir les apps"
      screenTimeLabel="Temps d'écran"
      permissionLabel="Autoriser Temps d'écran"
      unavailableLabel="Indisponible"
      topAppsLabel="Top apps"
      emptyUsageLabel="Aucune donnée"
      activityLabel="Activité"
      onPressHero={onPressHero}
      onRequestPermission={onRequestPermission}
      scoreCard={<Text>Score</Text>}
      blockedAppsCard={blockedAppsCard}
    />,
  )
}

describe('HomeDashboardSurface states', () => {
  let renderer: ReactTestRenderer | undefined

  beforeEach(() => {
    mockFocused = true
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
  })

  it('keeps permission copy hidden while authorization is loading', () => {
    act(() => {
      renderer = renderSurface('checking')
    })

    expect(
      renderer?.root.findAllByProps({
        accessibilityLabel: "Autoriser Temps d'écran",
      }),
    ).toHaveLength(0)
    expect(
      renderer?.root
        .findAllByType(Text)
        .some(node => node.props.children === '—'),
    ).toBe(false)
  })

  it('offers the real permission action when authorization is denied', () => {
    const onRequestPermission = jest.fn()
    act(() => {
      renderer = renderSurface('denied', onRequestPermission)
    })

    const action = renderer?.root.findByProps({
      accessibilityLabel: "Autoriser Temps d'écran",
    })
    expect(action?.props.disabled).toBe(false)

    act(() => action?.props.onPress())
    expect(onRequestPermission).toHaveBeenCalledTimes(1)
  })

  it('renders a disabled, honest fallback when Screen Time is unavailable', () => {
    act(() => {
      renderer = renderSurface('unavailable')
    })

    const action = renderer?.root.findByProps({
      accessibilityLabel: "Autoriser Temps d'écran",
    })
    expect(action?.props.disabled).toBe(true)
    expect(
      renderer?.root
        .findAllByType(Text)
        .some(node => node.props.children === 'Indisponible'),
    ).toBe(true)
  })

  it('expands the hero before using Activity as the secondary action', () => {
    const onPressHero = jest.fn()
    act(() => {
      renderer = renderSurface('approved', jest.fn(), onPressHero)
    })

    const report = () =>
      renderer?.root.findByProps({ testID: 'screen-time-report' })
    act(() =>
      report()?.props.onCommand({ nativeEvent: { command: 'home.hero' } }),
    )
    expect(onPressHero).not.toHaveBeenCalled()
    act(() =>
      report()?.props.onCommand({ nativeEvent: { command: 'home.hero' } }),
    )
    expect(onPressHero).toHaveBeenCalledTimes(1)
  })

  it('lets the local UIKit surface receive pans and collapses the blocked slot', () => {
    act(() => {
      renderer = renderSurface('approved', jest.fn(), jest.fn(), null)
    })

    const report = renderer?.root.findByProps({ testID: 'screen-time-report' })
    expect(report?.props.pointerEvents).toBe('auto')
    expect(report?.props.reloadToken).toBe(0)
    expect(report?.props.showsBlockedCard).toBe(false)
    // La carte de score reste rendue par React Native MÊME quand le rapport
    // natif s'affiche : c'est la seule qui expose un score que la feuille de
    // détail sait expliquer, l'extension n'ayant aucun moyen de publier le
    // sien vers le JS.
    expect(
      renderer?.root
        .findAllByType(Text)
        .some(node => node.props.children === 'Score'),
    ).toBe(true)
  })

  // Le rapport vit dans une extension, donc dans un AUTRE processus : iOS peut
  // la tuer dès que l'Accueil quitte la fenêtre. Au retour, la surface revient
  // vide et le reste — c'est la disparition du héro Temps d'écran et du
  // classement des apps. On redemande donc une connexion neuve à chaque retour,
  // sans démonter la vue native (bien plus coûteux qu'une reconnexion).
  it('asks the native report for a fresh connection when returning to the tab', () => {
    act(() => {
      renderer = renderSurface('approved')
    })
    const props = renderer!.root.findByType(HomeDashboardSurface)
      .props as React.ComponentProps<typeof HomeDashboardSurface>
    const report = renderer!.root.findByProps({ testID: 'screen-time-report' })
    act(() => report.props.onCommand({ nativeEvent: { command: 'ready' } }))

    act(() => {
      mockFocused = false
      renderer!.update(<HomeDashboardSurface {...props} />)
    })
    act(() => {
      mockFocused = true
      renderer!.update(<HomeDashboardSurface {...props} />)
    })

    expect(renderer!.root.findByProps({ testID: 'screen-time-report' })).toBe(
      report,
    )
    expect(report.props.reloadToken).toBe(1)
  })

  it('shows the skeleton again while the report reconnects', () => {
    act(() => {
      renderer = renderSurface('approved')
    })
    const props = renderer!.root.findByType(HomeDashboardSurface)
      .props as React.ComponentProps<typeof HomeDashboardSurface>
    const report = renderer!.root.findByProps({ testID: 'screen-time-report' })
    const skeletons = () =>
      renderer!.root.findAllByProps({ testID: 'home-report-skeleton' }).length

    act(() => report.props.onCommand({ nativeEvent: { command: 'ready' } }))
    expect(skeletons()).toBe(0)

    act(() => {
      mockFocused = false
      renderer!.update(<HomeDashboardSurface {...props} />)
    })
    act(() => {
      mockFocused = true
      renderer!.update(<HomeDashboardSurface {...props} />)
    })
    // Un vide muet se lit comme une journée sans usage : tant que la nouvelle
    // agrégation n'a pas répondu, l'écran dit qu'il charge.
    expect(skeletons()).toBeGreaterThan(0)

    act(() => report.props.onCommand({ nativeEvent: { command: 'ready' } }))
    expect(skeletons()).toBe(0)
  })

  it('keeps the first render free of an extra reconnection', () => {
    act(() => {
      renderer = renderSurface('approved')
    })
    const report = renderer!.root.findByProps({ testID: 'screen-time-report' })
    act(() => report.props.onCommand({ nativeEvent: { command: 'ready' } }))
    expect(report.props.reloadToken).toBe(0)
  })
})
