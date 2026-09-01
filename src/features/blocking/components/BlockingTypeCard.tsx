import { IconName } from '@assets/icons'
import React from 'react'
import { StyleSheet, Text, View, type ViewStyle } from 'react-native'
import {
  RuleTypeGlyph,
  type RuleTypeGlyphKind,
} from '@/features/blocking/components/BlockingGlyphs'
import { BlockingCardSurface } from '@/features/blocking/components/BlockingSurfaces'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'

const { colors, layout, radius, typography, shadow } = relockMaterial

interface Props {
  kind: RuleTypeGlyphKind
  title: string
  description: string
  onPress: () => void
  style?: ViewStyle
}

export function BlockingTypeCard({
  kind,
  title,
  description,
  onPress,
  style,
}: Props) {
  return (
    <PressableScale
      testID={`blocking-type-card-${kind}`}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      onPress={onPress}
      style={[styles.card, style]}
    >
      <BlockingCardSurface cornerRadius={radius.functional} />
      <View style={styles.head}>
        <View testID="blocking-type-icon-stage" style={styles.iconStage}>
          <RuleTypeGlyph kind={kind} />
        </View>
        <View style={styles.chevron}>
          <IconSvg
            name={IconName.FORWARD}
            size={spacing.sm}
            color={colors.textTertiary}
          />
        </View>
      </View>
      <View style={styles.titleSlot}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
      </View>
      <Text style={styles.description} numberOfLines={3}>
        {description}
      </Text>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: {
    minHeight: layout.blockingTypeCardMinHeight,
    overflow: 'hidden',
    padding: spacing.sm,
    alignItems: 'stretch',
    justifyContent: 'flex-start',
    borderRadius: radius.functional,
    backgroundColor: colors.blockingSurface,
    shadowColor: shadow.action.shadowColor,
    shadowOpacity: shadow.action.shadowOpacity,
    shadowRadius: shadow.action.shadowRadius,
    shadowOffset: shadow.action.shadowOffset,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  // Ni pastille ni cadre : on ne garde que le placement et la taille.
  chevron: {
    width: spacing.xl,
    height: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconStage: {
    width: spacing.xxxxl,
    height: spacing.xxxxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleSlot: {
    minHeight: typography.blockingTypeTitleLineHeight * 2,
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
  },
  title: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.blockingTypeTitleSize,
    lineHeight: typography.blockingTypeTitleLineHeight,
    letterSpacing: typography.blockingSectionLetterSpacing,
  },
  description: {
    ...fonts.regular,
    color: colors.textSecondary,
    fontSize: typography.blockingMetaSize,
    lineHeight: typography.blockingMetaLineHeight,
    marginTop: spacing.xxs,
  },
})
