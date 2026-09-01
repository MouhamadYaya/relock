import React, { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'
import { BlockingSheet } from '@/features/blocking/components/BlockingSheet'
import { BrandActionSurface } from '@/features/blocking/components/BlockingSurfaces'
import { durationLabel, hhmm } from '@/features/blocking/format'
import { useT } from '@/i18n/useT'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'

const { colors, layout, radius, shadow, typography } = relockMaterial

/** Cadenas fermé — l'état, pas une action : rien à toucher ici. */
function SealedLockGlyph() {
  return (
    <Svg width={spacing.xl} height={spacing.xl} viewBox="0 0 24 24">
      <Path
        d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5"
        fill="none"
        stroke={colors.blockingWarning}
        strokeWidth={1.9}
        strokeLinecap="round"
      />
      <Rect
        x={4.5}
        y={10.5}
        width={15}
        height={10}
        rx={3}
        fill={colors.blockingWarning}
      />
    </Svg>
  )
}

/**
 * « Blocage strict » — la fin de non-recevoir.
 *
 * Elle remplace la fiche (ou le déblocage d'une app) au lieu de la montrer
 * grisée : proposer des boutons éteints laisse croire qu'il existe un chemin.
 * Ici il n'y en a pas, et la seule information utile est QUAND ça se termine.
 */
export function StrictBlockSheet({
  visible,
  scope,
  ruleTitle,
  endsAt,
  onClose,
}: {
  visible: boolean
  /** « rule » : on a touché la carte. « app » : on a voulu ouvrir une app. */
  scope: 'rule' | 'app'
  ruleTitle?: string
  endsAt?: Date | null
  onClose: () => void
}) {
  const t = useT()
  const [now, setNow] = useState(() => Date.now())

  // Le temps restant se recalcule tant que la feuille est ouverte : personne
  // ne doit lire une échéance périmée sur l'écran qui la lui refuse.
  useEffect(() => {
    if (!visible) return
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [visible])

  const remainingMs = endsAt ? endsAt.getTime() - now : 0

  return (
    <BlockingSheet visible={visible} onClose={onClose}>
      <View style={styles.badge}>
        <SealedLockGlyph />
      </View>

      <Text accessibilityRole="header" style={styles.title}>
        {t('blocking.strict_lock.title')}
      </Text>
      {ruleTitle ? <Text style={styles.rule}>{ruleTitle}</Text> : null}

      <Text style={styles.body}>
        {scope === 'app'
          ? t('blocking.strict_lock.body_app')
          : t('blocking.strict_lock.body_rule')}
      </Text>

      <View style={styles.deadline}>
        {endsAt ? (
          <>
            <Text style={styles.until}>
              {t('blocking.strict_lock.until', { time: hhmm(endsAt) })}
            </Text>
            <Text style={styles.remaining}>
              {t('blocking.strict_lock.remaining', {
                time: durationLabel(Math.max(0, remainingMs)),
              })}
            </Text>
          </>
        ) : (
          <Text style={styles.until}>{t('blocking.strict_lock.no_end')}</Text>
        )}
      </View>

      <PressableScale
        testID="strict-lock-ack"
        accessibilityRole="button"
        accessibilityLabel={t('blocking.strict_lock.action')}
        onPress={onClose}
        style={styles.action}
      >
        <BrandActionSurface />
        <Text style={styles.actionLabel}>
          {t('blocking.strict_lock.action')}
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
  rule: {
    ...fonts.medium,
    color: colors.blockingAccentLight,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    textAlign: 'center',
    marginTop: spacing.micro,
  },
  body: {
    ...fonts.regular,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  deadline: {
    alignItems: 'center',
    borderRadius: radius.panel,
    backgroundColor: colors.blockingWarningTint,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.blockingWarningBorder,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  until: {
    ...fonts.semiBold,
    color: colors.blockingWarning,
    fontSize: typography.blockingCardTitleSize,
    lineHeight: typography.blockingCardTitleLineHeight,
  },
  remaining: {
    ...fonts.regular,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCompactBodySize,
    lineHeight: typography.blockingCompactBodyLineHeight,
    marginTop: spacing.micro,
  },
  action: {
    minHeight: layout.primaryActionHeight,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.capsule,
    marginTop: spacing.lg,
    shadowColor: shadow.glow.shadowColor,
    shadowOpacity: shadow.glow.shadowOpacity,
    shadowRadius: shadow.glow.shadowRadius,
    shadowOffset: shadow.glow.shadowOffset,
  },
  actionLabel: {
    ...fonts.semiBold,
    color: colors.onAccent,
    fontSize: typography.buttonSize,
    lineHeight: typography.buttonLineHeight,
  },
})
