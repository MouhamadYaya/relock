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
