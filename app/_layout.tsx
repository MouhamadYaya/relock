import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavThemeProvider,
} from '@react-navigation/native'
import { Stack } from 'expo-router'
import React, { useEffect, useMemo } from 'react'
import { StyleSheet, useColorScheme } from 'react-native'
import BootSplash from 'react-native-bootsplash'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import '@/i18n/i18n'
import '../global.css'

import { flags } from '@/config/constants'
import { runInstallReset } from '@/features/blocking/services/reset.service'
import { userKeys } from '@/features/user/api/keys'
import { useT } from '@/i18n/useT'
import { useBackButtonHandler } from '@/navigation/helpers/use-back-handler'
import {
  clearNavigationPersistence,
  usePersistLastPath,
  useRestoreLastPath,
} from '@/navigation/persistence/navigation-persistence'
import { ensureDevSession } from '@/session/dev-auth'
import { initDevTestBridge } from '@/session/dev-test-bridge'
import { ErrorBoundary } from '@/shared/components/ui/ErrorBoundary'
import { OfflineBanner } from '@/shared/components/ui/OfflineBanner'
import { ThemedStatusBar } from '@/shared/components/ui/ThemedStatusBar'
import { QueryProvider } from '@/shared/services/api/query/client/provider'
import { mockAdapter } from '@/shared/services/api/transport/adapters/mock.adapter'
import { restAdapter } from '@/shared/services/api/transport/adapters/rest.adapter'
import { setTransport } from '@/shared/services/api/transport/transport'
import {
  captureBoundaryError,
  initSentry,
} from '@/shared/services/monitoring/sentry'
import { useAppGateStore } from '@/shared/stores/app-gate.store'
import { useTheme } from '@/shared/theme'
import { ThemeProvider } from '@/shared/theme/ThemeProvider'

initSentry()

const HALF_SHEET_OPTIONS = {
  presentation: 'transparentModal',
  animation: 'none',
  gestureEnabled: false,
} as const

function AppShell() {
  const t = useT()
  const { theme, mode } = useTheme()
  const systemScheme = useColorScheme()
  const isDark =
    mode === 'dark' || (mode === 'system' && systemScheme === 'dark')

  const onboardingDone = useAppGateStore(s => s.onboardingDone)

  useEffect(() => {
    setTransport(flags.USE_MOCK ? mockAdapter : restAdapter)
    // Dev : session Supabase automatique quand le login est désactivé.
    ensureDevSession().catch(() => undefined)
    // Dev : pilotage par deep link (tests scriptés sur simulateur).
    initDevTestBridge()
    // (Ré)installation : purge le blocage résiduel au niveau système.
    runInstallReset().catch(() => undefined)
  }, [])

  useEffect(() => {
    BootSplash.hide({ fade: true })
  }, [])

  // Android: exit app from root-level leaves (main tabs, onboarding).
  useBackButtonHandler(
    pathname =>
      pathname === '/(tabs)/home' ||
      pathname === '/(tabs)/activity' ||
      pathname === '/onboarding',
  )

  usePersistLastPath()
  useRestoreLastPath(onboardingDone)

  const navigationTheme = useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      dark: isDark,
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.textPrimary,
        border: theme.colors.border,
        notification: theme.colors.danger,
      },
    }),
    [isDark, theme],
  )

  return (
    <NavThemeProvider value={navigationTheme}>
      <ThemedStatusBar />
      <OfflineBanner message={t('common.offline_banner')} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!onboardingDone}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={onboardingDone}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="add-block" options={HALF_SHEET_OPTIONS} />
          <Stack.Screen name="block-detail" options={HALF_SHEET_OPTIONS} />
          <Stack.Screen name="preset-recap" options={HALF_SHEET_OPTIONS} />
          <Stack.Screen name="theme-picker" options={HALF_SHEET_OPTIONS} />
          <Stack.Screen name="language-picker" options={HALF_SHEET_OPTIONS} />
          <Stack.Screen name="settings" />
        </Stack.Protected>
      </Stack>
    </NavThemeProvider>
  )
}

function AppRoot() {
  const t = useT()

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        captureBoundaryError(error, errorInfo)
        clearNavigationPersistence()
      }}
      labels={{
        title: t('common.error_title'),
        hint: t('common.error_hint'),
        retry: t('common.retry'),
      }}
    >
      <QueryProvider tagMaps={[userKeys.tagMap]}>
        <AppShell />
      </QueryProvider>
    </ErrorBoundary>
  )
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <ThemeProvider>
          <AppRoot />
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({ flex: { flex: 1 } })
