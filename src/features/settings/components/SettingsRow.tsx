import { IconName } from '@assets/icons'
import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, View } from 'react-native'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { haptics } from '@/shared/utils/platform/haptics'

const { colors, layout, radius, typography } = relockMaterial

/**
 * La teinte d'une famille de réglages. La couleur de la pastille classe la
 * ligne : on retrouve « le violet, c'est moi », « le vert, c'est ce qui me
 * protège » sans avoir à relire les intitulés de section.
 */
export type SettingsTint =
  | 'violet'
  | 'lavender'
  | 'mint'
  | 'blue'
  | 'amber'
  | 'danger'

const TINTS: Record<SettingsTint, { fg: string; bg: string }> = {
  violet: { fg: colors.accentViolet, bg: colors.settingsTintViolet },
  lavender: { fg: colors.homeLavender, bg: colors.settingsTintLavender },
  mint: { fg: colors.homeMint, bg: colors.settingsTintMint },
  blue: { fg: colors.homeBlue, bg: colors.settingsTintBlue },
  amber: { fg: colors.blockingWarning, bg: colors.settingsTintAmber },
  danger: { fg: colors.blockingDanger, bg: colors.settingsTintDanger },
}

export interface SettingsRowProps {
  icon: IconName
  label: string
  /** Une ligne d'explication sous l'intitulé. Rare : la plupart s'en passent. */
  hint?: string
  /** Valeur courante, alignée à droite (« Sombre », « Français »). */
  value?: string
  tint?: SettingsTint
  onPress?: () => void
  /** Interrupteur : fournir les deux, ou aucun des deux. */
  switchValue?: boolean
  onSwitchChange?: (value: boolean) => void
  /** Pastille d'état — permissions accordées ou non. */
  status?: { label: string; granted: boolean }
  /** Action irréversible : l'intitulé passe au rouge. */
  danger?: boolean
  /** Opération en cours : remplace le chevron par un indicateur. */
  busy?: boolean
  disabled?: boolean
  /** Élément libre à droite (badge d'abonnement, par exemple). */
  accessory?: React.ReactNode
}

/**
 * Une ligne de réglage. Trois formes possibles, jamais mélangées :
 * navigation (chevron), interrupteur, ou lecture seule.
 *
 * Le chevron n'apparaît QUE si la ligne mène quelque part. C'est la promesse
 * la plus simple d'une liste de réglages, et celle qu'on trahit le plus
 * souvent : une flèche sur une ligne qui ne navigue pas se paie en confiance.
 */
export function SettingsRow({
  icon,
  label,
  hint,
  value,
  tint = 'lavender',
  onPress,
  switchValue,
  onSwitchChange,
  status,
  danger,
  busy,
  disabled,
  accessory,
}: SettingsRowProps) {
  const palette = danger ? TINTS.danger : TINTS[tint]
  const hasSwitch = switchValue !== undefined && onSwitchChange !== undefined
  const navigates = onPress !== undefined && !hasSwitch
  const labelColor = danger ? colors.blockingDanger : colors.homeCardInk

  const handlePress = () => {
    if (disabled || busy) return
    haptics.selectionTick()
    onPress?.()
  }

  const body = (
    <>
      <View style={[styles.tile, { backgroundColor: palette.bg }]}>
        <IconSvg
          name={icon}
          size={layout.settingsIconSize}
          color={palette.fg}
        />
      </View>

      <View style={styles.copy}>
        <Text
          numberOfLines={1}
          maxFontSizeMultiplier={1.4}
          style={[styles.label, { color: labelColor }]}
        >
          {label}
        </Text>
        {hint ? (
          <Text numberOfLines={2} maxFontSizeMultiplier={1.3} style={styles.hint}>
            {hint}
          </Text>
        ) : null}
      </View>

      {value ? (
        <Text numberOfLines={1} style={styles.value}>
          {value}
        </Text>
      ) : null}

      {status ? (
        <View style={styles.status}>
          <View
            style={[
              styles.dot,
              {
                backgroundColor: status.granted
                  ? colors.settingsStatusOn
                  : colors.settingsStatusOff,
              },
            ]}
          />
          <Text
            style={[
              styles.statusLabel,
              {
                color: status.granted
                  ? colors.settingsStatusOn
                  : colors.settingsStatusOff,
              },
            ]}
          >
            {status.label}
          </Text>
        </View>
      ) : null}

      {accessory}

      {hasSwitch ? (
        <Switch
          value={switchValue}
          onValueChange={next => {
            haptics.selectionTick()
            onSwitchChange(next)
          }}
          disabled={disabled}
          trackColor={{ true: colors.accentVioletDeep, false: colors.homeScoreTile }}
          thumbColor={colors.homeCardInk}
          ios_backgroundColor={colors.homeScoreTile}
        />
      ) : null}

      {busy ? (
        <ActivityIndicator color={colors.homeCardMuted} />
      ) : navigates ? (
        <IconSvg
          name={IconName.FORWARD}
          size={layout.settingsChevronSize}
          color={colors.textTertiary}
        />
      ) : null}
    </>
  )

  if (!navigates) {
    return (
      <View
        style={[styles.row, disabled && styles.disabled]}
        accessible={hasSwitch ? undefined : true}
        accessibilityLabel={hasSwitch ? undefined : label}
      >
        {body}
      </View>
    )
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.row,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {body}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.settingsRowGap,
    minHeight: layout.settingsRowMinHeight,
    paddingHorizontal: layout.settingsRowHorizontal,
    paddingVertical: layout.settingsRowVertical,
  },
  // Le retour au doigt est un éclaircissement du verre, pas un aplat gris :
  // la carte reste translucide pendant l'appui.
  pressed: { backgroundColor: colors.homeGlass1 },
  disabled: { opacity: relockMaterial.opacity.disabled },
  tile: {
    width: layout.settingsIconTile,
    height: layout.settingsIconTile,
    borderRadius: layout.settingsIconTileRadius,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, minWidth: 0, gap: spacing.micro },
  label: {
    ...fonts.medium,
    fontSize: typography.settingsRowLabelSize,
    lineHeight: typography.settingsRowLabelLineHeight,
  },
  hint: {
    ...fonts.regular,
    color: colors.textTertiary,
    fontSize: typography.settingsRowHintSize,
    lineHeight: typography.settingsRowHintLineHeight,
  },
  value: {
    ...fonts.regular,
    color: colors.homeCardMuted,
    fontSize: typography.settingsRowValueSize,
    lineHeight: typography.settingsRowValueLineHeight,
    maxWidth: '42%',
  },
  status: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  dot: {
    width: spacing.xs - 1,
    height: spacing.xs - 1,
    borderRadius: radius.capsule,
  },
  statusLabel: {
    ...fonts.semiBold,
    fontSize: typography.settingsRowHintSize,
    lineHeight: typography.settingsRowValueLineHeight,
  },
})
