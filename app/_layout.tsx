import { ThemeProvider as NavThemeProvider } from '@react-navigation/native'
import { Stack } from 'expo-router'
import React, { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import BootSplash from 'react-native-bootsplash'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import '@/i18n/i18n'
import '../global.css'

import { flags } from '@/config/constants'
import { usePendingShieldRequest } from '@/features/blocking/hooks/usePendingShieldRequest'
import { runInstallReset } from '@/features/blocking/services/reset.service'
import { initializeRevenueCat } from '@/features/onboarding/services/revenuecat'
import { userKeys } from '@/features/user/api/keys'
import { useT } from '@/i18n/useT'
import { useBackButtonHandler } from '@/navigation/helpers/use-back-handler'
import { useNavigationTheme } from '@/navigation/helpers/use-navigation-theme'
import {
  clearNavigationPersistence,
  usePersistLastPath,
  useRestoreLastPath,
} from '@/navigation/persistence/navigation-persistence'
import { syncEntitlement, watchEntitlement } from '@/session/bootstrap'
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
import { resolveAppRoot, useAppGateStore } from '@/shared/stores/app-gate.store'
import { ThemeProvider } from '@/shared/theme/ThemeProvider'

initSentry()

const HALF_SHEET_OPTIONS = {
  presentation: 'transparentModal',
  animation: 'none',
  gestureEnabled: false,
} as const

function AppShell() {
  const t = useT()
  const navigationTheme = useNavigationTheme({ forceDark: true })

  const surveyDone = useAppGateStore(s => s.surveyDone)
  const entitled = useAppGateStore(s => s.entitled)
  const setupDone = useAppGateStore(s => s.setupDone)
  const root = resolveAppRoot({ surveyDone, entitled, setupDone })
  // L'app elle-même : parcours terminé ET abonnement actif. Un abonnement qui
  // expire referme donc la porte, exactement comme il l'avait ouverte.
  const appUnlocked = root === 'app'
  usePendingShieldRequest(appUnlocked)

  useEffect(() => {
    let stopEntitlementWatch: (() => void) | undefined
    setTransport(flags.USE_MOCK ? mockAdapter : restAdapter)
    // Dev : session Supabase automatique quand le login est désactivé.
    ensureDevSession().catch(() => undefined)
    // Dev : pilotage par deep link (tests scriptés sur simulateur).
    initDevTestBridge()
    // (Ré)installation : purge le blocage résiduel au niveau système.
    runInstallReset().catch(() => undefined)
    initializeRevenueCat()
      .then(() => {
        // Vérité serveur de l'abonnement, au démarrage puis à chaque
        // changement (expiration, remboursement, renouvellement, achat fait
        // depuis les Réglages iOS). Sans le second, la porte ne serait
        // réévaluée qu'au prochain démarrage à froid.
        void syncEntitlement()
        stopEntitlementWatch = watchEntitlement()
      })
      .catch(() => undefined)

    return () => stopEntitlementWatch?.()
  }, [])

  useEffect(() => {
    BootSplash.hide({ fade: true })
  }, [])

  // Android: exit app from root-level leaves (main tabs, onboarding).
  useBackButtonHandler(
    pathname =>
      pathname === '/home' ||
      pathname === '/blocks' ||
      pathname === '/activity' ||
      pathname === '/onboarding',
  )

  usePersistLastPath()
  useRestoreLastPath(appUnlocked)

  return (
    <NavThemeProvider value={navigationTheme}>
      <ThemedStatusBar />
      <OfflineBanner message={t('common.offline_banner')} />
      {/*
        Les trois portes de Relock, dans l'ordre où on les franchit. Aucune ne
        mémorise « où l'utilisateur en était » : la racine se DÉDUIT de l'état,
        ce qui reste juste après une fermeture d'app, une réinstallation, un
        changement d'appareil ou une expiration d'abonnement.

          récit      tant que le questionnaire n'a pas été fait — et, une fois
                     l'abonnement en poche, pour le parcours d'activation qui
                     suit l'offre (compte, tutoriel, permission, règles) ;
          paywall    quoi que l'utilisateur ait déjà fait, dès que
                     l'abonnement manque. Porte dure : la seule sortie est un
                     achat, une restauration ou la connexion à un compte déjà
                     abonné ;
          app        parcours terminé ET abonnement actif.

        `resolveAppRoot` tranche pour tout le monde (ici et dans
        `app/index.tsx`) : exclusivité et exhaustivité sont structurelles, pas
        une propriété qu'il faudrait redémontrer à chaque relecture.
      */}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={root === 'onboarding'}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>
        <Stack.Protected guard={root === 'paywall'}>
          <Stack.Screen name="paywall" />
        </Stack.Protected>
        <Stack.Protected guard={root === 'app'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="add-block" options={HALF_SHEET_OPTIONS} />
          <Stack.Screen name="block-editor" options={HALF_SHEET_OPTIONS} />
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
