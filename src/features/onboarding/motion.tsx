import type React from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import Animated, {
  FadeInDown,
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
} from 'react-native-reanimated'

/**
 * Langage de mouvement de l'onboarding.
 *
 * Règle : aucun écran ne s'affiche déjà posé. Les écrans glissent dans le
 * sens de la navigation (avant : droite → gauche ; retour : l'inverse), et
 * chaque élément d'un écran arrive en cascade, du haut vers le bas.
 */

export const enterFwd = FadeInRight.duration(340)
export const exitFwd = FadeOutLeft.duration(220)
export const enterBack = FadeInLeft.duration(340)
export const exitBack = FadeOutRight.duration(220)

type RevealProps = {
  /** Rang dans la cascade : chaque cran ajoute ~60 ms de retard. */
  index?: number
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}

/** Entrée en cascade : fondu + légère montée, décalés par rang. */
export function Reveal({ index = 0, style, children }: RevealProps) {
  return (
    <Animated.View
      entering={FadeInDown.duration(420).delay(80 + index * 60)}
      style={style}
    >
      {children}
    </Animated.View>
  )
}
