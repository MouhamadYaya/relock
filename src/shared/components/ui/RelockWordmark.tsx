import React from 'react'
import { Image, type ImageStyle, type StyleProp } from 'react-native'

/**
 * Le logotype Relock — la seule source de vérité pour la marque à l'écran.
 *
 * Le PNG est détouré au pixel (aucune marge transparente autour des lettres),
 * donc la hauteur demandée EST la hauteur optique du mot : pas de correction
 * à faire au cas par cas dans les écrans. L'étoile au-dessus du « R » déborde
 * de ~7 % au-dessus de la hampe, c'est voulu et compris dans le cadrage.
 *
 * Le chrome du logo porte déjà son propre liseré sombre : ne rien ajouter
 * derrière (ombre portée, halo) — sur le fond nocturne de l'Accueil ça
 * dessinait un rectangle gris visible autour de l'image.
 */
const SOURCE = require('@assets/relock-wordmark.png')

/** Ratio réel du fichier détouré (722 × 198 en @3x). La hauteur pilote tout. */
export const RELOCK_WORDMARK_RATIO = 722 / 198

interface Props {
  /** Hauteur optique du mot, en points. La largeur en découle. */
  height: number
  style?: StyleProp<ImageStyle>
  /** Nom de marque — non traduit. Surchargeable pour un contexte particulier. */
  accessibilityLabel?: string
}

export function RelockWordmark({
  height,
  style,
  accessibilityLabel = 'Relock',
}: Props) {
  return (
    <Image
      source={SOURCE}
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      resizeMode="contain"
      style={[{ height, width: height * RELOCK_WORDMARK_RATIO }, style]}
    />
  )
}
