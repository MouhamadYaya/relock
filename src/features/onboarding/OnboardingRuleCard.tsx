/**
 * Carte de préréglage, version onboarding.
 *
 * Même modèle que `RuleTemplateCard` (onglet Blocages / Nouvelle règle) :
 * image PLEIN CADRE, fondu vers le bas, texte posé dessus — l'image porte la
 * carte, elle n'est pas une vignette. Deux écarts assumés, et seulement deux :
 *
 * - Pas de « + » : sur cet écran on SÉLECTIONNE, on n'ajoute pas ; un badge
 *   d'ajout promettrait une action qui n'existe pas encore.
 * - État sélectionné explicite : liseré blanc + pastille de coche.
 *
 * Le fondu part plus bas et le voile est plus léger que dans l'app : la carte
 * du carrousel est deux fois plus haute que celles de la grille, donc à voile
 * égal l'image y tombait au noir — les huit cartes se ressemblaient toutes.
 *
 * Ce composant vit dans `features/onboarding/` exprès : rien de ce qu'on y
 * change ne doit toucher les cartes de l'app.
 */
import { IconName } from '@assets/icons'
import React from 'react'
import {
  ImageBackground,
  type ImageSourcePropType,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import {
  RuleTemplateFlowGlyph,
  type RuleTypeGlyphKind,
} from '@/features/blocking/components/BlockingGlyphs'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { fonts } from '@/shared/theme/tokens/fonts'
import { OB } from './tokens'

interface Props {
  title: string
  description: string
  time: string
  kind: RuleTypeGlyphKind
  image: ImageSourcePropType
  selected: boolean
  onToggle: () => void
}

/**
 * Fondu de lecture : transparent sur toute la moitié haute (l'image y reste
 * intacte), opaque derrière le texte seulement.
 */
function ImageFade() {
  return (
    <Svg
      pointerEvents="none"
      style={styles.fade}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      <Defs>
        <LinearGradient id="ob-rule-fade" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={OB.bg} stopOpacity={0} />
          <Stop offset="0.5" stopColor={OB.bg} stopOpacity={0.42} />
          <Stop offset="1" stopColor={OB.bg} stopOpacity={0.94} />
        </LinearGradient>
      </Defs>
      <Rect width={100} height={100} fill="url(#ob-rule-fade)" />
    </Svg>
  )
}

export function OnboardingRuleCard({
  title,
  description,
  time,
  kind,
  image,
  selected,
  onToggle,
}: Props) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${time}. ${description}`}
      accessibilityHint={
        selected ? 'Toucher pour désélectionner' : 'Toucher pour sélectionner'
      }
      onPress={onToggle}
      style={[styles.card, selected && styles.cardSelected]}
    >
      <ImageBackground
        accessibilityIgnoresInvertColors
        source={image}
        resizeMode="cover"
        style={styles.image}
        imageStyle={styles.imageCorners}
      >
        <ImageFade />
        <View style={styles.body}>
          <View style={styles.flow}>
            <RuleTemplateFlowGlyph kind={kind} />
          </View>
          <View style={styles.copy}>
            <Text style={styles.time}>{time}</Text>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          </View>
        </View>
        {selected ? (
          <View pointerEvents="none" style={styles.check}>
            <IconSvg name={IconName.CHECK} size={18} color={OB.onAccent} />
          </View>
        ) : null}
      </ImageBackground>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 24,
    backgroundColor: OB.card,
    borderWidth: 2,
    borderColor: OB.hairline,
    overflow: 'hidden',
  },
  cardSelected: {
    borderColor: OB.ink,
  },
  image: {
    flex: 1,
  },
  imageCorners: {
    borderRadius: 22,
  },
  fade: {
    ...StyleSheet.absoluteFillObject,
  },
  body: {
    flex: 1,
    padding: 14,
  },
  flow: {
    alignSelf: 'flex-start',
    padding: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(3,5,4,0.55)',
  },
  copy: {
    marginTop: 'auto',
  },
  time: {
    ...fonts.medium,
    fontSize: 13,
    lineHeight: 17,
    color: OB.ink70,
    fontVariant: ['tabular-nums'],
  },
  title: {
    ...fonts.semiBold,
    fontSize: 19,
    lineHeight: 24,
    color: OB.ink,
    marginTop: 2,
  },
  description: {
    ...fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: OB.ink70,
    marginTop: 2,
  },
  check: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OB.ink,
  },
})
