import type {
  HomeScoreAxis,
  HomeScoreSnapshot,
  HomeScoreStatus,
} from '@/features/home/types'
import type { NativeHomeScore } from '@/shared/native/screen-time'

function validScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function boundedScore(value: number): number {
  return Math.min(Math.max(Math.round(value), 0), 100)
}

const STATUSES: readonly HomeScoreStatus[] = ['pending', 'provisional', 'ready']

/**
 * Traduit la charge brute du pont natif en instantané typé.
 *
 * Ne recalcule rien : le score est produit par l'extension, seule à voir les
 * mesures de Temps d'écran. Cette fonction ne fait que valider et refuser —
 * un statut `ready` sans chiffre est incohérent, on le rétrograde en `pending`
 * plutôt que d'afficher un score inventé.
 */
export function toHomeScoreSnapshot(
  payload: NativeHomeScore | null | undefined,
): HomeScoreSnapshot {
  const empty: HomeScoreSnapshot = {
    status: 'pending',
    global: null,
    focus: null,
    rest: null,
    delta: null,
    weakestAxis: 'focus',
    historyDays: 0,
  }
  if (!payload) return empty

  const status = STATUSES.includes(payload.status as HomeScoreStatus)
    ? (payload.status as HomeScoreStatus)
    : 'pending'
  const global = validScore(payload.global)
    ? boundedScore(payload.global)
    : null
  const focus = validScore(payload.focus) ? boundedScore(payload.focus) : null
  const rest = validScore(payload.rest) ? boundedScore(payload.rest) : null

  // Cohérence : sans chiffre il n'y a pas de score, quel que soit le statut
  // annoncé. On préfère « calcul en cours » à un affichage partiel.
  if (status === 'pending' || global === null) return empty

  const axis: HomeScoreAxis = payload.weakestAxis === 'rest' ? 'rest' : 'focus'
  return {
    status,
    global,
    focus,
    rest,
    delta: validScore(payload.delta) ? Math.round(payload.delta) : null,
    weakestAxis: axis,
    historyDays: validScore(payload.historyDays)
      ? Math.max(0, Math.round(payload.historyDays))
      : 0,
  }
}

/** 0 → 3 : à améliorer, moyen, bon, excellent. Mêmes bornes que l'extension. */
export function scoreBandRank(value: number): number {
  if (value >= 80) return 3
  if (value >= 60) return 2
  if (value >= 35) return 1
  return 0
}

const BAND_KEYS = [
  'home.score_band_poor',
  'home.score_band_fair',
  'home.score_band_good',
  'home.score_band_excellent',
] as const

const FOOTER_FOCUS_KEYS = [
  'home.score_footer_focus_poor',
  'home.score_footer_focus_fair',
  'home.score_footer_focus_good',
  'home.score_footer_focus_excellent',
] as const

const FOOTER_REST_KEYS = [
  'home.score_footer_rest_poor',
  'home.score_footer_rest_fair',
  'home.score_footer_rest_good',
  'home.score_footer_rest_excellent',
] as const

/** Clés littérales : `t()` n'accepte que des clés connues à la compilation. */
type BandKey = (typeof BAND_KEYS)[number] | 'home.score_calculating'
type FooterKey =
  | (typeof FOOTER_FOCUS_KEYS)[number]
  | (typeof FOOTER_REST_KEYS)[number]
  | 'home.score_footer_pending'
  | 'home.score_footer_provisional'

/** Palier affiché sous le chiffre, ou l'état d'attente quand il n'y a rien. */
export function scoreBandKey(snapshot: HomeScoreSnapshot): BandKey {
  if (snapshot.global === null) return 'home.score_calculating'
  return BAND_KEYS[scoreBandRank(snapshot.global)]
}

/**
 * Encouragement du pied de carte. Il nomme l'axe qui décroche : « c'est le
 * nombre de prises en main qui coince » est actionnable, « ton rythme est
 * sain » ne l'est pas.
 */
export function scoreFooterKey(snapshot: HomeScoreSnapshot): FooterKey {
  if (snapshot.global === null) return 'home.score_footer_pending'
  if (snapshot.status === 'provisional') return 'home.score_footer_provisional'
  const rank = scoreBandRank(snapshot.global)
  return snapshot.weakestAxis === 'rest'
    ? FOOTER_REST_KEYS[rank]
    : FOOTER_FOCUS_KEYS[rank]
}
