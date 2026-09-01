import { IconName } from '@assets/icons'
import React, { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlockingCanvas } from '@/features/blocking/components/BlockingCanvas'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import {
  BlockedAppIcons,
  isBlockedAppIconsAvailable,
} from '@/shared/native/BlockedAppIcons'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { haptics } from '@/shared/utils/platform/haptics'

const { colors, layout, radius, shadow, typography } = relockMaterial

/** Une ouverture reste une courte parenthèse : jamais plus de 30 minutes. */
export const UNLOCK_MIN_MINUTES = 5
export const UNLOCK_MAX_MINUTES = 30
const DEFAULT_MINUTES = 5
const PICKER_ROW_HEIGHT = spacing.xxxxl
const PICKER_VISIBLE_ROWS = 5
const UNLOCK_MINUTE_OPTIONS = Array.from(
  { length: UNLOCK_MAX_MINUTES - UNLOCK_MIN_MINUTES + 1 },
  (_value, index) => UNLOCK_MIN_MINUTES + index,
)

export function clampUnlockMinutes(value: number): number {
  return Math.min(UNLOCK_MAX_MINUTES, Math.max(UNLOCK_MIN_MINUTES, value))
}

export function unlockMinutesForPickerOffset(offset: number): number {
  const index = Math.round(offset / PICKER_ROW_HEIGHT)
  return clampUnlockMinutes(UNLOCK_MIN_MINUTES + index)
}

