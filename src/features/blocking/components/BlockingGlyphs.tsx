import { IconName } from '@assets/icons'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'
import { type AppId, AppLogo } from '@/shared/components/ui/AppLogo'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'

const { colors, radius } = relockMaterial

export type RuleTypeGlyphKind = 'session' | 'schedule' | 'limit'

function XMark({
  size,
  color = colors.textPrimary,
  strokeWidth = 2.3,
}: {
  size: number
  color?: string
  strokeWidth?: number
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5 4.5 18.8 19.5M18.3 4.5 5.2 19.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  )
}

/**
 * Vignettes de marque, pour les seuls cas où l'app est connue d'avance.
 * ⚠️ Une règle RÉELLE n'a jamais d'`appId` (Apple ne rend qu'un jeton opaque) :
 * elle passe par `RuleAppIcons`, qui affiche les VRAIES icônes.
 */
export function AppBadgeRow({
  apps,
  extra,
}: {
  apps: AppId[]
  extra?: number
}) {
  return (
    <View style={styles.badgeRow}>
      {apps.map(app => (
        <View key={app} style={styles.badgeIcon}>
          <AppLogo app={app} size={spacing.xl} />
        </View>
      ))}
      {extra ? (
        <View style={styles.extraBadge}>
          <Text style={styles.extraText}>+{extra}</Text>
        </View>
      ) : null}
    </View>
  )
}

function TemplateCalendarGlyph() {
  return (
    <Svg width={spacing.xl} height={spacing.xl} viewBox="0 0 24 24">
      <Rect
        x={2}
        y={3.5}
        width={20}
        height={18}
        rx={5}
        fill={colors.textPrimary}
      />
      <Rect
        x={4.5}
        y={9}
        width={15}
        height={10}
        rx={2.5}
        fill={colors.blockingCanvas}
      />
      <Path
        d="M7.5 2v4M16.5 2v4"
        stroke={colors.textPrimary}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      <Circle cx={8} cy={13} r={1.25} fill={colors.blockingAccentLight} />
      <Circle cx={12} cy={13} r={1.25} fill={colors.blockingAccentLight} />
      <Circle cx={16} cy={13} r={1.25} fill={colors.blockingAccentLight} />
      <Circle cx={8} cy={17} r={1.25} fill={colors.blockingAccentLight} />
      <Circle cx={12} cy={17} r={1.25} fill={colors.blockingAccentLight} />
    </Svg>
  )
}

function TemplateTimerGlyph() {
  return (
    <Svg width={spacing.xl} height={spacing.xl} viewBox="0 0 24 24">
      <Circle cx={12} cy={13} r={9} fill={colors.textPrimary} />
      <Circle cx={12} cy={13} r={6} fill={colors.blockingCanvas} />
      <Rect
        x={9.5}
        y={1}
        width={5}
        height={3}
        rx={1.5}
        fill={colors.textPrimary}
      />
      <Path
        d="m17.5 5 2-2"
        stroke={colors.textPrimary}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Path
        d="M12 9v4l3 1.8"
        fill="none"
        stroke={colors.blockingAccentLight}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={13} r={1.25} fill={colors.blockingAccentLight} />
    </Svg>
  )
}

function TemplateHourglassGlyph() {
  return (
    <Svg width={spacing.xl} height={spacing.xl} viewBox="0 0 24 24">
      <Rect
        x={4}
        y={2}
        width={16}
        height={3}
        rx={1.5}
        fill={colors.textPrimary}
      />
      <Rect
        x={4}
        y={19}
        width={16}
        height={3}
        rx={1.5}
        fill={colors.textPrimary}
      />
      <Path
        d="M6.5 5h11c0 4-2.4 5.2-4.2 7 1.8 1.8 4.2 3 4.2 7h-11c0-4 2.4-5.2 4.2-7-1.8-1.8-4.2-3-4.2-7Z"
        fill={colors.textPrimary}
      />
      <Path
        d="M9 7h6c-.5 1.5-1.5 2.5-3 3.8C10.5 9.5 9.5 8.5 9 7Zm.2 10c.5-1.5 1.5-2.5 2.8-3.7 1.3 1.2 2.3 2.2 2.8 3.7H9.2Z"
        fill={colors.blockingAccentLight}
      />
    </Svg>
  )
}

