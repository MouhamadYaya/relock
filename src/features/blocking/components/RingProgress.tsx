// Anneau de progression statique (cartes de blocage + détail).
// La fraction (0→1) = part restante affichée ; la couleur porte le sens
// (violet = temps, ambre = quota).

import React from 'react'
import { View } from 'react-native'
import Svg, { Circle } from 'react-native-svg'

type Props = {
  size: number
  stroke: number
  fraction: number
  color: string
  track?: string
  children?: React.ReactNode
}

export function RingProgress({
  size,
  stroke,
  fraction,
  color,
  track = '#2A2E3C',
  children,
}: Props) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const f = Math.max(0, Math.min(1, fraction))
  return (
    <View style={{ width: size, height: size }}>
      <Svg
        width={size}
        height={size}
        style={{ transform: [{ rotate: '-90deg' }] }}
      >
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={track}
          strokeWidth={stroke}
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
        />
      </Svg>
      {children ? (
        <View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {children}
        </View>
      ) : null}
    </View>
  )
}
