import React from 'react'
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { HoldToConfirmButton } from '@/features/blocking/components/HoldToConfirmButton'
import { useT } from '@/i18n/useT'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'

const { colors, opacity, radius, shadow, typography } = relockMaterial

export {
  HOLD_MS,
  rumbleTimings,
  waveTimings,
} from '@/features/blocking/components/HoldToConfirmButton'

/** Corbeille — dessinée ici, aucun asset à régénérer pour un seul écran. */
function TrashGlyph({ size = spacing.xl }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M4 6.5h16M9.5 6.5V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v1.5M6.5 6.5l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12M10 10.5v6M14 10.5v6"
        fill="none"
        stroke={colors.blockingDangerBright}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/**
 * « Supprimer cette règle ? » — le maintien EST la confirmation.
 *
 * La feuille est la SEULE de l'app à porter le rouge : ici, la couleur est le
 * message. Tout le reste (ondes, martèlement, remplissage) est délégué au
 * bouton de maintien, partagé avec l'activation d'un blocage.
 */
export function HoldToDeleteSheet({
  visible,
  pending = false,
  onCancel,
  onConfirm,
}: {
  visible: boolean
  pending?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const t = useT()
  const insets = useSafeAreaInsets()

  const close = () => {
    if (!pending) onCancel()
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
          testID="hold-delete-sheet"
          accessible={false}
          accessibilityViewIsModal
          onPress={() => {}}
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) },
          ]}
        >
          {/* Rouge sombre dans la matière, rouge franc sur l'action : la
              suppression reste évidente sans transformer toute la feuille en
              bouton. */}
          <Svg
            pointerEvents="none"
            style={StyleSheet.absoluteFillObject}
            preserveAspectRatio="none"
          >
            <Defs>
              <LinearGradient id="hold-delete-wash" x1="0" y1="0" x2="0" y2="1">
                <Stop
                  offset="0"
                  stopColor={colors.blockingDangerDeep}
                  stopOpacity={0.72}
                />
                <Stop
                  offset="0.52"
                  stopColor={colors.blockingDangerCanvas}
                  stopOpacity={0.48}
                />
                <Stop
                  offset="1"
                  stopColor={colors.blockingCanvas}
                  stopOpacity={0.18}
                />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#hold-delete-wash)" />
          </Svg>

          <View style={styles.grabber} />

          <View style={styles.badge}>
            <TrashGlyph />
          </View>

          <Text accessibilityRole="header" style={styles.title}>
            {t('blocking.delete_sheet.title')}
          </Text>
          <Text style={styles.body}>{t('blocking.delete_sheet.body')}</Text>

          <HoldToConfirmButton
            testID="hold-to-delete"
            tone="danger"
            idleLabel={t('blocking.delete_sheet.hold')}
            holdingLabel={t('blocking.delete_sheet.holding')}
            pending={pending}
            onConfirm={onConfirm}
            style={styles.hold}
          />

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('blocking.delete_sheet.cancel')}
            disabled={pending}
            onPress={close}
            style={styles.cancel}
          >
            <Text style={styles.cancelLabel}>
              {t('blocking.delete_sheet.cancel')}
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
    backgroundColor: colors.blockingDangerCanvas,
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
    backgroundColor: colors.blockingDangerBorder,
  },
  badge: {
    alignSelf: 'center',
    width: spacing.xxxxxl,
    height: spacing.xxxxxl,
    borderRadius: radius.capsule,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.blockingDangerBright,
    backgroundColor: colors.blockingDangerWash,
  },
  title: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.blockingSectionSize,
    lineHeight: typography.blockingSectionLineHeight,
    letterSpacing: typography.blockingSectionLetterSpacing,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  body: {
    ...fonts.regular,
    color: colors.alertTextMuted,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    textAlign: 'center',
    marginTop: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  hold: {
    marginTop: spacing.xl,
  },
  cancel: {
    minHeight: spacing.xxxxl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  cancelLabel: {
    ...fonts.medium,
    color: colors.textPrimary,
    fontSize: typography.buttonSize,
    lineHeight: typography.buttonLineHeight,
    opacity: opacity.disabled + 0.3,
  },
})