function TemplateSourceGlyph({ kind }: { kind: RuleTypeGlyphKind }) {
  if (kind === 'session') return <TemplateTimerGlyph />
  if (kind === 'limit') return <TemplateHourglassGlyph />
  return <TemplateCalendarGlyph />
}

function TemplateShieldGlyph() {
  return (
    <Svg width={spacing.xl} height={spacing.xl} viewBox="0 0 24 24">
      <Defs>
        <LinearGradient id="template-shield" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.textPrimary} />
          <Stop offset="1" stopColor={colors.blockingAccentLight} />
        </LinearGradient>
      </Defs>
      <Path
        d="M12 1.8 21 5.5v6.7c0 5.7-3.6 9.8-9 12.4-5.4-2.6-9-6.7-9-12.4V5.5L12 1.8Z"
        fill="url(#template-shield)"
      />
      <Path
        d="M12 5.2v15.5"
        stroke={colors.onBrightAccent}
        strokeOpacity={0.14}
      />
    </Svg>
  )
}

export function RuleTemplateFlowGlyph({ kind }: { kind: RuleTypeGlyphKind }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.templateFlow}
    >
      <TemplateSourceGlyph kind={kind} />
      <FlowArrow />
      <TemplateShieldGlyph />
    </View>
  )
}

/**
 * Le badge (puce + icônes) des cartes prédéfinies — SEULE source de vérité
 * pour la taille/forme de cet indicateur. Utilisé aussi par `BlockingRuleCard`
 * pour qu'une règle créée par l'utilisateur reste visuellement identique aux
 * cartes prédéfinies (même badge, même icônes, même taille).
 */
export function RuleTemplateFlowBadge({ kind }: { kind: RuleTypeGlyphKind }) {
  return (
    <View style={styles.templateFlowBadge}>
      <RuleTemplateFlowGlyph kind={kind} />
    </View>
  )
}

