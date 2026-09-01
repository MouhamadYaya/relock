import React from 'react'
import {
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import {
  AppBadgeRow,
  RuleTemplateFlowBadge,
  type RuleTypeGlyphKind,
} from '@/features/blocking/components/BlockingGlyphs'
import { BlockingCardSurface } from '@/features/blocking/components/BlockingSurfaces'
import { RuleAppIcons } from '@/features/blocking/components/RuleAppIcons'
import type { AppId } from '@/shared/components/ui/AppLogo'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'

const { colors, layout, radius, typography, shadow } = relockMaterial

export interface BlockingRuleCardProps {
  title: string
  description: string
  status: string
  kind: RuleTypeGlyphKind
  apps: AppId[]
  extraApps?: number
  /** Pour afficher les VRAIES icônes des apps de la règle (voir RuleAppIcons). */
  ruleId?: string
  /** Avancement de la session en cours (0→1), `null` si non applicable. */
  progress?: number | null
  active?: boolean
  /** Omis quand la carte est montrée pour information (feuille de reblocage). */
  onPress?: () => void
  style?: StyleProp<ViewStyle>
}

export function BlockingRuleCard({
  title,
  description,
  status,
  kind,
  apps,
  extraApps,
  ruleId,
  progress = null,
  active = false,
  onPress,
  style,
}: BlockingRuleCardProps) {
  const accessibilityLabel = `${title}. ${status}. ${description}`
  return (
    <PressableScale
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel={accessibilityLabel}
      disabled={!onPress}
      onPress={onPress}
      style={[styles.card, style]}
    >
      <BlockingCardSurface active={active} />
      <View style={styles.cardContent}>
        <View style={styles.topGroup}>
          <RuleTemplateFlowBadge kind={kind} />
          {/* La pilule EST la barre de progression : le remplissage avance
              derrière le texte, donc « combien de temps il reste » se lit
              d'un coup d'œil sans ajouter un second élément à la carte. */}
          <View style={[styles.statusPill, active && styles.activePill]}>
            {active && progress !== null ? (
              <View
                pointerEvents="none"
                style={[
                  styles.progressFill,
                  { width: `${Math.round(progress * 100)}%` },
                ]}
              />
            ) : null}
            <Text style={[styles.status, active && styles.activeStatus]}>
              {status}
            </Text>
          </View>
        </View>
        <View style={styles.bottomGroup}>
          <View style={styles.copy}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          </View>
          {ruleId ? (
            <RuleAppIcons ruleId={ruleId} />
          ) : (
            <AppBadgeRow apps={apps} extra={extraApps} />
          )}
        </View>
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: {
    minHeight: layout.blockingTemplateCardMinHeight,
    borderRadius: radius.functional,
    backgroundColor: colors.blockingSurface,
    shadowColor: shadow.blockingSubtle.shadowColor,
    shadowOpacity: shadow.blockingSubtle.shadowOpacity,
    shadowRadius: shadow.blockingSubtle.shadowRadius,
    shadowOffset: shadow.blockingSubtle.shadowOffset,
  },
  cardContent: {
    flex: 1,
    minHeight: layout.blockingTemplateCardMinHeight,
    padding: spacing.sm,
  },
  topGroup: {
    gap: spacing.xs,
  },
  // Poussé en bas comme sur les cartes prédéfinies : les deux types de carte
  // ont la même hauteur fixe, le bloc bas doit s'y aligner de la même façon.
  bottomGroup: {
    marginTop: 'auto',
    gap: spacing.xs,
  },
  statusPill: {
    alignSelf: 'flex-start',
    minHeight: spacing.xxl - spacing.xxs,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    borderRadius: radius.capsule,
    // `overflow: hidden` borne le remplissage à la capsule — sans lui la
    // barre déborderait en rectangle par-dessus les coins arrondis.
    overflow: 'hidden',
    backgroundColor: colors.blockingPill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.blockingBorder,
  },
  progressFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.blockingProgressFill,
  },
  activePill: {
    backgroundColor: colors.blockingAccentTint,
    borderColor: colors.blockingBorderStrong,
  },
  status: {
    ...fonts.regular,
    color: colors.textSecondary,
    fontSize: typography.blockingMetaSize,
    lineHeight: typography.blockingMetaLineHeight,
    fontVariant: ['tabular-nums'],
  },
  activeStatus: {
    color: colors.blockingAccentLight,
  },
  copy: {
    gap: spacing.xxs,
  },
  title: {
    ...fonts.semiBold,
    color: colors.textPrimary,
    fontSize: typography.blockingCardTitleSize,
    lineHeight: typography.blockingCardTitleLineHeight,
  },
  description: {
    ...fonts.regular,
    color: colors.blockingInkMuted,
    fontSize: typography.blockingCardBodySize,
    lineHeight: typography.blockingCardBodyLineHeight,
    minHeight: typography.blockingCardBodyLineHeight,
  },
})
