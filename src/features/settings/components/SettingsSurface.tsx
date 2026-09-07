import React from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { relockMaterial } from '@/shared/theme'

const { colors, layout } = relockMaterial

/**
 * Le verre des cartes de Réglages.
 *
 * Trois couches, dans cet ordre :
 *   1. un voile clair en léger dégradé — plus dense en haut, où l'aurore
 *      tombe. Un aplat uniforme aurait suffi à « faire carte » ; le dégradé
 *      est ce qui fait qu'on croit à un objet posé sous une lumière ;
 *   2. l'arête haute de 1 px, qui donne son épaisseur au bord supérieur ;
 *   3. rien d'autre — la bordure et le rayon appartiennent au parent, qui
 *      porte aussi `overflow: 'hidden'` (sans quoi l'arête déborderait des
 *      angles arrondis).
 *
 * Pas de `BlurView`, volontairement : ce qui passe derrière ces cartes est un
 * dégradé lisse, dont le flou est visuellement identique à lui-même. On
 * paierait une couche de compositing par carte pour un résultat nul.
 */
export function SettingsSurface({ elevated = false }: { elevated?: boolean }) {
  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="settingsGlass" x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0"
              stopColor={colors.homeGlass1}
              stopOpacity={elevated ? 1 : 0.8}
            />
            <Stop offset="1" stopColor={colors.homeGlass3} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#settingsGlass)" />
      </Svg>
      <View
        style={[
          styles.edge,
          {
            backgroundColor: elevated
              ? colors.homeGlassEdge1
              : colors.homeGlassEdge2,
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  edge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: layout.homeGlassEdgeHeight,
  },
})
