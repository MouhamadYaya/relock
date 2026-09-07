/**
 * Ce que la grille des règles de l'onglet Blocages doit dessiner à cet instant.
 *
 * ⚠️ L'invariant qui compte : **« Nouvelle règle » n'attend jamais le réseau.**
 * C'est une porte d'entrée, pas un résultat. La placer derrière le chargement
 * des règles lui faisait attendre la session Supabase PUIS l'aller-retour
 * réseau — plusieurs secondes d'écran vide pour quelqu'un qui n'a aucun
 * blocage, et une attente sans fin hors ligne. Seules les suggestions, qui
 * dépendent des préréglages déjà pris, ont une raison d'attendre.
 *
 * ⚠️ Second invariant : **la carte ne disparaît jamais.** Elle a longtemps été
 * retirée dès la première règle créée — la porte d'entrée s'effaçait pile au
 * moment où l'utilisateur comprenait à quoi elle servait. Elle CHANGE de place :
 * en tête tant que la grille est vide (c'est la seule chose à faire), en queue
 * dès qu'il y a une règle (les règles passent devant, la porte reste ouverte).
 */
export interface RulesGridPlan {
  /** Des règles réelles occupent la grille. */
  showsRules: boolean
  /** La carte « Nouvelle règle » (statique, jamais différée, jamais retirée). */
  showsNewRuleCard: boolean
  /** Sa place dans la grille : en tête quand il n'y a rien, en queue sinon. */
  newRuleCardPosition: 'first' | 'last'
  /** L'indicateur d'attente, à côté de la carte et jamais à sa place. */
  showsLoader: boolean
  /** Les préréglages suggérés, une fois les règles connues. */
  showsSuggestions: boolean
}

export function rulesGridPlan(
  sessionCount: number,
  isPending: boolean,
): RulesGridPlan {
  const showsRules = sessionCount > 0
  return {
    showsRules,
    showsNewRuleCard: true,
    newRuleCardPosition: showsRules ? 'last' : 'first',
    showsLoader: !showsRules && isPending,
    showsSuggestions: !showsRules && !isPending,
  }
}
