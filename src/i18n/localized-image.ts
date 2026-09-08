import type { ImageSourcePropType } from 'react-native'
import type { SupportedLanguage } from '@/i18n/i18n'
import i18n from '@/i18n/i18n'

/**
 * Une image qui existe en plusieurs langues.
 *
 * Certaines illustrations contiennent du TEXTE dessiné dans les pixels — une
 * capture d'écran de l'app, par exemple. Aucun `t()` ne peut les traduire : il
 * faut un fichier par langue, et c'est le rendu qui choisit lequel afficher.
 *
 * `base` est la version toujours présente ; les variantes sont facultatives,
 * pour qu'une langue dont l'image n'a pas encore été produite retombe sur la
 * base au lieu de casser le bundle. Ajouter une variante = déposer le fichier
 * et ajouter une ligne `require()`.
 */
export interface LocalizedImage {
  base: ImageSourcePropType
  variants?: Partial<Record<SupportedLanguage, ImageSourcePropType>>
}

export function localizedImage(image: LocalizedImage): ImageSourcePropType {
  const language = i18n.language.split('-')[0] as SupportedLanguage
  return image.variants?.[language] ?? image.base
}
