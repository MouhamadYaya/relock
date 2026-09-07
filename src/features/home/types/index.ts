export interface HomeScores {
  focus: number | null
  rest: number | null
  global: number | null
  available: boolean
}

/** Confiance du score. `pending` = absence de score, pas un score bas. */
export type HomeScoreStatus = 'pending' | 'provisional' | 'ready'

/** L'axe le plus faible du jour, utilisé pour formuler l'encouragement. */
export type HomeScoreAxis = 'focus' | 'rest'

/**
 * Les six mesures qui composent le score. Chacune vient d'une donnée que
 * Relock observe réellement — aucune n'est une constante de design.
 *
 * - `pressure`   : tentatives d'ouverture d'apps bloquées, vs ta médiane
 * - `resistance` : part de ces tentatives où tu as explicitement renoncé
 * - `breaches`   : apps rouvertes par un sursis, donc protection contournée
 * - `coverage`   : part de la journée écoulée passée sous protection
 * - `regularity` : jours protégés sur les sept derniers
 * - `quota`      : avancement des limites journalières, vs l'heure qu'il est
 */
export type HomeScoreSignal =
  | 'pressure'
  | 'resistance'
  | 'breaches'
  | 'coverage'
  | 'regularity'
  | 'quota'

/** Unité de la mesure brute, pour la rendre lisible sans la réinterpréter. */
export type HomeScoreUnit = 'count' | 'minutes' | 'percent'

/**
 * Une composante du score, avec la mesure qui l'a produite.
 *
 * `observed` et `reference` sont conservés exprès : la feuille de détail les
 * affiche tels quels (« 12 tentatives, ta normale : 18 »). Un score qu'on ne
 * peut pas relier à un chiffre observable est indiscernable d'un chiffre
 * inventé — c'est précisément ce qu'on veut éviter.
 */
export interface HomeScoreComponent {
  signal: HomeScoreSignal
  axis: HomeScoreAxis
  /** Note 0-100 de cette seule composante. */
  score: number
  /** Poids dans son axe, avant redistribution des composantes absentes. */
  weight: number
  /** Mesure du jour, dans l'unité de la composante. */
  observed: number
  /** Repère auquel elle est comparée. `null` quand il n'y en a pas. */
  reference: number | null
  unit: HomeScoreUnit
}

/** Un jour noté : sert à tracer la tendance sous le score. */
export interface HomeScoreDay {
  /** Date locale « YYYY-MM-DD ». */
  date: string
  score: number | null
}

/** Score d'Accueil, calculé sur les données réelles du compte. */
export interface HomeScoreSnapshot {
  status: HomeScoreStatus
  global: number | null
  focus: number | null
  rest: number | null
  /** Écart avec le score d'hier ; `null` tant qu'hier n'est pas mesuré. */
  delta: number | null
  weakestAxis: HomeScoreAxis
  /** Jours complets ayant servi de référence : pilote la confiance. */
  historyDays: number
  /** 0 → 1. En dessous de 1, le score est tiré vers la neutralité. */
  confidence: number
  /** Les composantes retenues, celles qui manquaient étant absentes. */
  components: HomeScoreComponent[]
  /** Les sept derniers jours, du plus ancien au plus récent (aujourd'hui inclus). */
  trend: HomeScoreDay[]
  /** Minutes écoulées depuis minuit au moment du calcul. */
  elapsedMinutes: number
  /** Minutes de la journée déjà passées sous protection. */
  protectedMinutes: number
}

/** Palier qualitatif d'un score : `unknown` quand aucune valeur fiable n'existe. */
export type HomeScoreBand = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'

export type HomeDashboardState =
  | 'loading'
  | 'ready'
  | 'permissionMissing'
  | 'unavailable'
  | 'error'
