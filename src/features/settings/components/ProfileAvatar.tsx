import { IconName } from '@assets/icons'
import React from 'react'
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { buildAvatarUrl } from '@/shared/services/imagekit'
import { settingsTheme } from '@/shared/theme'

const { colors, radius, size: sizes } = settingsTheme

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
  badge?: boolean
  /** Upload en cours. */
  busy?: boolean
}

/**
 * La pastille d'identité : photo ou initiales, et l'appareil photo qui dit
 * qu'elle se remplace.
 *
 * La pastille est là MÊME quand une photo existe déjà. Sans elle, une photo
 * ronde ressemble à une décoration ; avec elle, elle ressemble à un champ.
 * C'est le seul indice qu'a l'utilisateur qu'il peut la changer.
 *
 * Elle reste monochrome comme le reste de l'écran : le violet est réservé aux
 * interrupteurs actifs, à la coche de sélection et au badge PRO.
 *
 * L'image est demandée à ImageKit au diamètre exact d'affichage : on
 * télécharge une vignette, jamais l'original.
 */
export function ProfileAvatar({
  avatar,
  displayName,
  size,
  badge,
  busy,
}: Props) {
  // La pastille suit le diamètre : figée, elle avalerait un petit avatar et
  // se perdrait sur un grand.
  const badgeSize = Math.round(size * 0.36)

  // On RÉSOUT avant de choisir la branche de rendu.
  //
  // Un chemin ImageKit stocké (`avatars/<uid>/photo.jpg`) reste « truthy »
  // même quand l'intégration est coupée : `buildAvatarUrl` le renvoie alors
  // tel quel, et le passer à `<Image>` produit un URI RELATIF — donc un disque
  // vide, sans jamais retomber sur les initiales. Le test porte donc sur le
  // résultat de la résolution, pas sur la présence d'une valeur en entrée.
  const resolved = avatar ? buildAvatarUrl(avatar, size) : ''
  const remoteUri = /^https?:\/\//i.test(resolved) ? resolved : null

  // Même absolue, une URL peut échouer : média supprimé côté CDN, chemin
  // erroné, avatar d'un fournisseur d'identité dont le lien a expiré. Sans ce
  // repli, il resterait le même disque vide.
  //
  // On mémorise l'URL EN ÉCHEC, pas un booléen : une nouvelle photo reprend
  // ainsi sa chance d'elle-même, sans effet de remise à zéro à tenir en phase.
  const [failedUri, setFailedUri] = React.useState<string | null>(null)

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.circle,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.textPrimary} />
        ) : remoteUri && failedUri !== remoteUri ? (
          <Image
            source={{ uri: remoteUri }}
            style={StyleSheet.absoluteFill}
            accessibilityIgnoresInvertColors
            onError={() => setFailedUri(remoteUri)}
          />
        ) : (
          <Text
            style={[styles.initials, { fontSize: Math.round(size * 0.36) }]}
          >
            {initialsFrom(displayName)}
          </Text>
        )}
      </View>

      {badge ? (
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
            size={Math.round(badgeSize * 0.56)}
            strokeWidth={sizes.iconStroke}
            color={colors.textPrimary}
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
    backgroundColor: colors.control,
    borderWidth: sizes.hairline,
    borderColor: colors.controlBorder,
  },
  initials: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  // La bordure sombre détache la pastille de la photo qu'elle chevauche —
  // sans elle, un appareil photo clair sur une photo claire disparaît.
  badge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.control,
    borderWidth: 2,
    borderColor: colors.bg,
    borderRadius: radius.pill,
  },
})
