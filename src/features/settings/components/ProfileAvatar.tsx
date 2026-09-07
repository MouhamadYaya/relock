import { IconName } from '@assets/icons'
import React from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { buildAvatarUrl } from '@/shared/services/imagekit'
import { relockMaterial } from '@/shared/theme'
import { fonts } from '@/shared/theme/tokens/fonts'

const { colors, radius } = relockMaterial

/** Les initiales affichées tant qu'aucune photo n'a été choisie. */
export function initialsFrom(source: string | null): string {
  if (!source) return '?'
  const letters = source
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word[0])
    .join('')
  return (letters || '?').toUpperCase()
}

interface Props {
  /** Chemin ImageKit ou URL du fournisseur d'identité. */
  avatar: string | null
  /** Sert aux initiales de repli. */
  displayName: string | null
  /** Diamètre en points. Sert au style ET à la requête ImageKit. */
  size: number
  /** Pastille appareil photo. C'est elle qui dit « ça se change ». */
  badgeSize?: number
  badgeIconSize?: number
  /** Upload en cours. */
  busy?: boolean
}

/**
 * La pastille d'identité : photo ou initiales, et l'appareil photo qui dit
 * qu'elle se remplace.
 *
 * La pastille est là MÊME quand une photo existe déjà. Sans elle, une photo
 * ronde ressemble à une décoration ; avec elle, elle ressemble à un champ.
 * C'est le seul indice qu'a l'utilisateur qu'il peut la changer — et il coûte
 * 24 points.
 *
 * L'image est demandée à ImageKit au diamètre exact d'affichage : on
 * télécharge une vignette, jamais l'original.
 */
export function ProfileAvatar({
  avatar,
  displayName,
  size,
  badgeSize,
  badgeIconSize,
  busy,
}: Props) {
  const showBadge = badgeSize !== undefined && badgeIconSize !== undefined

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        {/* Fond dégradé : une pastille d'initiales sur aplat plat fait
            « champ vide », le dégradé fait « portrait en attente ». */}
        <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="avatarBase" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.homeShieldLight} />
              <Stop offset="1" stopColor={colors.accentVioletDeep} />
            </LinearGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#avatarBase)" />
        </Svg>

        {busy ? (
          <ActivityIndicator color={colors.onBrightAccent} />
        ) : avatar ? (
          <Image
            source={{ uri: buildAvatarUrl(avatar, size) }}
            style={StyleSheet.absoluteFill}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Text style={[styles.initials, { fontSize: size * 0.36 }]}>
            {initialsFrom(displayName)}
          </Text>
        )}
      </View>

      {showBadge ? (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
            },
          ]}
        >
          <IconSvg
            name={IconName.CAMERA}
            size={badgeIconSize}
            color={colors.onAccent}
          />
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    // Rogne la photo au cercle, quel que soit son ratio d'origine.
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeBorderStrong,
  },
  initials: {
    ...fonts.bold,
    color: colors.onBrightAccent,
  },
  // La bordure sombre détache la pastille de la photo qu'elle chevauche —
  // sans elle, un appareil photo blanc sur une photo claire disparaît.
  badge: {
    position: 'absolute',
    right: -1,
    bottom: -1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentVioletDeep,
    borderWidth: 2,
    borderColor: colors.homeCanvas,
    borderRadius: radius.capsule,
  },
})
