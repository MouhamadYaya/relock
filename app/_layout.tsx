import { ThemeProvider as NavThemeProvider } from '@react-navigation/native'
import * as Sentry from '@sentry/react-native'
import { Stack, useNavigationContainerRef } from 'expo-router'
import React, { useEffect } from 'react'
import { StyleSheet } from 'react-native'
import BootSplash from 'react-native-bootsplash'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import '@/i18n/i18n'
import '../global.css'

import { flags } from '@/config/constants'
import { env } from '@/config/env'
import { usePendingShieldRequest } from '@/features/blocking/hooks/usePendingShieldRequest'
import { runInstallReset } from '@/features/blocking/services/reset.service'
import { useNotificationEngine } from '@/features/notifications/hooks/useNotificationEngine'
import { useNotificationRouter } from '@/features/notifications/routing/useNotificationRouter'
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
  drainExtensionTelemetry,
  publishSentryDsnToExtensions,
} from '@/shared/services/monitoring/extension-telemetry'
import {
  addAppBreadcrumb,
  attachSupabaseTelemetry,
  captureBoundaryError,
  captureError,
  initSentry,
  navigationIntegration,
  setSentryTags,
} from '@/shared/services/monitoring/sentry'
import { supabase } from '@/shared/services/supabase/client'
import { resolveAppRoot, useAppGateStore } from '@/shared/stores/app-gate.store'
import { ThemeProvider } from '@/shared/theme/ThemeProvider'

initSentry()
// Étiquettes vraies pour toute la vie du processus : filtrables dans le
// dashboard (« montre-moi les crashs de la version staging seulement »).
setSentryTags({ env: env.ENV, mock_api: String(flags.USE_MOCK) })

const HALF_SHEET_OPTIONS = {
  presentation: 'transparentModal',
  animation: 'none',
  gestureEnabled: false,
} as const

function AppShell() {
  const t = useT()
  const navigationTheme = useNavigationTheme({ forceDark: true })
  const navigationRef = useNavigationContainerRef()

  const surveyDone = useAppGateStore(s => s.surveyDone)
  const entitled = useAppGateStore(s => s.entitled)
  const setupDone = useAppGateStore(s => s.setupDone)
  const root = resolveAppRoot({ surveyDone, entitled, setupDone })
  // L'app elle-même : parcours terminé ET abonnement actif. Un abonnement qui
  // expire referme donc la porte, exactement comme il l'avait ouverte.
  const appUnlocked = root === 'app'
  usePendingShieldRequest(appUnlocked)

  // UN SEUL point de montage du moteur de notifications. Deux passages
  // concurrents avec des sources différentes se détruiraient l'un l'autre : la
  // file roulante est purgée puis réécrite intégralement à chaque passage.
  useNotificationEngine(appUnlocked)
  // Les taps sont consommés ici, et pas dans un écran : un tap démarre souvent
  // l'app à froid, et l'écran de destination n'est pas encore monté.
  useNotificationRouter(appUnlocked)

  // L'instrumentation de navigation a besoin du conteneur pour nommer les
  // transactions et rattacher un écran à chaque événement. Sans ce
  // rattachement, un crash arrive sans indication de l'écran où il s'est
  // produit — l'information la plus utile du rapport.
  useEffect(() => {
    if (navigationRef) {
      navigationIntegration.registerNavigationContainer(navigationRef)
    }
  }, [navigationRef])

  useEffect(() => {
    let stopEntitlementWatch: (() => void) | undefined
    setTransport(flags.USE_MOCK ? mockAdapter : restAdapter)
    // Chaque requête Supabase devient une miette du fil d'Ariane : on voit la
    // dernière table interrogée avant un crash.
    attachSupabaseTelemetry(supabase)
    // Les 5 extensions Family Controls sont des processus séparés : leurs
    // erreurs n'apparaissent jamais dans le rapport de l'app. On publie le
    // DSN pour celles qui portent un SDK, et on relève le journal partagé de
    // toutes les autres — c'est le seul canal de RelockActivityReport, à qui
    // Apple refuse tout accès réseau.
    publishSentryDsnToExtensions()
    drainExtensionTelemetry().catch(error =>
      captureError(error, {
        tags: { boot: 'extension-telemetry' },
        level: 'warning',
      }),
    )
    // Dev : session Supabase automatique quand le login est désactivé.
    ensureDevSession().catch(error =>
      captureError(error, { tags: { boot: 'dev-session' }, level: 'warning' }),
    )
    // Dev : pilotage par deep link (tests scriptés sur simulateur).
    initDevTestBridge()
    // (Ré)installation : purge le blocage résiduel au niveau système.
    //
    // Un échec ici laisse un blocage fantôme actif au niveau SYSTÈME, que
    // l'utilisateur ne peut plus lever depuis l'app : c'est exactement le
    // genre de panne dont personne ne fait de rapport et qui provoque une
    // désinstallation. D'où le niveau `error`.
    runInstallReset().catch(error =>
      captureError(error, { tags: { boot: 'install-reset' } }),
    )
    initializeRevenueCat()
      .then(() => {
        // Vérité serveur de l'abonnement, au démarrage puis à chaque
        // changement (expiration, remboursement, renouvellement, achat fait
        // depuis les Réglages iOS). Sans le second, la porte ne serait
        // réévaluée qu'au prochain démarrage à froid.
        void syncEntitlement()
        stopEntitlementWatch = watchEntitlement()
      })
      // RevenueCat muet = la porte dure du paywall ne peut plus s'ouvrir,
      // même pour un abonné en règle. Panne commercialement critique, et
      // parfaitement silencieuse jusqu'ici.
      .catch(error =>
        captureError(error, { tags: { boot: 'revenuecat' }, level: 'fatal' }),
      )

    return () => stopEntitlementWatch?.()
  }, [])

  // La porte franchie fait partie du contexte de tout crash ultérieur :
  // « ça plante au paywall » et « ça plante dans l'app » ne sont pas le même
  // bug, même avec la même stack.
  useEffect(() => {
    setSentryTags({ app_root: root })
    addAppBreadcrumb({
      category: 'navigation.gate',
      message: `racine de l'app : ${root}`,
    })
  }, [root])

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
          <Stack.Screen
            name="pause-ritual-picker"
            options={HALF_SHEET_OPTIONS}
          />
          <Stack.Screen name="settings" />
          <Stack.Screen name="profile" />
          <Stack.Screen name="delete-account" />
          <Stack.Screen name="reset-app" />
          {/* Diagnostic du moteur de notifications : tout s'y décide hors
              écran, et une notification qui ne part pas ressemble exactement à
              une notification qui n'avait pas lieu d'être. Dev uniquement, et
              SANS bouton dans l'UI (comme tous les raccourcis de dev depuis le
              2026-09-07) : on l'ouvre au deep link
              `relock://notifications-debug`. */}
          {__DEV__ ? <Stack.Screen name="notifications-debug" /> : null}
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

function RootLayout() {
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

/**
 * `Sentry.wrap` enveloppe la racine — c'est lui qui mesure le démarrage à
 * froid, relie le contexte natif au contexte JS et arme le suivi des
 * interactions tactiles. Il est neutre quand le DSN est absent.
 */
export default Sentry.wrap(RootLayout)

const styles = StyleSheet.create({ flex: { flex: 1 } })
