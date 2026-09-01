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

const { colors, opacity } = relockMaterial

export function BlockingCanvas() {
  return (
    <View pointerEvents="none" style={styles.canvas}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="blocking-canvas" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.blockingCanvasTop} />
            <Stop offset="1" stopColor={colors.blockingCanvas} />
          </LinearGradient>
          <RadialGradient
            id="blocking-ambient"
            cx="82%"
            cy="8%"
            rx="72%"
            ry="42%"
          >
            <Stop
              offset="0"
              stopColor={colors.blockingAccentDark}
              stopOpacity={opacity.blockingAmbient}
            />
            <Stop
              offset="1"
              stopColor={colors.blockingAccentDark}
              stopOpacity={0}
            />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#blocking-canvas)" />
        <Rect width="100%" height="100%" fill="url(#blocking-ambient)" />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  canvas: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
    backgroundColor: colors.blockingCanvas,
  },
})
