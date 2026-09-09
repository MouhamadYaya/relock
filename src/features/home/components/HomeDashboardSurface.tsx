import React, { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import {
  isScreenTimeReportAvailable,
  ScreenTimeReport,
} from '@/shared/native/ScreenTimeReport'
import type { ScreenTimeAuthorizationState } from '@/shared/native/useScreenTimeAuth'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { haptics } from '@/shared/utils/platform/haptics'

const { colors, layout, radius, typography } = relockMaterial
const scoreTop = layout.homeHeroHeight

function homeSurfaceMetrics(showsBlockedCard: boolean) {
  const blockedTop = scoreTop + layout.homeScoreHeight + layout.homeCardGap
  const reportTop = showsBlockedCard
    ? blockedTop + layout.homeBlockedHeight + layout.homeCardGap
    : blockedTop
  return {
    blockedTop,
    reportTop,
    surfaceHeight: reportTop + layout.homeReportHeight,
  }
}

interface Props {
  authorization: ScreenTimeAuthorizationState
  heroAccessibilityLabel: string
  topAppsAccessibilityLabel: string
  screenTimeLabel: string
  permissionLabel: string
  unavailableLabel: string
  topAppsLabel: string
  emptyUsageLabel: string
  activityLabel: string
  onPressHero: () => void
  onRequestPermission: () => void
  scoreCard: React.ReactNode
  blockedAppsCard?: React.ReactNode
}

export function HomeDashboardSurface({
  authorization,
  topAppsAccessibilityLabel,
  screenTimeLabel,
  permissionLabel,
  unavailableLabel,
  topAppsLabel,
  emptyUsageLabel,
  activityLabel,
  onPressHero,
  onRequestPermission,
  scoreCard,
  blockedAppsCard,
}: Props) {
  const [reportReady, setReportReady] = useState(false)
  const [heroExpanded, setHeroExpanded] = useState(false)
  const reduceMotion = useReducedMotion()
  const heroProgress = useSharedValue(0)
  const reportAvailable = isScreenTimeReportAvailable
  const authorizationChecking = authorization === 'checking'
  const reportUnavailable = authorization === 'unavailable' || !reportAvailable
  const canRenderReport = authorization === 'approved' && reportAvailable
  const showsBlockedCard = blockedAppsCard != null
  const metrics = homeSurfaceMetrics(showsBlockedCard)

  const open = (action: () => void) => {
    haptics.press()
    action()
  }
  const heroDetailStyle = useAnimatedStyle(() => ({
    opacity: heroProgress.value,
    transform: reduceMotion
      ? []
      : [{ translateY: (1 - heroProgress.value) * spacing.xs }],
  }))

  const pressHero = () => {
    // Le héros se DÉPLIE au premier appui et navigue au second : un seul et
    // même toucher, deux issues — la vibration reste donc la même.
    haptics.tap()
    if (heroExpanded) {
      onPressHero()
      return
    }
    setHeroExpanded(true)
    heroProgress.value = withTiming(1, { duration: reduceMotion ? 0 : 220 })
  }

  return (
    <View
      collapsable={false}
      style={[styles.surface, { height: metrics.surfaceHeight }]}
    >
      {canRenderReport && (
        <ScreenTimeReport
          mode="home"
          showsBlockedCard={showsBlockedCard}
          pointerEvents="auto"
          onCommand={event => {
            switch (event.nativeEvent.command) {
              case 'ready':
                setReportReady(true)
                break
              // UIKit preserves the Home surface through tab and stack
              // transitions. Only a real native configuration replacement
              // announces reloading; navigation must never reset this state.
              case 'reloading':
                setReportReady(false)
                break
              case 'home.hero':
                pressHero()
                break
              case 'home.apps':
                open(onPressHero)
                break
            }
          }}
          style={styles.nativeReport}
        />
      )}

      {((canRenderReport && !reportReady) || authorizationChecking) && (
        <View
          testID="home-report-skeleton"
          pointerEvents="none"
          style={styles.skeletonLayer}
        >
          <View style={styles.heroSkeleton}>
            <View style={styles.skeletonLabel} />
            <View style={styles.skeletonValue} />
            <View style={styles.skeletonDelta} />
          </View>
          <View style={[styles.appsSkeleton, { top: metrics.reportTop }]}>
            <View style={styles.skeletonTitle} />
            <View style={styles.skeletonRows}>
              {[0, 1, 2].map(item => (
                <View key={item} style={styles.skeletonRow} />
              ))}
            </View>
          </View>
        </View>
      )}

      {!canRenderReport && !authorizationChecking && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={permissionLabel}
            accessibilityState={{ disabled: reportUnavailable }}
            disabled={reportUnavailable}
            onPress={() => open(onRequestPermission)}
            style={styles.heroFallback}
          >
            <Text style={styles.fallbackLabel}>{screenTimeLabel}</Text>
            <Text style={styles.fallbackValue}>—</Text>
            <Text style={styles.fallbackBody}>
              {reportUnavailable ? unavailableLabel : permissionLabel}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={topAppsAccessibilityLabel}
            accessibilityState={{ disabled: reportUnavailable }}
            disabled={reportUnavailable}
            onPress={() => open(onRequestPermission)}
            style={[styles.appsFallback, { top: metrics.reportTop }]}
          >
            <Text style={styles.appsFallbackTitle}>{topAppsLabel}</Text>
            <Text style={styles.appsFallbackBody}>{emptyUsageLabel}</Text>
          </Pressable>
        </>
      )}

      {canRenderReport && (
        <>
          <Animated.View
            pointerEvents="none"
            style={[styles.heroDetail, heroDetailStyle]}
          >
            <Text numberOfLines={1} style={styles.heroDetailLabel}>
              {screenTimeLabel}
            </Text>
            <Text numberOfLines={1} style={styles.heroDetailAction}>
              {activityLabel} →
            </Text>
          </Animated.View>
        </>
      )}

      {/*
        La carte de score est TOUJOURS celle de React Native, y compris
        par-dessus le rapport natif. Le rapport ne peut pas publier son score
        vers le JS (l'extension n'a pas le droit d'écrire dans l'App Group),
        donc sa version affichait un chiffre que la feuille de détail était
        incapable d'expliquer. Une seule carte, une seule source, un tap qui
        ouvre l'explication de CE chiffre-là.
      */}
      <View style={[styles.scoreCard, { top: scoreTop }]}>{scoreCard}</View>
      {showsBlockedCard && (
        <View style={[styles.blockedCard, { top: metrics.blockedTop }]}>
          {blockedAppsCard}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  surface: {
    width: '100%',
  },
  nativeReport: {
    ...StyleSheet.absoluteFillObject,
  },
  skeletonLayer: {
    ...StyleSheet.absoluteFillObject,
  },
  heroSkeleton: {
    position: 'absolute',
    top: layout.homeHeroReportTop,
    left: layout.screenHorizontal,
    right: layout.screenHorizontal,
    alignItems: 'center',
    gap: spacing.xs,
  },
  skeletonLabel: {
    width: layout.headerLogoWidth,
    height: spacing.sm,
    borderRadius: radius.compact,
    backgroundColor: colors.homeSkeleton,
  },
  skeletonValue: {
    width: layout.heroCopyWidth,
    height: layout.homeHeaderActionSize,
    borderRadius: radius.compact,
    backgroundColor: colors.homeSkeleton,
  },
  skeletonDelta: {
    width: layout.headerLogoWidth,
    height: spacing.sm,
    borderRadius: radius.compact,
    backgroundColor: colors.homeSkeleton,
  },
  appsSkeleton: {
    position: 'absolute',
    left: layout.screenHorizontal,
    right: layout.screenHorizontal,
    height: layout.homeReportHeight,
    gap: layout.homeReportTitleGap,
    paddingVertical: layout.homeReportPaddingVertical,
    paddingHorizontal: layout.homeReportPaddingHorizontal,
    borderRadius: radius.homeCard,
    backgroundColor: colors.homeGlass3,
  },
  skeletonTitle: {
    width: layout.heroCopyWidth,
    height: spacing.md,
    borderRadius: radius.compact,
    backgroundColor: colors.homeSkeleton,
  },
  skeletonRows: {
    gap: layout.homeReportRowGap,
  },
  skeletonRow: {
    height: layout.homeReportRowHeight,
    borderRadius: radius.functional,
    backgroundColor: colors.homeSkeleton,
  },
  heroDetail: {
    position: 'absolute',
    top: layout.homeHeroHeight - 58,
    left: layout.screenHorizontal * 4,
    right: layout.screenHorizontal * 4,
    zIndex: 3,
    height: layout.homeHeaderActionSize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.capsule,
    backgroundColor: colors.homeTabBar,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeBorderStrong,
  },
  heroDetailLabel: {
    ...fonts.medium,
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.blockingMetaSize,
    lineHeight: typography.blockingMetaLineHeight,
  },
  heroDetailAction: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.blockingMetaSize,
    lineHeight: typography.blockingMetaLineHeight,
  },
  heroFallback: {
    position: 'absolute',
    top: layout.homeHeroReportTop,
    left: layout.screenHorizontal,
    right: layout.screenHorizontal,
    minHeight: layout.homeHeroReportHeight,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  fallbackLabel: {
    ...fonts.medium,
    color: colors.homeHeroInk,
    fontSize: typography.homeHeroLabelSize,
    lineHeight: typography.homeHeroLabelLineHeight,
    textAlign: 'center',
  },
  fallbackValue: {
    ...fonts.bold,
    color: colors.homeHeroInk,
    fontSize: typography.homeScoreSize,
    lineHeight: typography.homeScoreLineHeight,
  },
  fallbackBody: {
    ...fonts.medium,
    maxWidth: layout.heroCopyWidth,
    color: colors.textSecondary,
    fontSize: typography.blockingMetaSize,
    lineHeight: typography.blockingMetaLineHeight,
    textAlign: 'center',
  },
  scoreCard: {
    position: 'absolute',
    left: layout.screenHorizontal,
    right: layout.screenHorizontal,
    zIndex: 2,
  },
  blockedCard: {
    position: 'absolute',
    left: layout.screenHorizontal,
    right: layout.screenHorizontal,
    zIndex: 3,
  },
  appsFallback: {
    position: 'absolute',
    left: layout.screenHorizontal,
    right: layout.screenHorizontal,
    height: layout.homeReportHeight,
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: layout.homeReportPaddingVertical,
    paddingHorizontal: layout.homeReportPaddingHorizontal,
    borderRadius: radius.homeCard,
    backgroundColor: colors.homeGlass3,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeGlassBorder,
    ...relockMaterial.shadow.glass,
  },
  appsFallbackTitle: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.homeCardTitleSize,
    lineHeight: typography.homeCardTitleLineHeight,
  },
  appsFallbackBody: {
    ...fonts.regular,
    color: colors.textTertiary,
    fontSize: typography.homeSubtitleSize,
    lineHeight: typography.homeSubtitleLineHeight,
  },
})
