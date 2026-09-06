import { IconName } from '@assets/icons'
import React from 'react'
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'
import { HomeCardMaterial } from '@/features/home/components/HomeCardMaterial'
import type { HomeMyAppsState } from '@/features/home/types/my-apps'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { BlockedAppIcons } from '@/shared/native/BlockedAppIcons'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'

const { colors, layout, radius, typography } = relockMaterial

function ShieldMark() {
  return (
    <Svg
      width={spacing.xl}
      height={spacing.xxl}
      viewBox="0 0 32 40"
      accessibilityElementsHidden
    >
      <Defs>
        <LinearGradient id="myAppsShield" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.homeShieldLight} />
          <Stop offset="1" stopColor={colors.homeShieldCool} />
        </LinearGradient>
      </Defs>
      <Path
        d="M16 2 28 7q2 1 2 4v13c0 7-8 12-14 15C10 36 2 31 2 24V11q0-3 2-4Z"
        fill="url(#myAppsShield)"
      />
    </Svg>
  )
}

export function HomeMyAppsCard({
  model,
  now,
  onPress,
  onUnlock,
}: {
  model: HomeMyAppsState
  now: Date
  onPress: () => void
  onUnlock: () => void
}) {
  const t = useT()
  const blocked = model.state === 'blocked'
  const loading = model.state === 'loading'
  const minutes = model.nextStart
    ? Math.max(
        1,
        Math.ceil((model.nextStart.getTime() - now.getTime()) / 60_000),
      )
    : 0
  const duration =
    minutes >= 60 && minutes % 60 === 0
      ? t('home.my_apps.hours', { count: minutes / 60 })
      : minutes >= 60
        ? t('home.duration_hours_minutes', {
            hours: Math.floor(minutes / 60),
            minutes: minutes % 60,
          })
        : t('home.duration_minutes', { minutes })
  const ruleTitle =
    model.ruleTitles.join(' · ') || t('home.my_apps.active_protection')
  const title =
    !blocked && model.nextStart
      ? t(
          model.resuming ? 'home.my_apps.resumes_in' : 'home.my_apps.starts_in',
          {
            name: model.nextRuleTitle || ruleTitle,
            duration: duration.replace(/ /g, '\u00a0'),
          },
        )
      : ruleTitle
  const visibleApps = model.apps.slice(0, 3)
  const overflow = Math.max(0, model.blockedCount - visibleApps.length)

  return (
    <View testID="home-my-apps" style={styles.card}>
      <HomeCardMaterial tier={2} />
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('home.my_apps.open')}
        onPress={onPress}
        style={styles.heading}
      >
        <Text style={styles.eyebrow}>{t('home.my_apps.title')}</Text>
        <IconSvg
          name={IconName.FORWARD}
          size={layout.quickChevronSize}
          color={colors.homeCardMuted}
        />
      </PressableScale>
      <View style={styles.rule}>
        <ShieldMark />
        <View style={styles.ruleCopy}>
          <Text
            numberOfLines={2}
            maxFontSizeMultiplier={1.25}
            style={styles.ruleTitle}
          >
            {title}
          </Text>
          {blocked && (
            <Text style={styles.metadata}>
              {t('home.my_apps.blocked_count', { count: model.blockedCount })}
            </Text>
          )}
        </View>
      </View>
      <View style={styles.divider} />
      <View style={styles.stage}>
        <View
          pointerEvents="none"
          accessibilityElementsHidden
          style={styles.tiles}
        >
          {(blocked ? visibleApps : [null, null, null, null]).map(
            (app, index) => (
              <View key={app?.key ?? index} style={styles.tileColumn}>
                <View style={[styles.tile, !blocked && styles.emptyTile]}>
                  {app && (
                    <BlockedAppIcons
                      tokenKey={app.key}
                      pointerEvents="none"
                      style={StyleSheet.absoluteFill}
                    />
                  )}
                  {blocked && (
                    <View style={styles.tileShade}>
                      <IconSvg
                        name={IconName.SHIELD}
                        size={spacing.xl}
                        color={colors.homeCardMuted}
                      />
                    </View>
                  )}
                </View>
                {blocked && (
                  <Text style={styles.tileLabel}>
                    {t('home.my_apps.blocked')}
                  </Text>
                )}
              </View>
            ),
          )}
          {overflow > 0 && <Text style={styles.overflow}>+{overflow}</Text>}
        </View>
        {blocked ? (
          <PressableScale
            testID="home-unlock-apps"
            accessibilityRole="button"
            accessibilityLabel={t('home.my_apps.unlock')}
            onPress={onUnlock}
            style={styles.unlock}
          >
            <Svg
              width={spacing.lg}
              height={spacing.lg}
              viewBox="0 0 24 24"
              accessibilityElementsHidden
            >
              <Path
                d="M9 10V6a4 4 0 0 1 8 0v1M5 11h10v10H5z"
                fill="none"
                stroke={colors.homeCard}
                strokeWidth={2.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text maxFontSizeMultiplier={1.2} style={styles.unlockLabel}>
              {t('home.my_apps.unlock')}
            </Text>
          </PressableScale>
        ) : (
          <View pointerEvents="none" style={styles.emptyState}>
            {loading ? (
              <ActivityIndicator color={colors.homeCardMuted} />
            ) : (
              <View style={styles.emptyCheck}>
                <IconSvg
                  name={IconName.CHECK}
                  size={spacing.lg}
                  color={colors.homeCard}
                />
              </View>
            )}
            <Text style={styles.emptyLabel}>
              {t(
                loading ? 'home.my_apps.checking' : 'home.my_apps.none_blocked',
              )}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    height: layout.homeBlockedHeight,
    borderRadius: radius.homeCard,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    overflow: 'hidden',
    backgroundColor: colors.transparent,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeGlassBorder,
    ...relockMaterial.shadow.glass,
  },
  heading: {
    alignSelf: 'flex-start',
    minHeight: layout.headerActionSize,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  eyebrow: {
    ...fonts.semiBold,
    color: colors.homeCardMuted,
    fontSize: typography.sectionTitleSize,
    lineHeight: typography.sectionTitleLineHeight,
  },
  rule: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    minHeight: layout.blockingLockedTileSize,
    marginBottom: spacing.sm,
  },
  ruleCopy: { flex: 1, gap: spacing.xxs },
  ruleTitle: {
    ...fonts.semiBold,
    color: colors.homeCardInk,
    fontSize: typography.sectionTitleSize,
    lineHeight: typography.sectionTitleLineHeight,
  },
  metadata: {
    ...fonts.regular,
    color: colors.homeCardMuted,
    fontSize: typography.welcomeTitleSize,
    lineHeight: typography.welcomeTitleLineHeight,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.homeBorder,
    marginBottom: spacing.md,
  },
  stage: {
    flex: 1,
    minHeight: layout.homeMyAppsStageHeight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tiles: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    gap: spacing.xxs,
  },
  tileColumn: { flexShrink: 1, alignItems: 'center', gap: spacing.xs },
  tile: {
    width: layout.homeMyAppsTileSize,
    height: layout.homeMyAppsTileSize,
    borderRadius: radius.action,
    backgroundColor: colors.homeCardStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeBorderStrong,
    overflow: 'hidden',
  },
  emptyTile: { opacity: relockMaterial.opacity.decorative },
  tileShade: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.homeAppShade,
  },
  tileLabel: {
    ...fonts.medium,
    color: colors.homeCardMuted,
    opacity: relockMaterial.opacity.disabled,
    fontSize: typography.blockingMetaSize,
  },
  overflow: {
    ...fonts.semiBold,
    color: colors.homeCardMuted,
    fontSize: typography.blockingMetaSize,
  },
  unlock: {
    minHeight: layout.headerActionSize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.onAccent,
    borderRadius: radius.capsule,
    ...relockMaterial.shadow.action,
  },
  unlockLabel: {
    ...fonts.semiBold,
    color: colors.homeCard,
    fontSize: typography.buttonSize,
    lineHeight: typography.buttonLineHeight,
    flexShrink: 1,
  },
  emptyState: { alignItems: 'center', gap: spacing.sm },
  emptyCheck: {
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: radius.capsule,
    backgroundColor: colors.homeCardMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyLabel: {
    ...fonts.medium,
    color: colors.homeCardMuted,
    fontSize: typography.welcomeBodySize,
    lineHeight: typography.welcomeBodyLineHeight,
    textAlign: 'center',
  },
})
