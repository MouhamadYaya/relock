import { OB } from '@/features/onboarding/tokens'

/**
 * Le paywall parle la langue de l'onboarding — littéralement.
 *
 * Ce fichier ne réinvente PAS de palette : il prend `OB` (les jetons validés
 * écran par écran de l'onboarding) et ne lui ajoute que ce qu'un paywall
 * réclame en propre — les surfaces claires promotionnelles et le champ
 * violet de l'offre unique.
 *
 * Trois choses en découlent :
 *
 * 1. **Le violet n'est pas rationné.** L'onboarding le met dans le halo, les
 *    dégradés, les accents et les pilules ; le paywall fait pareil : fonds,
 *    titres, étoiles, bandeaux, blocs promotionnels. C'est la couleur de la
 *    marque, pas un badge de statut.
 *
 * 2. **La valeur s'inverse pour vendre.** L'onboarding le fait déjà :
 *    `ChoiceCard` sélectionnée et `Pill` primaire passent en fond CLAIR,
 *    texte sombre — « dans un univers sombre, le contraste maximal est la
 *    couleur ». Les panneaux promotionnels du paywall reprennent ce geste.
 *
 * 3. **Les proportions viennent des références, pas d'une règle.** Il n'y a
 *    pas une hauteur de CTA unique : le principal reprend les 58 pt de la
 *    pilule d'onboarding, le secondaire bordé est plus court, et le bouton
 *    d'une feuille n'a pas la métrique d'un bouton de page.
 *
 * Contrastes vérifiés (WCAG 2.1, luminance relative) :
 * `ink` 17.8:1 · `inkMuted` 12.4:1 · `inkFaint` 8.2:1 sur `canvas` ·
 * `onAccent` sur `accent` 7.7:1 · blanc sur `violetDeep` 5.6:1 ·
 * `paperInk` sur `paper` 16.4:1 · `paperMuted` sur `paper` 6.0:1 ·
 * blanc sur `fieldTop` 11.5:1.
 */
