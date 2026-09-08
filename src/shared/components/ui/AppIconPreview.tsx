import React from 'react'
import {
  Image,
  type ImageSourcePropType,
  type ImageStyle,
  type StyleProp,
} from 'react-native'
import type { AppLogo } from '@/shared/constants/app-logo'

/**
 * L'aperçu d'une icône d'app, dans le sélecteur des Réglages.
 *
 * Il ne montre pas une vignette dessinée à part : ce sont les mêmes marques
 * que celles compilées dans `Images.xcassets` (`AppIcon`, `AppIcon-Orb`,
 * `AppIcon-Phases`). Choisir sur un dessin et obtenir un autre serait le seul
 * vrai défaut possible de cet écran — l'utilisateur ne verra le résultat
 * qu'après avoir quitté l'app.
 *
 * L'arrondi imite celui d'iOS (22,37 % du côté), pour que la ligne montre
 * bien une ICÔNE et non une image carrée posée dans une liste. Le fond noir
 * fait partie du dessin — c'est le creux central de « phases » — donc rien
 * n'est détouré.
 */

/** Rapport d'arrondi d'une icône iOS. */
const RADIUS_RATIO = 0.2237

const SOURCES: Record<AppLogo, ImageSourcePropType> = {
  classic: require('@assets/logo-classic.png'),
  orb: require('@assets/logo-orb.png'),
  phases: require('@assets/logo-phases.png'),
}

interface Props {
  /** La variante à dessiner. */
  logo: AppLogo
  /** Côté de la vignette, en points. */
  size: number
  style?: StyleProp<ImageStyle>
  /** Décoratif par défaut : la ligne qui l'accueille porte déjà le nom. */
  accessibilityLabel?: string
}

export const AppIconPreview = React.memo(function AppIconPreview({
  logo,
  size,
  style,
  accessibilityLabel,
}: Props) {
  const source = SOURCES[logo]
  // Une préférence écrite par une version plus récente puis rétrogradée ne
  // doit pas produire une `Image` sans source : on retombe sur l'icône
  // d'origine, exactement comme le fait la lecture de la préférence.
  const safe = source ?? SOURCES.classic

  return (
    <Image
      source={safe}
      accessible={accessibilityLabel !== undefined}
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      resizeMode="contain"
      style={[
        {
          width: size,
          height: size,
          borderRadius: Math.round(size * RADIUS_RATIO),
        },
        style,
      ]}
    />
  )
})
