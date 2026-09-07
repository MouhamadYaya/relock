/**
 * Le système visuel de l'écran Réglages — sobre, monochrome, aéré.
 *
 * Il est VOLONTAIREMENT séparé de `relockMaterial`, qui décrit une scène :
 * une nuit, une aurore, des cartes de verre qui captent la lumière. Les
 * Réglages ne sont pas une scène, c'est une liste qu'on parcourt du regard et
 * qu'on doit comprendre en deux secondes sans lire. La couleur y porte une
 * seule information — ce qui est actif, ce qui est destructeur — et rien
 * d'autre.
 *
 * Règle d'usage : AUCUNE couleur ni valeur d'espacement en dur dans les
 * écrans ou les composants de réglages. Tout passe par ici.
 */
export const settingsTheme = {
  colors: {
    /** Fond de page. Jamais du noir pur : les cartes translucides n'auraient plus rien à éclaircir. */
    bg: '#07070A',
    /** Fond de carte : un voile clair, posé sur une `View` (l'alpha y est sûr, contrairement à un `<Stop>` SVG). */
    card: 'rgba(255,255,255,0.045)',
    cardBorder: 'rgba(255,255,255,0.06)',
    divider: 'rgba(255,255,255,0.07)',
    /** Retour au doigt : la carte s'éclaircit, elle ne se colore pas. */
    pressed: 'rgba(255,255,255,0.06)',
    textPrimary: '#FFFFFF',
    textSecondary: '#A7A4B3',
    /**
     * Texte complémentaire — notes sous les cartes, chevrons.
     *
     * Éclairci par rapport au gris d'origine : une note explicative sous une
     * carte porte souvent une CONDITION (« la résiliation passe par l'App
     * Store »). Un texte qu'on ne lit pas parce qu'il est trop pâle est un
     * texte qui n'existe pas. Mesuré, pas supposé : voir `contrast.test.ts`.
     */
    textTertiary: '#8B8895',
    /** Les icônes ont UNE seule couleur. Aucune pastille, aucune teinte par famille. */
    icon: '#B9B9C4',
    /** Le violet ne sert qu'à trois choses : interrupteur actif, coche de sélection, badge PRO. */
    accent: '#7C5CFF',
    accentSoft: 'rgba(124,92,255,0.14)',
    success: '#34D399',
    danger: '#FF453A',
    /** Chrome posé sur le fond : bouton retour, poignée de feuille. */
    control: 'rgba(255,255,255,0.08)',
    controlBorder: 'rgba(255,255,255,0.10)',
    /** Voile derrière une feuille modale. */
    scrim: 'rgba(0,0,0,0.6)',
    transparent: 'transparent',
  },
  radius: { card: 26, sheet: 28, pill: 999 },
  spacing: {
    /** Marge latérale de l'écran, et padding horizontal d'une ligne. */
    screenH: 16,
    /** Marge verticale d'une ligne. La hauteur reste adaptative au-dessus. */
    rowV: 15,
    rowH: 18,
    /**
     * Gouttière d'icône. C'est ELLE qui garantit que tous les titres de
     * toutes les lignes commencent au même x, y compris sur une ligne sans
     * icône — la gouttière est alors vide, jamais absente. Sa largeur ne
     * dépend pas de la forme du pictogramme, qui y est centré.
     */
    iconGutter: 24,
    /** Écart entre la gouttière et le bloc de texte. */
    iconGap: 12,
    /** Écart entre le bloc de texte et l'élément de droite. */
    trailingGap: 12,
    sectionGap: 30,
    /** Entre le titre d'une section et sa carte. */
    titleGap: 12,
    /** Entre une carte et sa note explicative. */
    captionGap: 10,
    /**
     * Retrait des titres de section et des notes. Une seule valeur pour les
     * deux, et pour toutes les sections : un titre qui se décale d'une
     * section à l'autre se remarque immédiatement en défilant.
     */
    sectionTitleH: 6,
    /** Entre le titre et sa description, dans une ligne. */
    textGap: 4,
    headerH: 44,
  },
  size: {
    rowMinHeight: 56,
    icon: 21,
    iconStroke: 1.8,
    chevron: 18,
    check: 20,
    avatar: 52,
    /** Filet de séparation : 1 px réel, jamais mis à l'échelle. */
    hairline: 1,
  },
  type: {
    screenTitle: { size: 17, weight: '600' as const },
    /**
     * Un cran sous l'ancien 20/700, qui écrasait la page. Un titre de section
     * doit se repérer en défilant, pas dominer les réglages qu'il annonce.
     */
    sectionTitle: { size: 18, weight: '600' as const },
    rowTitle: { size: 17, weight: '400' as const },
    rowSubtitle: { size: 14, weight: '400' as const, lineHeight: 19 },
    rowValue: { size: 15, weight: '400' as const },
    caption: { size: 13, weight: '400' as const, lineHeight: 18 },
    // Un cran SOUS le titre de section : la carte de profil vit à
    // l'intérieur de « Compte », elle ne doit pas lui disputer le regard.
    profileName: { size: 18, weight: '600' as const },
    profileMeta: { size: 14, weight: '400' as const },
    badge: { size: 11, weight: '700' as const },
    sheetTitle: { size: 20, weight: '700' as const },
  },
} as const

export type SettingsTheme = typeof settingsTheme
