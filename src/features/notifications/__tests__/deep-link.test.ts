/**
 * Routage au tap.
 *
 * Le cas que le routage naïf rate systématiquement : la notification a fait son
 * travail — l'utilisateur s'est abonné — et c'est précisément pour ça qu'ouvrir
 * le paywall serait une panne visible.
 */
import { nodeById } from '@/features/notifications/catalog'
import {
  parsePayload,
  resolveRoute,
} from '@/features/notifications/routing/deep-link'
import type {
  NotifPayload,
  RouteGuardContext,
} from '@/features/notifications/types'
import { NOTIF_PAYLOAD_VERSION } from '@/features/notifications/types'

const guardContext = (
  patch: Partial<RouteGuardContext> = {},
): RouteGuardContext => ({
  entitled: false,
  ruleIds: ['rule-1'],
  screenTimeAuthorized: true,
  offerActive: true,
  ...patch,
})

const payload = (patch: Partial<NotifPayload> = {}): NotifPayload => ({
  v: NOTIF_PAYLOAD_VERSION,
  n: 'billing.trial_ends_2d',
  f: 'billing',
  s: 1_784_000_000,
  r: { p: '/settings' },
  ...patch,
})

describe('lecture de la charge utile', () => {
  it('relit une charge utile complète', () => {
    const parsed = parsePayload({
      v: 1,
      n: 'retention.absent_5d',
      f: 'retention',
      va: 'a',
      s: 1_784_000_000,
      r: { p: '/(tabs)/home', q: { id: 'rule-1' } },
    })
    expect(parsed?.n).toBe('retention.absent_5d')
    expect(parsed?.r.q).toEqual({ id: 'rule-1' })
  })

  it('refuse une charge utile écrite par une version PLUS RÉCENTE', () => {
    // `v` existe pour que ce cas se traite, pas pour se deviner.
    expect(
      parsePayload({ ...payload(), v: NOTIF_PAYLOAD_VERSION + 1 }),
    ).toBeNull()
  })

  it('refuse ce qui n’est pas une charge utile', () => {
    expect(parsePayload(null)).toBeNull()
    expect(parsePayload({ n: 'x' })).toBeNull()
    expect(parsePayload({ v: 1, n: 'x', f: 'blocking' })).toBeNull()
  })
})

describe('gardes de route', () => {
  it('n’ouvre PAS le paywall à quelqu’un qui s’est abonné entre-temps', () => {
    const node = nodeById('billing.offer_expires_24h')
    expect(node?.routeGuard).toBeDefined()

    const resolved = resolveRoute(
      payload({
        n: 'billing.offer_expires_24h',
        r: { p: '/paywall', q: { offer: 'discount' } },
      }),
      guardContext({ entitled: true }),
    )
    expect(resolved.pathname).toBe('/(tabs)/home')
    expect(resolved.redirected).toBe(true)
  })

  it('ouvre bien le paywall quand l’abonnement manque toujours', () => {
    const resolved = resolveRoute(
      payload({
        n: 'billing.offer_expires_24h',
        r: { p: '/paywall', q: { offer: 'discount' } },
      }),
      guardContext({ entitled: false }),
    )
    expect(resolved.pathname).toBe('/paywall')
    expect(resolved.params).toEqual({ offer: 'discount' })
    expect(resolved.redirected).toBe(false)
  })

  it('n’ouvre pas un éditeur sur une règle supprimée depuis', () => {
    const resolved = resolveRoute(
      payload({
        n: 'activation.selection_empty',
        f: 'activation',
        r: { p: '/block-editor', q: { id: 'rule-disparue' } },
      }),
      guardContext(),
    )
    expect(resolved.pathname).toBe('/(tabs)/blocks')
    expect(resolved.redirected).toBe(true)
  })

  it('ouvre l’éditeur quand la règle existe toujours', () => {
    const resolved = resolveRoute(
      payload({
        n: 'activation.selection_empty',
        f: 'activation',
        r: { p: '/block-editor', q: { id: 'rule-1' } },
      }),
      guardContext(),
    )
    expect(resolved.pathname).toBe('/block-editor')
    expect(resolved.redirected).toBe(false)
  })

  it('replie vers l’accueil un paywall dont le nœud a disparu du catalogue', () => {
    // Un nœud retiré depuis la planification n'a plus de garde : on préfère
    // l'accueil à un écran sensible ouvert sans condition.
    const resolved = resolveRoute(
      payload({ n: 'billing.node_retire', r: { p: '/paywall' } }),
      guardContext({ entitled: true }),
    )
    expect(resolved.pathname).toBe('/(tabs)/home')
  })

  it('laisse passer une destination anodine dont le nœud a disparu', () => {
    const resolved = resolveRoute(
      payload({
        n: 'blocking.node_retire',
        f: 'blocking',
        r: { p: '/(tabs)/activity' },
      }),
      guardContext(),
    )
    expect(resolved.pathname).toBe('/(tabs)/activity')
  })
})
