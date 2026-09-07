/**
 * Fatigue — la nuance qu'une règle binaire ne sait pas exprimer.
 */

import { cooldownElapsed } from '@/features/notifications/engine/budget'
import {
  applyIdleDecay,
  cadenceFactor,
  creditActionAfterTap,
  familyFatigue,
  noteDelivered,
  noteInteraction,
} from '@/features/notifications/engine/fatigue'
import {
  DAY,
  NOW,
  node,
  state,
} from '@/features/notifications/notif-test-fixtures'
import { NOTIF_FAMILIES } from '@/features/notifications/types'

it('ne ralentit personne au départ', () => {
  expect(cadenceFactor(state(), 'progress')).toBe(1)
})

it('ralentit après trois notifications sans la moindre interaction', () => {
  let s = state()
  s = noteDelivered(s, 'progress')
  s = noteDelivered(s, 'progress')
  expect(cadenceFactor(s, 'progress')).toBe(1)

  s = noteDelivered(s, 'progress')
  s = noteDelivered(s, 'progress')
  s = noteDelivered(s, 'progress')
  s = noteDelivered(s, 'progress')
  expect(familyFatigue(s, 'progress')).toBe(-4)
  expect(cadenceFactor(s, 'progress')).toBe(2)
})

/**
 * Le cœur de la correction : un bilan hebdomadaire lu, apprécié, puis balayé
 * sans tap est un SUCCÈS produit. Une règle binaire le compterait comme un
 * échec ; une ouverture de l'app dans l'heure rétablit la vérité.
 */
it('rattrape une série silencieuse dès qu’une preuve d’utilité arrive', () => {
  let s = state()
  for (let i = 0; i < 6; i += 1) s = noteDelivered(s, 'progress')
  expect(cadenceFactor(s, 'progress')).toBe(2)

  s = noteInteraction(s, 'progress', 'openAfterNotif')
  s = noteInteraction(s, 'progress', 'tap')
  expect(cadenceFactor(s, 'progress')).toBe(1)
})

it('pèse une action réelle plus lourd qu’une simple curiosité', () => {
  const tapped = noteInteraction(state(), 'blocking', 'tap')
  const acted = noteInteraction(state(), 'blocking', 'cta')
  expect(familyFatigue(acted, 'blocking')).toBeGreaterThan(
    familyFatigue(tapped, 'blocking'),
  )
})

it('n’enferme pas une famille définitivement', () => {
  let s = state()
  for (let i = 0; i < 60; i += 1) s = noteDelivered(s, 'retention')
  // Le plancher garantit qu'un retour reste possible : quelques signaux
  // positifs suffisent à sortir du ralentissement.
  expect(familyFatigue(s, 'retention')).toBeGreaterThanOrEqual(-12)
})

describe('décroissance', () => {
  it('coûte un point par journée entière sans ouverture', () => {
    const s = applyIdleDecay(
      state({ lastDecayAt: NOW - 3 * DAY, opens: [NOW - 5 * DAY] }),
      NOW,
      NOTIF_FAMILIES,
    )
    expect(familyFatigue(s, 'blocking')).toBe(-3)
  })

  it('ne pénalise pas quelqu’un qui est revenu entre-temps', () => {
    const s = applyIdleDecay(
      state({ lastDecayAt: NOW - 3 * DAY, opens: [NOW - HOUR_MS] }),
      NOW,
      NOTIF_FAMILIES,
    )
    expect(familyFatigue(s, 'blocking')).toBe(0)
  })

  it('borne la pénalité pour qu’un retour après trois semaines trouve un moteur vivant', () => {
    const s = applyIdleDecay(
      state({ lastDecayAt: NOW - 40 * DAY, opens: [NOW - 45 * DAY] }),
      NOW,
      NOTIF_FAMILIES,
    )
    expect(familyFatigue(s, 'blocking')).toBe(-7)
  })
})

const HOUR_MS = 3_600_000

it('allonge le cooldown du nœud plutôt que d’ajouter un interrupteur séparé', () => {
  const definition = node({ id: 'blocking.x', cooldownDays: 2 })
  const sent = { 'blocking.x': NOW - 3 * DAY }

  expect(cooldownElapsed(definition, state({ lastSent: sent }), NOW)).toBe(true)

  // Famille fatiguée ⇒ cadence divisée par deux ⇒ cooldown doublé à 4 jours.
  const tired = state({ lastSent: sent, fatigue: { blocking: -6 } })
  expect(cooldownElapsed(definition, tired, NOW)).toBe(false)
})

describe('crédit d’une action réelle', () => {
  it('crédite la famille du dernier tap quand l’action suit de peu', () => {
    const s = creditActionAfterTap(
      state({ lastTap: { family: 'retention', at: NOW - 10 * 60_000 } }),
      NOW,
    )
    // Une action vaut plus qu'un tap : c'est la preuve que le message a servi.
    expect(familyFatigue(s, 'retention')).toBe(4)
    // Consommé : un seul crédit par tap.
    expect(s.lastTap).toBeNull()
  })

  it('ne crédite rien quand l’action arrive bien plus tard', () => {
    // Armer un blocage trois jours après, c'est le faire pour soi — pas parce
    // qu'on nous l'a rappelé.
    const s = creditActionAfterTap(
      state({ lastTap: { family: 'retention', at: NOW - 3 * DAY } }),
      NOW,
    )
    expect(familyFatigue(s, 'retention')).toBe(0)
  })

  it('ne crédite rien sans tap préalable', () => {
    expect(familyFatigue(creditActionAfterTap(state(), NOW), 'blocking')).toBe(
      0,
    )
  })
})
