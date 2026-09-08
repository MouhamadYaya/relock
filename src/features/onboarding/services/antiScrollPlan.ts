/**
 * Les trois promesses, montrées pendant la préparation puis sur le plan final.
 *
 * Seuls les identifiants vivent ici : le texte est dans les fichiers de langue
 * (`onboarding_plan_actions.<id>`), sinon les trois écrans qui les affichent
 * resteraient en français dans une app anglaise ou espagnole.
 */
export const ANTI_SCROLL_PLAN = [
  { id: 'block' },
  { id: 'pause' },
  { id: 'progress' },
] as const

export type AntiScrollPlanId = (typeof ANTI_SCROLL_PLAN)[number]['id']
