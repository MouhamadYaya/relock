import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg'
import { HomeCardMaterial } from '@/features/home/components/HomeCardMaterial'
import { useT } from '@/i18n/useT'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'

const { colors, layout, radius, typography } = relockMaterial

export function HomeProgressCard({ streak }: { streak: number }) {
  const t = useT()
  if (streak < 1) return null
  return (
    <View testID="home-progress" style={styles.card}>
      <HomeCardMaterial tier={3} warm />
      <View style={styles.copy}>
        <Text style={styles.title}>
          {t(
            streak === 1 ? 'home.progress.first_title' : 'home.progress.title',
            { count: streak },
          )}
        </Text>
        <Text style={styles.body}>
          {t(streak === 1 ? 'home.progress.first_body' : 'home.progress.body')}
        </Text>
      </View>
      <View
        accessible
        accessibilityLabel={t('home.streak_accessibility', { days: streak })}
        style={styles.art}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox="0 0 84 100"
          accessibilityElementsHidden
        >
          <Defs>
            <LinearGradient id="progressFlame" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={colors.homeCardInk} />
              <Stop offset="0.5" stopColor={colors.homeRewardGold} />
              <Stop
                offset="1"
                stopColor={colors.homeRewardGlow}
                stopOpacity={0.1}
              />
            </LinearGradient>
          </Defs>
          <Path
            d="M43 5C32 17 20 32 20 49l-5-12C5 69 17 91 42 92c30 0 39-24 27-57l-4 12C62 28 51 12 43 5Z"
            fill="url(#progressFlame)"
            stroke={colors.homeRewardGold}
            strokeOpacity={0.24}
          />
        </Svg>
        <Text maxFontSizeMultiplier={1} style={styles.number}>
          {streak}
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    minHeight: layout.homeProgressMinHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.homeCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeBorderStrong,
    backgroundColor: colors.homeCard,
    overflow: 'hidden',
  },
  copy: { flex: 1, gap: spacing.xs },
  title: {
    ...fonts.semiBold,
    color: colors.homeCardInk,
    fontSize: typography.sectionTitleSize,
    lineHeight: typography.sectionTitleLineHeight,
  },
  body: {
    ...fonts.regular,
    color: colors.homeCardMuted,
    fontSize: typography.welcomeBodySize,
    lineHeight: typography.welcomeBodyLineHeight,
  },
  art: {
    width: layout.homeProgressArtSize,
    height: layout.homeProgressArtSize,
    alignItems: 'center',
    justifyContent: 'flex-end',
    shadowColor: colors.homeRewardGold,
    shadowOpacity: relockMaterial.opacity.decorativeStrong,
    shadowRadius: spacing.md,
    shadowOffset: { width: 0, height: 0 },
  },
  number: {
    position: 'absolute',
    bottom: 0,
    ...fonts.semiBold,
    color: colors.homeRewardGold,
    fontSize: typography.homeScoreSize,
    lineHeight: typography.homeScoreLineHeight,
    fontVariant: ['tabular-nums'],
  },
})
