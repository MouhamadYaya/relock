/**
 * Fatigue — un SCORE, pas une règle binaire.
 *
 * « Trois notifications non ouvertes ⇒ on divise la cadence » se trompe de
 * signal. Un bilan hebdomadaire lu dans la bannière, apprécié, puis balayé sans
 * tap est un succès produit — et serait compté comme un échec. À l'inverse,
 * quelqu'un qui ouvre Relock dans l'heure qui suit chaque notification les
 * trouve manifestement utiles, même sans jamais toucher la bannière.
 *
 * On agrège donc plusieurs preuves d'utilité, positives et négatives, et on ne
 * ralentit que lorsque le faisceau devient franchement mauvais.
 */
import type { NotifFamily } from '@/features/notifications/types'
import type { NotifEngineState } from './state'

export type FatigueSignal =
  /** Tap sur la notification — la preuve la plus forte. */
  | 'tap'
  /** Ouverture de Relock dans l'heure qui suit une livraison. */
  | 'openAfterNotif'
  /** Action réellement faite sur l'écran d'arrivée (blocage armé, offre vue…). */
  | 'cta'
  /** Aucune ouverture de l'app pendant 24 h. */
  | 'idleDay'
  /** Trois notifications d'affilée sans la moindre interaction. */
  | 'silentRun'

const WEIGHTS: Record<FatigueSignal, number> = {
  tap: 3,
  openAfterNotif: 1,
  cta: 4,
  idleDay: -1,
  silentRun: -2,
}

/**
 * Bornes. Le plancher évite qu'une longue absence rende une famille
 * définitivement irrécupérable ; le plafond évite qu'un enthousiasme passé
 * achète des semaines d'indulgence.
 */
const MIN_SCORE = -12
const MAX_SCORE = 20

/** En dessous, la cadence est divisée par deux pour cette famille. */
const SLOWDOWN_THRESHOLD = -4

/** Notifications sans interaction avant de compter un `silentRun`. */
const SILENT_RUN_LENGTH = 3

const DAY_MS = 86_400_000

const clamp = (value: number): number =>
  Math.max(MIN_SCORE, Math.min(MAX_SCORE, value))

export function familyFatigue(
  state: NotifEngineState,
  family: NotifFamily,
): number {
  return state.fatigue[family] ?? 0
}

/**
 * Facteur appliqué au cooldown et au quota hebdomadaire d'une famille.
 * 1 = cadence nominale, 2 = deux fois moins souvent.
 */
export function cadenceFactor(
  state: NotifEngineState,
  family: NotifFamily,
): number {
  return familyFatigue(state, family) <= SLOWDOWN_THRESHOLD ? 2 : 1
}

export function isFatigued(
  state: NotifEngineState,
  family: NotifFamily,
): boolean {
  return cadenceFactor(state, family) > 1
}

/** Applique un signal. Pur : rend un nouvel état. */
export function applyFatigueSignal(
  state: NotifEngineState,
  family: NotifFamily,
  signal: FatigueSignal,
): NotifEngineState {
  return {
    ...state,
    fatigue: {
      ...state.fatigue,
      [family]: clamp(familyFatigue(state, family) + WEIGHTS[signal]),
    },
  }
}

/**
 * Une notification vient d'être livrée sans interaction connue.
 * Au troisième d'affilée, on encaisse le malus et on repart de zéro — sinon
 * une longue absence creuserait le score indéfiniment sur un seul événement.
 */
export function noteDelivered(
  state: NotifEngineState,
  family: NotifFamily,
): NotifEngineState {
  const run = (state.silentStreak[family] ?? 0) + 1
  if (run < SILENT_RUN_LENGTH) {
    return { ...state, silentStreak: { ...state.silentStreak, [family]: run } }
  }
  const penalised = applyFatigueSignal(state, family, 'silentRun')
  return {
    ...penalised,
    silentStreak: { ...penalised.silentStreak, [family]: 0 },
  }
}

/** Toute interaction remet la série silencieuse à zéro et crédite le score. */
export function noteInteraction(
  state: NotifEngineState,
  family: NotifFamily,
  signal: Extract<FatigueSignal, 'tap' | 'openAfterNotif' | 'cta'>,
): NotifEngineState {
  const credited = applyFatigueSignal(state, family, signal)
  return {
    ...credited,
    silentStreak: { ...credited.silentStreak, [family]: 0 },
  }
}

/**
 * Crédite l'ACTION réellement faite après un tap : un blocage armé dans
 * l'heure qui suit. C'est le signal le plus fort du modèle — plus fort que le
 * tap lui-même, qui ne prouve que la curiosité.
 *
 * Hors fenêtre, on ne crédite rien : quelqu'un qui arme un blocage trois jours
 * plus tard le fait pour lui, pas parce qu'on le lui a rappelé.
 */
export function creditActionAfterTap(
  state: NotifEngineState,
  now: number,
  windowMs = 3_600_000,
): NotifEngineState {
  const tap = state.lastTap
  if (!tap || now - tap.at > windowMs) return state
  return {
    ...applyFatigueSignal(state, tap.family as NotifFamily, 'cta'),
    lastTap: null,
  }
}

/**
 * Décroissance quotidienne : chaque tranche de 24 h sans la moindre ouverture
 * coûte un point à TOUTES les familles. Appliquée au plus une fois par jour,
 * et bornée à 7 jours pour qu'un retour après trois semaines d'absence ne
 * découvre pas un moteur muet.
 */
export function applyIdleDecay(
  state: NotifEngineState,
  now: number,
  families: readonly NotifFamily[],
): NotifEngineState {
  const last = state.lastDecayAt ?? now
  const elapsedDays = Math.floor((now - last) / DAY_MS)
  if (elapsedDays < 1) return state

  const lastOpen =
    state.opens.length > 0 ? state.opens[state.opens.length - 1] : null
  const openedSince = lastOpen !== null && lastOpen > last
  if (openedSince) return { ...state, lastDecayAt: now }

  const steps = Math.min(elapsedDays, 7)
  const fatigue = { ...state.fatigue }
  for (const family of families) {
    fatigue[family] = clamp((fatigue[family] ?? 0) + WEIGHTS.idleDay * steps)
  }
  return { ...state, fatigue, lastDecayAt: now }
}
