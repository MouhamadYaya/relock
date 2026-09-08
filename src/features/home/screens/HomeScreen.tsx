import { IconName } from '@assets/icons'
import { router } from 'expo-router'
import React, { useCallback, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { HomeBackdrop } from '@/features/home/components/HomeBackdrop'
import { HomeDashboardSurface } from '@/features/home/components/HomeDashboardSurface'
import { HomeDetailSheet } from '@/features/home/components/HomeDetailSheet'
import { HomeHeader } from '@/features/home/components/HomeHeader'
import { HomeHeaderScrim } from '@/features/home/components/HomeHeaderScrim'
import { HomeMyAppsCard } from '@/features/home/components/HomeMyAppsCard'
import { HomeProgressCard } from '@/features/home/components/HomeProgressCard'
import { HomeScoreCard } from '@/features/home/components/HomeScoreCard'
import { HomeScoreDetail } from '@/features/home/components/HomeScoreDetail'
import { useHomeDashboard } from '@/features/home/hooks/useHomeDashboard'
import { durationParts } from '@/features/home/services/home-dashboard'
import {
  scoreBandKey,
  scoreFooterKey,
} from '@/features/home/services/home-score'
import { useT } from '@/i18n/useT'
import { useWarmRoute } from '@/navigation/helpers/route-warmup'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import { ScreenTime } from '@/shared/native/screen-time'
import { requireScreenTime } from '@/shared/native/screen-time-gate'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'

const { colors, layout, radius, typography } = relockMaterial

export default function HomeScreen() {
  const t = useT()
  const insets = useSafeAreaInsets()
  const dashboard = useHomeDashboard()
  const [streakOpen, setStreakOpen] = useState(false)
  // Les Réglages sont l'écran le plus lourd de l'app, et on y va depuis ici :
  // on charge son module pendant que l'Accueil ne fait rien.
  useWarmRoute('settings')
  const [scoreOpen, setScoreOpen] = useState(false)
  // Le voile de l'entete naît du défilement : on suit l'offset sur le thread
  // UI (aucun aller-retour JS, donc aucun retard sur un scroll rapide).
  const scrollY = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler(event => {
    scrollY.value = event.contentOffset.y
  })
  const streak = dashboard.referenceFixture?.streak ?? dashboard.stats.streak

  const countdown = useMemo(() => {
    const duration = durationParts(dashboard.streakMinutesRemaining)
    if (duration.unit === 'minutes')
      return t('home.duration_minutes', { minutes: duration.minutes })
    if (duration.unit === 'hours')
      return t('home.duration_hours', { hours: duration.hours })
    return t('home.duration_hours_minutes', {
      hours: duration.hours,
      minutes: duration.minutes,
    })
  }, [dashboard.streakMinutesRemaining, t])

  /**
   * L'ancienne version rappelait `requestAuthorization()` puis, en cas
   * d'échec, proposait « Ouvrir Réglages ». Les deux gestes étaient vides :
   * iOS ne représente plus sa fenêtre après un refus, et la fiche Réglages de
   * Relock ne contient aucun interrupteur Temps d'écran. On passait donc son
   * temps à renvoyer les gens chercher une chose absente.
   *
   * `requireScreenTime` ne demande que lorsqu'il reste une fenêtre à ouvrir,
   * et l'écran de récupération prend le relais quand il n'y en a plus.
   */
  const requestScreenTimeAuthorization = useCallback(async () => {
    if (!ScreenTime.isAvailable) return
    const gate = await requireScreenTime()
    await dashboard.authorization.refresh()
    if (gate === 'blocked') router.push('/screen-time-help')
  }, [dashboard.authorization])

  const openBlocks = useCallback(() => {
    if (dashboard.isNewUser && !dashboard.referenceFixture)
      router.push('/add-block')
    else router.navigate('/(tabs)/blocks')
  }, [dashboard.isNewUser, dashboard.referenceFixture])

  // Les quatre gestes de l'écran, d'identité stable : ils traversent
  // `React.memo` sans le percer à chaque tic d'horloge (`now` avance toutes
  // les 30 s et re-rend cet écran, pas ses cartes).
  const openScoreDetail = useCallback(() => setScoreOpen(true), [])
  const closeScoreDetail = useCallback(() => setScoreOpen(false), [])
  const openStreakDetail = useCallback(() => setStreakOpen(true), [])
  const closeStreakDetail = useCallback(() => setStreakOpen(false), [])
  const openSettings = useCallback(() => router.push('/settings'), [])
  const openBlocksUnlock = useCallback(
    () =>
      router.navigate({
        pathname: '/(tabs)/blocks',
        params: { homeUnlockRequest: String(Date.now()) },
      }),
    [],
  )

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
      <HomeBackdrop />
      <Animated.ScrollView
        testID="home-scroll"
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.scroll}
        removeClippedSubviews={false}
        automaticallyAdjustContentInsets={false}
        bounces
        alwaysBounceVertical
        contentInsetAdjustmentBehavior="never"
        directionalLockEnabled
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: insets.bottom + layout.homeTabBarHeight + spacing.lg,
          },
        ]}
      >
        <View style={styles.container}>
          <HomeDashboardSurface
            authorization={dashboard.authorization.status}
            heroAccessibilityLabel={t('home.screen_time_open_activity')}
            topAppsAccessibilityLabel={t('home.top_apps_open_activity')}
            screenTimeLabel={t('home.screen_time_today')}
            permissionLabel={t('home.screen_time_permission')}
            unavailableLabel={t('home.screen_time_unavailable')}
            topAppsLabel={t('home.top_apps')}
            emptyUsageLabel={t('home.usage_missing')}
            activityLabel={t('navigation.tabs.activity')}
            onPressHero={() => router.navigate('/(tabs)/activity')}
            onRequestPermission={requestScreenTimeAuthorization}
            scoreCard={
              <HomeScoreCard
                scores={dashboard.scores}
                title={t('home.global_score')}
                subtitle={t('home.score_today')}
                delta={dashboard.score.delta}
                deltaSuffix={t('home.score_delta_suffix')}
                bandLabel={t(scoreBandKey(dashboard.score))}
                footerLabel={t(scoreFooterKey(dashboard.score))}
                focusLabel={t('home.focus_score')}
                restLabel={t('home.rest_score')}
                accessibilityLabel={`${t('home.global_score')} ${
                  dashboard.scores.global ?? '—'
                }, ${t('home.focus_score')} ${
                  dashboard.scores.focus ?? '—'
                }, ${t('home.rest_score')} ${dashboard.scores.rest ?? '—'}`}
                accessibilityHint={t('home.score_accessibility')}
                onPress={openScoreDetail}
              />
            }
            blockedAppsCard={
              dashboard.myApps ? (
                <HomeMyAppsCard
                  model={dashboard.myApps}
                  now={dashboard.now}
                  onPress={openBlocks}
                  onUnlock={openBlocksUnlock}
                />
              ) : null
            }
          />

          {streak > 0 && (
            <View style={styles.progressCard}>
              <HomeProgressCard streak={streak} />
            </View>
          )}
        </View>
      </Animated.ScrollView>

      {/*
        L'entete vit HORS du `ScrollView` : c'est une barre fixe de l'ecran,
        pas le haut du contenu. Elle etait deja en `position: absolute`, mais
        ancree dans le conteneur de contenu — donc elle defilait avec lui.
        `box-none` laisse passer le geste de defilement partout sauf sur les
        deux boutons, sinon la bande du haut avalerait le scroll.
      */}
      <HomeHeaderScrim
        scrollY={scrollY}
        solidHeight={insets.top + spacing.xxs + layout.homeHeaderActionSize}
        fadeHeight={layout.homeHeaderScrimFade}
      />
      <View
        testID="home-header"
        pointerEvents="box-none"
        style={[styles.header, { top: insets.top + spacing.xxs }]}
      >
        <HomeHeader
          streak={streak}
          streakLabel={t('home.streak_accessibility', { days: streak })}
          settingsLabel={t('home.settings_accessibility')}
          onPressStreak={openStreakDetail}
          onPressSettings={openSettings}
        />
      </View>

      {dashboard.state === 'error' && (
        <View
          accessibilityRole="alert"
          style={[styles.errorCard, { top: insets.top + 68 }]}
        >
          <IconSvg
            name={IconName.INFO}
            size={layout.quickChevronSize}
            color={colors.alertText}
          />
          <Text style={styles.errorText}>{t('home.data_error')}</Text>
        </View>
      )}

      <HomeScoreDetail
        visible={scoreOpen}
        snapshot={dashboard.score}
        onClose={closeScoreDetail}
      />

      <HomeDetailSheet
        visible={streakOpen}
        title={t('home.streak_detail_title')}
        closeLabel={t('home.close')}
        onClose={closeStreakDetail}
      >
        <View style={styles.sheetMetrics}>
          <View style={styles.sheetMetricNeutral}>
            <Text style={styles.sheetMetricLabel}>
              {t('home.streak_detail_current')}
            </Text>
            <Text style={styles.sheetMetricValue}>
              {t('home.streak_detail_days', { count: streak })}
            </Text>
          </View>
          <View style={styles.sheetMetricNeutral}>
            <Text style={styles.sheetMetricLabel}>
              {t('home.streak_detail_record')}
            </Text>
            <Text style={styles.sheetMetricValue}>
              {t('home.streak_detail_days', {
                count: Math.max(streak, dashboard.stats.record),
              })}
            </Text>
          </View>
        </View>
        <View style={styles.streakStatus}>
          <IconSvg
            name={dashboard.protectedToday ? IconName.CHECK : IconName.CLOCK}
            size={layout.headerIconSize}
            color={
              dashboard.protectedToday ? colors.homeMint : colors.homeLavender
            }
          />
          <Text style={styles.streakStatusText}>
            {dashboard.protectedToday
              ? t('home.streak_detail_protected')
              : t('home.streak_detail_waiting')}
          </Text>
        </View>
        <View style={styles.dayProgressTrack}>
          <View
            style={[
              styles.dayProgressFill,
              {
                width: `${Math.max(0, Math.min(100, ((1440 - dashboard.streakMinutesRemaining) / 1440) * 100))}%`,
              },
            ]}
          />
        </View>
        <Text style={styles.sheetBody}>
          {t('home.streak_detail_next', { duration: countdown })}
        </Text>
        <Text style={styles.sheetHint}>{t('home.streak_detail_rule')}</Text>
      </HomeDetailSheet>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  scrollContent: {
    minHeight:
      layout.homeHeroHeight +
      layout.homeScoreHeight +
      layout.homeReportHeight +
      layout.homeCardGap * 2,
  },
  container: {
    width: '100%',
    maxWidth: layout.contentMaxWidth,
    alignSelf: 'center',
  },
  progressCard: {
    marginHorizontal: layout.screenHorizontal,
    marginTop: layout.homeCardGap,
  },
  header: {
    position: 'absolute',
    left: layout.screenHorizontal,
    right: layout.screenHorizontal,
    zIndex: 4,
  },
  errorCard: {
    position: 'absolute',
    left: layout.screenHorizontal,
    right: layout.screenHorizontal,
    zIndex: 5,
    minHeight: layout.homeHeaderActionSize,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.functional,
    backgroundColor: colors.alertBackground,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.alertBorder,
  },
  errorText: {
    ...fonts.medium,
    flex: 1,
    color: colors.alertText,
    fontSize: typography.blockingCompactBodySize,
    lineHeight: typography.blockingCompactBodyLineHeight,
  },
  sheetMetrics: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  sheetMetricNeutral: {
    flex: 1,
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.functional,
    backgroundColor: colors.homeCardSoft,
  },
  sheetMetricLabel: {
    ...fonts.medium,
    color: colors.textSecondary,
    fontSize: typography.blockingMetaSize,
    lineHeight: typography.blockingMetaLineHeight,
  },
  sheetMetricValue: {
    ...fonts.bold,
    color: colors.textPrimary,
    fontSize: typography.homeMetricSize,
    lineHeight: typography.homeMetricLineHeight,
    fontVariant: ['tabular-nums'],
  },
  streakStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  streakStatusText: {
    ...fonts.semiBold,
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.homeCardTitleSize,
    lineHeight: typography.homeCardTitleLineHeight,
  },
  dayProgressTrack: {
    height: spacing.xs,
    overflow: 'hidden',
    borderRadius: radius.capsule,
    backgroundColor: colors.homeProgressTrack,
    marginBottom: spacing.md,
  },
  dayProgressFill: {
    height: '100%',
    borderRadius: radius.capsule,
    backgroundColor: colors.homeMint,
  },
  sheetBody: {
    ...fonts.regular,
    color: colors.textPrimary,
    fontSize: typography.homeSubtitleSize,
    lineHeight: typography.homeSubtitleLineHeight,
    marginBottom: spacing.sm,
  },
  sheetHint: {
    ...fonts.regular,
    color: colors.textTertiary,
    fontSize: typography.blockingMetaSize,
    lineHeight: typography.blockingMetaLineHeight,
  },
})
