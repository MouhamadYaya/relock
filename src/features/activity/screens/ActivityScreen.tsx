import { IconName } from '@assets/icons'
import { useIsFocused } from '@react-navigation/native'
import { router } from 'expo-router'
import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  DeviceEventEmitter,
  Linking,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Svg, { Path } from 'react-native-svg'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import {
  isScreenTimeReportAvailable,
  ScreenTimeReport,
} from '@/shared/native/ScreenTimeReport'
import { requireScreenTime } from '@/shared/native/screen-time-gate'
import { useScreenTimeAuthorization } from '@/shared/native/useScreenTimeAuth'
import { fonts } from '@/shared/theme/tokens/fonts'
import { haptics } from '@/shared/utils/platform/haptics'

const C = {
  bg: '#0B0C10',
  surface: '#1C1C1E',
  surface2: '#1C1F2B',
  ink: '#F0F0F4',
  ink2: '#A8ABBE',
  ink3: '#6B6F82',
  accent: '#A49AFE',
  border: 'rgba(148,152,178,0.16)',
}

function ReloadIcon({ color, size = 19 }: { color: string; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function ActivityHeader({ refreshing }: { refreshing?: boolean }) {
  const t = useT()
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{t('activity.title')}</Text>
      <View style={styles.headerActions}>
        <View style={styles.iconBtn}>
          {refreshing ? (
            <ActivityIndicator size="small" color={C.accent} />
          ) : (
            <ReloadIcon color={C.ink2} />
          )}
        </View>
        <View style={styles.iconBtn}>
          <IconSvg name={IconName.SETTINGS} size={19} color={C.ink2} />
        </View>
      </View>
    </View>
  )
}

function ReportPlaceholder({ refreshing }: { refreshing?: boolean }) {
  const t = useT()
  return (
    <View
      testID="activity-report-placeholder"
      style={styles.placeholder}
      pointerEvents="none"
    >
      <ActivityHeader refreshing={refreshing} />
      <View style={styles.placeholderDays}>
        {[0, 1, 2, 3, 4, 5, 6].map(day => (
          <View key={day} style={styles.placeholderDay} />
        ))}
      </View>
      <View style={styles.placeholderSummary}>
        <View style={styles.placeholderLabel} />
        <View style={styles.placeholderTotal} />
        <View style={styles.placeholderLabelWide} />
      </View>
      <View style={styles.placeholderSectionLabel} />
      <View style={styles.placeholderChart}>
        <ActivityIndicator color={C.accent} />
        <Text style={styles.loadingText}>{t('activity.state.loading')}</Text>
      </View>
      <View style={styles.placeholderSectionLabel} />
      <View style={styles.placeholderRows}>
        {[0, 1, 2].map(row => (
          <View key={row} style={styles.placeholderRow}>
            <View style={styles.placeholderIcon} />
            <View style={styles.placeholderRowText} />
            <View style={styles.placeholderDuration} />
          </View>
        ))}
      </View>
    </View>
  )
}

function StateCard({
  icon,
  title,
  description,
  action,
  onPress,
}: {
  icon: 'monitor' | 'reload'
  title: string
  description: string
  action: string
  onPress: () => void
}) {
  return (
    <View style={styles.statePage}>
      <ActivityHeader />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={action}
        onPress={onPress}
        shadow={{ color: C.accent }}
        style={styles.stateCard}
      >
        <View style={styles.stateIcon}>
          {icon === 'monitor' ? (
            <IconSvg name={IconName.MONITOR} size={24} color={C.accent} />
          ) : (
            <ReloadIcon color={C.accent} size={24} />
          )}
        </View>
        <Text style={styles.stateTitle}>{title}</Text>
        <Text style={styles.stateDescription}>{description}</Text>
        <Text style={styles.stateAction}>{action}</Text>
      </PressableScale>
    </View>
  )
}

type NativeCommandEvent = { nativeEvent: { command: string } }

export default function ActivityScreen() {
  const t = useT()
  const isFocused = useIsFocused()
  const [dayOffset, setDayOffset] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [reportLoading, setReportLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const {
    status: authorizationStatus,
    authorized,
    refresh,
  } = useScreenTimeAuthorization()

  // Native UIKit owns foreground recovery for both Home and Activity. An
  // AppState listener here also fired after alerts and raced the native mount.
  const reportIdentity = `${dayOffset}-${reloadKey}`
  // biome-ignore lint/correctness/useExhaustiveDependencies: reportIdentity n'est pas lu, c'est son changement (jour, rechargement) qui remet l'écran d'attente
  useEffect(() => {
    if (authorized && isFocused) setReportLoading(true)
  }, [authorized, isFocused, reportIdentity])

  const reloadReport = useCallback(async () => {
    if (isRefreshing) return
    setIsRefreshing(true)
    setReportLoading(true)
    try {
      const nextStatus = await refresh()
      if (nextStatus === 'approved') setReloadKey(key => key + 1)
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing, refresh])

  /**
   * `Linking.openSettings()` en repli, c'était envoyer vers la fiche Réglages
   * de Relock — qui ne contient aucun interrupteur Temps d'écran quand
   * l'autorisation a été refusée. `requireScreenTime` ouvre la fenêtre système
   * s'il en reste une, et l'écran de récupération dit quoi faire sinon.
   */
  const askAuthorization = useCallback(async () => {
    const gate = await requireScreenTime()
    const checkedStatus = await refresh()
    if (gate === 'approved' && checkedStatus === 'approved') {
      setReloadKey(key => key + 1)
      return
    }
    if (gate === 'blocked') router.push('/screen-time-help')
  }, [refresh])

  const selectDay = useCallback((nextOffset: number) => {
    if (!Number.isInteger(nextOffset) || nextOffset < 0 || nextOffset > 6)
      return
    setDayOffset(nextOffset)
  }, [])

  /**
   * L'entête du rapport (actualiser, réglages, les sept jours) est dessinée en
   * UIKit, pas en React — elle vit dans `ScreenTimeReportView.swift`, par-dessus
   * la vue système de Screen Time. Le retour haptique de ces boutons part donc
   * d'ici, à réception de la commande, et non d'un `onPressIn`.
   *
   * Il n'est volontairement PAS déclenché côté natif : le réglage « Retours
   * haptiques » vit dans MMKV, côté JS. Un `UIImpactFeedbackGenerator` posé
   * dans le Swift vibrerait pour quelqu'un qui a justement coupé l'option.
   */
  const handleNativeCommand = useCallback(
    ({ nativeEvent: { command } }: NativeCommandEvent) => {
      if (command === 'ready') {
        setReportLoading(false)
        return
      }
      if (command === 'reloading') {
        setReportLoading(true)
        return
      }
      if (command === 'refresh') {
        haptics.selectionTick()
        reloadReport().catch(() => {})
        return
      }
      if (command === 'settings') {
        haptics.selectionTick()
        router.push('/settings')
        return
      }
      const selection = command.match(/^select\.day(\d)$/)
      if (selection) {
        haptics.selectionTick()
        selectDay(Number(selection[1]))
      }
    },
    [reloadReport, selectDay],
  )

  useEffect(() => {
    const settingsSub = DeviceEventEmitter.addListener(
      'relock-native-settings',
      () => {
        haptics.selectionTick()
        router.push('/settings')
      },
    )
    return () => settingsSub.remove()
  }, [])

  useEffect(() => {
    if (!__DEV__) return
    const sub = DeviceEventEmitter.addListener(
      'relock-dev-activity-day',
      (selection: { offset: number }) => selectDay(selection.offset),
    )
    return () => sub.remove()
  }, [selectDay])

  const nativeReportVisible =
    authorized && isFocused && isScreenTimeReportAvailable

  return (
    <ScreenWrapper backgroundColor={C.bg}>
      <View style={styles.root}>
        {nativeReportVisible ? (
          <>
            {reportLoading ? (
              <ReportPlaceholder refreshing={isRefreshing} />
            ) : null}
            <ScreenTimeReport
              testID="activity-report"
              style={styles.report}
              mode="usage"
              offset={dayOffset}
              reloadToken={reloadKey}
              onCommand={handleNativeCommand}
              fallback={
                <StateCard
                  icon="reload"
                  title={t('activity.state.report_unavailable_title')}
                  description={t('activity.state.report_unavailable_body')}
                  action={t('common.retry')}
                  onPress={() => {
                    reloadReport().catch(() => {})
                  }}
                />
              }
            />
          </>
        ) : authorizationStatus === 'denied' ||
          authorizationStatus === 'notDetermined' ? (
          <StateCard
            icon="monitor"
            title={t('activity.state.denied_title')}
            description={t('activity.state.denied_body')}
            action={t('activity.state.allow')}
            onPress={() => {
              askAuthorization().catch(() => {})
            }}
          />
        ) : authorizationStatus === 'error' ? (
          <StateCard
            icon="reload"
            title={t('activity.state.error_title')}
            description={t('activity.state.error_body')}
            action={t('common.retry')}
            onPress={() => {
              reloadReport().catch(() => {})
            }}
          />
        ) : authorizationStatus === 'unavailable' ||
          !isScreenTimeReportAvailable ? (
          <StateCard
            icon="monitor"
            title={t('activity.state.device_title')}
            description={t('activity.state.device_body')}
            action={t('home.permission_open_settings')}
            onPress={() => Linking.openSettings()}
          />
        ) : (
          <ReportPlaceholder refreshing={isRefreshing} />
        )}
      </View>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  report: { ...StyleSheet.absoluteFillObject, backgroundColor: 'transparent' },
  header: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...fonts.bold,
    fontSize: 24,
    color: C.ink,
    letterSpacing: -0.6,
  },
  headerActions: { flexDirection: 'row', gap: 10 },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    paddingHorizontal: 20,
    paddingTop: 4,
    backgroundColor: C.bg,
  },
  placeholderDays: {
    height: 78,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  placeholderDay: {
    width: 38,
    height: 44,
    borderRadius: 22,
    backgroundColor: C.surface2,
  },
  placeholderSummary: {
    height: 132,
    padding: 16,
    borderRadius: 18,
    backgroundColor: C.surface,
    gap: 10,
  },
  placeholderLabel: {
    width: 92,
    height: 11,
    borderRadius: 6,
    backgroundColor: C.border,
  },
  placeholderTotal: {
    width: 132,
    height: 34,
    borderRadius: 10,
    backgroundColor: C.surface2,
  },
  placeholderLabelWide: {
    width: 168,
    height: 13,
    borderRadius: 7,
    backgroundColor: C.border,
  },
  placeholderSectionLabel: {
    width: 176,
    height: 13,
    marginTop: 18,
    marginBottom: 10,
    borderRadius: 7,
    backgroundColor: C.border,
  },
  placeholderChart: {
    height: 184,
    borderRadius: 18,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: { ...fonts.medium, fontSize: 13, color: C.ink3 },
  placeholderRows: {
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: C.surface,
  },
  placeholderRow: {
    height: 66,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  placeholderIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: C.surface2,
  },
  placeholderRowText: {
    width: 120,
    height: 13,
    borderRadius: 7,
    backgroundColor: C.border,
  },
  placeholderDuration: {
    width: 48,
    height: 13,
    marginLeft: 'auto',
    borderRadius: 7,
    backgroundColor: C.border,
  },
  statePage: { flex: 1, paddingHorizontal: 20, paddingTop: 4 },
  stateCard: {
    flex: 1,
    maxHeight: 320,
    marginTop: 28,
    paddingHorizontal: 32,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateIcon: {
    width: 54,
    height: 54,
    borderRadius: 17,
    marginBottom: 14,
    backgroundColor: 'rgba(164,154,254,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateTitle: {
    ...fonts.bold,
    fontSize: 17,
    color: C.ink,
    textAlign: 'center',
  },
  stateDescription: {
    ...fonts.regular,
    marginTop: 8,
    fontSize: 13.5,
    lineHeight: 20,
    color: C.ink2,
    textAlign: 'center',
  },
  stateAction: {
    ...fonts.semiBold,
    marginTop: 18,
    fontSize: 14,
    color: C.accent,
  },
})
