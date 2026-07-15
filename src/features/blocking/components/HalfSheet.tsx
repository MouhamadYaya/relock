import React, { useEffect, useRef, useState } from 'react'
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

// Flou natif chargé en douceur (repli sur assombrissement si absent).
let BlurView: React.ComponentType<{
  style?: unknown
  blurType?: string
  blurAmount?: number
  reducedTransparencyFallbackColor?: string
}> | null = null
try {
  BlurView = require('@react-native-community/blur').BlurView
} catch {}

const GRAB = 26
const C = { sheet: '#14161E', accent: '#A49AFE' }

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/**
 * Demi-feuille réutilisable (même style que l'écran Ajout) : fond flouté léger,
 * hauteur adaptée au contenu, glisser vers le bas / tap pour fermer, ombre
 * violette au sommet. `children` reçoit `close` pour fermer proprement.
 */
export function HalfSheet({
  children,
  onClose,
}: {
  children: (close: () => void) => React.ReactNode
  onClose: () => void
}) {
  const { height: SCREEN_H } = useWindowDimensions()
  const MAXH = Math.round(SCREEN_H * 0.9)

  const [contentH, setContentH] = useState(Math.round(SCREEN_H * 0.4))
  const translateY = useSharedValue(SCREEN_H)
  const backdrop = useSharedValue(0)
  const sheetH = useSharedValue(Math.round(SCREEN_H * 0.4) + GRAB)
  const firstMeasure = useRef(true)
  const target = Math.min(MAXH, GRAB + contentH)

  useEffect(() => {
    translateY.value = withTiming(0, {
      duration: 340,
      easing: Easing.out(Easing.cubic),
    })
    backdrop.value = withTiming(1, { duration: 240 })
    // Valeurs partagées Reanimated : références stables → mount-only.
  }, [backdrop, translateY])

  useEffect(() => {
    if (firstMeasure.current) {
      sheetH.value = target
      firstMeasure.current = false
    } else {
      sheetH.value = withTiming(target, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      })
    }
  }, [sheetH, target])

  const close = () => {
    backdrop.value = withTiming(0, { duration: 200 })
    translateY.value = withTiming(
      SCREEN_H,
      { duration: 240, easing: Easing.in(Easing.cubic) },
      fin => {
        if (fin) runOnJS(onClose)()
      },
    )
  }

  const pan = Gesture.Pan()
    .onUpdate(e => {
      translateY.value = Math.max(0, e.translationY)
    })
    .onEnd(e => {
      if (e.translationY > 110 || e.velocityY > 900) {
        runOnJS(close)()
      } else {
        translateY.value = withSpring(0, { damping: 30, stiffness: 240 })
      }
    })

  const measure = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height)
    setContentH(prev => (prev === h ? prev : h))
  }

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }))
  const sheetStyle = useAnimatedStyle(() => ({
    height: sheetH.value,
    transform: [{ translateY: translateY.value }],
  }))

  return (
    <View style={styles.root}>
      <AnimatedPressable
        style={[StyleSheet.absoluteFill, backdropStyle]}
        onPress={close}
      >
        {BlurView ? (
          <BlurView
            style={StyleSheet.absoluteFill as object}
            blurType="dark"
            blurAmount={9}
            reducedTransparencyFallbackColor="#0B0C10"
          />
        ) : null}
        <View style={styles.dim} />
      </AnimatedPressable>

      <Animated.View style={[styles.sheet, sheetStyle]}>
        <GestureDetector gesture={pan}>
          <View style={styles.grabZone}>
            <View style={styles.grabber} />
          </View>
        </GestureDetector>
        <View style={styles.content} onLayout={measure}>
          {children(close)}
        </View>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,7,10,0.28)',
  },
  sheet: {
    backgroundColor: C.sheet,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
  },
  grabZone: { alignItems: 'center', paddingTop: 10, paddingBottom: 10 },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  content: { paddingHorizontal: 22, paddingBottom: 30 },
})
