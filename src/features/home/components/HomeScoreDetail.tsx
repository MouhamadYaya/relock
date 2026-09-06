import { IconName } from '@assets/icons'
import React, { useEffect, useState } from 'react'
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { HomeCardMaterial } from '@/features/home/components/HomeCardMaterial'
import { HomeScoreRings } from '@/features/home/components/HomeScoreRings'
import { scoreBand } from '@/features/home/services/home-dashboard'
import type { HomeScoreBand, HomeScores } from '@/features/home/types'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { haptics } from '@/shared/utils/platform/haptics'

const { colors, layout, radius, typography } = relockMaterial
const FLIP_IN = 380
const FLIP_OUT = 220

const BAND_KEYS = {
  excellent: 'home.score_band_excellent',
  good: 'home.score_band_good',
  fair: 'home.score_band_fair',
  poor: 'home.score_band_poor',
  unknown: 'home.score_calculating',
} as const satisfies Record<HomeScoreBand, string>

const FOOTER_KEYS = {
  excellent: 'home.score_footer_excellent',
  good: 'home.score_footer_good',
  fair: 'home.score_footer_fair',
  poor: 'home.score_footer_poor',
  unknown: 'home.score_footer_pending',
} as const satisfies Record<HomeScoreBand, string>

interface Props {
  visible: boolean
  scores: HomeScores
  onClose: () => void
}

function Row({
  icon,
  tone,
  label,
  value,
  bandLabel,
  body,
}: {
  icon: IconName
  tone: 'focus' | 'rest'
  label: string
  value: number | null
  bandLabel: string
  body: string
}) {
  const tint = tone === 'focus' ? colors.accentViolet : colors.homeLavender
  return (
    <View style={styles.row}>
      <View style={styles.rowHead}>
        <IconSvg
          name={icon}
          size={layout.homeScoreDialogGlyphSize}
          color={tint}
        />
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={[styles.rowBand, { color: tint }]}>{bandLabel}</Text>
        <Text style={styles.rowValue}>{value ?? '—'}</Text>
      </View>
      <View style={styles.rowTrack}>
        <View
          style={[
            styles.rowFill,
            {
              width: `${Math.max(0, Math.min(100, value ?? 0))}%`,
              backgroundColor: tint,
            },
          ]}
        />
      </View>
      <Text style={styles.body}>{body}</Text>
    </View>
  )
}

/**
 * Fenêtre contextuelle du score : la carte se retourne et s'agrandit pour
 * expliquer ce qu'est le score, comment il est calculé et comment le faire
 * remonter. Aucune donnée nouvelle n'y est inventée — elle relit les mêmes
 * scores que la carte.
 */
