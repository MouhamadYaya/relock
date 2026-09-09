import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, { Path, Polyline } from 'react-native-svg'
import { BlockingSheet } from '@/features/blocking/components/BlockingSheet'
import { HoldToConfirmButton } from '@/features/blocking/components/HoldToConfirmButton'
import { RuleAppIcons } from '@/features/blocking/components/RuleAppIcons'
import { durationLabelFromMinutes } from '@/features/blocking/format'
import {
  daysLabel,
  isStrictRule,
  type RuleSession,
  ruleDays,
} from '@/features/blocking/session'
import type { BlockRuleView } from '@/features/blocking/types'
import { useT } from '@/i18n/useT'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'

const { colors, radius, typography } = relockMaterial

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' ? value : fallback

const hhmmParts = (h: unknown, m: unknown) =>
  `${String(num(h, 0)).padStart(2, '0')}:${String(num(m, 0)).padStart(2, '0')}`

/**
 * Flèche circulaire antihoraire — « on remet en marche ce qui existait déjà ».
 * Ni un « + » (rien n'est créé), ni un « ▶ » (ce n'est pas une lecture) :
 * la règle reprend là où elle s'était arrêtée.
 */
export function RestoreGlyph({
  size = spacing.lg,
  color = colors.blockingAccentLight,
}: {
  size?: number
  color?: string
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Polyline
        points="1 4 1 10 7 10"
        fill="none"
        stroke={color}
        strokeWidth={1.9}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function RecapRow({
  label,
  value,
  last = false,
}: {
  label: string
  value: string
  last?: boolean
}) {
  return (
    <View style={[styles.row, !last && styles.rowSep]}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  )
}

/** « Pendant » : la durée réglée, dite dans les mots du type de la règle. */
function duringValue(rule: BlockRuleView, t: ReturnType<typeof useT>): string {
  const config = rule.config ?? {}
  if (rule.type === 'schedule') {
    const range = `${hhmmParts(config.start_hour, config.start_minute)} → ${hhmmParts(config.end_hour, config.end_minute)}`
    return `${range} · ${daysLabel(ruleDays(rule))}`
  }
  if (rule.type === 'daily_limit') {
    return t('blocking.resume_sheet.per_day', {
      time: durationLabelFromMinutes(num(config.limit_min, 60)),
    })
  }
  return durationLabelFromMinutes(num(config.duration_min, 30))
}

/**
 * « Règle en pause » — la seule sortie d'une pause, et son récapitulatif.
 *
 * Toucher une règle suspendue n'ouvrait rien : la fiche de session n'a que des
 * actions de blocage à proposer, et une règle en pause n'en applique aucune.
 * On répond donc la seule chose qui compte ici — CE QUI VA REPRENDRE — puis on
 * demande le même maintien que pour l'armer la première fois. Rétablir une
 * protection est une décision, pas un tap.
 */
export function ResumeRuleSheet({
  visible,
  session,
  status,
  pending = false,
  onCancel,
  onConfirm,
}: {
  visible: boolean
  /** La session suspendue à rétablir. `null` referme la feuille. */
  session: RuleSession | null
  /** Ligne d'état déjà composée par l'écran (« Reprend dans 2 h »). */
  status?: string
  pending?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const t = useT()
  const rule = session?.rule
  const strict = rule ? isStrictRule(rule) : false
  const appCount = rule ? (rule.count ?? rule.appIds.length) : 0

  const typeLabel = (): string => {
    if (!rule) return ''
    if (rule.type === 'daily_limit') return t('blocking.rule_types.limit')
    if (rule.type === 'schedule') return t('blocking.rule_types.schedule')
    return t('blocking.rule_types.timed')
  }

  return (
    <BlockingSheet visible={visible} onClose={onCancel}>
      <View style={styles.badge}>
        <RestoreGlyph size={spacing.xl} />
      </View>

      <Text accessibilityRole="header" style={styles.title}>
        {t('blocking.resume_sheet.title')}
      </Text>
      {session?.title ? <Text style={styles.rule}>{session.title}</Text> : null}
      <Text style={styles.body}>{t('blocking.resume_sheet.body')}</Text>

      {rule ? (
        <View style={styles.recap}>
          <View style={[styles.row, styles.rowSep]}>
            <Text style={styles.rowLabel}>
              {t('blocking.resume_sheet.apps')}
            </Text>
            <View style={styles.appsValue}>
              <RuleAppIcons ruleId={rule.id} size={spacing.lg} />
              <Text style={styles.rowValue}>
                {appCount === 1
                  ? t('blocking.resume_sheet.apps_single', { n: appCount })
                  : t('blocking.resume_sheet.apps_plural', { n: appCount })}
              </Text>
            </View>
          </View>
          <RecapRow
            label={t('blocking.resume_sheet.type')}
            value={typeLabel()}
          />
          <RecapRow
            label={t('blocking.session_sheet.during')}
            value={duringValue(rule, t)}
          />
          {strict ? (
            <RecapRow
              label={t('blocking.resume_sheet.strict')}
              value={t('blocking.resume_sheet.strict_on')}
            />
          ) : null}
          <RecapRow
            label={t('blocking.resume_sheet.paused')}
            value={status ?? ''}
            last
          />
        </View>
      ) : null}

      {/* Même geste que l'activation : ce qui se rétablit d'un tap se
          rétablit par réflexe, et un réflexe n'engage personne. */}
      <HoldToConfirmButton
        testID="resume-rule-confirm"
        idleLabel={t('blocking.resume_sheet.confirm')}
        holdingLabel={t('blocking.hold.keep_holding')}
        leadingGlyph={
          <RestoreGlyph size={spacing.md} color={colors.onAccent} />
        }
        pending={pending}
        onConfirm={onConfirm}
        style={styles.confirm}
      />

      <PressableScale
        testID="resume-rule-cancel"
        accessibilityRole="button"
        accessibilityLabel={t('blocking.resume_sheet.cancel')}
        disabled={pending}
        haptic="graze"
        onPress={onCancel}
        style={styles.cancel}
      >
        <Text style={styles.cancelLabel}>
          {t('blocking.resume_sheet.cancel')}
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
    borderColor: colors.blockingBorderStrong,
    backgroundColor: colors.blockingAccentTint,
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
    paddingHorizontal: spacing.xs,
  },
  recap: {
    borderRadius: radius.panel,
    backgroundColor: colors.blockingSheetCard,
    paddingHorizontal: spacing.md,
    marginTop: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  rowSep: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.blockingBorder,
  },
  rowLabel: {
    ...fonts.regular,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
  },
  rowValue: {
    ...fonts.medium,
    color: colors.textPrimary,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    flexShrink: 1,
    textAlign: 'right',
  },
  appsValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexShrink: 1,
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
