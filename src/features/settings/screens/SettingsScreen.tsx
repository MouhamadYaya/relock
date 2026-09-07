import { IconName } from '@assets/icons'
import { router } from 'expo-router'
import React from 'react'
import { Alert, Linking, Share, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { appBuild, appVersion, links } from '@/config/app-config'
import { AuthService } from '@/features/auth/services/auth/auth.service'
import { NotificationService } from '@/features/notifications/notification.service'
import {
  getNotifPrefs,
  type NotifPrefs,
  setNotifPrefs,
} from '@/features/notifications/prefs'
import {
  isRevenueCatEnabled,
  openRevenueCatCustomerCenter,
  restoreRevenueCatPurchases,
} from '@/features/onboarding/services/revenuecat'
import { ProfileCard } from '@/features/settings/components/ProfileCard'
import { SettingsBackdrop } from '@/features/settings/components/SettingsBackdrop'
import { SettingsGroup } from '@/features/settings/components/SettingsGroup'
import { SettingsHeader } from '@/features/settings/components/SettingsHeader'
import { SettingsRow } from '@/features/settings/components/SettingsRow'
import { useProfile } from '@/features/user/hooks/useProfile'
import { i18n } from '@/i18n'
import { useT } from '@/i18n/useT'
import { resetOnboarding, syncEntitlement } from '@/session/bootstrap'
import { RelockWordmark } from '@/shared/components/ui/RelockWordmark'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import { Notif, type NotifPermission } from '@/shared/native/notifications'
import { ScreenTime } from '@/shared/native/screen-time'
import {
  captureError,
  isSentryEnabled,
  setSentryTags,
} from '@/shared/services/monitoring/sentry'
import { useAppGateStore } from '@/shared/stores/app-gate.store'
import { usePreferences } from '@/shared/stores/preferences.store'
import { relockMaterial } from '@/shared/theme'
import { useTheme } from '@/shared/theme/useTheme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { showErrorToast, showToast } from '@/shared/utils/toast'

const { colors, layout, typography } = relockMaterial

const THEME_KEY = {
  light: 'settings.theme_light',
  dark: 'settings.theme_dark',
  system: 'settings.theme_system',
} as const

const LANGUAGE_KEY: Record<string, string> = {
  fr: 'settings.language.french',
  en: 'settings.language.english',
  de: 'settings.language.german',
  ru: 'settings.language.russian',
}

/**
 * Bilan de santé natif (build, journal, vie des extensions). Réservé au
 * développement : c'est le seul endroit d'où l'on voit ce qu'iOS a VRAIMENT
 * armé, par opposition à ce que la base de données croit.
 */
function showNativeDiagnostics(title: string, unavailable: string) {
  if (!ScreenTime.isAvailable) {
    Alert.alert(title, unavailable)
    return
  }
  ScreenTime.getDiagnostics()
    .then(d => {
      const lines = [
        `Build natif : ${d.nativeBuiltAt}`,
        `Autorisation : ${d.authorized ? 'accordée' : 'ABSENTE'}`,
        `App Group : ${d.appGroupOK ? 'OK' : 'INACCESSIBLE'}`,
        `Transport Shield : ${d.shieldStateTransport}`,
        `Journal : ${d.eventLogCount} événement(s)`,
        `Résistances (total) : ${d.totalResisted}`,
        `Fenêtres actives : ${d.activeWindows.join(', ') || 'aucune'}`,
        // La vérité d'iOS, pas la nôtre : une règle absente d'ici ne
        // bloquera jamais rien, quoi qu'en dise la DB.
        `Armées côté iOS : ${d.armedActivities?.join(', ') || 'AUCUNE'}`,
        `Moniteur réveillé : ${d.monitorLastWakeAt}`,
        `  → ${d.monitorLastWakeWhat}`,
        `Bouclier affiché : ${d.shieldShownTotal ?? 0}× (dernier : ${d.shieldLastShownAt ?? 'jamais'})`,
        `Bouclier tapé : ${d.shieldLastActionAt}`,
        `  → ${d.shieldLastOpenRequestStatus} / ${d.shieldLastActionResponse}`,
        `Contexte en attente : ${d.pendingShieldRequest?.applicationName ?? 'aucun'}`,
        `Quotas du jour : ${
          Object.entries(d.limitProgress ?? {})
            .map(([k, v]) => `${k.slice(14, 22)}…=${v}`)
            .join(', ') || 'aucun palier franchi'
        }`,
        '',
        ...d.eventLogTail.map(e => `· ${e.kind} (${e.at})`),
      ]
      Alert.alert(title, lines.join('\n'))
    })
    .catch(e => showErrorToast(e))
}

export default function SettingsScreen() {
  const t = useT()
  const insets = useSafeAreaInsets()
  const { displayName, email, avatar } = useProfile()
  const { mode } = useTheme()
  const entitled = useAppGateStore(s => s.entitled)
  const revenueCatEnabled = isRevenueCatEnabled()

  // Le voile de l'entête et le titre compact naissent du défilement : on suit
  // l'offset sur le thread UI, sans aller-retour JS.
  const scrollY = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler(e => {
    scrollY.value = e.contentOffset.y
  })

  const haptics = usePreferences(s => s.haptics)
  const pauseSound = usePreferences(s => s.pauseSound)
  const crashReports = usePreferences(s => s.crashReports)
  const setPreference = usePreferences(s => s.setPreference)

  const [restoring, setRestoring] = React.useState(false)

  // Notifications : préférences persistées, appliquées IMMÉDIATEMENT.
  const [notif, setNotif] = React.useState<NotifPrefs>(getNotifPrefs)
  const updateNotif = (patch: Partial<NotifPrefs>) => {
    const next = { ...notif, ...patch }
    setNotif(next)
    setNotifPrefs(next)
    const turningOn = next.master && Object.values(patch).some(v => v === true)
    ;(async () => {
      if (turningOn) {
        await NotificationService.ensurePermission()
        setNotifPermission(await Notif.permissionStatus())
      }
      await NotificationService.reconcileFromLast()
    })().catch(() => {})
  }

  // Statuts RÉELS des deux permissions, jamais codés en dur : ce que l'écran
  // affiche doit venir du système, sinon il ment dès qu'on change un réglage
  // depuis iOS.
  const [authorized, setAuthorized] = React.useState(false)
  const [notifPermission, setNotifPermission] =
    React.useState<NotifPermission>('notDetermined')

  React.useEffect(() => {
    if (!ScreenTime.isAvailable) return
    ScreenTime.authorizationStatus()
      .then(s => setAuthorized(s === 'approved'))
      .catch(() => {})
    Notif.permissionStatus().then(setNotifPermission).catch(() => {})
  }, [])

  const requestScreenTime = () => {
    if (!ScreenTime.isAvailable) {
      Alert.alert(
        t('settings.screen_time_unavailable_title'),
        t('settings.screen_time_unavailable_body'),
      )
      return
    }
    if (authorized) {
      // Déjà accordée : la seule chose à faire ici est d'emmener l'utilisateur
      // là où il peut la RETIRER — iOS ne permet pas de la révoquer depuis
      // l'app, et redemander une autorisation acquise ne fait rien du tout.
      Linking.openSettings().catch(() => {})
      return
    }
    ScreenTime.requestAuthorization()
      .then(s => setAuthorized(s === 'approved'))
      .catch(e => showErrorToast(e))
  }

  const openCustomerCenter = () => {
    if (!revenueCatEnabled) {
      Alert.alert(t('settings.pro.title'), t('settings.pro.unavailable'))
      return
    }
    void (async () => {
      try {
        await openRevenueCatCustomerCenter()
      } catch {
        showErrorToast(t('settings.pro.manage_error'))
      }
    })()
  }

  const restorePurchases = () => {
    if (!revenueCatEnabled) {
      Alert.alert(t('settings.pro.title'), t('settings.pro.unavailable'))
      return
    }
    setRestoring(true)
    void (async () => {
      try {
        const restored = await restoreRevenueCatPurchases()
        // La restauration RevenueCat rend un booléen ; la porte, elle, se
        // rouvre par la vérité serveur — d'où la synchronisation qui suit.
        await syncEntitlement()
        showToast(
          restored
            ? t('settings.pro.restore_done')
            : t('settings.pro.restore_none'),
        )
      } catch (e) {
        showErrorToast(e)
      } finally {
        setRestoring(false)
      }
    })()
  }

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => showErrorToast(t('settings.link_error')))
  }

  const shareApp = () => {
    Share.share({
      message: `${t('settings.share_message')} ${links.share}`,
    }).catch(() => {})
  }

  const confirmLogout = () => {
    Alert.alert(t('settings.logout_title'), t('settings.logout_body'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('settings.logout'),
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await AuthService.logout()
              // Importé à la demande : `signOutToAuth` navigue, et le charger
              // au montage de l'écran ferait remonter tout le module de
              // parcours dans le graphe des Réglages.
              const { signOutToAuth } = await import('@/session/bootstrap')
              signOutToAuth()
            } catch (e) {
              captureError(e, { tags: { feature: 'settings', op: 'logout' } })
              showErrorToast(t('settings.logout_error'))
            }
          })()
        },
      },
    ])
  }

  const version = appVersion()
  const build = appBuild()

  /**
   * Appui long discret sur le numéro de version : envoie une erreur de TEST
   * à Sentry, et dit franchement quand rien ne part.
   *
   * Le silence est le pire mode de défaillance d'un outil de monitoring :
   * sans ce retour, un DSN absent ressemble exactement à un DSN qui marche.
   * Et c'est ici plutôt que dans le pont de dev parce que la seule
   * vérification qui compte — « ma stack de PRODUCTION est-elle lisible ? » —
   * exige un build release, où le pont n'existe pas.
   */
  const sendSentryTestEvent = () => {
    if (!isSentryEnabled()) {
      Alert.alert(t('settings.sentry_off_title'), t('settings.sentry_off_body'))
      return
    }
    captureError(new Error('[TEST] événement déclenché depuis les Réglages'), {
      tags: { test: 'settings-longpress' },
      level: 'warning',
    })
    showToast(t('settings.sentry_test_sent'))
  }

  return (
    <ScreenWrapper
      disableTopInset
      disableBottomInset
      backgroundColor={colors.homeCanvas}
      statusBarProps={{
        backgroundColor: colors.transparent,
        translucent: true,
      }}
    >
      <SettingsBackdrop />

      <Animated.ScrollView
        testID="settings-scroll"
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + layout.settingsHeaderHeight,
            paddingBottom: insets.bottom + layout.settingsScrollBottom,
          },
        ]}
      >
        <Text style={styles.title}>{t('settings.title')}</Text>

        <ProfileCard
          displayName={displayName}
          email={email}
          avatar={avatar}
          pro={entitled}
          proLabel={t('settings.pro.badge')}
          subtitle={t('settings.profile.card_hint')}
          accessibilityLabel={t('settings.profile.open')}
          onPress={() => router.push('/profile')}
        />

        <SettingsGroup
          title={t('settings.sections.subscription')}
          footnote={t('settings.pro.footnote')}
        >
          <SettingsRow
            icon={IconName.CROWN}
            tint="amber"
            label={t('settings.pro.manage')}
            hint={t('settings.pro.manage_hint')}
            status={{
              label: entitled
                ? t('settings.pro.status_active')
                : t('settings.pro.status_inactive'),
              granted: entitled,
            }}
            onPress={openCustomerCenter}
          />
          <SettingsRow
            icon={IconName.CHECK}
            tint="amber"
            label={t('settings.pro.restore')}
            busy={restoring}
            onPress={restorePurchases}
          />
        </SettingsGroup>

        <SettingsGroup title={t('settings.sections.personalization')}>
          <SettingsRow
            icon={IconName.MOON}
            tint="lavender"
            label={t('settings.appearance')}
            value={t(THEME_KEY[mode] ?? 'settings.theme_dark')}
            onPress={() => router.push('/theme-picker')}
          />
          <SettingsRow
            icon={IconName.GLOBE}
            tint="blue"
            label={t('settings.language.label')}
            value={t(
              LANGUAGE_KEY[i18n.language] ?? 'settings.language.english',
            )}
            onPress={() => router.push('/language-picker')}
          />
          <SettingsRow
            icon={IconName.PULSE}
            tint="violet"
            label={t('settings.haptics')}
            hint={t('settings.haptics_hint')}
            switchValue={haptics}
            onSwitchChange={v => setPreference('haptics', v)}
          />
          <SettingsRow
            icon={IconName.HEADPHONES}
            tint="violet"
            label={t('settings.pause_sound')}
            hint={t('settings.pause_sound_hint')}
            switchValue={pauseSound}
            onSwitchChange={v => setPreference('pauseSound', v)}
          />
        </SettingsGroup>

        {/* Peu de notifications, mais utiles ; jamais de promotion. */}
        <SettingsGroup
          title={t('settings.sections.notifications')}
          footnote={t('settings.notifications_footnote')}
        >
          <SettingsRow
            icon={IconName.BELL}
            tint="blue"
            label={t('settings.notifications_master')}
            switchValue={notif.master}
            onSwitchChange={v => updateNotif({ master: v })}
          />
          {notif.master ? (
            <SettingsRow
              icon={IconName.CLOCK}
              tint="blue"
              label={t('settings.notifications_reminders')}
              hint={t('settings.notifications_reminders_hint')}
              switchValue={notif.reminders}
              onSwitchChange={v => updateNotif({ reminders: v })}
            />
          ) : null}
          {notif.master ? (
            <SettingsRow
              icon={IconName.STAR}
              tint="blue"
              label={t('settings.notifications_progression')}
              hint={t('settings.notifications_progression_hint')}
              switchValue={notif.progression}
              onSwitchChange={v => updateNotif({ progression: v })}
            />
          ) : null}
          {/* La permission iOS prime sur tout ce qui précède : une fois
              refusée, aucun interrupteur de cet écran ne fera apparaître quoi
              que ce soit. La ligne mène donc aux réglages du système. */}
          {notifPermission !== 'granted' ? (
            <SettingsRow
              icon={IconName.MONITOR}
              tint="amber"
              label={t('settings.notifications_permission')}
              status={{
                label:
                  notifPermission === 'denied'
                    ? t('settings.notifications_denied')
                    : t('settings.notifications_pending'),
                granted: false,
              }}
              onPress={() => Linking.openSettings().catch(() => {})}
            />
          ) : null}
        </SettingsGroup>

        <SettingsGroup
          title={t('settings.sections.protection')}
          footnote={t('settings.protection_footnote')}
        >
          <SettingsRow
            icon={IconName.MONITOR}
            tint="mint"
            label={t('settings.screen_time')}
            hint={t('settings.screen_time_hint')}
            status={{
              label: authorized
                ? t('settings.screen_time_granted')
                : t('settings.screen_time_missing'),
              granted: authorized,
            }}
            onPress={requestScreenTime}
          />
          <SettingsRow
            icon={IconName.SHIELD}
            tint="mint"
            label={t('settings.blocks')}
            hint={t('settings.blocks_hint')}
            onPress={() => router.navigate('/(tabs)/blocks')}
          />
        </SettingsGroup>

        <SettingsGroup
          title={t('settings.sections.privacy')}
          footnote={t('settings.privacy_footnote')}
        >
          <SettingsRow
            icon={IconName.PULSE}
            tint="violet"
            label={t('settings.crash_reports')}
            hint={t('settings.crash_reports_hint')}
            switchValue={crashReports}
            onSwitchChange={value => {
              setPreference('crashReports', value)
              // Les étiquettes de session ont été posées au démarrage, quand
              // l'envoi pouvait être coupé : on les repose, sinon les
              // événements repris seraient orphelins de leur contexte.
              if (value) setSentryTags({ crash_reports: 'opt-in' })
            }}
          />
          <SettingsRow
            icon={IconName.LOCK}
            tint="violet"
            label={t('settings.privacy_policy')}
            onPress={() => openLink(links.privacy)}
          />
        </SettingsGroup>

        <SettingsGroup title={t('settings.sections.support')}>
          <SettingsRow
            icon={IconName.INFO}
            tint="lavender"
            label={t('settings.help')}
            onPress={() => openLink(links.help)}
          />
          <SettingsRow
            icon={IconName.MAIL}
            tint="lavender"
            label={t('settings.contact')}
            onPress={() =>
              openLink(
                `mailto:${links.supportEmail}?subject=${encodeURIComponent(
                  t('settings.contact_subject'),
                )}`,
              )
            }
          />
          <SettingsRow
            icon={IconName.BOOK}
            tint="lavender"
            label={t('settings.terms')}
            onPress={() => openLink(links.terms)}
          />
          <SettingsRow
            icon={IconName.STAR}
            tint="amber"
            label={t('settings.rate')}
            onPress={() => openLink(links.review)}
          />
          <SettingsRow
            icon={IconName.SHARE}
            tint="lavender"
            label={t('settings.share')}
            onPress={shareApp}
          />
        </SettingsGroup>

        <SettingsGroup
          title={t('settings.sections.account')}
          footnote={t('settings.account_footnote')}
        >
          <SettingsRow
            icon={IconName.LOGOUT}
            tint="amber"
            label={t('settings.logout')}
            onPress={confirmLogout}
          />
          <SettingsRow
            icon={IconName.TRASH}
            danger
            label={t('settings.delete_account')}
            onPress={() => router.push('/delete-account')}
          />
        </SettingsGroup>

        {__DEV__ ? (
          <SettingsGroup title={t('settings.sections.developer')}>
            <SettingsRow
              icon={IconName.MONITOR}
              tint="mint"
              label={t('settings.diagnostics')}
              onPress={() =>
                showNativeDiagnostics(
                  t('settings.diagnostics_title'),
                  t('settings.diagnostics_unavailable'),
                )
              }
            />
            <SettingsRow
              icon={IconName.GROWTH}
              tint="mint"
              label={t('settings.replay_onboarding')}
              onPress={resetOnboarding}
            />
          </SettingsGroup>
        ) : null}

        {/* Signature : le logotype porte la marque, la ligne du dessous ne
            dit plus que la version RÉELLEMENT installée. */}
        <View style={styles.signature}>
          <RelockWordmark height={layout.settingsLogoHeight} />
          <Text
            accessibilityRole="text"
            onLongPress={sendSentryTestEvent}
            suppressHighlighting
            style={styles.version}
          >
            {build
              ? t('settings.version_build', { version, build })
              : t('settings.version', { version })}
          </Text>
        </View>
      </Animated.ScrollView>

      {/* L'entête vit HORS du `ScrollView` : c'est une barre fixe de l'écran,
          pas le haut du contenu. */}
      <SettingsHeader
        title={t('settings.title')}
        backLabel={t('settings.back')}
        scrollY={scrollY}
        topInset={insets.top}
        onBack={() => router.back()}
      />
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.settingsHorizontal,
  },
  title: {
    ...fonts.bold,
    color: colors.homeCardInk,
    fontSize: typography.settingsTitleSize,
    lineHeight: typography.settingsTitleLineHeight,
    letterSpacing: typography.settingsTitleLetterSpacing,
    paddingTop: layout.settingsTitleTop,
    paddingBottom: layout.settingsTitleBottom,
    paddingHorizontal: layout.settingsGroupLabelHorizontal,
  },
  signature: {
    alignItems: 'center',
    paddingTop: layout.settingsSignatureTop,
    gap: layout.settingsSignatureGap,
  },
  version: {
    ...fonts.regular,
    color: colors.textTertiary,
    fontSize: typography.settingsFooterSize,
    lineHeight: typography.settingsFooterLineHeight,
    // Cible tactile de l'appui long : le texte seul est trop fin au doigt.
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.md,
  },
})
