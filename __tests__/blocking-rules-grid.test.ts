/**
 * Verrou sur la grille des règles de l'onglet Blocages.
 *
 * Deux régressions vécues, deux invariants :
 *
 *  1. (écran Blocages V2) la carte « Nouvelle règle » était placée derrière le
 *     chargement des règles. Elle attendait donc la session Supabase, puis
 *     l'aller-retour réseau — plusieurs secondes d'écran vide, et indéfiniment
 *     hors ligne. L'utilisateur sans aucun blocage actif se retrouvait devant
 *     une page qui ne proposait rien.
 *  2. elle DISPARAISSAIT dès la première règle créée : la porte d'entrée
 *     s'effaçait pile au moment où l'utilisateur venait d'en comprendre
 *     l'usage. Elle change désormais de place, elle ne s'en va jamais.
 */
import { rulesGridPlan } from '@/features/blocking/rules-grid'

describe('rulesGridPlan', () => {
  it('montre « Nouvelle règle » DÈS le chargement, sans attendre le réseau', () => {
    const plan = rulesGridPlan(0, true)
    expect(plan.showsNewRuleCard).toBe(true)
    expect(plan.showsLoader).toBe(true)
    // Les suggestions dépendent des préréglages déjà pris : elles, attendent.
    expect(plan.showsSuggestions).toBe(false)
  })

  it('aucune règle et chargement terminé → carte + suggestions, sans indicateur', () => {
    const plan = rulesGridPlan(0, false)
    expect(plan.showsNewRuleCard).toBe(true)
    expect(plan.showsSuggestions).toBe(true)
    expect(plan.showsLoader).toBe(false)
  })

  it('grille vide → la carte ouvre la marche, seule chose à faire', () => {
    expect(rulesGridPlan(0, false).newRuleCardPosition).toBe('first')
    expect(rulesGridPlan(0, true).newRuleCardPosition).toBe('first')
  })

  it('des règles à dessiner → la grille leur appartient', () => {
    const plan = rulesGridPlan(3, false)
    expect(plan.showsRules).toBe(true)
    expect(plan.showsSuggestions).toBe(false)
    expect(plan.showsLoader).toBe(false)
  })

  it('une règle suffit à faire passer la carte en QUEUE — jamais à la retirer', () => {
    const plan = rulesGridPlan(1, false)
    expect(plan.showsNewRuleCard).toBe(true)
    expect(plan.newRuleCardPosition).toBe('last')
  })

  it('des règles déjà en cache pendant un refetch → rien ne disparaît', () => {
    const plan = rulesGridPlan(2, true)
    expect(plan.showsRules).toBe(true)
    expect(plan.showsLoader).toBe(false)
    expect(plan.showsNewRuleCard).toBe(true)
    expect(plan.newRuleCardPosition).toBe('last')
  })
})
