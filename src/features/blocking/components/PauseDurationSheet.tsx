import { IconName } from '@assets/icons'
import React, { useEffect, useMemo, useRef, useState } from 'react'
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
import Svg, { Rect } from 'react-native-svg'
import {
  BrandActionSurface,
  SheetBloom,
} from '@/features/blocking/components/BlockingSurfaces'
import { hhmm } from '@/features/blocking/format'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { haptics } from '@/shared/utils/platform/haptics'

const { colors, layout, opacity, radius, shadow, typography } = relockMaterial

const ROW_HEIGHT = spacing.xxxxl
const VISIBLE_ROWS = 3
const EDGE_ROWS = Math.floor(VISIBLE_ROWS / 2)

/**
 * Durées de pause. Une pause n'est JAMAIS une suppression : la règle reste,
 * elle dort. « Indéfiniment » couvre le départ en vacances sans rien détruire —
 * à l'échéance (ou à la reprise), iOS remet le bouclier tout seul.
 */
export type PauseChoice = 'min15' | 'hour1' | 'today' | 'day1' | 'indefinite'

export const PAUSE_CHOICES: PauseChoice[] = [
  'min15',
  'hour1',
  'today',
  'day1',
  'indefinite',
]

const PAUSE_LABEL_KEY = {
  min15: 'blocking.pause_sheet.option_15min',
  hour1: 'blocking.pause_sheet.option_1h',
  today: 'blocking.pause_sheet.option_today',
  day1: 'blocking.pause_sheet.option_1day',
  indefinite: 'blocking.pause_sheet.option_indefinite',
} as const satisfies Record<PauseChoice, string>

/**
 * Échéance de reprise d'un choix. `null` = « jusqu'à ce que tu reprennes »,
 * la seule valeur que `useSuspendRuleMutation` traduit en « aucun réveil
 * programmé » côté natif.
 */
export function pauseUntil(choice: PauseChoice, now = new Date()): Date | null {
  if (choice === 'indefinite') return null
  if (choice === 'min15') return new Date(now.getTime() + 15 * 60_000)
  if (choice === 'hour1') return new Date(now.getTime() + 3_600_000)
  if (choice === 'day1') return new Date(now.getTime() + 86_400_000)
  // « Pour aujourd'hui » : la règle repart à la bascule du jour, pas 24 h plus
  // tard — sinon une pause prise le soir mangerait toute la journée suivante.
  const midnight = new Date(now)
  midnight.setHours(24, 0, 0, 0)
  return midnight
}

export function pauseChoiceForOffset(offset: number): PauseChoice {
  const index = Math.round(offset / ROW_HEIGHT)
  const bounded = Math.min(PAUSE_CHOICES.length - 1, Math.max(0, index))
  return PAUSE_CHOICES[bounded]
}

/** Deux barres pleines — le pictogramme de la pause, sans texte à traduire. */
function PauseGlyph({ size = spacing.xl }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect
        x={6.5}
        y={4}
        width={4}
        height={16}
        rx={2}
        fill={colors.blockingAccentLight}
      />
      <Rect
        x={13.5}
        y={4}
        width={4}
        height={16}
        rx={2}
        fill={colors.blockingAccentLight}
      />
    </Svg>
  )
}

/**
 * « Définir la durée de pause » — la feuille qui suit « Quitter en avance ».
 *
 * Elle arrive APRÈS la respiration : l'utilisateur a déjà pris six secondes,
 * on ne lui remet donc pas d'obstacle, on lui demande seulement pour combien
 * de temps. La sortie destructrice reste en bas, en rouge, à part.
 */
