import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { haptics } from '@/shared/utils/platform/haptics'

const { colors, layout, radius, typography } = relockMaterial

/** Durée du maintien. Assez pour qu'une impulsion retombe, pas pour punir. */
export const HOLD_MS = 2400
/** Nombre d'ondes visibles pendant le maintien. */
const WAVE_COUNT = 7
/**
 * Exposant des courbes. > 1 ⇒ ondes et secousses se resserrent à mesure que le
 * doigt tient : le geste ACCÉLÈRE au lieu de battre à vide.
 */
const WAVE_CURVE = 1.6

/** Cadence du marteau-piqueur : de l'espacé au serré, en millisecondes. */
const RUMBLE_START_MS = 190
const RUMBLE_END_MS = 38

/** Instants (ms) où une onde part. */
export function waveTimings(
  holdMs = HOLD_MS,
  waves = WAVE_COUNT,
  curve = WAVE_CURVE,
): number[] {
  return Array.from({ length: waves }, (_value, index) =>
    Math.round(((index + 1) / waves) ** (1 / curve) * holdMs),
  )
}

/**
 * Instants (ms) des secousses : l'intervalle rétrécit linéairement de
 * `RUMBLE_START_MS` à `RUMBLE_END_MS`, ce qui donne un martèlement qui
 * s'emballe — un terrassement, pas une série de petits tics réguliers.
 */
export function rumbleTimings(holdMs = HOLD_MS): number[] {
  const times: number[] = []
  let at = 0
  while (at < holdMs) {
    const ratio = at / holdMs
    at += RUMBLE_START_MS + (RUMBLE_END_MS - RUMBLE_START_MS) * ratio
    if (at < holdMs) times.push(Math.round(at))
  }
  times.push(holdMs)
  return times
}

/** Une secousse : plus le maintien avance, plus la frappe est doublée. */
function strike(progress: number) {
  haptics.impactHeavy()
  // Dans le dernier tiers, on superpose une frappe sèche au coup lourd :
  // la vibration cesse d'être un tic, elle devient un choc.
  if (progress > 0.62) haptics.impactRigid()
}

type HoldTone = 'brand' | 'danger'

/**
 * Le maintien ALLUME le bouton : le remplissage est toujours plus clair que
 * son fond. Passé le libellé, l'encre s'inverse — sans ça, du blanc sur un
 * violet clair (ou un rose vif) devient illisible pile au moment décisif.
 */
const TONE = {
  brand: {
    ring: colors.blockingAccentLight,
    fill: colors.blockingAccentLight,
    border: colors.blockingAccentLight,
    surface: colors.blockingAccent,
    glow: colors.blockingAccent,
    label: colors.onAccent,
    labelFlooded: colors.onBrightAccent,
    spinner: colors.onAccent,
  },
  danger: {
    ring: colors.blockingDangerBright,
    fill: colors.blockingDangerBright,
    border: colors.blockingDangerBright,
    surface: colors.blockingDangerSurface,
    glow: colors.blockingDanger,
    label: colors.onAccent,
    labelFlooded: colors.blockingDangerCanvas,
    spinner: colors.onAccent,
  },
} as const satisfies Record<HoldTone, Record<string, string>>

/** Part du maintien après laquelle le remplissage a dépassé le libellé. */
const FLOOD_RATIO = 0.58

/**
 * Une onde : elle naît au bord du bouton, s'écarte, s'efface — et recommence
 * de plus en plus vite. `offset` décale la crête pour que les anneaux ne
 * partent pas ensemble.
 */
function HoldWave({
  progress,
  offset,
  color,
}: {
  progress: SharedValue<number>
  offset: number
  color: string
}) {
  const style = useAnimatedStyle(() => {
    const value = progress.value
    if (value <= 0) return { opacity: 0, transform: [{ scale: 1 }] }
    const phase = (value ** WAVE_CURVE * WAVE_COUNT + offset) % 1
    // L'onde ne va pas seulement plus vite : elle tape plus fort.
    // L'onde tape plus fort en accélérant, mais elle reste PRÈS du bouton :
    // un halo qui s'étale mange l'écran au lieu de désigner l'action.
    const intensity = 0.14 + value * 0.42
    return {
      opacity: (1 - phase) * intensity,
      transform: [{ scale: 1 + phase * 0.1 }],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.wave, { borderColor: color }, style]}
    />
  )
}

