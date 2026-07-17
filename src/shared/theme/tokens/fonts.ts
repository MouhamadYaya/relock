/**
 * FILE: fonts.ts
 * LAYER: core/theme/tokens
 * ---------------------------------------------------------------------
 * PURPOSE:
 *   Source unique des graisses de texte de l'app.
 *
 * ⚠️ AUCUNE `fontFamily` n'est déclarée, et c'est VOLONTAIRE.
 *
 * L'app utilise la police SYSTÈME (San Francisco sur iOS) — celle des
 * Réglages, de Messages, et de toutes les apps qui « font natif ». Elle n'est
 * pas accessible par son nom : Apple la réserve, aucun `fontFamily` ne la
 * désigne. On l'obtient en n'imposant AUCUNE famille — c'est celle que le
 * système applique par défaut — et en ne pilotant que la graisse.
 *
 * Bénéfice : iOS choisit lui-même la coupe optique (Text sous 20 pt, Display
 * au-dessus) et le crénage adapté à chaque taille, ce qu'une police embarquée
 * ne sait pas faire.
 *
 * USAGE : ces tokens sont des STYLES, à étaler — jamais des noms de police.
 *   ✅ `{ ...fonts.semiBold, fontSize: 15 }`
 *   ❌ `{ fontFamily: fonts.semiBold }`
 * ---------------------------------------------------------------------
 */

export const fonts = {
  regular: { fontWeight: '400' as const },
  medium: { fontWeight: '500' as const },
  semiBold: { fontWeight: '600' as const },
  bold: { fontWeight: '700' as const },

  /** Libellés en capitales (onglets, puces, badges). */
  caps: { fontWeight: '600' as const },

  /**
   * Technique (valeurs, code). SF Mono n'étant pas exposée aux apps, Menlo est
   * la monospace système la plus proche.
   */
  mono: { fontFamily: 'Menlo' as const },
} as const

export type Fonts = typeof fonts
