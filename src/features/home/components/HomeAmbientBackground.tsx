import React from 'react'
import { StyleSheet, View } from 'react-native'
import Svg, {
  Defs,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'
import { relockMaterial } from '@/shared/theme'

const { colors } = relockMaterial

/** Ambient, non-interactive canvas shared by every Home state. */
export function HomeAmbientBackground() {
  return (
    <View pointerEvents="none" style={styles.canvas}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="home-canvas" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.canvasTop} />
            <Stop offset="1" stopColor={colors.canvasBottom} />
          </LinearGradient>
          <RadialGradient
            id="home-ambient-top"
            cx="78%"
            cy="7%"
            rx="72%"
            ry="44%"
          >
            <Stop
              offset="0"
              stopColor={colors.ambientIndigoSolid}
              stopOpacity={0.16}
            />
            <Stop
              offset="1"
              stopColor={colors.ambientIndigoSolid}
              stopOpacity={0}
            />
          </RadialGradient>
          <RadialGradient
            id="home-ambient-bottom"
            cx="20%"
            cy="70%"
            rx="64%"
            ry="42%"
          >
            <Stop
              offset="0"
              stopColor={colors.ambientVioletSolid}
              stopOpacity={0.1}
            />
            <Stop
              offset="1"
              stopColor={colors.ambientVioletSolid}
              stopOpacity={0}
            />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#home-canvas)" />
        <Rect width="100%" height="100%" fill="url(#home-ambient-top)" />
        <Rect width="100%" height="100%" fill="url(#home-ambient-bottom)" />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  canvas: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.canvasFallback,
  },
})
