import { IconName } from '@assets/icons'
import React from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { HomeCardMaterial } from '@/features/home/components/HomeCardMaterial'
import type { HomeScores } from '@/features/home/types'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { haptics } from '@/shared/utils/platform/haptics'

const { colors, layout, opacity, radius, typography } = relockMaterial

interface Props {
  scores: HomeScores
  title: string
  subtitle: string
  bandLabel: string
  footerLabel: string
  focusLabel: string
  restLabel: string
  accessibilityLabel: string
  accessibilityHint: string
  onPress: () => void
}

function ScoreRow({
  icon,
  label,
  value,
  tone,
}: {
  icon: IconName
  label: string
  value: number | null
  tone: 'focus' | 'rest'
}) {
  return (
    <View style={styles.row} accessibilityElementsHidden>
      <IconSvg
        name={icon}
        size={layout.homeScoreRowGlyphSize}
        color={tone === 'focus' ? colors.accentViolet : colors.homeLavender}
      />
      <Text numberOfLines={1} style={styles.rowLabel}>
        {label}
      </Text>
      <Text style={styles.rowValue}>{value ?? '—'}</Text>
    </View>
  )
}

/**
 * Carte « Score global » de l'Accueil : la rosace et son chiffre à gauche, les
 * deux sous-scores en liste à droite, l'encouragement en pied. Rendu de repli —
 * l'extension `RelockActivityReport` dessine la même carte dès que Temps
 * d'écran est autorisé ; les deux géométries partagent `homeScoreHeight`.
 */
export function HomeScoreCard({
  scores,
  title,
  subtitle,
  bandLabel,
  footerLabel,
  focusLabel,
  restLabel,
  accessibilityLabel,
  accessibilityHint,
  onPress,
}: Props) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      onPress={() => {
        haptics.selectionTick()
        onPress()
      }}
      style={styles.card}
    >
      <HomeCardMaterial tier={1} />

      <View style={styles.heading}>
        <View style={styles.headingText}>
          <Text numberOfLines={1} style={styles.title}>
            {title}
          </Text>
          <Text numberOfLines={1} style={styles.subtitle}>
            {subtitle}
          </Text>
        </View>
        <View style={styles.chevron} accessibilityElementsHidden>
          <IconSvg
            name={IconName.FORWARD}
            size={layout.homeScoreRowGlyphSize}
            color={colors.textSecondary}
          />
        </View>
      </View>

      <View style={styles.middle}>
        <View style={styles.dial}>
          <Image
            source={require('@assets/home-score-dial.png')}
            resizeMode="contain"
            style={styles.dialArt}
            accessibilityElementsHidden
          />
          <View style={styles.dialCenter} pointerEvents="none">
            <Text style={styles.score}>{scores.global ?? '—'}</Text>
            <Text numberOfLines={1} style={styles.band}>
              {bandLabel}
            </Text>
          </View>
        </View>

        <View style={styles.separator} />

        <View style={styles.rows}>
          <ScoreRow
            icon={IconName.FOCUS}
            label={focusLabel}
            value={scores.focus}
            tone="focus"
          />
          <View style={styles.rowDivider} />
          <ScoreRow
            icon={IconName.REST}
            label={restLabel}
            value={scores.rest}
            tone="rest"
          />
        </View>
      </View>

      <Text numberOfLines={1} style={styles.footer}>
        {footerLabel}
      </Text>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: {
    height: layout.homeScoreHeight,
    justifyContent: 'space-between',
    padding: layout.homeScoreCardPadding,
    borderRadius: radius.homeCard,
    // Le verre vient de `HomeCardMaterial` : la carte elle-meme ne peint rien,
    // sinon le voile translucide se poserait sur un aplat opaque.
    backgroundColor: colors.transparent,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeGlassBorder,
    overflow: 'hidden',
    ...relockMaterial.shadow.glass,
  },
  heading: {
    width: '100%',
    height: layout.homeScoreHeadingHeight,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  headingText: {
    flex: 1,
    gap: spacing.micro,
  },
  title: {
    ...fonts.bold,
    color: colors.textPrimary,
    fontSize: typography.homeScoreCardTitleSize,
    lineHeight: typography.homeScoreCardTitleLineHeight,
    letterSpacing: typography.blockingSectionLetterSpacing,
  },
  subtitle: {
    ...fonts.regular,
    color: colors.textTertiary,
    fontSize: typography.homeSubtitleSize,
    lineHeight: typography.homeSubtitleLineHeight,
  },
  chevron: {
    width: layout.homeScoreChevronSize,
    height: layout.homeScoreChevronSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.capsule,
    backgroundColor: colors.homeCardSoft,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeBorder,
  },
  middle: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dial: {
    width: layout.homeScoreDialSize,
    height: layout.homeScoreDialSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialArt: {
    width: layout.homeScoreDialSize,
    height: layout.homeScoreDialSize,
    opacity: opacity.homeScoreDial,
  },
  dialCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    ...fonts.bold,
    color: colors.textPrimary,
    fontSize: typography.homeScoreValueSize,
    lineHeight: typography.homeScoreValueLineHeight,
    fontVariant: ['tabular-nums'],
  },
  band: {
    ...fonts.medium,
    color: colors.homeLavender,
    fontSize: typography.homeScoreCardRowLabelSize,
    lineHeight: typography.homeScoreCardRowLabelLineHeight,
  },
  separator: {
    width: StyleSheet.hairlineWidth,
    height: layout.homeScoreDialSize,
    marginHorizontal: layout.homeScoreSeparatorGap,
    backgroundColor: colors.homeBorder,
  },
  rows: {
    flex: 1,
    height: layout.homeScoreDialSize,
    justifyContent: 'center',
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.homeBorder,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rowLabel: {
    ...fonts.medium,
    flex: 1,
    color: colors.textPrimary,
    fontSize: typography.homeScoreCardRowLabelSize,
    lineHeight: typography.homeScoreCardRowLabelLineHeight,
  },
  rowValue: {
    ...fonts.bold,
    color: colors.textPrimary,
    fontSize: typography.homeScoreRowValueSize,
    lineHeight: typography.homeScoreRowValueLineHeight,
    fontVariant: ['tabular-nums'],
  },
  footer: {
    ...fonts.medium,
    width: '100%',
    color: colors.textSecondary,
    fontSize: typography.homeSubtitleSize,
    lineHeight: typography.homeSubtitleLineHeight,
    textAlign: 'center',
  },
})
