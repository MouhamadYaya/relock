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

/** Score d'Accueil tel que l'extension de rapport l'a calculé et déposé. */
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
}

/** Palier qualitatif d'un score : `unknown` quand aucune valeur fiable n'existe. */
export type HomeScoreBand = 'excellent' | 'good' | 'fair' | 'poor' | 'unknown'

export type HomeDashboardState =
  | 'loading'
  | 'ready'
  | 'permissionMissing'
  | 'unavailable'
  | 'error'
