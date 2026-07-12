import React from 'react'
import {
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>
  /** Échelle au press (défaut 0.96, jamais < 0.95). */
  scaleTo?: number
}

/**
 * Pressable avec retour tactile : scale au press (0.96), piloté par Reanimated.
 * Respecte prefers-reduced-motion (pas d'échelle).
 */
export function PressableScale({
  style,
  scaleTo = 0.96,
  onPressIn,
  onPressOut,
  disabled,
  children,
  ...rest
}: Props) {
  const reduce = useReducedMotion()
  const scale = useSharedValue(1)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={e => {
        if (!reduce && !disabled) {
          scale.value = withTiming(scaleTo, { duration: 90 })
        }
        onPressIn?.(e)
      }}
      onPressOut={e => {
        scale.value = withTiming(1, { duration: 140 })
        onPressOut?.(e)
      }}
      style={[style, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  )
}