export const PW = {
  color: {
    // ── Repris tels quels de l'onboarding ──────────────────────────────
    canvas: OB.bg,
    surface: OB.card,
    surfaceRaised: OB.card2,
    ink: OB.ink,
    inkMuted: OB.ink70,
    inkFaint: OB.ink55,
    inkGhost: OB.ink28,
    hairline: OB.hairline,
    /** La lavande de la marque. Elle a le droit d'être partout. */
    accent: OB.accent,
    /** Sur un aplat lavande, l'encre est sombre — comme la pilule d'onboarding. */
    onAccent: OB.onAccent,
    accentDim: OB.accentDim,
    /** Cœur du halo « projecteur ». */
    halo: OB.halo,
    /** Dégradé signature : lavande → lilas clair → bleu glacier. */
    grad: OB.grad,

    // ── Ajouts propres au paywall ──────────────────────────────────────
    /**
     * Violet assez profond pour porter du texte blanc, et assez saturé pour
     * se lire comme violet sur une surface claire — la lavande `accent`,
     * elle, disparaît sur `paper`.
     */
    violetDeep: '#6B4BE0',
    violetInk: '#7A5BF0',

    /**
     * Le champ violet de l'offre unique. Trois arrêts : la référence
     * concurrente pose un aplat violet vif plein écran ; Relock le décline
     * en nuit violette, ce que son halo d'onboarding annonce déjà.
     */
    fieldTop: '#3B2C74',
    fieldMid: '#2A2054',
    fieldBottom: '#171232',

    /** Les grandes surfaces claires : panneau de remise, feuille d'offre. */
    paper: '#F3F1FA',
    paperInk: '#141220',
    paperMuted: '#5A5670',
    paperEdge: 'rgba(20, 18, 32, 0.10)',

    onViolet: '#FFFFFF',
    control: 'rgba(255, 255, 255, 0.22)',
    /**
     * Voile de la feuille d'offre. CLAIR volontairement : la référence
     * laisse l'écran derrière parfaitement lisible, et c'est ce qui fait
     * comprendre que l'offre arrive PAR-DESSUS une page qu'on connaît.
     */
    scrim: 'rgba(6, 5, 12, 0.55)',
    shadow: '#000000',
    transparent: 'rgba(0, 0, 0, 0)',
  },

  /** Famille de rayons alignée sur l'onboarding (pilule 29, visuel 28). */
  radius: { xs: 8, sm: 12, md: 18, lg: 24, xl: 30, capsule: 999 },

  /** Grille de 8 (les demi-pas de 4 servent aux interlignes serrés). */
  space: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    section: 32,
  },

  layout: {
    maxWidth: 540,
    page: 20,
    touch: 44,
    /** Le CTA principal reprend la pilule d'onboarding. */
    button: 58,
    compactButton: 52,
    /** Le refus bordé est volontairement plus court que l'action. */
    buttonSecondary: 52,
    compactButtonSecondary: 46,
    wordmark: 20,
    icon: 20,
    check: 26,
    /** Sous cette hauteur de fenêtre, la déclinaison compacte prend le relais. */
    compactHeight: 780,

    // Écran « Formules » : la grille 2 × 2 occupe le premier tiers, comme la
    // référence. C'est le SEUL bloc élastique de l'écran — sur un appareil
    // court, la décoration cède, le prix ne bouge pas.
    tileGap: 8,
    tiles: 216,
    minTiles: 148,
    maxTiles: 244,

    // Écran « Avant / Après ».
    comparison: 110,
    compactComparison: 84,
    chart: 44,
    compactChart: 34,
    benefitThumb: 58,
    compactBenefitThumb: 50,
    divider: 1,

    // Écran « Offre unique » : le panneau clair EST le point focal.
    promo: 196,
    compactPromo: 152,
    sparkle: 15,
    moonMotif: 132,
    mark: 64,
    sheetGrip: 40,
    star: 14,
    starGap: 3,
    ribbon: 28,
    planBody: 64,
    compactPlanBody: 56,
    hairline: 1,
    /** Le ruban promotionnel qui chevauche le bord haut de la feuille. */
    banner: 44,
    bannerTilt: '-4deg',
  },

  text: {
    /** Le chiffre qui décide : une remise, rien d'autre. */
    display: 76,
    displayLine: 80,
    compactDisplay: 60,
    compactDisplayLine: 64,

    h1: 34,
    h1Line: 40,
    compactH1: 28,
    compactH1Line: 34,

    h2: 26,
    h2Line: 32,
    compactH2: 22,
    compactH2Line: 27,

    /** Le chiffre héros des données (6h 32m) et les prix. */
    figure: 44,
    figureLine: 50,
    compactFigure: 34,
    compactFigureLine: 40,

    price: 34,
    priceLine: 40,
    compactPrice: 28,
    compactPriceLine: 34,

    body: 16,
    bodyLine: 23,
    compactBody: 15,
    compactBodyLine: 21,

    caption: 14,
    captionLine: 20,
    compactCaption: 13,
    compactCaptionLine: 18,

    fine: 13,
    fineLine: 18,
    compactFine: 12,
    compactFineLine: 16,

    button: 17,
    eyebrow: 13,
    eyebrowLine: 18,

    /** L'unité accompagne le montant : même graisse, jamais sa taille. */
    unit: 16,
    compactUnit: 14,

    tracking: 1.6,
    trackingWide: 2.4,
    tight: -0.6,
    tighter: -1.4,
  },

  shadow: {
    /** Décolle la feuille modale de la page assombrie. */
    sheet: {
      elevation: 14,
      shadowColor: '#000000',
      shadowOpacity: 0.55,
      shadowRadius: 30,
      shadowOffset: { width: 0, height: -10 },
    },
    /** Le ruban flottant du haut de feuille. */
    banner: {
      elevation: 8,
      shadowColor: '#000000',
      shadowOpacity: 0.35,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
    },
    /** Le panneau clair de l'offre unique, posé sur le champ violet. */
    promo: {
      elevation: 10,
      shadowColor: '#0B0718',
      shadowOpacity: 0.4,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
    },
  },

  opacity: { grain: 0.03, disabled: 0.5, motif: 0.28, sparkle: 0.9 },
  motion: { enter: 260, exit: 180 },
} as const