export function UnlockDurationSheet({
  visible,
  tokenKey,
  onCancel,
  onPick,
  pending = false,
  allApps = false,
}: {
  visible: boolean
  tokenKey?: string
  onCancel: () => void
  onPick: (minutes: number) => void
  pending?: boolean
  /** « Tout débloquer » : même choix de durée, formulé au pluriel. */
  allApps?: boolean
}) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES)
  const pickerRef = useRef<FlatList<number>>(null)
  const hapticMinuteRef = useRef(DEFAULT_MINUTES)

  // Chaque ouverture repart du minimum : un déblocage n'hérite pas de la
  // durée du précédent, qui concernait une autre app et un autre moment.
  useEffect(() => {
    if (!visible) return
    setMinutes(DEFAULT_MINUTES)
    hapticMinuteRef.current = DEFAULT_MINUTES
    const frame = requestAnimationFrame(() => {
      pickerRef.current?.scrollToOffset({ offset: 0, animated: false })
    })
    return () => cancelAnimationFrame(frame)
  }, [visible])

  const selectMinutes = (
    nextMinutes: number,
    animated = true,
    withHaptic = true,
  ) => {
    const bounded = clampUnlockMinutes(nextMinutes)
    if (bounded !== hapticMinuteRef.current) {
      hapticMinuteRef.current = bounded
      if (withHaptic) haptics.selectionTick()
    }
    setMinutes(bounded)
    pickerRef.current?.scrollToOffset({
      offset: (bounded - UNLOCK_MIN_MINUTES) * PICKER_ROW_HEIGHT,
      animated,
    })
  }

  const previewPicker = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextMinutes = unlockMinutesForPickerOffset(
      event.nativeEvent.contentOffset.y,
    )
    if (nextMinutes === hapticMinuteRef.current) return
    hapticMinuteRef.current = nextMinutes
    setMinutes(nextMinutes)
    haptics.selectionTick()
  }

  const settlePicker = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    selectMinutes(
      unlockMinutesForPickerOffset(event.nativeEvent.contentOffset.y),
      false,
      false,
    )
  }

  const close = () => {
    if (!pending) onCancel()
  }

  return (
    <Modal
      visible={visible}
      transparent={false}
      statusBarTranslucent
      animationType="fade"
      presentationStyle="fullScreen"
      onRequestClose={close}
    >
      <View accessibilityViewIsModal style={styles.root}>
        <BlockingCanvas />
        <View
          style={[
            styles.content,
            {
              paddingTop: insets.top + spacing.sm,
              paddingBottom: Math.max(insets.bottom, spacing.md),
            },
          ]}
        >
          <View style={styles.topBar}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('blocking.unlock_app.cancel')}
              disabled={pending}
              onPress={close}
              style={styles.roundAction}
            >
              <IconSvg
                name={IconName.CLOSE}
                size={spacing.lg}
                color={colors.textPrimary}
              />
            </PressableScale>

            <View pointerEvents="none" style={styles.appPill}>
              <View style={styles.appIcon}>
                {tokenKey && isBlockedAppIconsAvailable ? (
                  <BlockedAppIcons
                    tokenKey={tokenKey}
                    style={StyleSheet.absoluteFill}
                  />
                ) : (
                  <IconSvg
                    name={IconName.LOCK}
                    size={spacing.lg}
                    color={colors.textPrimary}
                  />
                )}
              </View>
              <Text numberOfLines={1} style={styles.appPillLabel}>
                {allApps
                  ? t('blocking.breathing.all_apps')
                  : t('blocking.breathing.one_app')}
              </Text>
            </View>
          </View>

          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>
              {t('blocking.unlock_app.picker_title')}
            </Text>
            <Text style={styles.subtitle}>
              {allApps
                ? t('blocking.unlock_app.unlock_all_subtitle')
                : t('blocking.unlock_app.subtitle')}
            </Text>
          </View>

          <View style={styles.pickerHero}>
            <View style={styles.picker}>
              <View pointerEvents="none" style={styles.pickerSelection} />
              <FlatList
                ref={pickerRef}
                accessibilityLabel={t('blocking.unlock_app.subtitle')}
                data={UNLOCK_MINUTE_OPTIONS}
                keyExtractor={item => String(item)}
                renderItem={({ item }) => {
                  const selected = item === minutes
                  const distance = Math.abs(item - minutes)
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('blocking.unlock_app.minutes', {
                        count: item,
                      })}
                      accessibilityState={{ selected }}
                      onPress={() => selectMinutes(item)}
                      style={styles.minuteRow}
                    >
                      <Text
                        style={[
                          styles.minuteLabel,
                          distance === 1 && styles.minuteLabelNear,
                          distance > 1 && styles.minuteLabelFar,
                          selected && styles.minuteLabelSelected,
                        ]}
                      >
                        {t('blocking.unlock_app.minutes', { count: item })}
                      </Text>
                    </Pressable>
                  )
                }}
                getItemLayout={(_data, index) => ({
                  length: PICKER_ROW_HEIGHT,
                  offset: PICKER_ROW_HEIGHT * index,
                  index,
                })}
                contentContainerStyle={styles.pickerContent}
                style={styles.pickerList}
                showsVerticalScrollIndicator={false}
                snapToInterval={PICKER_ROW_HEIGHT}
                snapToAlignment="start"
                decelerationRate="fast"
                bounces={false}
                overScrollMode="never"
                scrollEventThrottle={16}
                onScroll={previewPicker}
                onMomentumScrollEnd={settlePicker}
              />
            </View>
          </View>

          <View style={styles.actions}>
            <PressableScale
              testID="unlock-duration-confirm"
              accessibilityRole="button"
              accessibilityLabel={t('blocking.unlock')}
              accessibilityHint={t('blocking.unlock_app.minutes', {
                count: minutes,
              })}
              accessibilityState={{ disabled: pending }}
              disabled={pending}
              onPress={() => onPick(minutes)}
              style={[styles.confirm, pending && styles.confirmPending]}
            >
              {pending ? (
                <ActivityIndicator color={colors.blockingCanvas} />
              ) : (
                <Text style={styles.confirmLabel}>{t('blocking.unlock')}</Text>
              )}
            </PressableScale>

            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('blocking.unlock_app.cancel')}
              disabled={pending}
              onPress={close}
              style={styles.cancel}
            >
              <Text style={styles.cancelLabel}>
                {t('blocking.unlock_app.cancel')}
              </Text>
            </PressableScale>
          </View>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.blockingCanvas,
  },
  content: {
    flex: 1,
    zIndex: 1,
    paddingHorizontal: spacing.lg,
  },
  topBar: {
    minHeight: spacing.xxxxxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  roundAction: {
    width: spacing.xxxxl,
    height: spacing.xxxxl,
    borderRadius: radius.capsule,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blockingSurfaceRaised,
    shadowColor: shadow.action.shadowColor,
    shadowOpacity: shadow.action.shadowOpacity,
    shadowRadius: shadow.action.shadowRadius,
    shadowOffset: shadow.action.shadowOffset,
  },
  appPill: {
    maxWidth: '72%',
    minHeight: spacing.xxxxl,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: spacing.xxs,
    paddingRight: spacing.sm,
    borderRadius: radius.capsule,
    backgroundColor: colors.blockingSurfaceRaised,
    shadowColor: shadow.action.shadowColor,
    shadowOpacity: shadow.action.shadowOpacity,
    shadowRadius: shadow.action.shadowRadius,
    shadowOffset: shadow.action.shadowOffset,
  },
  appIcon: {
    width: spacing.xxxl,
    height: spacing.xxxl,
    borderRadius: radius.compact,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blockingSurfaceCool,
  },
  appPillLabel: {
    ...fonts.medium,
    flexShrink: 1,
    color: colors.textSecondary,
    fontSize: typography.blockingCompactTitleSize,
    lineHeight: typography.blockingCompactTitleLineHeight,
  },
  heading: {
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  title: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.blockingTitleSize,
    lineHeight: typography.blockingTitleLineHeight,
    letterSpacing: typography.blockingTitleLetterSpacing,
    textAlign: 'center',
  },
  subtitle: {
    ...fonts.regular,
    maxWidth: layout.contentMaxWidth,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  pickerHero: {
    flex: 1,
    justifyContent: 'center',
  },
  picker: {
    height: PICKER_ROW_HEIGHT * PICKER_VISIBLE_ROWS,
    overflow: 'hidden',
  },
  pickerSelection: {
    position: 'absolute',
    top: PICKER_ROW_HEIGHT * Math.floor(PICKER_VISIBLE_ROWS / 2),
    right: 0,
    left: 0,
    height: PICKER_ROW_HEIGHT,
    borderRadius: radius.capsule,
    backgroundColor: colors.blockingPill,
    shadowColor: shadow.panel.shadowColor,
    shadowOpacity: shadow.panel.shadowOpacity,
    shadowRadius: shadow.panel.shadowRadius,
    shadowOffset: shadow.panel.shadowOffset,
  },
  pickerList: {
    zIndex: 1,
  },
  pickerContent: {
    paddingVertical: PICKER_ROW_HEIGHT * Math.floor(PICKER_VISIBLE_ROWS / 2),
  },
  minuteRow: {
    height: PICKER_ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minuteLabel: {
    ...fonts.regular,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    fontVariant: ['tabular-nums'],
    opacity: relockMaterial.opacity.disabled,
  },
  minuteLabelNear: {
    opacity: 0.72,
  },
  minuteLabelFar: {
    opacity: relockMaterial.opacity.decorativeStrong,
  },
  minuteLabelSelected: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.blockingSectionSize,
    lineHeight: typography.blockingSectionLineHeight,
    opacity: 1,
  },
  actions: {
    gap: spacing.xxs,
  },
  confirm: {
    minHeight: layout.primaryActionHeight,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.capsule,
    backgroundColor: colors.textPrimary,
    shadowColor: shadow.action.shadowColor,
    shadowOpacity: shadow.action.shadowOpacity,
    shadowRadius: shadow.action.shadowRadius,
    shadowOffset: shadow.action.shadowOffset,
  },
  confirmPending: {
    opacity: relockMaterial.opacity.disabled,
  },
  confirmLabel: {
    ...fonts.semiBold,
    color: colors.blockingCanvas,
    fontSize: typography.buttonSize,
    lineHeight: typography.buttonLineHeight,
  },
  cancel: {
    minHeight: spacing.xxxxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    ...fonts.medium,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
  },
})
