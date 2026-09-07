import { trigger } from 'react-native-haptic-feedback'

/**
 * Direction artistique de l'onboarding — validée écran par écran :
 * fond noir profond, halo violet « projecteur » en haut, et le dégradé
 * signature réservé aux héros (chiffres, mots-clés, liserés). La rareté
 * du dégradé fait le premium — jamais en fond plein écran.
 *
 * Palette volontairement locale : l'onboarding est un espace narratif à
 * part, plus sombre que l'app (exception documentée aux theme tokens).
 */
export const RECOGNITION = {
  moonSize: 88,
  introSize: 26,
  introLineHeight: 34,
  titleSize: 36,
  titleLineHeight: 44,
  questionSize: 17,
  questionLineHeight: 24,
  revealDuration: 500,
  // Intro, looking up, elapsed time, question, then time to read before the CTA.
  readingDelays: [200, 1100, 800, 1000, 900],
} as const

/** Bounded decorative segments for the annual projection. */
export const PROJECTION_MAX_BARS = 14

export const GOOD_NEWS = {
  leadSize: 22,
  leadLineHeight: 30,
} as const

export const VICTORY = {
  moonSize: 152,
  compactMoonSize: 120,
  compactHeight: 740,
  titleSize: 38,
  titleLineHeight: 46,
  bodySize: 18,
  bodyLineHeight: 27,
  captionSize: 14,
  captionLineHeight: 21,
  iconSize: 20,
  maxWidth: 440,
} as const

export const PERSONALIZED_PLAN = {
  titleSize: 32,
  titleLineHeight: 39,
  compactTitleSize: 28,
  compactTitleLineHeight: 34,
  compactHeight: 740,
  bodySize: 17,
  bodyLineHeight: 25,
  captionSize: 13,
  captionLineHeight: 19,
  iconSize: 22,
  revealDuration: 450,
  // Un temps par bloc révélé de l'écran de plan : titre, écho des réponses,
  // objectif, réflexes, note finale. Ajouter un bloc SANS ajouter un délai ici
  // laisserait le CTA définitivement désactivé (`revealed` compare à cette
  // longueur) — et en ajouter un sans place dans le budget de `PLAN_SUMMARY`
  // repousserait du contenu sous la ligne de flottaison.
  readingDelays: [200, 850, 950, 900, 800],
} as const

/**
 * Maquette de l'écran « Ton plan est prêt » — pensée pour tenir SANS SCROLL,
 * sur tous les iPhone supportés.
 *
 * Les valeurs sont celles de la maquette de RÉFÉRENCE (iPhone 14 : 844pt
 * d'écran, dont 751 réellement offerts à la scène une fois les encoches et
 * les marges du conteneur retirées). À l'exécution, tout est multiplié par
 * `hauteur disponible / referenceHeight`, borné entre `minScale` et
 * `maxScale` : la composition garde ses proportions au lieu de basculer d'un
 * palier « compact » à un autre, et l'iPhone SE reçoit le même dessin en plus
 * serré.
 *
 * ⚠️ BUDGET VERTICAL de la référence, PIRE CAS (chaque texte à la limite de
 * son `numberOfLines`, résumé d'objectif sur deux lignes) :
 *
 *   marge haute            6
 *   en-tête              120   (badge 38 + 10 + titre 2×36)
 *   écho                 104   (surtitre 15 + 5 + texte 4×21)
 *   carte objectif       193   (36 de padding + 2 de liseré + 15 + 3×4
 *                               + 48 de chiffre + 2×23 + 2×17)
 *   réflexes              76   (tuile 36 + 8 + libellé 2×16)
 *   note finale           68   (4×17)
 *   4 écarts de 18        72
 *   pied (16 + pilule 58) 74
 *   ------------------------
 *   total                713  ≤ 751 ✓
 *
 * Toute ligne AJOUTÉE ici doit être réintégrée à ce calcul : c'est lui, et
 * rien d'autre, qui garantit qu'aucun contenu ne tombe hors de l'écran — et
 * `ScenePersonalizedPlan.test.tsx` refait la somme à chaque exécution.
 */
export const PLAN_SUMMARY = {
  /** Hauteur offerte à la scène sur la maquette de référence. */
  referenceHeight: 751,
  /** Marges que `OnboardingFlow` ajoute autour de la scène (6 + 6). */
  chrome: 12,
  minScale: 0.84,
  maxScale: 1.06,
  maxWidth: 440,
  screenPaddingH: 24,
  screenPaddingTop: 6,
  gap: 18,
  // En-tête
  badgeSize: 38,
  badgeIconSize: 20,
  headingGap: 10,
  titleSize: 29,
  titleLineHeight: 36,
  // Écho des réponses
  eyebrowSize: 11,
  eyebrowLineHeight: 15,
  eyebrowTracking: 1.1,
  quoteRuleWidth: 2.5,
  quoteGap: 13,
  echoGap: 5,
  echoSize: 15,
  echoLineHeight: 21,
  echoLines: 4,
  // Carte objectif
  cardPadding: 18,
  cardGap: 4,
  goalSize: 38,
  goalSummarySize: 17,
  goalSummaryLineHeight: 23,
  goalSummaryLines: 2,
  noteSize: 12.5,
  noteLineHeight: 17,
  // Bande des trois réflexes
  tileSize: 36,
  tileIconSize: 19,
  tileGap: 8,
  tileLabelSize: 12,
  tileLabelLineHeight: 16,
  // Note finale + pied
  footnoteLines: 4,
  footerGap: 16,
  /**
   * Un écran sans scroll ne peut pas absorber les tailles d'accessibilité les
   * plus hautes : on borne le grossissement plutôt que de laisser le contenu
   * déborder hors de l'écran, sans recours.
   */
  maxFontScale: 1.2,
} as const