/**
 * Bouton « maintenir pour… » — le temps passé le doigt posé EST la
 * confirmation.
 *
 * Aucune boîte de dialogue derrière : ce qui protège de l'impulsion, c'est la
 * durée, rendue visible (remplissage + ondes) et sensible (martèlement qui
 * s'emballe). Relâcher avant la fin annule tout, sans pénalité.
 *
 * Le déclenchement est piloté par un timer JS, pas par la fin de l'animation :
 * c'est le TEMPS tenu qui confirme, et il doit rester exact même si le fil
 * d'animation est ralenti.
 */
export function HoldToConfirmButton({
  idleLabel,
  holdingLabel,
  tone = 'brand',
  holdMs = HOLD_MS,
  disabled = false,
  pending = false,
  testID,
  accessibilityHint,
  onConfirm,
  style,
}: {
  idleLabel: string
  holdingLabel: string
  tone?: HoldTone
  holdMs?: number
  disabled?: boolean
  pending?: boolean
  testID?: string
  accessibilityHint?: string
  onConfirm: () => void
  style?: object
}) {
  const reduceMotion = useReducedMotion()
  const palette = TONE[tone]
  const [holding, setHolding] = useState(false)
  const [flooded, setFlooded] = useState(false)
  const progress = useSharedValue(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = () => {
    for (const timer of timers.current) clearTimeout(timer)
    timers.current = []
  }

  useEffect(() => {
    const tracked = timers
    return () => {
      for (const timer of tracked.current) clearTimeout(timer)
    }
  }, [])

  const startHold = () => {
    if (disabled || pending) return
    setHolding(true)
    setFlooded(false)
    haptics.impactHeavy()
    progress.value = 0
    progress.value = withTiming(1, { duration: holdMs, easing: Easing.linear })
    clearTimers()
    timers.current = [
      ...rumbleTimings(holdMs).map(at =>
        setTimeout(() => strike(at / holdMs), at),
      ),
      setTimeout(() => setFlooded(true), holdMs * FLOOD_RATIO),
      setTimeout(() => {
        setHolding(false)
        setFlooded(false)
        onConfirm()
      }, holdMs),
    ]
  }

  const endHold = () => {
    clearTimers()
    cancelAnimation(progress)
    progress.value = withTiming(0, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    })
    setHolding(false)
    setFlooded(false)
  }

  const fillStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }))

  const shellStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + progress.value * 0.014 }],
    shadowOpacity: 0.1 + progress.value * 0.32,
    shadowRadius: spacing.xxs + progress.value * spacing.sm,
  }))

  return (
    <View style={[styles.stage, style]}>
      {reduceMotion ? null : (
        <>
          <HoldWave progress={progress} offset={0} color={palette.ring} />
          <HoldWave progress={progress} offset={0.33} color={palette.ring} />
          <HoldWave progress={progress} offset={0.66} color={palette.ring} />
        </>
      )}
      <Animated.View
        style={[styles.shell, { shadowColor: palette.glow }, shellStyle]}
      >
        <Pressable
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={idleLabel}
          accessibilityHint={accessibilityHint ?? holdingLabel}
          accessibilityState={{ disabled: disabled || pending, busy: holding }}
          disabled={disabled || pending}
          onPressIn={startHold}
          onPressOut={endHold}
          style={[
            styles.button,
            {
              borderColor: palette.border,
              backgroundColor: palette.surface,
            },
            (disabled || pending) && styles.buttonDisabled,
          ]}
        >
          <Animated.View
            pointerEvents="none"
            style={[styles.fill, { backgroundColor: palette.fill }, fillStyle]}
          />
          {pending ? (
            <ActivityIndicator color={palette.spinner} />
          ) : (
            <Text
              style={[
                styles.label,
                { color: flooded ? palette.labelFlooded : palette.label },
              ]}
            >
              {holding ? holdingLabel : idleLabel}
            </Text>
          )}
        </Pressable>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  wave: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.capsule,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  shell: {
    borderRadius: radius.capsule,
    shadowOffset: { width: 0, height: 0 },
  },
  button: {
    minHeight: layout.primaryActionHeight,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.capsule,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  buttonDisabled: {
    opacity: relockMaterial.opacity.disabled,
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  label: {
    ...fonts.semiBold,
    fontSize: typography.buttonSize,
    lineHeight: typography.buttonLineHeight,
  },
})
