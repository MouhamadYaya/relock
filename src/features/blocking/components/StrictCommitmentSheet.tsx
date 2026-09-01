import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Circle, Path } from 'react-native-svg'
import { BlockingSheet } from '@/features/blocking/components/BlockingSheet'
import { HoldToConfirmButton } from '@/features/blocking/components/HoldToConfirmButton'
import { useT } from '@/i18n/useT'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'

const { colors, radius, typography } = relockMaterial

/** Triangle d'avertissement — le seul de l'app, pour le seul geste sans retour. */
function WarningGlyph({ size = spacing.xxl }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 3.6 2.9 19.2a1.2 1.2 0 0 0 1 1.8h16.2a1.2 1.2 0 0 0 1-1.8L12 3.6Z"
        fill="none"
        stroke={colors.blockingWarning}
        strokeWidth={1.9}
        strokeLinejoin="round"
      />
      <Path
        d="M12 9.6v4.6"
        stroke={colors.blockingWarning}
        strokeWidth={2.2}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={17.4} r={1.15} fill={colors.blockingWarning} />
    </Svg>
  )
}

/**
 * L'engagement du mode strict — la dernière porte avant l'irréversible.
 *
 * C'était une `Alert` système : trois lignes grises qu'on balaie sans lire.
 * Or c'est LE moment où l'utilisateur décide pour son lui de tout à l'heure ;
 * il doit voir l'heure exacte jusqu'à laquelle il s'enferme, et le mot
 * « irréversible » écrit noir sur blanc. La feuille ne se referme pas d'un tap
 * à côté : on répond, ou on annule.
 */
export function StrictCommitmentSheet({
  visible,
  endsAtLabel,
  onCancel,
  onCommit,
}: {
  visible: boolean
  /** Heure de fin, déjà formatée par l'écran qui connaît la durée choisie. */
  endsAtLabel: string
  onCancel: () => void
  onCommit: () => void
}) {
  const t = useT()

  return (
    <BlockingSheet visible={visible} dismissible={false} onClose={onCancel}>
      <View style={styles.badge}>
        <WarningGlyph />
      </View>

      <Text accessibilityRole="header" style={styles.title}>
        {t('blocking.strict_commit.title')}
      </Text>

      <Text style={styles.body}>
        {t('blocking.strict_commit.body', { time: endsAtLabel })}
      </Text>

      <View style={styles.warning}>
        <WarningGlyph size={spacing.md} />
        <Text style={styles.warningLabel}>
          {t('blocking.strict_commit.irreversible')}
        </Text>
      </View>

      <Text style={styles.reassure}>
        {t('blocking.strict_commit.reassure')}
      </Text>

      {/* On ne s'engage pas d'un tap. Le geste doit peser autant que la
          décision : même maintien, mêmes ondes, même martèlement que pour
          supprimer — aux couleurs de la marque. */}
      <HoldToConfirmButton
        testID="strict-commit-confirm"
        idleLabel={t('blocking.hold.commit')}
        holdingLabel={t('blocking.hold.keep_holding')}
        accessibilityHint={t('blocking.strict_commit.irreversible')}
        onConfirm={onCommit}
        style={styles.confirm}
      />

      <PressableScale
        testID="strict-commit-cancel"
        accessibilityRole="button"
        accessibilityLabel={t('blocking.strict_commit.cancel')}
        onPress={onCancel}
        style={styles.cancel}
      >
        <Text style={styles.cancelLabel}>
          {t('blocking.strict_commit.cancel')}
        </Text>
      </PressableScale>
    </BlockingSheet>
  )
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'center',
    width: spacing.xxxxxl,
    height: spacing.xxxxxl,
    borderRadius: radius.capsule,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor: colors.blockingWarningBorder,
    backgroundColor: colors.blockingWarningTint,
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
    color: colors.textSecondary,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  warning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.capsule,
    backgroundColor: colors.blockingWarningTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.blockingWarningBorder,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  warningLabel: {
    ...fonts.semiBold,
    color: colors.blockingWarning,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
  },
  reassure: {
    ...fonts.regular,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCompactBodySize,
    lineHeight: typography.blockingCompactBodyLineHeight,
    textAlign: 'center',
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  confirm: {
    marginTop: spacing.lg,
  },
  cancel: {
    minHeight: spacing.xxxxl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xxs,
  },
  cancelLabel: {
    ...fonts.medium,
    color: colors.blockingInkMuted,
    fontSize: typography.buttonSize,
    lineHeight: typography.buttonLineHeight,
  },
})
