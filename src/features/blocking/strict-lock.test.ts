import { buildSessions, strictSessionFor } from '@/features/blocking/session'
import type { BlockRuleView } from '@/features/blocking/types'

const NOW = new Date('2026-08-31T21:00:00')

function timedRule(
  id: string,
  { strict, minutes = 120 }: { strict: boolean; minutes?: number },
): BlockRuleView {
  return {
    id,
    type: 'progressive_delay',
    appIds: [],
    isActive: true,
    count: 2,
    config: { mode: 'block_now', duration_min: minutes, strict },
    // Démarré il y a 30 min : la session court encore.
    createdAt: new Date(NOW.getTime() - 30 * 60_000).toISOString(),
  }
}

const sessionsFor = (rules: BlockRuleView[]) => buildSessions(rules, NOW, {})

describe('strictSessionFor', () => {
  it('lets an app be opened when no rule covering it is strict', () => {
    const sessions = sessionsFor([timedRule('soft', { strict: false })])
    expect(strictSessionFor(sessions, ['soft'], NOW)).toBeNull()
  })

  it('refuses an app as soon as one covering rule is strict', () => {
    const sessions = sessionsFor([timedRule('hard', { strict: true })])
    expect(strictSessionFor(sessions, ['hard'], NOW)?.rule.id).toBe('hard')
  })

  it('keeps the strictest shield when a soft rule also covers the app', () => {
    const sessions = sessionsFor([
      timedRule('soft', { strict: false }),
      timedRule('hard', { strict: true }),
    ])
    // Sinon il suffirait d'ajouter une règle souple pour rouvrir ce qu'on
    // s'était interdit.
    expect(strictSessionFor(sessions, ['soft', 'hard'], NOW)?.rule.id).toBe(
      'hard',
    )
  })

  it('ignores a strict rule that covers other apps only', () => {
    const sessions = sessionsFor([timedRule('hard', { strict: true })])
    expect(strictSessionFor(sessions, ['other'], NOW)).toBeNull()
  })

  it('releases the app once the strict session is over', () => {
    // Fenêtre de 10 min démarrée il y a 30 min : le verrou est tombé.
    const sessions = sessionsFor([
      timedRule('expired', { strict: true, minutes: 10 }),
    ])
    expect(strictSessionFor(sessions, ['expired'], NOW)).toBeNull()
  })

  it('exposes the deadline the refusal popup has to show', () => {
    const sessions = sessionsFor([timedRule('hard', { strict: true })])
    const strict = strictSessionFor(sessions, ['hard'], NOW)
    // 120 min de blocage, démarré il y a 30 : il reste 90 min.
    expect(strict?.sessionEndsAt?.getTime()).toBe(NOW.getTime() + 90 * 60_000)
  })
})
