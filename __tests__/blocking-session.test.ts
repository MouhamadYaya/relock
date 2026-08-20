/**
 * Verrouille le modèle règle/session : c'est le contrat du produit.
 *  • une règle récurrente est TOUJOURS « en cours » ou « à venir » (jamais un
 *    état « terminé »/« inactif » : la liste ne peut pas pourrir) ;
 *  • un timer terminé et une règle expirée sont AUTO-SUPPRIMÉS ;
 *  • le mode strict verrouille la SESSION en cours, jamais la durée de vie.
 */
import type { BlockRuleView } from '@/features/blocking/types'
import {
  buildSessions,
  deriveSession,
  isFinished,
  isSessionLocked,
  lifetimeProgress,
  sessionEnd,
} from '@/features/blocking/session'

const NOW = new Date('2026-07-14T19:35:00') // mardi 19h35, heure locale

const rule = (over: Partial<BlockRuleView>): BlockRuleView => ({
  id: 'r1',
  type: 'schedule',
  appIds: [],
  isActive: true,
  ...over,
})

// ── Timer : éphémère, auto-supprimé une fois terminé ──────────────────

test('timer en cours → « en cours », minutes restantes justes', () => {
  const r = rule({
    type: 'progressive_delay',
    createdAt: '2026-07-14T19:20:00', // il y a 15 min
    config: { duration_min: 45 }, // → se termine à 20h05, reste 30 min
  })
  const s = deriveSession(r, NOW)
  expect(s.state).toBe('running')
  expect(s.indicator).toMatchObject({ kind: 'timer', minutesLeft: 30 })
  expect(isFinished(r, NOW)).toBe(false)
})

test('timer terminé → auto-supprimé (jamais listé)', () => {
  const r = rule({
    type: 'progressive_delay',
    createdAt: '2026-07-14T18:00:00',
    config: { duration_min: 30 }, // fini à 18h30
  })
  expect(isFinished(r, NOW)).toBe(true)
  expect(buildSessions([r], NOW)).toHaveLength(0)
})

// ── Limite : compte ou est atteinte → TOUJOURS en cours ───────────────

test('limite quotidienne → toujours « en cours », jamais un autre état', () => {
  const r = rule({ type: 'daily_limit', config: { limit_min: 120 } })
  expect(deriveSession(r, NOW).state).toBe('running')
})

test('quota : 0 tant que le natif n’a rien remonté (jamais inventé)', () => {
  const r = rule({ type: 'daily_limit', config: { limit_min: 120 } })
  expect(deriveSession(r, NOW).indicator).toMatchObject({ kind: 'limit', pct: 0 })
  // Palier remonté par le monitor natif.
  expect(deriveSession(r, NOW, { r1: 0.75 }).indicator).toMatchObject({
    pct: 0.75,
    reached: false,
  })
  expect(deriveSession(r, NOW, { r1: 1 }).indicator).toMatchObject({ reached: true })
})

// ── Plage : en cours ou à venir, jamais rien d'autre ───────────────────

test('plage hors créneau → « à venir »', () => {
  const r = rule({ config: { start_hour: 22, end_hour: 7 } }) // 19h35 → pas encore
  expect(deriveSession(r, NOW).state).toBe('upcoming')
})

test('plage à cheval sur minuit, en pleine nuit → « en cours »', () => {
  const r = rule({ config: { start_hour: 22, end_hour: 7 } })
  expect(deriveSession(r, new Date('2026-07-15T02:00:00')).state).toBe('running')
})

test('jours : une plage lun→ven ne tourne pas le dimanche', () => {
  const r = rule({
    config: { start_hour: 22, end_hour: 23, days: [1, 2, 3, 4, 5] },
  })
  const sunday = new Date('2026-07-19T22:30:00') // dimanche
  expect(deriveSession(r, sunday).state).toBe('upcoming')
  const tuesday = new Date('2026-07-14T22:30:00') // mardi
  expect(deriveSession(r, tuesday).state).toBe('running')
})

test('une règle récurrente n’est JAMAIS ni terminée ni supprimée d’office', () => {
  const old = rule({ createdAt: '2026-06-01T10:00:00' }) // il y a 6 semaines
  expect(isFinished(old, NOW)).toBe(false)
  expect(buildSessions([old], NOW)).toHaveLength(1)
})

// ── Suspension ────────────────────────────────────────────────────────

test('règle en pause → « suspendue » (et pas « inactive »)', () => {
  const r = rule({ isActive: false })
  const s = deriveSession(r, NOW)
  expect(s.state).toBe('suspended')
  expect(s.indicator).toMatchObject({ kind: 'paused' })
})

// ── Mode strict : verrouille la SESSION, jamais la durée de vie ────────

test('strict verrouille la session en cours d’un timer', () => {
  const r = rule({
    type: 'progressive_delay',
    createdAt: '2026-07-14T19:20:00',
    config: { duration_min: 45, strict: true },
  })
  expect(isSessionLocked(r, NOW)).toBe(true)
  expect(sessionEnd(r, NOW)).toEqual(new Date('2026-07-14T20:05:00'))
})

test('strict sur une limite → verrouillé jusqu’à MINUIT, pas au-delà', () => {
  const r = rule({ type: 'daily_limit', config: { limit_min: 120, strict: true } })
  expect(sessionEnd(r, NOW)).toEqual(new Date('2026-07-15T00:00:00'))
  expect(isSessionLocked(r, NOW)).toBe(true)
})

test('strict sur une règle de 30 jours ne verrouille QUE la session', () => {
  const r = rule({
    type: 'daily_limit',
    createdAt: '2026-07-01T10:00:00',
    config: { limit_min: 120, strict: true, lifetime_days: 30 },
  })
  // Le verrou expire à minuit — surtout pas dans 30 jours.
  expect(sessionEnd(r, NOW)).toEqual(new Date('2026-07-15T00:00:00'))
})

test('plage strict hors créneau → rien à verrouiller', () => {
  const r = rule({ config: { start_hour: 22, end_hour: 7, strict: true } })
  expect(isSessionLocked(r, NOW)).toBe(false) // 19h35 : la session n’a pas commencé
})

test('sans strict, jamais de verrou', () => {
  const r = rule({
    type: 'progressive_delay',
    createdAt: '2026-07-14T19:20:00',
    config: { duration_min: 45 },
  })
  expect(isSessionLocked(r, NOW)).toBe(false)
})

// ── Durée de vie = un défi, expiration = auto-suppression ──────────────

test('durée de vie → progression « J x sur y »', () => {
  const r = rule({
    createdAt: '2026-07-03T10:00:00', // 11 jours pleins écoulés
    config: { start_hour: 22, end_hour: 7, lifetime_days: 30 },
  })
  expect(lifetimeProgress(r, NOW)).toEqual({ day: 12, total: 30 })
})

test('durée de vie expirée → auto-supprimée comme un timer terminé', () => {
  const r = rule({
    createdAt: '2026-06-01T10:00:00',
    config: { start_hour: 22, end_hour: 7, lifetime_days: 7 },
  })
  expect(isFinished(r, NOW)).toBe(true)
  expect(buildSessions([r], NOW)).toHaveLength(0)
})

test('sans durée de vie → « toujours », aucune progression affichée', () => {
  const r = rule({ createdAt: '2026-06-01T10:00:00' })
  expect(lifetimeProgress(r, NOW)).toBeNull()
  expect(isFinished(r, NOW)).toBe(false)
})