export function HomeScoreDetail({ visible, scores, onClose }: Props) {
  const t = useT()
  const reduceMotion = useReducedMotion()
  const [mounted, setMounted] = useState(visible)
  const progress = useSharedValue(0)

  useEffect(() => {
    if (visible) {
      setMounted(true)
      progress.value = withTiming(1, { duration: reduceMotion ? 0 : FLIP_IN })
      return
    }
    progress.value = withTiming(
      0,
      { duration: reduceMotion ? 0 : FLIP_OUT },
      finished => {
        if (finished) runOnJS(setMounted)(false)
      },
    )
  }, [visible, reduceMotion, progress])

  const dialogStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: reduceMotion
      ? [{ scale: 1 }]
      : [
          { perspective: 900 },
          { scale: 0.82 + progress.value * 0.18 },
          { rotateY: `${(1 - progress.value) * -104}deg` },
        ],
  }))
  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }))

  const close = () => {
    haptics.selectionTick()
    onClose()
  }

  const bandLabel = (value: number | null) => t(BAND_KEYS[scoreBand(value)])

  if (!mounted) return null

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={close}
    >
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.close')}
            onPress={close}
            style={styles.backdrop}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[styles.dialog, dialogStyle]}
        >
          <HomeCardMaterial />
          <ScrollView
            bounces={false}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}
          >
            <View style={styles.header}>
              <Text style={styles.title}>{t('home.score_detail_title')}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('home.close')}
                hitSlop={spacing.sm}
                onPress={close}
                style={styles.close}
              >
                <IconSvg
                  name={IconName.CLOSE}
                  size={layout.quickChevronSize}
                  color={colors.textPrimary}
                />
              </Pressable>
            </View>

            <View style={styles.hero}>
              <HomeScoreRings
                focus={scores.focus}
                rest={scores.rest}
                size={layout.homeScoreDialogRingSize}
                stroke={layout.homeScoreDialogRingStroke}
                gap={layout.homeScoreDialogRingGap}
                gradientPrefix="homeScoreDialog"
              >
                <Text style={styles.heroValue}>{scores.global ?? '—'}</Text>
              </HomeScoreRings>
              <View style={styles.heroCopy}>
                <Text style={styles.heroBand}>
                  {scores.available
                    ? bandLabel(scores.global)
                    : t('home.score_calculating')}
                </Text>
                <Text style={styles.body}>
                  {scores.available
                    ? t('home.score_subtitle')
                    : t('home.score_detail_unavailable')}
                </Text>
              </View>
            </View>

            <Text style={styles.section}>{t('home.score_what_title')}</Text>
            <Text style={styles.body}>{t('home.score_what_body')}</Text>

            <Text style={styles.section}>{t('home.score_how_title')}</Text>
            <Row
              icon={IconName.FOCUS}
              tone="focus"
              label={t('home.focus_score')}
              value={scores.focus}
              bandLabel={bandLabel(scores.focus)}
              body={t('home.score_how_focus')}
            />
            <Row
              icon={IconName.REST}
              tone="rest"
              label={t('home.rest_score')}
              value={scores.rest}
              bandLabel={bandLabel(scores.rest)}
              body={t('home.score_how_rest')}
            />
            <View style={styles.formula}>
              <Text style={styles.formulaText}>{t('home.score_formula')}</Text>
            </View>

            <Text style={styles.section}>{t('home.score_improve_title')}</Text>
            <View style={styles.tips}>
              {(
                [
                  [IconName.SHIELDFILL, 'home.score_tip_block'],
                  [IconName.FOCUS, 'home.score_tip_focus'],
                  [IconName.REST, 'home.score_tip_rest'],
                ] as const
              ).map(([icon, key]) => (
                <View key={key} style={styles.tip}>
                  <IconSvg
                    name={icon}
                    size={layout.homeScoreTileGlyphSize}
                    color={colors.homeMint}
                  />
                  <Text style={styles.tipText}>{t(key)}</Text>
                </View>
              ))}
            </View>

            <View style={styles.footer}>
              <IconSvg
                name={IconName.PULSE}
                size={layout.homeScoreLegendGlyphSize}
                color={colors.accentViolet}
              />
              <Text style={styles.footerText}>
                {t(FOOTER_KEYS[scoreBand(scores.global)])}
              </Text>
            </View>

            <Text style={styles.note}>{t('home.score_note')}</Text>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.homeModalBackdrop,
  },
  dialog: {
    width: '100%',
    maxWidth: layout.homeScoreDialogMaxWidth,
    maxHeight: '84%',
    marginHorizontal: layout.screenHorizontal,
    overflow: 'hidden',
    borderRadius: radius.homeCard,
    backgroundColor: colors.homeCard,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeBorderStrong,
    ...relockMaterial.shadow.hero,
  },
  content: {
    padding: layout.homeScoreDialogPadding,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  title: {
    ...fonts.bold,
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.homeScoreDialogTitleSize,
    lineHeight: typography.homeScoreDialogTitleLineHeight,
    letterSpacing: typography.homeGreetingLetterSpacing,
  },
  close: {
    width: layout.homeScoreChevronSize,
    height: layout.homeScoreChevronSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.capsule,
    backgroundColor: colors.homeCardSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeBorder,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.md,
  },
  heroValue: {
    ...fonts.bold,
    color: colors.textPrimary,
    fontSize: typography.homeMetricSize,
    lineHeight: typography.homeMetricLineHeight,
    fontVariant: ['tabular-nums'],
  },
  heroCopy: { flex: 1, gap: spacing.micro },
  heroBand: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.homeScoreTitleSize,
    lineHeight: typography.homeScoreTitleLineHeight,
  },
  section: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.homeScoreSectionSize,
    lineHeight: typography.homeScoreSectionLineHeight,
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  body: {
    ...fonts.regular,
    color: colors.textSecondary,
    fontSize: typography.homeScoreBodySize,
    lineHeight: typography.homeScoreBodyLineHeight,
  },
  row: { gap: spacing.xs, marginBottom: spacing.md },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowLabel: {
    ...fonts.semiBold,
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.homeScoreRowLabelSize,
    lineHeight: typography.homeScoreRowLabelLineHeight,
  },
  rowBand: {
    ...fonts.medium,
    fontSize: typography.homeScoreBandSize,
    lineHeight: typography.homeScoreBandLineHeight,
  },
  rowValue: {
    ...fonts.bold,
    color: colors.textPrimary,
    fontSize: typography.homeScoreDetailValueSize,
    lineHeight: typography.homeScoreDetailValueLineHeight,
    fontVariant: ['tabular-nums'],
  },
  rowTrack: {
    height: layout.homeScoreBarHeight,
    overflow: 'hidden',
    borderRadius: radius.capsule,
    backgroundColor: colors.homeProgressTrack,
  },
  rowFill: { height: '100%', borderRadius: radius.capsule },
  footer: {
    height: layout.homeScoreFooterHeight,
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.homeBorder,
    paddingTop: spacing.lg,
  },
  footerText: {
    ...fonts.medium,
    flex: 1,
    color: colors.textSecondary,
    fontSize: typography.homeScoreFooterSize,
    lineHeight: typography.homeScoreFooterLineHeight,
  },
  formula: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xxs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.capsule,
    backgroundColor: colors.homeCardSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeBorder,
  },
  formulaText: {
    ...fonts.medium,
    color: colors.textPrimary,
    fontSize: typography.homeScoreBandSize,
    lineHeight: typography.homeScoreCaptionLineHeight,
  },
  tips: { gap: spacing.xs },
  tip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.functional,
    backgroundColor: colors.homeScoreTile,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeBorder,
  },
  tipText: {
    ...fonts.regular,
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.homeScoreBodySize,
    lineHeight: typography.homeScoreBodyLineHeight,
  },
  note: {
    ...fonts.regular,
    marginTop: spacing.lg,
    color: colors.textTertiary,
    fontSize: typography.homeScoreCaptionSize,
    lineHeight: typography.homeScoreCaptionLineHeight,
  },
})
