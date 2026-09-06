import React, { useCallback } from 'react'
import {
  type NativeSyntheticEvent,
  Platform,
  requireNativeComponent,
  StyleSheet,
  View,
  type ViewProps,
} from 'react-native'
import { spacing } from '@/shared/theme/tokens/spacing'

type DurationChangeEvent = NativeSyntheticEvent<{ minutes: number }>

// `onChange` est déjà enregistré comme événement bubbling par le cœur RN
// (`topChange`) : réutiliser ce nom pour un direct event fait planter le
// renderer (« Event cannot be both direct and bubbling »). D'où `onDurationChange`.
type NativeProps = ViewProps & {
  minutes: number
  minimumMinutes: number
  maximumMinutes: number
  minuteInterval: number
  onDurationChange: (event: DurationChangeEvent) => void
}

const NATIVE_VIEW_NAME = 'NativeDurationPickerView'
const NativePicker =
  Platform.OS === 'ios'
    ? requireNativeComponent<NativeProps>(NATIVE_VIEW_NAME)
    : null

export function normalizeDurationMinutes(
  value: number,
  minimumMinutes: number,
  maximumMinutes: number,
  minuteInterval: number,
): number {
  const lower = Math.max(1, Math.round(minimumMinutes))
  const upper = Math.max(lower, Math.round(maximumMinutes))
  const interval = Math.max(1, Math.round(minuteInterval))
  const stepped = Math.round(value / interval) * interval
  return Math.min(upper, Math.max(lower, stepped))
}

export function NativeDurationPicker({
  minutes,
  minimumMinutes,
  maximumMinutes,
  minuteInterval = 5,
  onMinutesChange,
  style,
  ...rest
}: Omit<NativeProps, 'onDurationChange' | 'minutes' | 'minuteInterval'> & {
  minutes: number
  minuteInterval?: number
  onMinutesChange: (minutes: number) => void
}) {
  const normalizedMinutes = normalizeDurationMinutes(
    minutes,
    minimumMinutes,
    maximumMinutes,
    minuteInterval,
  )

  const handleChange = useCallback(
    (event: DurationChangeEvent) => {
      onMinutesChange(
        normalizeDurationMinutes(
          event.nativeEvent.minutes,
          minimumMinutes,
          maximumMinutes,
          minuteInterval,
        ),
      )
    },
    [maximumMinutes, minimumMinutes, minuteInterval, onMinutesChange],
  )

  if (!NativePicker) {
    return <View {...rest} style={[styles.picker, style]} />
  }

  return (
    <NativePicker
      {...rest}
      accessibilityRole="adjustable"
      minutes={normalizedMinutes}
      minimumMinutes={minimumMinutes}
      maximumMinutes={maximumMinutes}
      minuteInterval={minuteInterval}
      onDurationChange={handleChange}
      style={[styles.picker, style]}
    />
  )
}

const styles = StyleSheet.create({
  picker: {
    alignSelf: 'stretch',
    height: spacing.xxxxl * 3,
  },
})
