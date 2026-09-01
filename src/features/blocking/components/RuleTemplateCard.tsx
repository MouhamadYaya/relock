import { IconName } from '@assets/icons'
import React from 'react'
import {
  ImageBackground,
  type ImageSourcePropType,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import {
  RuleTemplateFlowGlyph,
  type RuleTypeGlyphKind,
} from '@/features/blocking/components/BlockingGlyphs'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'

const { colors, layout, radius, typography, shadow } = relockMaterial

interface Props {
  title: string
  description: string
  time: string
  kind: RuleTypeGlyphKind
  image: ImageSourcePropType
  addLabel: string
  onAdd: () => void
  style?: StyleProp<ViewStyle>
}

function CompactFlow({ kind }: { kind: RuleTypeGlyphKind }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.flow}
    >
      <RuleTemplateFlowGlyph kind={kind} />
    </View>
  )
}

function ImageFade() {
  return (
    <Svg
      pointerEvents="none"
      style={styles.imageFade}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id="template-image-fade" x1="0" y1="0" x2="0" y2="1">
          <Stop
            offset="0.18"
            stopColor={colors.blockingSurfaceCool}
            stopOpacity={0}
          />
          <Stop
            offset="0.48"
            stopColor={colors.blockingSurfaceCool}
            stopOpacity={0.28}
          />
          <Stop
            offset="1"
            stopColor={colors.blockingSurfaceCool}
            stopOpacity={0.96}
          />
        </LinearGradient>
      </Defs>
      <Rect width={100} height={100} fill="url(#template-image-fade)" />
    </Svg>
  )
}

/**
 * Ajouter un préréglage est une action SECONDAIRE : son « + » est en verre
 * clair, pas au dégradé violet. Ce dégradé n'appartient qu'au « + » principal
 * de l'écran — quand tous les boutons portent la même couleur, plus aucun ne
 * dit lequel est le geste principal.
 */
function AddBadge() {
  const size = spacing.xxxl
  return (
    <View
      pointerEvents="none"
      style={[
        styles.addBadge,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <IconSvg
        name={IconName.PLUS}
        size={spacing.xl}
        color={colors.textPrimary}
      />
    </View>
  )
}

export function RuleTemplateCard({
  title,
  description,
  time,
  kind,
  image,
  addLabel,
  onAdd,
  style,
}: Props) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={addLabel}
      onPress={onAdd}
      style={[styles.card, style]}
    >
      <ImageBackground
        accessibilityIgnoresInvertColors
        source={image}
        resizeMode="cover"
        style={styles.image}
        imageStyle={styles.imageCorners}
      >
        <View style={styles.imageShade} />
        <ImageFade />
        <View style={styles.body}>
          <CompactFlow kind={kind} />
          <View style={styles.copy}>
            <Text style={styles.time}>{time}</Text>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description} numberOfLines={1}>
              {description}
            </Text>
          </View>
          {/* Aucune vignette d'app ici : un préréglage dit QUAND bloquer, pas
              QUOI. Les apps sont choisies à l'activation (Apple ne permet pas
              d'en pré-sélectionner), donc afficher des logos de marque serait
              inventer un contenu que la règle n'a pas encore. */}
          <View style={styles.footer}>
            <AddBadge />
          </View>
        </View>
      </ImageBackground>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: {
    minHeight: layout.blockingTemplateCardMinHeight,
    borderRadius: radius.visual,
    backgroundColor: colors.blockingSurfaceCool,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.blockingBorder,
    overflow: 'hidden',
    shadowColor: shadow.blockingSubtle.shadowColor,
    shadowOpacity: shadow.blockingSubtle.shadowOpacity,
    shadowRadius: shadow.blockingSubtle.shadowRadius,
    shadowOffset: shadow.blockingSubtle.shadowOffset,
  },
  image: {
    flex: 1,
    minHeight: layout.blockingTemplateCardMinHeight,
  },
  imageCorners: {
    borderRadius: radius.visual,
  },
  imageShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.blockingImageShade,
  },
  imageFade: {
    ...StyleSheet.absoluteFillObject,
  },
  flow: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.xxs,
    borderRadius: radius.compact,
    backgroundColor: colors.blockingImageChrome,
  },
  body: {
    flex: 1,
    padding: spacing.sm,
  },
  copy: {
    marginTop: 'auto',
  },
  time: {
    ...fonts.medium,
    color: colors.textSecondary,
    fontSize: typography.blockingMetaSize,
    lineHeight: typography.blockingMetaLineHeight,
    fontVariant: ['tabular-nums'],
  },
  title: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.blockingCardTitleSize,
    lineHeight: typography.blockingCardTitleLineHeight,
    marginTop: spacing.micro,
  },
  description: {
    ...fonts.regular,
    color: colors.textSecondary,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
  },
  addBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.blockingGlassBright,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.blockingGlassBrightEdge,
  },
})
