/**
 * Du tap à l'écran.
 *
 * Le cas que le routage naïf rate systématiquement : une notification écrite
 * lundi, touchée mercredi. Entre-temps l'utilisateur s'est abonné, ou la règle
 * visée a été supprimée. Ouvrir le paywall à un abonné — ou un éditeur sur une
 * règle disparue — est une panne visible, et elle se produit précisément quand
 * la notification a fait son travail.
 *
 * D'où le garde, évalué au moment du TAP avec l'état du moment.
 */
import { nodeById } from '@/features/notifications/catalog'
import type {
  NotifPayload,
  RouteGuardContext,
} from '@/features/notifications/types'
import { NOTIF_PAYLOAD_VERSION } from '@/features/notifications/types'

export interface ResolvedRoute {
  pathname: string
  params?: Record<string, string>
  /** Vrai si le garde a dévié la destination d'origine. */
  redirected: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * Relit une charge utile venue du système. Elle a pu être écrite par une
 * version antérieure de l'app : `v` existe pour que ce cas se traite, et non
 * pour se deviner.
 */
export function parsePayload(raw: unknown): NotifPayload | null {
  if (!isRecord(raw)) return null
  const { v, n, f, s, r } = raw
  if (typeof n !== 'string' || typeof f !== 'string') return null
  if (typeof v !== 'number' || v > NOTIF_PAYLOAD_VERSION) return null
  if (!isRecord(r) || typeof r.p !== 'string') return null

  const params: Record<string, string> = {}
  if (isRecord(r.q)) {
    for (const [key, value] of Object.entries(r.q)) {
      if (typeof value === 'string') params[key] = value
    }
  }

  return {
    v,
    n,
    f: f as NotifPayload['f'],
    va: typeof raw.va === 'string' ? raw.va : undefined,
    s: typeof s === 'number' ? s : 0,
    e: typeof raw.e === 'string' ? raw.e : undefined,
    r: { p: r.p, q: Object.keys(params).length > 0 ? params : undefined },
  }
}

const FALLBACK = '/(tabs)/home'

/**
 * Destination finale. Le garde vient du CATALOGUE et non de la charge utile :
 * une règle de sécurité qui voyage dans `userInfo` est une règle qu'un vieux
 * binaire applique avec ses vieilles conditions.
 */
export function resolveRoute(
  payload: NotifPayload,
  guardContext: RouteGuardContext,
): ResolvedRoute {
  const definition = nodeById(payload.n)
  const intended = {
    pathname: payload.r.p,
    params: payload.r.q,
  }

  // Nœud disparu du catalogue (retiré depuis la planification) : la
  // destination brute reste utilisable, mais sans garde on préfère l'accueil
  // aux écrans sensibles.
  if (!definition) {
    return intended.pathname.startsWith('/paywall')
      ? { pathname: FALLBACK, redirected: true }
      : { ...intended, redirected: false }
  }

  // Le garde vient du catalogue, la destination de la charge utile : la
  // première est la règle d'aujourd'hui, la seconde l'intention d'hier.
  if (definition.routeGuard && !definition.routeGuard(guardContext, payload)) {
    return {
      pathname: definition.routeFallback ?? FALLBACK,
      redirected: true,
    }
  }
  return { ...intended, redirected: false }
}
