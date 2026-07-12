import React, { useEffect } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'

interface Props {
  children: React.ReactNode
  /** Délai d'entrée en ms (pour staggerer une liste). */
  delay?: number
  style?: StyleProp<ViewStyle>
}

/**
 * Entrée en fondu + légère translation vers le haut, avec délai optionnel
 * pour staggerer. Le contenu est visible par défaut si reduced-motion.
 */
export function FadeSlideIn({ children, delay = 0, style }: Props) {
  const reduce = useReducedMotion()
  const p = useSharedValue(reduce ? 1 : 0)

  useEffect(() => {
    if (reduce) {
      p.value = 1
      return
    }
    p.value = withDelay(
      delay,
      withTiming(1, { duration: 420, easing: Easing.out(Easing.quad) }),
    )
  }, [delay, reduce, p])

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: p.value,
    transform: [{ translateY: (1 - p.value) * 12 }],
  }))

  return (
    <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
  )
}
