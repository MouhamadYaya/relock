/**
 * Présentation du score : paliers, formulation de l'encouragement, et la
 * réduction en `HomeScores` que consomme la carte.
 *
 * Aucun calcul de note ici — tout vient de `score-engine.ts`. Ce module ne
 * fait que choisir les mots qui décrivent un chiffre déjà établi.
 */
import type {
  HomeScoreComponent,
  HomeScoreSignal,
  HomeScoreSnapshot,
  HomeScores,
} from '@/features/home/types'
import type { HomeReferenceFixture } from '@/shared/native/screen-time'

/** 0 → 3 : à améliorer, moyen, bon, excellent. */
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

/** Une clé par signal : l'encouragement nomme la mesure qui décroche. */
const WEAK_KEYS = {
  pressure: 'home.score_weak_pressure',
  resistance: 'home.score_weak_resistance',
  breaches: 'home.score_weak_breaches',
  coverage: 'home.score_weak_coverage',
  regularity: 'home.score_weak_regularity',
  quota: 'home.score_weak_quota',
} as const satisfies Record<HomeScoreSignal, string>

/** Clés littérales : `t()` n'accepte que des clés connues à la compilation. */
type BandKey = (typeof BAND_KEYS)[number] | 'home.score_calculating'
type FooterKey =
  | (typeof WEAK_KEYS)[HomeScoreSignal]
  | 'home.score_footer_pending'
  | 'home.score_footer_provisional'
  | 'home.score_footer_excellent'

/** Palier affiché sous le chiffre, ou l'état d'attente quand il n'y a rien. */
export function scoreBandKey(snapshot: HomeScoreSnapshot): BandKey {
  if (snapshot.global === null) return 'home.score_calculating'
  return BAND_KEYS[scoreBandRank(snapshot.global)]
}

/**
 * La composante la plus faible du jour, pondération comprise.
 *
 * Le poids entre dans le tri : une régularité à 40 pèse plus lourd sur le
 * score qu'une brèche à 30, et c'est donc elle qu'il faut nommer. Nommer la
 * note la plus basse dans l'absolu enverrait régulièrement l'utilisateur
 * corriger ce qui ne changera presque rien.
 */
export function weakestComponent(
  snapshot: HomeScoreSnapshot,
): HomeScoreComponent | null {
  if (snapshot.components.length === 0) return null
  return snapshot.components.reduce((weakest, component) =>
    (100 - component.score) * component.weight >
    (100 - weakest.score) * weakest.weight
      ? component
      : weakest,
  )
}

/**
 * Encouragement du pied de carte. Il nomme ce qui coince : « c'est le nombre
 * de tentatives qui décroche » est actionnable, « ton rythme est sain » ne
 * l'est pas.
 */
export function scoreFooterKey(snapshot: HomeScoreSnapshot): FooterKey {
  if (snapshot.global === null) return 'home.score_footer_pending'
  if (snapshot.status === 'provisional') return 'home.score_footer_provisional'
  const weakest = weakestComponent(snapshot)
  if (!weakest || snapshot.global >= 80) return 'home.score_footer_excellent'
  return WEAK_KEYS[weakest.signal]
}

/** Réduction consommée par la carte : trois chiffres et leur disponibilité. */
export function toHomeScores(snapshot: HomeScoreSnapshot): HomeScores {
  return {
    focus: snapshot.focus,
    rest: snapshot.rest,
    global: snapshot.global,
    available: snapshot.global !== null,
  }
}

/**
 * Snapshot figé de la fixture de référence (DEBUG uniquement).
 *
 * Les captures de comparaison ont besoin d'un écran identique d'un lancement à
 * l'autre : un score calculé sur des données réelles bougerait à chaque
 * exécution. La fixture remplace donc le snapshot ENTIER, pas seulement les
 * deux chiffres de la carte — sinon la carte et la feuille de détail
 * afficheraient de nouveau deux vérités différentes, ce que ce module existe
 * précisément pour empêcher.
 */
export function fixtureSnapshot(
  fixture: HomeReferenceFixture,
  now: Date,
): HomeScoreSnapshot {
  const global = Math.round((fixture.focusScore + fixture.restScore) / 2)
  return {
    status: 'ready',
    global,
    focus: fixture.focusScore,
    rest: fixture.restScore,
    delta: null,
    weakestAxis: fixture.restScore < fixture.focusScore ? 'rest' : 'focus',
    historyDays: 14,
    confidence: 1,
    components: [],
    trend: [],
    elapsedMinutes: now.getHours() * 60 + now.getMinutes(),
    protectedMinutes: 0,
  }
}
