import { IconName } from '@assets/icons'
import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { ProfileAvatar } from '@/features/settings/components/ProfileAvatar'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { settingsTheme } from '@/shared/theme'
import { haptics } from '@/shared/utils/platform/haptics'

const { colors, radius, size, spacing, type } = settingsTheme

interface Props {
  displayName: string | null
  email: string | null
  avatar: string | null
  /** Abonnement actif : la carte porte alors le badge PRO. */
  pro: boolean
  proLabel: string
  /** Repli quand le compte n'a pas encore d'e-mail. */
  subtitle: string
  accessibilityLabel: string
  onPress: () => void
}

/**
 * La carte d'identité, en tête de la section « Compte ».
 *
 * Une seule cible tactile pour toute la carte, photo comprise. La photo porte
 * bien sa pastille d'appareil photo, mais elle n'ouvre pas la galerie
 * directement : deux zones tactiles imbriquées aux effets différents sur une
 * même carte se manquent au doigt une fois sur trois. La carte mène à la
 * fiche, où la photo est grande et où l'appui ne peut plus être ambigu.
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
  const [pressed, setPressed] = React.useState(false)

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      // Le tic part du TOUCHER : la fiche profil est un écran, et l'appui doit
      // se sentir avant qu'il ne commence à se monter.
      onPressIn={() => {
        setPressed(true)
        haptics.selectionTick()
      }}
      onPressOut={() => setPressed(false)}
      style={pressed ? styles.cardPressed : styles.card}
    >
      <ProfileAvatar
        avatar={avatar}
        displayName={displayName}
        size={size.avatar}
        badge
      />

      <View style={styles.content}>
        <View style={styles.nameRow}>
          <Text numberOfLines={1} style={styles.name}>
            {displayName ?? '—'}
          </Text>
          {pro ? (
            <View style={styles.badge}>
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
        size={size.chevron}
        strokeWidth={size.iconStroke}
        color={colors.textTertiary}
      />
    </Pressable>
  )
}

/**
 * ⚠️ Aucun `style` en FONCTION ni en TABLEAU sur les `Pressable` de cet
 * écran : à l'exécution, le style était purement et simplement perdu, la vue
 * retombait sur `flexDirection: 'column'` (le défaut de React Native) et tout
 * le contenu s'empilait à gauche. Invisible sous `react-test-renderer`, qui
 * résout le style-fonction correctement — voir `SettingsRow`.
 */
/**
 * La ligne de profil n'a PAS de fond ni de bordure propres : elle est la
 * première ligne de la carte « Compte », pas une carte posée dedans. Le
 * double cadre se voyait immédiatement — deux arrondis concentriques et une
 * couture là où le filet du groupe passait sous la carte intérieure.
 *
 * Sa géométrie diffère quand même des autres lignes, à cause de l'avatar :
 * un peu plus d'air vertical, et un espace icône-texte plus large. C'est
 * l'exception assumée, et elle est contenue ici.
 */
const CARD_LAYOUT = {
  flexDirection: 'row',
  alignItems: 'center',
  flexWrap: 'nowrap',
  paddingHorizontal: spacing.rowH,
  paddingVertical: spacing.rowV,
} as const

const styles = StyleSheet.create({
  card: CARD_LAYOUT,
  cardPressed: { ...CARD_LAYOUT, backgroundColor: colors.pressed },
  content: {
    flex: 1,
    minWidth: 0,
    marginLeft: 14,
    marginRight: spacing.trailingGap,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'nowrap' },
  name: {
    flexShrink: 1,
    color: colors.textPrimary,
    fontSize: type.profileName.size,
    fontWeight: type.profileName.weight,
  },
  // Le violet ne sert qu'à trois choses dans cet écran, et c'en est une.
  badge: {
    flexShrink: 0,
    marginLeft: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  badgeLabel: {
    color: colors.accent,
    fontSize: type.badge.size,
    fontWeight: type.badge.weight,
    letterSpacing: 0.4,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: type.profileMeta.size,
    fontWeight: type.profileMeta.weight,
    marginTop: 2,
  },
})