function FlowArrow() {
  return (
    <Svg width={spacing.xxl} height={spacing.lg} viewBox="0 0 32 20">
      <Path
        d="M2 10h26M22 4l6 6-6 6"
        fill="none"
        stroke={colors.textTertiary}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/**
 * Pictogrammes des trois types de règle — dessinés à même la carte, sans tuile
 * de fond : le volume vient du dégradé et des reflets, pas d'un cadre.
 */
export function RuleTypeGlyph({ kind }: { kind: RuleTypeGlyphKind }) {
  return (
    <View style={styles.typeGlyph}>
      <Svg width="100%" height="100%" viewBox="0 0 64 64">
        <Defs>
          <LinearGradient id="type-icon" x1="0.1" y1="0" x2="0.9" y2="1">
            <Stop offset="0" stopColor={colors.blockingAccentLight} />
            <Stop offset="0.5" stopColor={colors.blockingAccent} />
            <Stop offset="1" stopColor={colors.accentVioletDeep} />
          </LinearGradient>
          <LinearGradient id="type-sand" x1="0" y1="0" x2="0.6" y2="1">
            <Stop offset="0" stopColor={colors.blockingAccentLight} />
            <Stop offset="1" stopColor={colors.blockingAccent} />
          </LinearGradient>
          <RadialGradient id="type-sheen" cx="30%" cy="18%" rx="70%" ry="70%">
            <Stop offset="0" stopColor={colors.textPrimary} stopOpacity={0.3} />
            <Stop offset="1" stopColor={colors.textPrimary} stopOpacity={0} />
          </RadialGradient>
        </Defs>

        {kind === 'session' ? (
          <G>
            {/* Traits de vitesse : le chrono file vers la droite. */}
            <Path
              d="M4 27h9M2 36h11M7 45h6"
              stroke={colors.blockingAccent}
              strokeOpacity={0.7}
              strokeWidth={3.4}
              strokeLinecap="round"
            />
            <Rect
              x={35}
              y={9}
              width={8}
              height={9}
              rx={2}
              fill={colors.blockingAccent}
            />
            <Rect
              x={32}
              y={4}
              width={14}
              height={7}
              rx={3.5}
              fill={colors.blockingAccentLight}
            />
            <Path
              d="m51 24 5-5"
              stroke={colors.blockingAccentLight}
              strokeWidth={4.4}
              strokeLinecap="round"
            />
            <Circle
              cx={39}
              cy={39}
              r={18.5}
              fill="none"
              stroke="url(#type-icon)"
              strokeWidth={7}
            />
            <Circle
              cx={39}
              cy={39}
              r={18.5}
              fill="none"
              stroke="url(#type-sheen)"
              strokeWidth={7}
            />
            <Path
              d="M39 39V29M39 39l7.5 5"
              stroke={colors.blockingAccentLight}
              strokeWidth={3.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </G>
        ) : kind === 'schedule' ? (
          <G>
            <Rect
              x={18}
              y={4}
              width={6}
              height={14}
              rx={3}
              fill={colors.blockingAccentLight}
            />
            <Rect
              x={40}
              y={4}
              width={6}
              height={14}
              rx={3}
              fill={colors.blockingAccentLight}
            />
            <Rect
              x={6}
              y={11}
              width={52}
              height={48}
              rx={13}
              fill="url(#type-icon)"
            />
            <Rect
              x={6}
              y={11}
              width={52}
              height={48}
              rx={13}
              fill="url(#type-sheen)"
            />
            <Path
              d="M6 24h52"
              stroke={colors.textPrimary}
              strokeOpacity={0.24}
              strokeWidth={2}
            />
            {[34, 43.5].map(y =>
              [16, 26.7, 37.4, 48.1].map(x => (
                <Circle
                  key={`${x}-${y}`}
                  cx={x}
                  cy={y}
                  r={2.7}
                  fill={colors.textPrimary}
                  fillOpacity={0.92}
                />
              )),
            )}
            {[16, 26.7, 37.4].map(x => (
              <Circle
                key={`${x}-53`}
                cx={x}
                cy={53}
                r={2.7}
                fill={colors.textPrimary}
                fillOpacity={0.92}
              />
            ))}
          </G>
        ) : (
          <G>
            <Rect
              x={11}
              y={4}
              width={42}
              height={7.5}
              rx={3.75}
              fill="url(#type-icon)"
            />
            <Rect
              x={11}
              y={52.5}
              width={42}
              height={7.5}
              rx={3.75}
              fill="url(#type-icon)"
            />
            {/* Verre : translucide, c'est le fond de la carte qu'on voit au travers. */}
            <Path
              d="M17 11.5h30c0 11-8 15.5-13 20.5 5 5 13 9.5 13 20.5H17c0-11 8-15.5 13-20.5-5-5-13-9.5-13-20.5Z"
              fill={colors.blockingAccentLight}
              fillOpacity={0.16}
              stroke={colors.blockingAccentLight}
              strokeOpacity={0.55}
              strokeWidth={1.8}
            />
            <Path
              d="M22 16h20c0 7.5-6 10.5-10 14.5-4-4-10-7-10-14.5Z"
              fill="url(#type-sand)"
            />
            <Path
              d="M23 48c1-7.5 5-11 9-14 4 3 8 6.5 9 14Z"
              fill="url(#type-sand)"
            />
            <Rect
              x={31}
              y={33}
              width={2}
              height={9}
              rx={1}
              fill={colors.blockingAccentLight}
            />
          </G>
        )}
      </Svg>
    </View>
  )
}

export function PurplePlusButton({
  accessibilityLabel,
  onPress,
  compact = false,
}: {
  accessibilityLabel: string
  onPress: () => void
  compact?: boolean
}) {
  const size = compact ? spacing.xxxl : spacing.xxxxl
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={compact ? spacing.micro : undefined}
      onPress={onPress}
      style={[
        styles.plusButton,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id="plus-gradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.blockingAccentLight} />
            <Stop offset="0.55" stopColor={colors.blockingAccent} />
            <Stop offset="1" stopColor={colors.accentVioletDeep} />
          </LinearGradient>
        </Defs>
        <Rect
          width="100%"
          height="100%"
          rx={size / 2}
          fill="url(#plus-gradient)"
        />
      </Svg>
      <IconSvg
        name={IconName.PLUS}
        size={spacing.xl}
        color={compact ? colors.textPrimary : colors.blockingCanvas}
      />
    </PressableScale>
  )
}

export function LockedAppTile() {
  return (
    <View style={styles.lockedTile}>
      <XMark
        size={spacing.xxxxxl + spacing.xxs}
        color={colors.blockingLockedAppMark}
        strokeWidth={3.2}
      />
      <View style={styles.lockBadge}>
        <Svg width={spacing.xxl} height={spacing.xxl} viewBox="0 0 32 32">
          <Path
            d="M10 14v-3.2a6 6 0 0 1 12 0V14"
            fill="none"
            stroke={colors.textSecondary}
            strokeWidth={3}
            strokeLinecap="round"
          />
          <Rect
            x={6}
            y={13}
            width={20}
            height={16}
            rx={4}
            fill={colors.textSecondary}
          />
          <Circle cx={16} cy={21} r={2.2} fill={colors.blockingCanvas} />
        </Svg>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  badgeIcon: {
    width: spacing.xl,
    height: spacing.xl,
    borderRadius: spacing.xl * 0.24,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.blockingBorder,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  extraBadge: {
    minWidth: spacing.xxxl,
    height: spacing.xl,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.compact,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blockingPill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.blockingBorder,
  },
  extraText: {
    ...fonts.medium,
    color: colors.textPrimary,
    fontSize: relockMaterial.typography.blockingMetaSize,
    lineHeight: relockMaterial.typography.blockingMetaLineHeight,
    fontVariant: ['tabular-nums'],
  },
  templateFlow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
  },
  templateFlowBadge: {
    alignSelf: 'flex-start',
    padding: spacing.xxs,
    borderRadius: radius.compact,
    backgroundColor: colors.blockingImageChrome,
  },
  typeGlyph: {
    width: relockMaterial.layout.blockingTypeGlyphSize,
    height: relockMaterial.layout.blockingTypeGlyphSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusButton: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: colors.blockingAccent,
    shadowOpacity: relockMaterial.shadow.blockingGlow.shadowOpacity,
    shadowRadius: relockMaterial.shadow.blockingGlow.shadowRadius,
    shadowOffset: relockMaterial.shadow.blockingGlow.shadowOffset,
  },
  lockedTile: {
    width: relockMaterial.layout.blockingLockedTileSize,
    height: relockMaterial.layout.blockingLockedTileSize,
    borderRadius: radius.panel,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.blockingCanvas,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.blockingBorderStrong,
    shadowColor: colors.blockingAccent,
    shadowOpacity: relockMaterial.shadow.blockingGlow.shadowOpacity,
    shadowRadius: relockMaterial.shadow.blockingGlow.shadowRadius,
    shadowOffset: relockMaterial.shadow.blockingGlow.shadowOffset,
  },
  lockBadge: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: spacing.xxl,
    height: spacing.xxl,
    borderRadius: radius.compact,
    backgroundColor: colors.transparent,
    shadowColor: colors.shadow,
    shadowOpacity: relockMaterial.shadow.blockingSubtle.shadowOpacity,
    shadowRadius: relockMaterial.shadow.blockingSubtle.shadowRadius,
    shadowOffset: relockMaterial.shadow.blockingSubtle.shadowOffset,
  },
})
