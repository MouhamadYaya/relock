import { OB } from '@/features/onboarding/tokens'

/**
 * Le paywall parle la langue de l'onboarding — littéralement.
 *
 * Ce fichier ne réinvente PAS de palette : il prend `OB` (les jetons validés
 * écran par écran de l'onboarding) et ne lui ajoute que ce qu'un paywall
 * réclame en propre — les surfaces promotionnelles et le champ violet de
 * l'offre unique.
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
 *    couleur ». Les panneaux promotionnels du paywall reprennent ce
 *    geste — mais en VIOLET ÉCLAIRÉ, pas en blanc : un aplat quasi blanc
 *    plein cadre, au milieu d'un parcours nocturne, éblouit. Voir `paper`.
 *
 * 3. **Les proportions viennent des références, pas d'une règle.** Il n'y a
 *    pas une hauteur de CTA unique : le principal reprend les 58 pt de la
 *    pilule d'onboarding, le secondaire bordé est plus court, et le bouton
 *    d'une feuille n'a pas la métrique d'un bouton de page.
 *
 * Contrastes vérifiés (WCAG 2.1, luminance relative) :
 * `ink` 17.8:1 · `inkMuted` 12.4:1 · `inkFaint` 8.2:1 sur `canvas` ·
 * `onAccent` sur `accent` 7.7:1 · blanc sur `violetDeep` 5.6:1 ·
 * `paperInk` sur `paper` 16.6:1 · `paperMuted` sur `paper` 7.6:1 ·
 * `paperAccent` sur `paper` 7.5:1 · `violetDeep` (fond de CTA) sur `paper`
 * 3.2:1 · blanc sur `fieldTop` 11.5:1.
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
    /** Le pied du dégradé de la coque choisie. */
    violetShade: '#4C36A8',

    /**
     * Le champ violet de l'offre unique. Trois arrêts : la référence
     * concurrente pose un aplat violet vif plein écran ; Relock le décline
     * en nuit violette, ce que son halo d'onboarding annonce déjà.
     */
    fieldTop: '#3B2C74',
    fieldMid: '#2A2054',
    fieldBottom: '#171232',

    /**
     * La surface des grands panneaux promotionnels : feuille d'offre, bloc
     * de remise. Elle a longtemps été un aplat quasi blanc ; dans un
     * parcours entièrement nocturne, ce mur de lumière éblouissait au lieu
     * de guider — la feuille d'offre arrivait comme une lampe allumée en
     * pleine nuit.
     *
     * Elle est donc devenue une NUIT VIOLETTE : assez claire pour se lire
     * comme un plan posé AU-DESSUS du fond (`canvas`, quasi noir), assez
     * sombre pour ne plus brûler. À 1.1:1 du fond, la valeur seule ne fait
     * plus la séparation — ce sont le liseré (`paperEdge`) et les ombres
     * violettes qui la portent, et c'est délibéré : plus bas, il faudrait
     * choisir entre une surface qui brille et une surface qui disparaît. L'inversion de valeur n'est pas perdue,
     * elle change de registre — « violet éclairé sur noir » plutôt que
     * « blanc sur noir », ce que le halo d'onboarding annonce déjà.
     */
    paper: '#14112B',
    paperInk: '#F4F2FF',
    paperMuted: '#A8A2C6',
    /**
     * Le liseré monte à mesure que la surface descend : plus `paper`
     * s'approche de `canvas`, moins la valeur suffit à dire « ceci est un
     * autre plan », et plus c'est l'arête qui doit le dire.
     */
    paperEdge: 'rgba(255, 255, 255, 0.12)',
    /**
     * Le violet LISIBLE sur `paper`. `violetDeep` est fait pour porter du
     * blanc en fond de bouton ; posé en TEXTE sur la nuit violette il
     * s'éteint (1.4:1). Les titres, chiffres et étoiles violets des
     * panneaux prennent donc la lavande de la marque.
     */
    paperAccent: OB.accent,

    /**
     * Les deux liserés des cartes sombres. Le HAUT est deux fois plus clair
     * que les trois autres côtés : sur du quasi-noir, c'est ce déséquilibre
     * qui simule une lumière tombant d'en haut et creuse le relief. Une
     * bordure uniforme laisse la carte plate, quelle que soit sa couleur.
     */
    edgeTop: 'rgba(255, 255, 255, 0.10)',
    edge: 'rgba(255, 255, 255, 0.05)',
    /** Le pied du violet éteint : la coque d'une formule non sélectionnée. */
    violetMuted: '#221E3A',

    onViolet: '#FFFFFF',
    control: 'rgba(255, 255, 255, 0.22)',
    /**
     * Voile de la feuille d'offre. La page derrière doit rester LISIBLE —
     * c'est ce qui fait comprendre que l'offre arrive par-dessus une page
     * qu'on connaît — mais il est plus dense qu'au temps de la feuille
     * claire : deux plans sombres ne se séparent que si celui du dessous
     * s'efface.
     */
    scrim: 'rgba(6, 5, 12, 0.72)',
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

    // Écran « Formules ». La bande du haut est le SEUL bloc élastique : tous
    // les autres écarts sont écrits en dur, donc c'est elle qui absorbe la
    // hauteur en trop. L'ancienne version répartissait ce rab également entre
    // tous les blocs (`space-between`) et creusait ~50 pt de vide partout, y
    // compris entre le titre et le prix.
    marqueeGap: 8,
    /** L'écart VERTICAL entre rangées, plus serré que l'horizontal. */
    marqueeRowGap: 6,
    /**
     * Une carte respire : 10 de rembourrage + 22 de pictogramme + 6 + 18 de
     * libellé + 10 = 66 pt de contenu, la mesure de la référence.
     *
     * La borne basse tient ce compte pour trois rangées (3 × 66 + 2 × 6) et
     * elle ne se négocie pas : sous 210, le rembourrage se fait écraser et
     * les cartes redeviennent plates. C'est le RESTE de l'écran qui a été
     * resserré pour financer les 59 pt rendus à la barre d'état, puis l'air
     * ajouté autour des deux formules.
     */
    marqueeMin: 210,
    marqueeMax: 250,
    marqueeCardPad: 18,
    /** Largeur plancher : « Créer » doit peser autant que « Se retrouver ». */
    marqueeCard: 108,
    marqueeIcon: 22,
    /** La coque qui réunit le ruban et la carte en un seul objet. */
    shellPad: 4,
    shellRibbon: 20,

    // Écran « Avant / Après ». Une carte, deux panneaux, deux graphes lus
    // sur la MÊME échelle : c'est la carte qui tient la comparaison, plus
    // deux blocs posés côte à côte.
    comparisonPad: 12,
    panelPad: 12,
    panelGap: 10,
    chart: 78,
    compactChart: 62,
    /** La bande des initiales de jours, sous la ligne de base. */
    chartAxis: 16,
    /**
     * Largeur d'une barre, en fraction de son pas. Une largeur en points
     * laisserait le graphe flotter dans son panneau sur grand écran et
     * déborder sur petit — c'est le pas qui se mesure, la barre suit.
     */
    barFill: 0.42,
    barRadius: 3,
    /** Le pictogramme d'un bénéfice — plus de vignette photo ici. */
    benefitIcon: 26,
    compactBenefitIcon: 23,
    /** La rangée des marques universitaires. */
    trustLogo: 30,
    compactTrustLogo: 25,
    divider: 1,

    // Écran « Offre unique » : le panneau de remise EST le point focal.
    promo: 196,
    compactPromo: 152,
    sparkle: 15,
    moonMotif: 132,
    mark: 64,
    sheetGrip: 40,
    star: 14,
    starGap: 3,
    ribbon: 28,
    planBody: 62,
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

    /**
     * Le même chiffre, mais DANS la carte de comparaison : deux colonnes et
     * deux marges plus loin, il ne reste que ~150 pt de large. À 44 pt,
     * « 6h 32m » se faisait rétrécir par `adjustsFontSizeToFit` — autant
     * écrire la taille qui tient.
     */
    cardFigure: 30,
    cardFigureLine: 36,
    compactCardFigure: 25,
    compactCardFigureLine: 30,

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
    /**
     * Le halo violet : sous une carte allumée de la bande, et sous la formule
     * sélectionnée. C'est ce qui les décolle d'un cran du fond au lieu de les
     * y coller — une carte violette posée à plat sur du noir fait autocollant.
     */
    lift: {
      elevation: 8,
      shadowColor: '#A49AFE',
      shadowOpacity: 0.25,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
    },
    /**
     * Le halo de la formule choisie. Nettement plus court et plus discret que
     * `lift` : la carte annuelle porte DÉJÀ une coque violette pleine, donc
     * un halo large par-dessus faisait déborder la couleur bien au-delà de la
     * carte. La formule hebdomadaire, elle, n'a que sa bordure — c'est
     * pourquoi le même halo y tombait juste.
     */
    select: {
      elevation: 4,
      shadowColor: '#A49AFE',
      shadowOpacity: 0.13,
      shadowRadius: 11,
      shadowOffset: { width: 0, height: 4 },
    },
    liftSoft: {
      elevation: 6,
      shadowColor: '#A49AFE',
      shadowOpacity: 0.22,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 6 },
    },
    /**
     * Le panneau de remise de l'offre unique. Une ombre NOIRE le décollait
     * quand il était blanc ; posé en nuit violette sur un fond quasi noir,
     * elle ne produit plus rien — noir sur noir. C'est donc un halo violet
     * qui le soulève, comme les cartes allumées de la bande.
     */
    promo: {
      elevation: 10,
      shadowColor: '#A49AFE',
      shadowOpacity: 0.34,
      shadowRadius: 28,
      shadowOffset: { width: 0, height: 10 },
    },
  },

  opacity: {
    grain: 0.03,
    disabled: 0.5,
    motif: 0.28,
    sparkle: 0.9,
    /** Les marques universitaires : présentes, jamais concurrentes du CTA. */
    trust: 0.55,
  },
  motion: { enter: 260, exit: 180 },
} as const