export function PauseDurationSheet({
  visible,
  pending = false,
  onBack,
  onConfirm,
  onDelete,
}: {
  visible: boolean
  pending?: boolean
  onBack: () => void
  onConfirm: (until: Date | null, choice: PauseChoice) => void
  onDelete: () => void
}) {
  const t = useT()
  const insets = useSafeAreaInsets()
  // Le choix le moins destructeur d'abord : une pause courte se répare toute
  // seule, une pause indéfinie s'oublie.
  const [choice, setChoice] = useState<PauseChoice>('min15')
  const listRef = useRef<FlatList<PauseChoice>>(null)
  const hapticChoiceRef = useRef<PauseChoice>('min15')

  useEffect(() => {
    if (!visible) return
    setChoice('min15')
    hapticChoiceRef.current = 'min15'
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated: false })
    })
  }, [visible])

  const select = (next: PauseChoice, animated = true, withHaptic = true) => {
    if (next !== hapticChoiceRef.current) {
      hapticChoiceRef.current = next
      if (withHaptic) haptics.selectionTick()
    }
    setChoice(next)
    listRef.current?.scrollToOffset({
      offset: PAUSE_CHOICES.indexOf(next) * ROW_HEIGHT,
      animated,
    })
  }

  const preview = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = pauseChoiceForOffset(event.nativeEvent.contentOffset.y)
    if (next === hapticChoiceRef.current) return
    hapticChoiceRef.current = next
    setChoice(next)
    haptics.selectionTick()
  }

  const settle = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    select(
      pauseChoiceForOffset(event.nativeEvent.contentOffset.y),
      false,
      false,
    )
  }

  // Ce que le choix promet, écrit noir sur blanc : personne ne doit deviner
  // quand son blocage revient.
  const subtitle = useMemo(() => {
    if (choice === 'indefinite') {
      return t('blocking.pause_sheet.subtitle_indefinite')
    }
    const now = new Date()
    const until = pauseUntil(choice, now)
    if (!until) return t('blocking.pause_sheet.subtitle_indefinite')
    const when =
      choice === 'today'
        ? t('blocking.pause_sheet.when_midnight')
        : until.getDate() === now.getDate()
          ? t('blocking.pause_sheet.when_time', { time: hhmm(until) })
          : t('blocking.pause_sheet.when_tomorrow', { time: hhmm(until) })
    return t('blocking.pause_sheet.subtitle_until', { when })
  }, [choice, t])

  const close = () => {
    if (!pending) onBack()
  }

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={close}
    >
      <Pressable accessible={false} onPress={close} style={styles.backdrop}>
        <Pressable
          accessible={false}
          accessibilityViewIsModal
          onPress={() => {}}
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) },
          ]}
        >
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <SheetBloom />
          </View>

          <View style={styles.grabber} />

          <View style={styles.topBar}>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={t('blocking.pause_sheet.back')}
              disabled={pending}
              onPress={close}
              style={styles.roundAction}
            >
              <IconSvg
                name={IconName.BACK}
                size={spacing.lg}
                color={colors.textPrimary}
              />
            </PressableScale>

            <View pointerEvents="none" style={styles.badge}>
              <PauseGlyph />
            </View>

            <View style={styles.roundActionGhost} />
          </View>

          <View style={styles.heading}>
            <Text accessibilityRole="header" style={styles.title}>
              {t('blocking.pause_sheet.title')}
            </Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <View style={styles.picker}>
            <View
              testID="pause-picker-selection"
              pointerEvents="none"
              style={styles.pickerSelection}
            />
            <FlatList
              ref={listRef}
              accessibilityLabel={t('blocking.pause_sheet.title')}
              data={PAUSE_CHOICES}
              keyExtractor={item => item}
              renderItem={({ item }) => {
                const selected = item === choice
                const distance = Math.abs(
                  PAUSE_CHOICES.indexOf(item) - PAUSE_CHOICES.indexOf(choice),
                )
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t(PAUSE_LABEL_KEY[item])}
                    onPress={() => select(item)}
                    style={styles.row}
                  >
                    <Text
                      style={[
                        styles.rowLabel,
                        distance === 1 && styles.rowLabelNear,
                        distance > 1 && styles.rowLabelFar,
                        selected && styles.rowLabelSelected,
                      ]}
                    >
                      {t(PAUSE_LABEL_KEY[item])}
                    </Text>
                  </Pressable>
                )
              }}
              getItemLayout={(_data, index) => ({
                length: ROW_HEIGHT,
                offset: ROW_HEIGHT * index,
                index,
              })}
              contentContainerStyle={styles.pickerContent}
              style={styles.pickerList}
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

          <PressableScale
            testID="pause-duration-confirm"
            accessibilityRole="button"
            accessibilityLabel={t('blocking.pause_sheet.confirm')}
            accessibilityHint={t(PAUSE_LABEL_KEY[choice])}
            accessibilityState={{ disabled: pending }}
            disabled={pending}
            onPress={() => onConfirm(pauseUntil(choice), choice)}
            style={[styles.confirm, pending && styles.confirmPending]}
          >
            <BrandActionSurface />
            {pending ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={styles.confirmLabel}>
                {t('blocking.pause_sheet.confirm')}
              </Text>
            )}
          </PressableScale>

          <PressableScale
            testID="pause-duration-delete"
            accessibilityRole="button"
            accessibilityLabel={t('blocking.pause_sheet.delete')}
            disabled={pending}
            onPress={onDelete}
            style={styles.destroy}
          >
            <Text style={styles.destroyLabel}>
              {t('blocking.pause_sheet.delete')}
            </Text>
          </PressableScale>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.blockingModalBackdrop,
  },
  sheet: {
    overflow: 'hidden',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    borderTopLeftRadius: radius.visual,
    borderTopRightRadius: radius.visual,
    backgroundColor: colors.blockingSheetSurface,
    shadowColor: shadow.panel.shadowColor,
    shadowOpacity: shadow.panel.shadowOpacity,
    shadowRadius: shadow.panel.shadowRadius,
    shadowOffset: shadow.panel.shadowOffset,
  },
  grabber: {
    alignSelf: 'center',
    width: spacing.xxxl,
    height: spacing.xxs,
    borderRadius: radius.capsule,
    backgroundColor: colors.blockingBorderStrong,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  roundAction: {
    width: layout.headerActionSize,
    height: layout.headerActionSize,
    borderRadius: radius.capsule,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blockingGlass,
  },
  // Garde le badge parfaitement centré malgré le seul bouton de gauche.
  roundActionGhost: {
    width: layout.headerActionSize,
    height: layout.headerActionSize,
  },
  badge: {
    width: spacing.xxxxxl,
    height: spacing.xxxxxl,
    borderRadius: radius.capsule,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blockingAccentTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.blockingBorderStrong,
  },
  heading: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  title: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.blockingSectionSize,
    lineHeight: typography.blockingSectionLineHeight,
    letterSpacing: typography.blockingSectionLetterSpacing,
    textAlign: 'center',
  },
  subtitle: {
    ...fonts.regular,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    textAlign: 'center',
    marginTop: spacing.xxs,
    paddingHorizontal: spacing.md,
  },
  picker: {
    height: ROW_HEIGHT * VISIBLE_ROWS,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  pickerSelection: {
    position: 'absolute',
    top: ROW_HEIGHT * EDGE_ROWS,
    right: 0,
    left: 0,
    height: ROW_HEIGHT,
    borderRadius: radius.capsule,
    // La ligne choisie est tenue par la couleur de la marque, pas par un
    // aplat noir : on voit ce qu'on a réglé d'un coup d'œil.
    backgroundColor: colors.blockingAccentTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.blockingBorderStrong,
  },
  pickerList: {
    zIndex: 1,
  },
  pickerContent: {
    paddingVertical: ROW_HEIGHT * EDGE_ROWS,
  },
  row: {
    height: ROW_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    ...fonts.regular,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    opacity: opacity.disabled,
  },
  rowLabelNear: {
    opacity: 0.72,
  },
  rowLabelFar: {
    opacity: opacity.decorativeStrong,
  },
  rowLabelSelected: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.blockingSectionSize,
    lineHeight: typography.blockingSectionLineHeight,
    opacity: 1,
  },
  confirm: {
    minHeight: layout.primaryActionHeight,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.capsule,
    marginTop: spacing.md,
    shadowColor: shadow.glow.shadowColor,
    shadowOpacity: shadow.glow.shadowOpacity,
    shadowRadius: shadow.glow.shadowRadius,
    shadowOffset: shadow.glow.shadowOffset,
  },
  confirmPending: {
    opacity: opacity.disabled,
  },
  confirmLabel: {
    ...fonts.semiBold,
    color: colors.onAccent,
    fontSize: typography.buttonSize,
    lineHeight: typography.buttonLineHeight,
  },
  destroy: {
    minHeight: spacing.xxxxl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xxs,
  },
  destroyLabel: {
    ...fonts.medium,
    color: colors.blockingDanger,
    fontSize: typography.buttonSize,
    lineHeight: typography.buttonLineHeight,
  },
})
