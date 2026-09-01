/**
 * @format
 */

import React from 'react'
import { DeviceEventEmitter, StyleSheet } from 'react-native'
import ReactTestRenderer, { act } from 'react-test-renderer'

let mockFocused = true
const mockRefresh = jest.fn()
const mockRouterPush = jest.fn()

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockFocused,
}))

jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockRouterPush(...args) },
}))

jest.mock('@assets/icons', () => ({
  IconName: { MONITOR: 'monitor', SETTINGS: 'settings' },
}))

jest.mock('@/shared/components/ui/IconSvg', () => {
  const React = require('react')
  const { View } = require('react-native')
  return { IconSvg: (props: object) => React.createElement(View, props) }
})

jest.mock('@/shared/components/ui/ScreenWrapper', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    ScreenWrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(View, null, children),
  }
})

jest.mock('@/shared/native/ScreenTimeReport', () => {
  const React = require('react')
  const { View } = require('react-native')
  return {
    isScreenTimeReportAvailable: true,
    ScreenTimeReport: (props: object) =>
      React.createElement(View, {
        ...props,
        testID: 'native-screen-time-report',
      }),
  }
})

jest.mock('@/shared/native/screen-time', () => ({
  ScreenTime: {
    isAvailable: true,
    requestAuthorization: jest.fn().mockResolvedValue('approved'),
  },
}))

jest.mock('@/shared/native/useScreenTimeAuth', () => ({
  useScreenTimeAuthorization: () => ({
    status: 'approved',
    authorized: true,
    refresh: mockRefresh,
  }),
}))

import ActivityScreen from '@/features/activity/screens/ActivityScreen'

function nativeReport(renderer: ReactTestRenderer.ReactTestRenderer) {
  return renderer.root.findByProps({ testID: 'native-screen-time-report' })
}

describe('ActivityScreen', () => {
  beforeEach(() => {
    mockFocused = true
    mockRefresh.mockReset()
    mockRefresh.mockResolvedValue('approved')
    mockRouterPush.mockReset()
  })

  it('n’ajoute aucun ScrollView React Native autour du rapport plein écran', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer
    await act(async () => {
      renderer = ReactTestRenderer.create(<ActivityScreen />)
    })

    expect(
      renderer!.root.findAllByProps({ testID: 'activity-scroll' }),
    ).toHaveLength(0)
    expect(
      StyleSheet.flatten(nativeReport(renderer!).props.style),
    ).toMatchObject({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    })
    expect(nativeReport(renderer!).props.period).toBeUndefined()
    expect(nativeReport(renderer!).props.offset).toBe(0)
    await act(async () => renderer!.unmount())
  })

  it('retire le squelette uniquement au signal ready du vrai rapport', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer
    await act(async () => {
      renderer = ReactTestRenderer.create(<ActivityScreen />)
    })

    expect(
      renderer!.root.findAllByProps({ testID: 'activity-report-placeholder' }),
    ).not.toHaveLength(0)

    await act(async () => {
      nativeReport(renderer!).props.onCommand({
        nativeEvent: { command: 'ready' },
      })
    })

    expect(
      renderer!.root.findAllByProps({ testID: 'activity-report-placeholder' }),
    ).toHaveLength(0)
    await act(async () => renderer!.unmount())
  })

  it('applique immédiatement le jour sélectionné par la surcouche native', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer
    await act(async () => {
      renderer = ReactTestRenderer.create(<ActivityScreen />)
    })

    await act(async () => {
      nativeReport(renderer!).props.onCommand({
        nativeEvent: { command: 'select.day3' },
      })
    })

    expect(nativeReport(renderer!).props.period).toBeUndefined()
    expect(nativeReport(renderer!).props.offset).toBe(3)
    expect(
      renderer!.root.findAllByProps({ testID: 'activity-report-placeholder' }),
    ).not.toHaveLength(0)
    await act(async () => renderer!.unmount())
  })

  it('attend la vérification d’autorisation avant de reconnecter le rapport', async () => {
    let resolveRefresh: (status: string) => void = () => undefined
    mockRefresh.mockReturnValueOnce(
      new Promise(resolve => {
        resolveRefresh = resolve
      }),
    )

    let renderer: ReactTestRenderer.ReactTestRenderer
    await act(async () => {
      renderer = ReactTestRenderer.create(<ActivityScreen />)
    })
    expect(nativeReport(renderer!).props.reloadToken).toBe(0)

    await act(async () => {
      nativeReport(renderer!).props.onCommand({
        nativeEvent: { command: 'refresh' },
      })
    })
    expect(mockRefresh).toHaveBeenCalledTimes(1)
    expect(nativeReport(renderer!).props.reloadToken).toBe(0)

    await act(async () => {
      resolveRefresh('approved')
      await Promise.resolve()
    })
    expect(nativeReport(renderer!).props.reloadToken).toBe(1)
    await act(async () => renderer!.unmount())
  })

  it('relaie la commande Réglages vers le routeur', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer
    await act(async () => {
      renderer = ReactTestRenderer.create(<ActivityScreen />)
    })

    await act(async () => {
      nativeReport(renderer!).props.onCommand({
        nativeEvent: { command: 'settings' },
      })
    })

    expect(mockRouterPush).toHaveBeenCalledWith('/settings')
    await act(async () => renderer!.unmount())
  })

  it('relaie aussi le bouton natif Réglages par le pont global', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer
    await act(async () => {
      renderer = ReactTestRenderer.create(<ActivityScreen />)
    })

    await act(async () => {
      DeviceEventEmitter.emit('relock-native-settings')
    })

    expect(mockRouterPush).toHaveBeenCalledWith('/settings')
    await act(async () => renderer!.unmount())
  })

  it('démonte le rapport Apple hors focus et le remonte au retour', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer
    await act(async () => {
      renderer = ReactTestRenderer.create(<ActivityScreen />)
    })

    mockFocused = false
    await act(async () => {
      renderer!.update(<ActivityScreen />)
    })
    expect(
      renderer!.root.findAllByProps({ testID: 'native-screen-time-report' }),
    ).toHaveLength(0)

    mockFocused = true
    await act(async () => {
      renderer!.update(<ActivityScreen />)
    })
    expect(nativeReport(renderer!)).toBeDefined()
    await act(async () => renderer!.unmount())
  })
})
