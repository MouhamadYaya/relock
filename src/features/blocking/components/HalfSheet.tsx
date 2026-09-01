import React, { useEffect, useRef, useState } from 'react'
import {
  type LayoutChangeEvent,
  Pressable,
  type StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  type ViewStyle,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { relockMaterial } from '@/shared/theme'

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
// Bande laissée visible au-dessus de la feuille une fois dépliée en plein écran.
const EXPANDED_GAP = 10
const SNAP = { damping: 30, stiffness: 360, mass: 0.9 } as const
// Déplier ne se mérite pas : un petit geste vers le haut ouvre en grand.
const LIFT_TRIGGER = 20
const LIFT_VELOCITY = -120
const C = {
  sheet: relockMaterial.colors.blockingSheetSurface,
  accent: '#A49AFE',
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/**
 * Demi-feuille réutilisable (même style que l'écran Ajout) : fond flouté léger,
 * hauteur adaptée au contenu, glisser vers le bas / tap pour fermer, ombre
 * violette au sommet. `children` reçoit `close` pour fermer proprement.
 */
export function HalfSheet({
  children,
  onClose,
  height,
  contentStyle,
  expandable,
  header,
  onExpandedChange,
}: {
  children: (close: () => void, expanded: boolean) => React.ReactNode
  onClose: () => void
  /**
   * Hauteur fixe (px). Sans elle la feuille se mesure sur son contenu — ce qui
   * ne marche pas quand le contenu défile (un ScrollView n'a pas de hauteur
   * propre). Avec elle, le contenu remplit la feuille et défile dedans.
   */
  height?: number
  contentStyle?: StyleProp<ViewStyle>
  /**
   * Autorise le dépliage en plein écran : on tire la feuille vers le haut et
   * elle s'aimante entre sa hauteur `height` et la pleine page. Sans `height`
   * (feuille mesurée sur son contenu) l'option n'a pas de sens.
   */
  expandable?: boolean
  /**
   * En-tête rendu DANS la zone de glissement, sous la poignée : la feuille se
   * tire donc aussi par son titre, pas seulement par les 26 px de la poignée.
   * Sa hauteur n'entre pas dans la mesure automatique — réservé aux feuilles
   * à `height` fixe.
   */
  header?: (close: () => void) => React.ReactNode
  /** Notifie le passage cran bas ↔ plein écran (pour remettre une liste à zéro). */
  onExpandedChange?: (expanded: boolean) => void
}) {
  const { height: SCREEN_H } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const MAXH = Math.round(SCREEN_H * 0.9)
  const fixedH =
    height === undefined ? null : Math.min(MAXH, Math.round(height))
  const canExpand = expandable === true && fixedH !== null
  // Feuille dépliable : elle mesure TOUJOURS la pleine page, et c'est sa
  // translation qui la fait monter ou descendre. Un `transform` s'anime sur le
  // fil UI sans relayout ; animer `height` en relayoutait un à chaque frame,
  // d'où le glissement pâteux qu'il fallait relancer plusieurs fois.
  const expandedH = Math.max(
    fixedH ?? 0,
    Math.round(SCREEN_H - insets.top - EXPANDED_GAP),
  )
  // Position de repos : ce qui dépasse sous l'écran quand la feuille est posée.
  const restY = canExpand ? expandedH - (fixedH as number) : 0

  const [expanded, setExpanded] = useState(false)
  const [contentH, setContentH] = useState(Math.round(SCREEN_H * 0.4))
  const translateY = useSharedValue(SCREEN_H)
  const backdrop = useSharedValue(0)
  const sheetH = useSharedValue(fixedH ?? Math.round(SCREEN_H * 0.4) + GRAB)
  const dragStartY = useSharedValue(0)
  const expandedSV = useSharedValue(false)
  const firstMeasure = useRef(true)
  const target = fixedH ?? Math.min(MAXH, GRAB + contentH)

  useEffect(() => {
    translateY.value = withTiming(restY, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    })
    backdrop.value = withTiming(1, { duration: 240 })
    // Rotation ou changement de hauteur : la feuille se repose. L'état déplié
    // doit suivre, sinon le contenu reste défilable et impossible à tirer sur
    // une feuille pourtant repliée.
    if (expandedSV.value) {
      expandedSV.value = false
      setExpanded(false)
    }
    // Valeurs partagées Reanimated : références stables → mount-only.
  }, [backdrop, translateY, restY, expandedSV])

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

  const applyExpanded = (value: boolean) => {
    setExpanded(value)
    onExpandedChange?.(value)
  }

  const onDragStart = () => {
    'worklet'
    dragStartY.value = translateY.value
  }

  const onDragUpdate = (e: { translationY: number }) => {
    'worklet'
    if (!canExpand) {
      translateY.value = Math.max(0, e.translationY)
      return
    }
    // Suivi du doigt au pixel près, borné en haut par la pleine page.
    translateY.value = Math.max(0, dragStartY.value + e.translationY)
  }

  const onDragEnd = (e: { translationY: number; velocityY: number }) => {
    'worklet'
    if (!canExpand) {
      if (e.translationY > 110 || e.velocityY > 900) {
        runOnJS(close)()
      } else {
        translateY.value = withSpring(0, SNAP)
      }
      return
    }
    // On ne referme que depuis le cran bas : vers le bas, une feuille dépliée
    // se repose d'abord sur son cran.
    const atRest = translateY.value >= restY - 1
    if (atRest && (e.translationY > 110 || e.velocityY > 900)) {
      runOnJS(close)()
      return
    }
    const pulledUp = e.translationY < 0
    const expand = pulledUp
      ? e.translationY < -LIFT_TRIGGER || e.velocityY < LIFT_VELOCITY
      : e.velocityY < 400 && translateY.value < restY / 2
    translateY.value = withSpring(expand ? 0 : restY, SNAP)
    if (expand !== expandedSV.value) {
      expandedSV.value = expand
      runOnJS(applyExpanded)(expand)
    }
  }

  // Deux détecteurs sur des zones disjointes, plutôt qu'un seul : l'en-tête
  // reste saisissable en permanence, et le contenu n'est saisi QUE tant que la
  // feuille est repliée — une fois dépliée il rend la main au défilement.
  const headerPan = Gesture.Pan()
    .onStart(onDragStart)
    .onUpdate(onDragUpdate)
    .onEnd(onDragEnd)

  const contentPan = Gesture.Pan()
    .enabled(canExpand && !expanded)
    .onStart(onDragStart)
    .onUpdate(onDragUpdate)
    .onEnd(onDragEnd)

  const measure = (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height)
    setContentH(prev => (prev === h ? prev : h))
  }

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }))
  const sheetStyle = useAnimatedStyle(() => ({
    height: canExpand ? expandedH : sheetH.value,
    transform: [{ translateY: translateY.value }],
  }))
  // Posée, la feuille dépasse sous l'écran : on rogne le contenu d'autant pour
  // que le défilement s'arrête pile en bas de l'écran. Valeur en palier (et non
  // continue) → une seule passe de layout au décollage, pas soixante par
  // seconde.
  const contentPadStyle = useAnimatedStyle(() => ({
    paddingBottom:
      canExpand && translateY.value >= restY - 1 ? restY : (0 as number),
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
        <GestureDetector gesture={headerPan}>
          <View>
            <View style={styles.grabZone}>
              <View style={styles.grabber} />
            </View>
            {header?.(close)}
          </View>
        </GestureDetector>
        <GestureDetector gesture={contentPan}>
          <Animated.View
            style={[
              styles.content,
              fixedH !== null && styles.contentFill,
              contentStyle,
              canExpand && contentPadStyle,
            ]}
            onLayout={fixedH === null ? measure : undefined}
          >
            {children(close, expanded)}
          </Animated.View>
        </GestureDetector>
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
  contentFill: { flex: 1 },
})
