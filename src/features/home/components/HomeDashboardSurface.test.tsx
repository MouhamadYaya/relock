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
    expect(
      renderer?.root
        .findAllByType(Text)
        .some(node => node.props.children === 'Score'),
    ).toBe(false)
  })

  it('does not destroy an in-flight native report when returning to the tab', () => {
    act(() => {
      renderer = renderSurface('approved')
    })
    const props = renderer!.root.findByType(HomeDashboardSurface)
      .props as React.ComponentProps<typeof HomeDashboardSurface>
    const report = renderer!.root.findByProps({ testID: 'screen-time-report' })
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
    expect(report.props.reloadToken).toBe(0)
  })
})
