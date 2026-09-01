import { IconName } from '@assets/icons'
import React, { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BlockedAppLockGlyph } from '@/features/blocking/components/BlockedAppTileView'
import {
  BlockingRuleCard,
  type BlockingRuleCardProps,
} from '@/features/blocking/components/BlockingRuleCard'
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

const { colors, layout, radius, shadow, typography } = relockMaterial

/** La feuille reçoit exactement les props de la carte utilisée sur la page. */
export type ReblockRuleSummary = Omit<BlockingRuleCardProps, 'style'> & {
  id: string
}

export function formatReprieveRemaining(
  untilSeconds: number | undefined,
  nowMilliseconds = Date.now(),
): string {
  if (untilSeconds == null) return '0:00'
  const total = Math.max(
    0,
    Math.ceil((untilSeconds * 1000 - nowMilliseconds) / 1000),
  )
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

export function ReblockAppSheet({
  visible,
  tokenKey,
  reprievedUntil,
  rules,
  pending = false,
  onCancel,
  onConfirm,
}: {
  visible: boolean
  tokenKey?: string
  reprievedUntil?: number
  rules: ReblockRuleSummary[]
  pending?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const t = useT()
  const insets = useSafeAreaInsets()
  const [remaining, setRemaining] = useState(() =>
    formatReprieveRemaining(reprievedUntil),
  )

  useEffect(() => {
    if (!visible) return
    const update = () =>
      setRemaining(formatReprieveRemaining(reprievedUntil, Date.now()))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [reprievedUntil, visible])

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="slide"
      onRequestClose={pending ? undefined : onCancel}
    >
      <Pressable
        // Ne pas grouper toute la modale en un bouton « Annuler » : les
        // règles et les deux vraies actions doivent rester parcourables par
        // VoiceOver. Le geste visuel sur le fond continue de fermer la feuille.
        accessible={false}
        onPress={pending ? undefined : onCancel}
        style={styles.backdrop}
      >
        <Pressable
          accessible={false}
          accessibilityViewIsModal
          onPress={() => {}}
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.lg) },
          ]}
        >
          <View style={styles.grabber} />

          <View style={styles.appHeader}>
            <View style={styles.appTile}>
              {tokenKey && isBlockedAppIconsAvailable ? (
                <BlockedAppIcons
                  tokenKey={tokenKey}
                  style={StyleSheet.absoluteFill}
                />
              ) : (
                <IconSvg
                  name={IconName.LOCK}
                  size={spacing.xxl}
                  color={colors.textPrimary}
                />
              )}
              <View pointerEvents="none" style={styles.appShade} />
              <View pointerEvents="none" style={styles.appLock}>
                <BlockedAppLockGlyph open />
              </View>
            </View>

            <View style={styles.appCopy}>
              <Text accessibilityRole="header" style={styles.title}>
                {t('blocking.reblock_app.title')}
              </Text>
            </View>
          </View>

          <Text style={styles.rulesTitle}>
            {t('blocking.reblock_app.rules_title')}
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.rulesViewport}
            contentContainerStyle={styles.rulesContent}
          >
            {rules.length === 0 ? (
              <Text style={styles.emptyRules}>
                {t('blocking.reblock_app.empty_rules')}
              </Text>
            ) : (
              rules.map(rule => (
                <BlockingRuleCard
                  key={rule.id}
                  title={rule.title}
                  description={rule.description}
                  status={rule.status}
                  kind={rule.kind}
                  apps={rule.apps}
                  extraApps={rule.extraApps}
                  ruleId={rule.ruleId}
                  progress={rule.progress}
                  active={rule.active}
                  onPress={rule.onPress}
                  style={styles.ruleCard}
                />
              ))
            )}
          </ScrollView>

          <PressableScale
            testID="reblock-confirm"
            accessibilityRole="button"
            accessibilityLabel={t('blocking.reblock_app.action')}
            accessibilityState={{ disabled: pending }}
            disabled={pending}
            onPress={onConfirm}
            style={[styles.confirm, pending && styles.pending]}
          >
            {pending ? (
              <ActivityIndicator color={colors.blockingCanvas} />
            ) : (
              <>
                <IconSvg
                  name={IconName.LOCK}
                  size={spacing.lg}
                  color={colors.blockingCanvas}
                />
                <Text style={styles.confirmLabel}>
                  {t('blocking.reblock_app.action')}
                </Text>
              </>
            )}
          </PressableScale>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('blocking.reblock_app.cancel')}
            disabled={pending}
            onPress={onCancel}
            style={styles.cancel}
          >
            <Text style={styles.cancelLabel}>
              {t('blocking.reblock_app.cancel')}
            </Text>
          </PressableScale>

          <Text
            accessibilityLabel={t('blocking.reblock_app.remaining', {
              time: remaining,
            })}
            style={styles.footerTimer}
          >
            {remaining}
          </Text>
        </Pressable>
      </Pressable>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.blockingImageChrome,
  },
  sheet: {
    minHeight: '70%',
    maxHeight: '88%',
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
    marginBottom: spacing.md,
  },
  appHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  appTile: {
    width: layout.blockingLockedTileSize,
    height: layout.blockingLockedTileSize,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.action,
    backgroundColor: colors.blockingSurfaceCool,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.surfaceHighlight,
  },
  appShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.blockingImageShade,
    opacity: 0.12,
  },
  appLock: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appCopy: {
    flex: 1,
  },
  title: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.blockingSectionSize,
    lineHeight: typography.blockingSectionLineHeight,
    letterSpacing: typography.blockingSectionLetterSpacing,
  },
  rulesTitle: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.blockingCardTitleSize,
    lineHeight: typography.blockingCardTitleLineHeight,
    marginTop: spacing.lg,
  },
  // Une carte entière tient dans la fenêtre ; la suivante dépasse juste assez
  // pour qu'on voie qu'il y en a d'autres.
  rulesViewport: {
    flexGrow: 0,
    height: layout.blockingTemplateCardMinHeight,
    marginTop: spacing.sm,
  },
  rulesContent: {
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  ruleCard: {
    width: layout.blockingTemplateCardMinHeight - spacing.xxl,
    height: layout.blockingTemplateCardMinHeight,
  },
  emptyRules: {
    ...fonts.regular,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  confirm: {
    minHeight: layout.primaryActionHeight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.capsule,
    backgroundColor: colors.textPrimary,
    marginTop: spacing.lg,
    shadowColor: shadow.action.shadowColor,
    shadowOpacity: shadow.action.shadowOpacity,
    shadowRadius: shadow.action.shadowRadius,
    shadowOffset: shadow.action.shadowOffset,
  },
  pending: {
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
    marginTop: spacing.xxs,
  },
  cancelLabel: {
    ...fonts.medium,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
  },
  footerTimer: {
    ...fonts.medium,
    alignSelf: 'center',
    color: colors.textSecondary,
    fontSize: typography.blockingCardTitleSize,
    lineHeight: typography.blockingCardTitleLineHeight,
    fontVariant: ['tabular-nums'],
    marginTop: spacing.xxs,
  },
})
