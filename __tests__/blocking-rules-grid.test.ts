/**
 * Verrou sur la grille des règles de l'onglet Blocages.
 *
 * Régression vécue (écran Blocages V2) : la carte « Nouvelle règle » était
 * placée derrière le chargement des règles. Elle attendait donc la session
 * Supabase, puis l'aller-retour réseau — plusieurs secondes d'écran vide, et
 * indéfiniment hors ligne. L'utilisateur sans aucun blocage actif se
 * retrouvait devant une page qui ne proposait rien.
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

  it('des règles à dessiner → la grille leur appartient', () => {
    const plan = rulesGridPlan(3, false)
    expect(plan.showsRules).toBe(true)
    expect(plan.showsNewRuleCard).toBe(false)
    expect(plan.showsSuggestions).toBe(false)
    expect(plan.showsLoader).toBe(false)
  })

  it('des règles déjà en cache pendant un refetch → rien ne disparaît', () => {
    const plan = rulesGridPlan(2, true)
    expect(plan.showsRules).toBe(true)
    expect(plan.showsLoader).toBe(false)
  })
})
