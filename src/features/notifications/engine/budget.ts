/**
 * Budgets — trois, parce que trois natures de message différentes.
 *
 * L'ambiguïté que ça lève : quatre nœuds éligibles le même jour, priorités 90,
 * 88, 95 et 80. Combien partent ? Réponse : le 95 (protection, hors budget
 * standard) plus le 90 (le seul slot standard du jour, pris par la priorité la
 * plus haute). Les deux autres sont refusés avec `budget_daily`, et le journal
 * le dit.
 */
import type {
  NotifBudgetClass,
  NotifDefinition,
  NotifFamily,
} from '@/features/notifications/types'
import { cadenceFactor } from './fatigue'
import { dayKey, type NotifEngineState, nodeWeekKey, weekKey } from './state'

export const BUDGET = {
  /** Régime nominal : une seule sollicitation de notre initiative par jour. */
  standardPerDay: 1,
  standardPerWeek: 5,
  /**
   * Ce que l'utilisateur a explicitement demandé (rituel). Il l'a choisi :
   * ça ne consomme pas le budget des messages qu'on envoie de nous-mêmes.
   */
  userRequestedPerDay: 2,
  /**
   * Protection : hors budget standard, MAIS jamais illimitée. Trois symptômes
   * d'une même panne font une notification, pas trois — la déduplication passe
   * par `exclusiveGroup`, ce plafond n'est que le dernier filet.
   */
  protectionPerDay: 2,
} as const

const DAY_MS = 86_400_000

export interface BudgetLedger {
  standardDay: number
  standardWeek: number
  userRequestedDay: number
  protectionDay: number
}

export function openLedger(state: NotifEngineState, now: number): BudgetLedger {
  return {
    standardDay: state.dailyCount[dayKey(now)] ?? 0,
    standardWeek: state.weeklyCount[weekKey(now)] ?? 0,
    userRequestedDay: 0,
    protectionDay: 0,
  }
}

/** Le budget de la classe autorise-t-il un envoi de plus ? */
export function hasRoom(
  ledger: BudgetLedger,
  budget: NotifBudgetClass,
): { ok: true } | { ok: false; reason: 'budget_daily' | 'budget_weekly' } {
  if (budget === 'protection') {
    return ledger.protectionDay < BUDGET.protectionPerDay
      ? { ok: true }
      : { ok: false, reason: 'budget_daily' }
  }
  if (budget === 'userRequested') {
    return ledger.userRequestedDay < BUDGET.userRequestedPerDay
      ? { ok: true }
      : { ok: false, reason: 'budget_daily' }
  }
  if (ledger.standardWeek >= BUDGET.standardPerWeek) {
    return { ok: false, reason: 'budget_weekly' }
  }
  return ledger.standardDay < BUDGET.standardPerDay
    ? { ok: true }
    : { ok: false, reason: 'budget_daily' }
}

export function consume(
  ledger: BudgetLedger,
  budget: NotifBudgetClass,
): BudgetLedger {
  if (budget === 'protection') {
    return { ...ledger, protectionDay: ledger.protectionDay + 1 }
  }
  if (budget === 'userRequested') {
    return { ...ledger, userRequestedDay: ledger.userRequestedDay + 1 }
  }
  return {
    ...ledger,
    standardDay: ledger.standardDay + 1,
    standardWeek: ledger.standardWeek + 1,
  }
}

/**
 * Le cooldown d'un nœud est-il écoulé ?
 *
 * La fatigue de la famille l'ALLONGE : c'est là que « cadence divisée par
 * deux » se matérialise concrètement, plutôt que dans un interrupteur séparé
 * qu'il faudrait penser à consulter partout.
 */
export function cooldownElapsed(
  definition: NotifDefinition,
  state: NotifEngineState,
  now: number,
): boolean {
  if (definition.cooldownDays <= 0) return true
  const last = state.lastSent[definition.id]
  if (last === undefined) return true
  const days = definition.cooldownDays * cadenceFactor(state, definition.family)
  return now - last >= days * DAY_MS
}

/**
 * Le quota hebdomadaire PROPRE au nœud est-il déjà atteint ?
 *
 * Distinct du budget global : cinq messages par semaine au total n'empêchent
 * pas qu'un même nœud parle cinq fois. La fatigue divise ce quota, exactement
 * comme elle allonge le cooldown.
 */
export function weeklyQuotaReached(
  definition: NotifDefinition,
  state: NotifEngineState,
  at: number,
): boolean {
  if (definition.maxPerWeek === undefined) return false
  const factor = cadenceFactor(state, definition.family)
  const quota = Math.max(1, Math.floor(definition.maxPerWeek / factor))
  const sent = state.sentPerWeek[nodeWeekKey(definition.id, at)] ?? 0
  return sent >= quota
}

/** Familles concernées par la décroissance de fatigue. */
export function budgetClassOf(family: NotifFamily): NotifBudgetClass {
  if (family === 'health') return 'protection'
  if (family === 'ritual') return 'userRequested'
  return 'standard'
}
