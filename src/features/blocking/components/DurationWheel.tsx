import React, { useEffect, useRef } from 'react'
import {
  FlatList,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { durationLabelFromMinutes } from '@/features/blocking/format'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { haptics } from '@/shared/utils/platform/haptics'

const { colors, opacity, radius, typography } = relockMaterial

const ROW_HEIGHT = spacing.xxxxl
const VISIBLE_ROWS = 3
const EDGE_ROWS = Math.floor(VISIBLE_ROWS / 2)

/**
 * Durées d'un « Bloquer maintenant ». Cinq minutes est un vrai besoin — le
 * temps d'une envie qui passe — et iOS sait le tenir (cf. le réveil court
 * de `startTimedBlock`).
 */
export const BLOCK_DURATION_OPTIONS = [
  5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180, 240, 300, 360, 480,
]

/** Limites quotidiennes : mêmes paliers, bornés à 4 h de tolérance. */
export const DAILY_LIMIT_OPTIONS = [
  5, 10, 15, 20, 25, 30, 45, 60, 90, 120, 180, 240,
]

/** Le palier le plus proche d'une valeur libre (config déjà enregistrée). */
export function nearestDurationOption(
  minutes: number,
  options: number[],
): number {
  return options.reduce((best, option) =>
    Math.abs(option - minutes) < Math.abs(best - minutes) ? option : best,
  )
}

export function durationForOffset(offset: number, options: number[]): number {
  const index = Math.round(offset / ROW_HEIGHT)
  return options[Math.min(options.length - 1, Math.max(0, index))]
}

/**
 * Molette de durée maison.
 *
 * ⚠️ Elle remplace `DateTimePicker mode="countdown"` : en mode compte à
 * rebours, `UIDatePicker` IGNORE sa propriété `date` (documentation Apple) et
 * ne publie sa valeur que par `countDownDuration`, que la lib ne lit jamais.
 * L'`onChange` renvoyait donc la date qu'on venait de lui pousser — la durée
 * restait bloquée sur sa valeur initiale, quoi qu'on fasse tourner.
 */
export function DurationWheel({
  minutes,
  options,
  onChange,
  accessibilityLabel,
  testID,
}: {
  minutes: number
  options: number[]
  onChange: (minutes: number) => void
  accessibilityLabel: string
  testID?: string
}) {
  const listRef = useRef<FlatList<number>>(null)
  const hapticRef = useRef(minutes)

  // Recentrage sur la valeur courante à l'ouverture (et en édition, sur la
  // durée déjà enregistrée).
  // biome-ignore lint/correctness/useExhaustiveDependencies: recentrage au MONTAGE uniquement — ensuite c'est le doigt qui commande, réagir à `minutes` reprendrait la main pendant le geste.
  useEffect(() => {
    const index = options.indexOf(minutes)
    if (index < 0) return
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({
        offset: index * ROW_HEIGHT,
        animated: false,
      })
    })
  }, [])

  const select = (next: number, animated = true, withHaptic = true) => {
    if (next !== hapticRef.current) {
      hapticRef.current = next
      if (withHaptic) haptics.selectionTick()
    }
    onChange(next)
    listRef.current?.scrollToOffset({
      offset: options.indexOf(next) * ROW_HEIGHT,
      animated,
    })
  }

  const preview = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = durationForOffset(event.nativeEvent.contentOffset.y, options)
    if (next === hapticRef.current) return
    hapticRef.current = next
    onChange(next)
    haptics.selectionTick()
  }

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    select(
      durationForOffset(event.nativeEvent.contentOffset.y, options),
      false,
      false,
    )
  }

  return (
    <View style={styles.picker} testID={testID}>
      <View pointerEvents="none" style={styles.selection} />
      <FlatList
        ref={listRef}
        accessibilityLabel={accessibilityLabel}
        data={options}
        keyExtractor={item => String(item)}
        renderItem={({ item }) => {
          const selected = item === minutes
          const distance = Math.abs(
            options.indexOf(item) - options.indexOf(minutes),
          )
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={durationLabelFromMinutes(item)}
              onPress={() => select(item)}
              style={styles.row}
            >
              <Text
                style={[
                  styles.label,
                  distance === 1 && styles.labelNear,
                  distance > 1 && styles.labelFar,
                  selected && styles.labelSelected,
                ]}
              >
                {durationLabelFromMinutes(item)}
              </Text>
            </Pressable>
          )
        }}
        getItemLayout={(_data, index) => ({
          length: ROW_HEIGHT,
          offset: ROW_HEIGHT * index,
          index,
        })}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        bounces={false}
        overScrollMode="never"
        scrollEventThrottle={16}
        onScroll={preview}
        onMomentumScrollEnd={settle}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  picker: {
    height: ROW_HEIGHT * VISIBLE_ROWS,
    overflow: 'hidden',
  },
  selection: {
    position: 'absolute',
    top: ROW_HEIGHT * EDGE_ROWS,
    right: 0,
    left: 0,
    height: ROW_HEIGHT,
    borderRadius: radius.capsule,
    backgroundColor: colors.blockingAccentTintStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.blockingAccentLight,
  },
  content: {
    paddingVertical: ROW_HEIGHT * EDGE_ROWS,
  },
  row: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...fonts.regular,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    opacity: opacity.disabled,
  },
  labelNear: {
    opacity: 0.72,
  },
  labelFar: {
    opacity: opacity.decorativeStrong,
  },
  labelSelected: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.blockingSectionSize,
    lineHeight: typography.blockingSectionLineHeight,
    opacity: 1,
  },
})
