import { IconName } from '@assets/icons'
import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { ProfileAvatar } from '@/features/settings/components/ProfileAvatar'
import { SettingsSurface } from '@/features/settings/components/SettingsSurface'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { haptics } from '@/shared/utils/platform/haptics'

const { colors, layout, radius, shadow, typography } = relockMaterial

interface Props {
  displayName: string | null
  email: string | null
  avatar: string | null
  /** Abonnement actif : la carte porte alors le liseré Pro. */
  pro: boolean
  proLabel: string
  /** Ce que la carte promet — « Photo, nom, date de naissance ». */
  subtitle: string
  accessibilityLabel: string
  onPress: () => void
}

/**
 * La carte d'identité, en tête des Réglages.
 *
 * Une seule cible tactile pour toute la carte, y compris la photo. La photo
 * a bien sa propre pastille d'appareil photo, mais elle n'ouvre PAS la
 * galerie directement : deux zones tactiles imbriquées aux effets différents
 * sur une même carte se manquent au doigt une fois sur trois. La carte mène à
 * la fiche, où la photo est grande et où l'appui ne peut plus être ambigu.
 */
export function ProfileCard({
  displayName,
  email,
  avatar,
  pro,
  proLabel,
  subtitle,
  accessibilityLabel,
  onPress,
}: Props) {
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      scaleTo={0.985}
      onPress={() => {
        haptics.selectionTick()
        onPress()
      }}
      style={styles.card}
    >
      <SettingsSurface elevated />

      <ProfileAvatar
        avatar={avatar}
        displayName={displayName}
        size={layout.settingsAvatarSize}
        badgeSize={layout.settingsAvatarBadge}
        badgeIconSize={layout.settingsAvatarBadgeIcon}
      />

      <View style={styles.copy}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.name}>
            {displayName ?? '—'}
          </Text>
          {pro ? (
            <View style={styles.badge}>
              <IconSvg
                name={IconName.CROWN}
                size={typography.settingsBadgeSize}
                color={colors.blockingWarning}
              />
              <Text style={styles.badgeLabel}>{proLabel}</Text>
            </View>
          ) : null}
        </View>
        <Text numberOfLines={1} style={styles.meta}>
          {email ?? subtitle}
        </Text>
      </View>

      <IconSvg
        name={IconName.FORWARD}
        size={layout.settingsChevronSize}
        color={colors.textTertiary}
      />
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: layout.settingsProfileGap,
    padding: layout.settingsProfilePadding,
    borderRadius: layout.settingsCardRadius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeBorderStrong,
    overflow: 'hidden',
    ...shadow.glass,
  },
  copy: { flex: 1, minWidth: 0, gap: spacing.micro },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  name: {
    ...fonts.bold,
    flexShrink: 1,
    color: colors.homeCardInk,
    fontSize: typography.settingsNameSize,
    lineHeight: typography.settingsNameLineHeight,
    letterSpacing: typography.settingsNameLetterSpacing,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.micro,
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.micro,
    borderRadius: radius.capsule,
    backgroundColor: colors.settingsTintAmber,
  },
  badgeLabel: {
    ...fonts.semiBold,
    color: colors.blockingWarning,
    fontSize: typography.settingsBadgeSize,
    lineHeight: typography.settingsBadgeLineHeight,
    letterSpacing: 0.3,
  },
  meta: {
    ...fonts.regular,
    color: colors.homeCardMuted,
    fontSize: typography.settingsMetaSize,
    lineHeight: typography.settingsMetaLineHeight,
  },
})
