import React from 'react'
import { StyleSheet } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
} from 'react-native-reanimated'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { relockMaterial } from '@/shared/theme'

const { colors, layout, opacity } = relockMaterial

interface Props {
  /** Décalage vertical du `ScrollView` de l'Accueil, en points. */
  scrollY: SharedValue<number>
  /** Bande pleine : du haut de l'écran au bas de la rangée d'actions. */
  solidHeight: number
  /** Longueur sur laquelle le voile s'éteint, sous cette bande. */
  fadeHeight: number
}

/**
 * Le voile qui tient sous l'entête fixe.
 *
 * Depuis que l'entête ne défile plus, TOUT le contenu passe dessous : sans
 * voile, le titre d'une carte traversait le logotype et les deux devenaient
 * illisibles.
 *
 * Deux mécaniques, et les deux comptent :
 *
 * 1. **Il se densifie au défilement.** À l'arrêt il ne pèse que
 *    `HEADER_SCRIM_REST` : l'Accueil est adossé à une scène lumineuse (voir
 *    `HomeBackdrop`) et une bande franche posée en permanence sur le limbe de
 *    la planète serait une balafre — mais ce fond de voile assoit déjà la
 *    barre d'état. Il monte à pleine densité sur les `HEADER_SCRIM_REVEAL`
 *    premiers points, quand du contenu commence à remonter : le comportement
 *    d'une barre de navigation iOS.
 *
 *    Ce plancher n'est pas qu'esthétique, il rend la panne sûre : si le
 *    gestionnaire de défilement ne s'attachait pas, un voile parti de zéro
 *    disparaîtrait en silence et le bug d'illisibilité reviendrait sans
 *    prévenir. Là, il resterait simplement moins dense.
 * 2. **Il s'éteint vers le bas.** Un aplat à bord franc se lirait comme une
 *    barre posée sur la page ; le dégradé rend l'assombrissement invisible en
 *    tant qu'objet — on ne voit que le contenu qui s'efface en passant
 *    dessous.
 *
 * Le coude du dégradé est calé sur le BAS de la rangée d'actions, pas à une
 * fraction arbitraire : c'est jusque-là qu'il faut tenir l'assombrissement
 * pour que le logotype garde son contraste, la retombée vient après.
 */
const HEADER_SCRIM_REVEAL = 24
const HEADER_SCRIM_REST = 0.35

export function HomeHeaderScrim({ scrollY, solidHeight, fadeHeight }: Props) {
  const height = solidHeight + fadeHeight
  const knee = solidHeight / height

  const revealStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, HEADER_SCRIM_REVEAL],
      [HEADER_SCRIM_REST, 1],
      Extrapolation.CLAMP,
    ),
  }))

  return (
    <Animated.View
      testID="home-header-scrim"
      pointerEvents="none"
      accessibilityElementsHidden
      style={[styles.scrim, { height }, revealStyle]}
    >
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="homeHeaderScrim" x1="0" y1="0" x2="0" y2="1">
            <Stop
              offset="0"
              stopColor={colors.homeCanvas}
              stopOpacity={opacity.homeHeaderScrimTop}
            />
            <Stop
              offset={knee}
              stopColor={colors.homeCanvas}
              stopOpacity={opacity.homeHeaderScrimKnee}
            />
            <Stop offset="1" stopColor={colors.homeCanvas} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#homeHeaderScrim)" />
      </Svg>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: layout.homeHeaderScrimZ,
  },
})
