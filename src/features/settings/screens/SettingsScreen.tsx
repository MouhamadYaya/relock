import { IconName } from '@assets/icons'
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker'
import { router, useFocusEffect } from 'expo-router'
import React from 'react'
import {
  Alert,
  AppState,
  Linking,
  Modal,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { appBuild, appConfig, appVersion, links } from '@/config/app-config'
import { AuthService } from '@/features/auth/services/auth/auth.service'
import { useBlockRulesQuery } from '@/features/blocking/hooks/useBlockRulesQuery'
import {
  currentDailyLimit,
  DAILY_LIMIT_CHOICES,
  setDailyLimit,
} from '@/features/blocking/services/daily-screen-time'
import { emergencyUnlock } from '@/features/blocking/services/emergency-unlock'
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
import { SettingsHeader } from '@/features/settings/components/SettingsHeader'
import { SettingsRow } from '@/features/settings/components/SettingsRow'
import { SettingsSection } from '@/features/settings/components/SettingsSection'
import { SettingsSheet } from '@/features/settings/components/SettingsSheet'
import {
  buildDataExport,
  serializeDataExport,
} from '@/features/settings/services/data-export'
import { useProfile } from '@/features/user/hooks/useProfile'
import { i18n } from '@/i18n'
import { useT } from '@/i18n/useT'
import { resetOnboarding, syncEntitlement } from '@/session/bootstrap'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import { Notif, type NotifPermission } from '@/shared/native/notifications'
import { ScreenTime } from '@/shared/native/screen-time'
import {
  applyCrashReportsPreference,
  captureError,
  isSentryEnabled,
  setSentryTags,
} from '@/shared/services/monitoring/sentry'
import {
  getReminderMinutes,
  setReminderMinutes,
} from '@/shared/services/storage/app-preferences'
import { useAppGateStore } from '@/shared/stores/app-gate.store'
import { usePreferences } from '@/shared/stores/preferences.store'
import { settingsTheme } from '@/shared/theme'
import { showErrorToast, showToast } from '@/shared/utils/toast'

const { colors, spacing, type } = settingsTheme

const THEME_KEY = {
  light: 'settings.theme_light',
  dark: 'settings.theme_dark',
  system: 'settings.theme_system',
} as const

/**
 * Les langues, écrites dans leur propre langue — même convention que le
 * sélecteur (`LanguagePickerModal`). `i18n.language` peut valoir n'importe
 * quoi (locale régionale héritée, langue retirée depuis) : le repli évite
 * d'afficher un code brut dans la colonne de droite.
 */
const LANGUAGE_NAME: Record<string, string> = {
  fr: 'Français',
  en: 'English',
  de: 'Deutsch',
  ru: 'Русский',
}

/** Minutes depuis minuit → `Date` d'aujourd'hui, pour le sélecteur natif. */
function minutesToDate(minutes: number): Date {
  const date = new Date()
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0)
  return date
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
  const entitled = useAppGateStore(s => s.entitled)
  const revenueCatEnabled = isRevenueCatEnabled()
  const { rules, refetch: refetchRules } = useBlockRulesQuery()

  const haptics = usePreferences(s => s.haptics)
  const pauseSound = usePreferences(s => s.pauseSound)
  const crashReports = usePreferences(s => s.crashReports)
  const setPreference = usePreferences(s => s.setPreference)

  const [restoring, setRestoring] = React.useState(false)
  const [unlocking, setUnlocking] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [limitSheet, setLimitSheet] = React.useState(false)
  const [reminder, setReminder] = React.useState(getReminderMinutes)

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

  // Statuts RÉELS des permissions et de la protection, jamais codés en dur :
  // ce que l'écran affiche doit venir du système, sinon il ment dès qu'on
  // change un réglage depuis iOS.
  const [authorized, setAuthorized] = React.useState(false)
  const [notifPermission, setNotifPermission] =
    React.useState<NotifPermission>('notDetermined')
  const [uninstallGuard, setUninstallGuard] = React.useState({
    enabled: false,
    active: false,
  })

  /**
   * Relit les trois états auprès du système.
   *
   * Trois lectures indépendantes : une plateforme sans Family Controls a
   * quand même des notifications.
   */
  const refreshPermissions = React.useCallback(() => {
    if (ScreenTime.isAvailable) {
      ScreenTime.authorizationStatus()
        .then(s => setAuthorized(s === 'approved'))
        .catch(() => {})
      ScreenTime.uninstallProtection()
        .then(setUninstallGuard)
        .catch(() => {})
    }
    Notif.permissionStatus()
      .then(setNotifPermission)
      .catch(() => {})
  }, [])

  // Ces permissions se révoquent DEPUIS iOS, pas seulement depuis ici. Une
  // lecture au seul montage laisse donc l'écran affirmer « accordée » alors
  // que la protection est tombée, et proposer des actions qui échoueront.
  //
  // Deux réveils complémentaires : le focus couvre le retour depuis un autre
  // écran (montage inclus), l'`AppState` couvre l'aller-retour par Réglages
  // iOS — celui qui change vraiment les permissions, et pendant lequel
  // l'écran n'a jamais perdu le focus.
  useFocusEffect(refreshPermissions)

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') refreshPermissions()
    })
    return () => subscription.remove()
  }, [refreshPermissions])

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

  const applyUninstallProtection = (enabled: boolean) => {
    ScreenTime.setUninstallProtection(enabled)
      .then(() => ScreenTime.uninstallProtection())
      .then(setUninstallGuard)
      .catch(e => showErrorToast(e))
  }

  /**
   * L'explication précède l'activation, jamais l'inverse.
   *
   * La restriction iOS est GLOBALE : pendant un blocage, plus aucune app ne
   * peut être supprimée de l'appareil. Quelqu'un qui découvrirait ça en
   * essayant de désinstaller autre chose penserait, à raison, que son
   * téléphone est cassé. Couper, en revanche, ne demande rien : on ne met pas
   * d'obstacle devant la sortie.
   */
  const toggleUninstallProtection = (enabled: boolean) => {
    if (!ScreenTime.isAvailable) {
      Alert.alert(
        t('settings.uninstall_protection'),
        t('settings.uninstall_unavailable'),
      )
      return
    }
    if (!enabled) {
      applyUninstallProtection(false)
      return
    }
    Alert.alert(
      t('settings.uninstall_explain_title'),
      t('settings.uninstall_explain_body'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.uninstall_explain_cta'),
          onPress: () => applyUninstallProtection(true),
        },
      ],
    )
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

  const mailTo = (subject: string, body?: string) =>
    openLink(
      `mailto:${links.supportEmail}?subject=${encodeURIComponent(subject)}` +
        (body ? `&body=${encodeURIComponent(body)}` : ''),
    )

  const shareApp = () => {
    Share.share({
      message: `${t('settings.share_message')} ${links.share}`,
    }).catch(() => {})
  }

  // ─── Déblocage d'urgence ────────────────────────────────────────────────
  const activeRules = rules.filter(r => r.isActive)

  const confirmEmergencyUnlock = () => {
    if (activeRules.length === 0) {
      showToast(t('settings.emergency_none'))
      return
    }
    Alert.alert(
      t('settings.emergency_title'),
      t('settings.emergency_body', { count: activeRules.length }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.emergency_cta'),
          style: 'destructive',
          onPress: () => {
            setUnlocking(true)
            void (async () => {
              try {
                // On passe TOUTES les règles, pas seulement les actives : une
                // règle inactive peut avoir laissé une activité armée côté
                // iOS (arrêt hors ligne, plantage). La sortie de secours doit
                // ne rien laisser derrière elle.
                const result = await emergencyUnlock(rules)
                await refetchRules()
                await ScreenTime.uninstallProtection()
                  .then(setUninstallGuard)
                  .catch(() => {})
                showToast(
                  result.failed > 0
                    ? t('settings.emergency_partial', { count: result.failed })
                    : t('settings.emergency_done'),
                )
              } catch (e) {
                captureError(e, {
                  tags: { feature: 'settings', op: 'emergency-unlock' },
                })
                showErrorToast(e)
              } finally {
                setUnlocking(false)
              }
            })()
          },
        },
      ],
    )
  }

  // ─── Temps d'écran par jour ─────────────────────────────────────────────
  const dailyLimit = currentDailyLimit(rules)

  const formatDuration = (minutes: number): string => {
    if (minutes < 60) return t('settings.duration_minutes', { minutes })
    const hours = Math.floor(minutes / 60)
    const rest = minutes % 60
    return rest === 0
      ? t('settings.duration_hours', { hours })
      : t('settings.duration_hours_minutes', { hours, minutes: rest })
  }

  const openDailyLimit = () => {
    if (dailyLimit === null) {
      // Ce réglage ajuste une règle existante ; il n'en crée pas. Créer un
      // blocage demande de choisir des apps dans le sélecteur d'Apple, ce qui
      // n'a pas sa place dans une liste de réglages.
      Alert.alert(
        t('settings.daily_limit_missing_title'),
        t('settings.daily_limit_missing_body'),
        [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('settings.daily_limit_missing_cta'),
            onPress: () => router.push('/add-block'),
          },
        ],
      )
      return
    }
    setLimitSheet(true)
  }

  const chooseDailyLimit = (minutes: number) => {
    setLimitSheet(false)
    void (async () => {
      try {
        await setDailyLimit(rules, minutes)
        await refetchRules()
        showToast(t('settings.daily_limit_updated'))
      } catch (e) {
        showErrorToast(e)
      }
    })()
  }

  // ─── Heure des rappels ──────────────────────────────────────────────────
  const onChangeReminder = (_event: DateTimePickerEvent, date?: Date) => {
    if (!date) return
    const minutes = date.getHours() * 60 + date.getMinutes()
    setReminder(minutes)
    setReminderMinutes(minutes)
    // Replanifie tout de suite : le reconciler est idempotent, et le rappel de
    // ce soir doit déjà tomber à la nouvelle heure.
    NotificationService.reconcileFromLast().catch(() => {})
  }

  // ─── Export ─────────────────────────────────────────────────────────────
  const exportData = () => {
    setExporting(true)
    void (async () => {
      try {
        const payload = await buildDataExport()
        await Share.share({
          title: t('settings.export_subject'),
          message: serializeDataExport(payload),
        })
      } catch (e) {
        captureError(e, { tags: { feature: 'settings', op: 'export' } })
        showErrorToast(t('settings.export_error'))
      } finally {
        setExporting(false)
      }
    })()
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
      disableBottomInset
      backgroundColor={colors.bg}
      statusBarProps={{ backgroundColor: colors.bg }}
    >
      <SettingsHeader
        title={t('settings.title')}
        backLabel={t('settings.back')}
        onBack={() => router.back()}
      />

      <ScrollView
        testID="settings-scroll"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          // Marge basse généreuse : la dernière ligne ne doit jamais finir
          // collée au bord, ni sous l'encoche basse.
          { paddingBottom: insets.bottom + spacing.sectionGap * 2 },
        ]}
      >
        <SettingsSection
          title={t('settings.sections.account')}
          caption={t('settings.pro.footnote')}
        >
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
          <SettingsRow
            icon={IconName.CROWN}
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
            label={t('settings.pro.restore')}
            busy={restoring}
            onPress={restorePurchases}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.sections.personalization')}>
          <SettingsRow
            icon={IconName.MOON}
            label={t('settings.appearance')}
            value={t(THEME_KEY.dark)}
            onPress={() => router.push('/theme-picker')}
          />
          <SettingsRow
            icon={IconName.GLOBE}
            label={t('settings.language.label')}
            value={LANGUAGE_NAME[i18n.language] ?? i18n.language.toUpperCase()}
            onPress={() => router.push('/language-picker')}
          />
          <SettingsRow
            icon={IconName.PULSE}
            label={t('settings.haptics')}
            hint={t('settings.haptics_hint')}
            switchValue={haptics}
            onSwitchChange={v => setPreference('haptics', v)}
          />
          <SettingsRow
            icon={IconName.HEADPHONES}
            label={t('settings.pause_sound')}
            hint={t('settings.pause_sound_hint')}
            switchValue={pauseSound}
            onSwitchChange={v => setPreference('pauseSound', v)}
          />
        </SettingsSection>

        {/* Peu de notifications, mais utiles ; jamais de promotion. */}
        <SettingsSection
          title={t('settings.sections.notifications')}
          caption={t('settings.notifications_footnote')}
        >
          {/*
            La permission iOS passe AVANT les préférences, et non après.
            Tant qu'elle manque, aucun interrupteur de cette section ne fera
            apparaître quoi que ce soit : un « Autoriser les notifications »
            en tête, allumé, au-dessus d'une autorisation « À demander »,
            laisse croire que tout fonctionne déjà. L'ordre dit la
            dépendance.

            Aucune demande n'est déclenchée à l'ouverture de l'écran : la
            ligne ne fait qu'ouvrir les réglages du système, où le choix
            appartient à l'utilisateur.
          */}
          {notifPermission !== 'granted' ? (
            <SettingsRow
              icon={IconName.MONITOR}
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
          <SettingsRow
            icon={IconName.BELL}
            label={t('settings.notifications_master')}
            switchValue={notif.master}
            onSwitchChange={v => updateNotif({ master: v })}
          />
          {/*
            Les catégories restent VISIBLES quand l'interrupteur maître est
            coupé, simplement désactivées. Les masquer effaçait la dépendance
            au lieu de l'expliquer — et donnait l'impression que le réglage
            avait été perdu, alors que la préférence est bien conservée et
            retrouvée telle quelle à la réactivation.
          */}
          <SettingsRow
            icon={IconName.CLOCK}
            label={t('settings.notifications_reminders')}
            hint={t('settings.notifications_reminders_hint')}
            switchValue={notif.reminders}
            onSwitchChange={v => updateNotif({ reminders: v })}
            disabled={!notif.master}
          />
          {notif.reminders ? (
            <SettingsRow
              icon={IconName.SUNRISE}
              label={t('settings.reminder_time')}
              disabled={!notif.master}
              accessory={
                <DateTimePicker
                  mode="time"
                  display="compact"
                  themeVariant="dark"
                  value={minutesToDate(reminder)}
                  onChange={onChangeReminder}
                  accessibilityLabel={t('settings.reminder_time')}
                />
              }
            />
          ) : null}
          <SettingsRow
            icon={IconName.STAR}
            label={t('settings.notifications_progression')}
            hint={t('settings.notifications_progression_hint')}
            switchValue={notif.progression}
            onSwitchChange={v => updateNotif({ progression: v })}
            disabled={!notif.master}
          />
        </SettingsSection>

        <SettingsSection
          title={t('settings.sections.protection')}
          caption={t('settings.protection_footnote')}
        >
          <SettingsRow
            icon={IconName.MONITOR}
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
            icon={IconName.CLOCK}
            label={t('settings.daily_limit')}
            hint={t('settings.daily_limit_hint')}
            value={
              dailyLimit === null
                ? t('settings.daily_limit_none')
                : formatDuration(dailyLimit)
            }
            onPress={openDailyLimit}
          />
          <SettingsRow
            icon={IconName.SHIELD}
            label={t('settings.blocks')}
            hint={t('settings.blocks_hint')}
            onPress={() => router.navigate('/(tabs)/blocks')}
          />
          <SettingsRow
            icon={IconName.LOCK}
            label={t('settings.uninstall_protection')}
            hint={t('settings.uninstall_protection_hint')}
            switchValue={uninstallGuard.enabled}
            onSwitchChange={toggleUninstallProtection}
          />
        </SettingsSection>

        <SettingsSection
          title={t('settings.sections.privacy')}
          caption={t('settings.privacy_footnote')}
        >
          <SettingsRow
            icon={IconName.PULSE}
            label={t('settings.crash_reports')}
            hint={t('settings.crash_reports_hint')}
            switchValue={crashReports}
            onSwitchChange={value => {
              setPreference('crashReports', value)
              // La préférence d'abord (elle survit à tout), le SDK ensuite.
              // Sans cette seconde ligne, couper l'interrupteur ne ferait
              // taire que les appels de NOTRE code : crashs natifs, sessions,
              // traces et replay continueraient de partir seuls.
              applyCrashReportsPreference(value)
              if (value) setSentryTags({ crash_reports: 'opt-in' })
            }}
          />
          <SettingsRow
            icon={IconName.SHARE}
            label={t('settings.export')}
            hint={t('settings.export_hint')}
            busy={exporting}
            onPress={exportData}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.sections.support')}>
          <SettingsRow
            icon={IconName.INFO}
            label={t('settings.help')}
            onPress={() => openLink(links.help)}
          />
          {/* Un stylo, pas un graphique à barres : on propose une idée, on
              ne consulte pas des statistiques. */}
          <SettingsRow
            icon={IconName.PEN}
            label={t('settings.feedback_feature')}
            onPress={() => mailTo(t('settings.feedback_feature_subject'))}
          />
          {/* Le contexte technique est pré-rempli : un rapport de bug sans
              version ni appareil coûte un aller-retour à tout le monde. */}
          <SettingsRow
            icon={IconName.BLOCK}
            label={t('settings.feedback_bug')}
            onPress={() =>
              mailTo(
                t('settings.feedback_bug_subject'),
                `\n\n---\n${t('settings.feedback_bug_body')}\n${appConfig.appName} ${version}${build ? ` (${build})` : ''}\n${i18n.language}\n`,
              )
            }
          />
          <SettingsRow
            icon={IconName.MAIL}
            label={t('settings.contact')}
            onPress={() => mailTo(t('settings.contact_subject'))}
          />
          {/* Retirée tant qu'aucune fiche App Store n'existe : proposer
              « Noter l'app » pour ouvrir une page introuvable est pire que
              de ne rien proposer. */}
          {links.review ? (
            <SettingsRow
              icon={IconName.STAR}
              label={t('settings.rate')}
              onPress={() => {
                if (links.review) openLink(links.review)
              }}
            />
          ) : null}
          <SettingsRow
            icon={IconName.SHARE}
            label={t('settings.share')}
            onPress={shareApp}
          />
        </SettingsSection>

        <SettingsSection title={t('settings.sections.about')}>
          <SettingsRow
            icon={IconName.LOCK}
            label={t('settings.privacy_policy')}
            onPress={() =>
              openLink(
                i18n.language.startsWith('fr')
                  ? links.privacyFr
                  : links.privacy,
              )
            }
          />
          <SettingsRow
            icon={IconName.BOOK}
            label={t('settings.terms')}
            onPress={() =>
              openLink(
                i18n.language.startsWith('fr') ? links.termsFr : links.terms,
              )
            }
          />
        </SettingsSection>

        {__DEV__ ? (
          <SettingsSection title={t('settings.sections.developer')}>
            <SettingsRow
              icon={IconName.MONITOR}
              label={t('settings.diagnostics')}
              onPress={() =>
                showNativeDiagnostics(
                  t('settings.diagnostics_title'),
                  t('settings.diagnostics_unavailable'),
                )
              }
            />
            <SettingsRow
              icon={IconName.COMPASS}
              label={t('settings.replay_onboarding')}
              onPress={resetOnboarding}
            />
          </SettingsSection>
        ) : null}

        {/*
          La zone sensible ferme l'écran, dans l'ordre de gravité croissante :
          se déconnecter (on revient quand on veut), lever tous les blocages,
          remettre les compteurs à zéro, supprimer le compte. Du plus
          réversible au moins réversible — on ne tombe pas par mégarde sur la
          dernière marche en cherchant la première.
        */}
        <SettingsSection
          title={t('settings.sections.danger')}
          caption={t('settings.emergency_footnote')}
        >
          <SettingsRow
            icon={IconName.LOGOUT}
            danger
            label={t('settings.logout')}
            onPress={confirmLogout}
          />
          <SettingsRow
            icon={IconName.BLOCK}
            danger
            label={t('settings.emergency')}
            hint={t('settings.emergency_hint')}
            busy={unlocking}
            onPress={confirmEmergencyUnlock}
          />
          <SettingsRow
            icon={IconName.LAYERS}
            danger
            label={t('settings.reset')}
            hint={t('settings.reset_hint')}
            onPress={() => router.push('/reset-app')}
          />
          <SettingsRow
            icon={IconName.TRASH}
            danger
            label={t('settings.delete_account')}
            onPress={() => router.push('/delete-account')}
          />
        </SettingsSection>

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
      </ScrollView>

      <Modal
        visible={limitSheet}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={() => setLimitSheet(false)}
      >
        <SettingsSheet
          title={t('settings.daily_limit_sheet_title')}
          closeLabel={t('common.close')}
          onClose={() => setLimitSheet(false)}
        >
          <View>
            {DAILY_LIMIT_CHOICES.map(minutes => (
              <React.Fragment key={minutes}>
                {minutes !== DAILY_LIMIT_CHOICES[0] ? (
                  <View style={styles.sheetDivider} />
                ) : null}
                <SettingsRow
                  label={formatDuration(minutes)}
                  selected={dailyLimit === minutes}
                  onPress={() => chooseDailyLimit(minutes)}
                />
              </React.Fragment>
            ))}
          </View>
        </SettingsSheet>
      </Modal>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.screenH },
  version: {
    textAlign: 'center',
    color: colors.textTertiary,
    fontSize: type.caption.size,
    fontWeight: type.caption.weight,
    marginTop: spacing.sectionGap,
    // Cible tactile de l'appui long : le texte seul est trop fin au doigt.
    paddingVertical: 8,
  },
  sheetDivider: {
    height: settingsTheme.size.hairline,
    backgroundColor: colors.divider,
    marginLeft: spacing.rowH + spacing.iconGutter + spacing.iconGap,
    marginRight: spacing.rowH,
  },
})
