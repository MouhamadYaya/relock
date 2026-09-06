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
  successSize: 40,
  iconSize: 22,
  goalSize: 30,
  revealDuration: 450,
  readingDelays: [200, 800, 1000, 1000, 1000],
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
