/**
 * L'arbre assemblé.
 *
 * Le catalogue porte les 50 nœuds ; une vingtaine seulement est `enabled`.
 * Livrer 50 sollicitations d'un coup ferait de Relock exactement ce contre quoi
 * Relock est vendu — la rampe n'est pas de la prudence d'ingénieur, c'est la
 * promesse du produit.
 *
 * `catalogIntegrityIssues()` est vérifié par un test : les invariants du modèle
 * doivent casser la CI, pas se découvrir en production six semaines plus tard.
 */

import { CAPACITY } from '@/features/notifications/engine/capacity'
import type {
  NotifDefinition,
  NotifFamily,
} from '@/features/notifications/types'
import { activationNodes } from './activation'
import { billingNodes } from './billing'
import { blockingNodes } from './blocking'
import { healthNodes } from './health'
import { progressNodes } from './progress'
import { retentionNodes } from './retention'
import { ritualNodes } from './ritual'
import { scoreNodes } from './score'
import { strictNodes } from './strict'

export const NOTIF_CATALOG: readonly NotifDefinition[] = [
  ...activationNodes,
  ...blockingNodes,
  ...strictNodes,
  ...scoreNodes,
  ...progressNodes,
  ...retentionNodes,
  ...billingNodes,
  ...healthNodes,
  ...ritualNodes,
]

/** Ce que le moteur planifie réellement aujourd'hui. */
export const enabledNodes = (): readonly NotifDefinition[] =>
  NOTIF_CATALOG.filter(node => node.enabled)

export function nodeById(id: string): NotifDefinition | undefined {
  return NOTIF_CATALOG.find(node => node.id === id)
}

export function nodesByFamily(family: NotifFamily): readonly NotifDefinition[] {
  return NOTIF_CATALOG.filter(node => node.family === family)
}

/**
 * Invariants du modèle. Rendre une liste plutôt que lever : un test doit
 * pouvoir montrer TOUS les problèmes d'un coup, pas le premier.
 */
export function catalogIntegrityIssues(
  catalog: readonly NotifDefinition[] = NOTIF_CATALOG,
): string[] {
  const issues: string[] = []
  const seen = new Set<string>()
  const ids = new Set(catalog.map(node => node.id))

  for (const node of catalog) {
    if (seen.has(node.id)) issues.push(`identifiant en double : ${node.id}`)
    seen.add(node.id)

    if (!node.id.startsWith(`${node.family}.`)) {
      issues.push(`${node.id} : l'identifiant doit être préfixé par sa famille`)
    }
    if (node.priority < 0 || node.priority > 100) {
      issues.push(`${node.id} : priorité hors bornes (${node.priority})`)
    }

    // LA règle de la famille `health` : pas de nœud actif sans observateur
    // vérifié. « Immédiat » sans observateur est un mensonge, et un mensonge
    // sur la protection est le pire de tous.
    if (
      node.family === 'health' &&
      node.detectability.offlineSignal === 'unverified' &&
      node.enabled
    ) {
      issues.push(
        `${node.id} : nœud de protection actif alors que sa détectabilité n'est pas vérifiée`,
      )
    }

    // Une alerte censée partir app fermée doit être portée par une file qui
    // survit à l'horizon roulant, sinon elle ne partira jamais.
    if (
      node.detectability.firesWithoutReopen &&
      node.detectability.observer === 'watchdog' &&
      node.scheduling !== 'anchor'
    ) {
      issues.push(
        `${node.id} : un watchdog doit être planifié en file d'ancrage`,
      )
    }

    for (const target of node.supersedes ?? []) {
      if (!ids.has(target)) {
        issues.push(`${node.id} : absorbe un nœud inexistant (${target})`)
      }
      if (target === node.id) {
        issues.push(`${node.id} : s'absorbe lui-même`)
      }
    }

    if (
      node.emitter === 'shieldExtension' &&
      node.delivery !== 'notification'
    ) {
      issues.push(
        `${node.id} : un message émis par l'extension ne peut pas être livré in-app`,
      )
    }
  }

  const anchors = catalog.filter(
    node => node.enabled && node.scheduling === 'anchor',
  ).length
  if (anchors > CAPACITY.anchorMax) {
    issues.push(
      `${anchors} ancres actives pour ${CAPACITY.anchorMax} créneaux réservés`,
    )
  }

  return issues
}