export const PLAN_PREPARATION = {
  duration: 4200,
  completionHold: 650,
  tick: 50,
  percentageSize: 76,
  percentageLineHeight: 91,
  trackHeight: 7,
} as const

export const OB = {
  bg: '#050507',
  ink: '#F5F5F7',
  ink70: 'rgba(245,245,247,0.72)',
  ink55: 'rgba(235,235,245,0.55)',
  ink40: 'rgba(235,235,245,0.40)',
  ink28: 'rgba(235,235,245,0.28)',
  card: '#151517',
  card2: '#1C1C1E',
  hairline: 'rgba(255,255,255,0.08)',
  accent: '#A49AFE',
  onAccent: '#131318',
  accentDim: 'rgba(164,154,254,0.16)',
  danger: '#F87171',
  dangerBg: 'rgba(239,68,68,0.10)',
  dangerBorder: 'rgba(248,113,113,0.38)',
  /** Dégradé signature : lavande → lilas clair → bleu glacier. */
  grad: ['#A49AFE', '#C9BFFF', '#8FD4EC'] as const,
  /** Cœur du halo « projecteur » (fondu vers le fond). */
  halo: '#2A2547',
} as const

/**
 * Marge horizontale des cadres-guide de permission, mesurée sur les
 * références 390 pt.
 */
export const GUIDE_SCENE_PADDING = 37

/**
 * Écart horizontal entre le contour lumineux et la fausse alerte.
 */
export const GUIDE_FRAME_GAP = 20

/** Marge latérale du contenu inférieur, plus large que le cadre-guide. */
export const GUIDE_BOTTOM_PADDING = 27

/** Ratios largeur/hauteur mesurés sur les deux références de permission. */
export const GUIDE_FRAME_ASPECT_RATIO = {
  permission: 1.153,
  notifications: 1.105,
} as const

/**
 * Géométrie de l'alerte système iOS (`UIAlertController`, style `.alert`)
 * qui apparaît réellement après le tap, centrée à l'écran.
 *
 * ⚠️ Ces chiffres ont changé avec iOS 26 (matériau « Liquid Glass ») : la
 * valeur historique de 270pt (stable depuis iOS 7, largement documentée
 * par la communauté avant iOS 26) NE tient plus. Mesure DIRECTE, au pixel,
 * sur une capture réelle du simulateur iPhone 17 Pro Max / iOS 26 — le
 * dialogue système « notifications » apparu par-dessus cet écran pendant
 * les tests (fichier `dialog-crop.png`, script d'analyse par balayage de
 * luminosité + détection des glyphes « Refuser »/« Autoriser ») :
 * - largeur de l'alerte : ≈ 319pt (bords nets détectés par contraste,
 *   pas ≈270pt).
 * - centre de chaque bouton : mesuré à ≈ 220 ± 74pt de l'axe horizontal
 *   de l'écran (là où l'ancienne valeur 270pt donnait ±67.5pt).
 * - centrage HORIZONTAL confirmé exact (le centre de l'alerte mesuré
 *   tombe à moins de 1pt du centre écran).
 * - centrage VERTICAL en revanche PAS confirmé sur cette capture : le
 *   centre de l'alerte est tombé à ≈66pt plus bas que le centre plein
 *   écran. Comme la hauteur dépend du texte affiché (donc du contenu, de
 *   la langue, de la taille de police système) et qu'aucune API publique
 *   n'expose la position réelle d'une UI de consentement système (choix
 *   délibéré d'Apple), l'axe vertical n'est PAS prédit ici — voir `dimmed`
 *   sur `GuideCard` : on efface la carte-guide plutôt que de deviner.
 *
 * Une seule mesure ne prouve pas que 319pt/±74pt est universel sur tous
 * les iPhone iOS 26 (contrairement à l'ancien 270pt, croisé sur de
 * nombreux appareils par la communauté avant le redesign) — à réviser si
 * une mesure sur un autre modèle diverge nettement.
 *
 * ⚠️ `GuideCard` n'utilise PLUS `width`/`buttonCenterOffset` directement :
 * la carte reste large (fidèle à la référence design, comme celle d'Opal),
 * et la flèche vise le centre RÉEL du bouton tel qu'il est affiché (calculé
 * depuis la géométrie de la carte elle-même, dans `bits.tsx`) plutôt qu'une
 * position absolue calquée sur l'alerte système. Ces chiffres restent ici
 * comme référence documentée — utile si une carte à la taille exacte de
 * l'alerte est retentée un jour.
 *
 * Sources complémentaires :
 * - HIG Apple (Alerts) : présentation centrée à l'écran (toujours valable).
 * - Capture réelle du dialogue Family Controls (crunchybagel.com, 2023) :
 *   confirme l'ordre Continue (GAUCHE) / Don't Allow (DROITE), inchangé.
 */
export const NATIVE_ALERT = {
  width: 319,
  buttonCenterOffset: 74,
} as const

const opts = {
  enableVibrateFallback: false,
  ignoreAndroidSystemSettings: false,
}

/**
 * Carte haptique de l'onboarding — léger à la sélection, moyen sur les
 * CTA, succès aux validations, ticks sur les compteurs, lourd sur le
 * rituel. Les vibrations portent la charge sensorielle (pas de son :
 * aucune dépendance audio autorisée).
 */
export const haptic = {
  select: () => trigger('impactLight', opts),
  tap: () => trigger('impactMedium', opts),
  heavy: () => trigger('impactHeavy', opts),
  success: () => trigger('notificationSuccess', opts),
  tick: () => trigger('selection', opts),
}
