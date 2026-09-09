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

/**
 * Un des trois types de règle — le choix le plus important de l'app.
 *
 * ⚠️ RANGÉE pleine largeur, pas une vignette de grille. En trois colonnes, la
 * description ne tenait qu'en deux mots (« p. ex. 30 min ») : il fallait déjà
 * savoir ce qu'était une « Session » pour la choisir. Pleine largeur, le titre
 * dit l'action et la ligne dessous dit exactement ce qui va se passer — et les
 * trois rangées remplissent la feuille au repos au lieu d'être avalées par les
 * modèles illustrés qui défilent en dessous.
 */
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
      // Le choix le plus structurant de l'app, et il ouvre l'éditeur : ni un
      // effleurement de carte, ni un simple tic de liste.
      haptic="press"
      onPress={onPress}
      style={[styles.card, style]}
    >
      <BlockingCardSurface cornerRadius={radius.functional} />
      {/* Ni pastille ni cadre : on ne garde que le placement et la taille. */}
      <View testID="blocking-type-icon-stage" style={styles.iconStage}>
        <RuleTypeGlyph kind={kind} />
      </View>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.description} numberOfLines={2}>
          {description}
        </Text>
      </View>
      <View style={styles.chevron}>
        <IconSvg
          name={IconName.FORWARD}
          size={spacing.sm}
          color={colors.textTertiary}
        />
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: {
    minHeight: layout.blockingTypeRowMinHeight,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
    borderRadius: radius.functional,
    backgroundColor: colors.blockingSurface,
    shadowColor: shadow.action.shadowColor,
    shadowOpacity: shadow.action.shadowOpacity,
    shadowRadius: shadow.action.shadowRadius,
    shadowOffset: shadow.action.shadowOffset,
  },
  iconStage: {
    width: spacing.xxxxl,
    height: spacing.xxxxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // `minWidth: 0` : sans lui la colonne de texte refuse de se comprimer et
  // pousse le chevron hors de la rangée sur les titres longs.
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.blockingCardTitleSize,
    lineHeight: typography.blockingCardTitleLineHeight,
    letterSpacing: typography.blockingSectionLetterSpacing,
  },
  description: {
    ...fonts.regular,
    color: colors.textSecondary,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    marginTop: spacing.micro,
  },
  chevron: {
    width: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
