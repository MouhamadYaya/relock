import React from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { relockMaterial } from '@/shared/theme'

const { colors, layout } = relockMaterial

/**
 * Rang lumineux d'une carte. Plus une carte est haute dans l'écran, plus elle
 * est proche du limbe éclairé (voir `HomeBackdrop`) et plus elle capte de
 * lumière. C'est imperceptible carte par carte, et c'est exactement ce qui
 * produit la sensation de profondeur d'un écran à l'autre.
 */
export type HomeCardTier = 1 | 2 | 3

const TIERS = {
  1: { fill: colors.homeGlass1, edge: colors.homeGlassEdge1 },
  2: { fill: colors.homeGlass2, edge: colors.homeGlassEdge2 },
  3: { fill: colors.homeGlass3, edge: colors.homeGlassEdge3 },
} as const

/**
 * Le verre des cartes de l'Accueil : un voile clair translucide posé sur la
 * scène, et l'arête haute de 1 px qui lui donne son épaisseur.
 *
 * **Pas de `BlurView` ici, volontairement.** Les cartes « Score » et « Top 3 »
 * sont dessinées en SwiftUI par l'extension `RelockActivityReport`, hors
 * processus : une vue distante ne peut pas échantillonner le fond de l'hôte,
 * donc aucun flou d'arrière-plan n'y est possible. Flouter côté React Native
 * ferait diverger « Mes apps » de ses deux voisines natives, pour un gain nul :
 * ce qui passe derrière ces cartes est un dégradé lisse, dont le flou est
 * visuellement identique à lui-même. Le voile translucide suffit et reste
 * reproductible des deux côtés.
 *
 * Le parent porte le rayon, `overflow: 'hidden'` (qui découpe l'arête sur les
 * angles) et `shadow.glass`.
 */
export const HomeCardMaterial = React.memo(function HomeCardMaterial({
  tier = 2,
  warm = false,
}: {
  tier?: HomeCardTier
  warm?: boolean
}) {
  const { colors: palette } = relockMaterial
  const { fill, edge } = TIERS[tier]

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
    >
      {warm ? (
        <Svg
          width="100%"
          height="100%"
          pointerEvents="none"
          accessibilityElementsHidden
        >
          <Defs>
            <LinearGradient id="homeWarmMaterial" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={palette.homeCard} />
              <Stop offset="0.6" stopColor={palette.homeCard} />
              <Stop
                offset="1"
                stopColor={palette.homeRewardGlow}
                stopOpacity={0.28}
              />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#homeWarmMaterial)" />
        </Svg>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: fill }]} />
      )}
      <View style={[styles.edge, { backgroundColor: edge }]} />
    </View>
  )
})

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: layout.homeGlassEdgeHeight,
  },
})
