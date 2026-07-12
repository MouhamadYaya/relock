import React, { useEffect, useState } from 'react'
import type { StyleProp, TextStyle } from 'react-native'
import {
  Easing,
  runOnJS,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { Text } from '@/shared/components/ui/Text'

interface Props {
  value: number
  duration?: number
  style?: StyleProp<TextStyle>
  /** Format the (rounded) display value, e.g. add a suffix. */
  format?: (n: number) => string
}

/**
 * Compte à rebours ascendant (count-up) sur un nombre, piloté par Reanimated.
 * Respecte prefers-reduced-motion (affiche la valeur finale d'emblée).
 * tabular-nums pour éviter tout décalage de mise en page.
 */
export function CountUp({ value, duration = 900, style, format }: Props) {
  const reduce = useReducedMotion()
  const progress = useSharedValue(0)
  const [display, setDisplay] = useState(reduce ? value : 0)

  useEffect(() => {
    if (reduce) {
      // Pas d'animation : fige la valeur finale côté UI ET côté shared value,
      // sinon useAnimatedReaction réécrirait l'affichage à 0.
      progress.value = value
      setDisplay(value)
      return
    }
    progress.value = 0
    progress.value = withTiming(value, {
      duration,
      easing: Easing.out(Easing.cubic),
    })
  }, [value, duration, reduce, progress])

  useAnimatedReaction(
    () => progress.value,
    v => runOnJS(setDisplay)(Math.round(v)),
  )

  return (
    <Text style={[{ fontVariant: ['tabular-nums'] }, style]}>
      {format ? format(display) : display}
    </Text>
  )
}
