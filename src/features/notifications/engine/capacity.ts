/**
 * Garde de capacité.
 *
 * iOS plafonne les notifications locales EN ATTENTE. Au-delà, les suivantes
 * sont jetées — sans erreur, sans journal, sans que rien ne le signale. Une
 * saturation ne se découvre donc que par l'absence de notifications, des
 * semaines plus tard.
 *
 * On ne programme jamais jusqu'au plafond : huit créneaux restent libres en
 * permanence, pour absorber ce qu'on n'a pas prévu (célébrations émises par
 * l'extension, ancres posées hors passage du moteur).
 */
import type { PlannedNotification } from '@/features/notifications/types'

export const CAPACITY = {
  /** Plafond système. On ne s'en approche jamais. */
  hard: 56,
  /** Plafond de nos propres écritures ⇒ 8 créneaux toujours disponibles. */
  soft: 48,
  /**
   * Réservé aux ancres. Ce sont les seules notifications capables de partir
   * quand l'app n'est plus jamais ouverte : elles ne doivent jamais être
   * évincées par le flux roulant, qui sera de toute façon réécrit demain.
   */
  anchorMax: 12,
} as const

export interface CapacityReport {
  /** En attente côté iOS, hors ce que le moteur s'apprête à écrire. */
  foreign: number
  anchors: number
  rolling: number
  total: number
  /** Créneaux encore libres sous le plafond doux. */
  free: number
}

/**
 * Répartit les notifications planifiées sous les plafonds.
 *
 * Les ancres passent EN PREMIER — c'est tout l'objet de leur file. Le flux
 * roulant remplit ensuite ce qui reste, par priorité décroissante.
 */
export function fitToCapacity(
  anchors: PlannedNotification[],
  rolling: PlannedNotification[],
  /** Notifications déjà en attente qui ne viennent pas de ce passage. */
  foreignPending: number,
): {
  anchors: PlannedNotification[]
  rolling: PlannedNotification[]
  dropped: PlannedNotification[]
} {
  const dropped: PlannedNotification[] = []

  const keptAnchors = anchors.slice(0, CAPACITY.anchorMax)
  dropped.push(...anchors.slice(CAPACITY.anchorMax))

  const budget = Math.max(
    0,
    CAPACITY.soft - foreignPending - keptAnchors.length,
  )
  const keptRolling = rolling.slice(0, budget)
  dropped.push(...rolling.slice(budget))

  return { anchors: keptAnchors, rolling: keptRolling, dropped }
}

export function capacityReport(
  pendingIds: readonly string[],
  anchorPrefix: string,
  rollingPrefix: string,
): CapacityReport {
  let anchors = 0
  let rolling = 0
  let foreign = 0
  for (const id of pendingIds) {
    if (id.startsWith(anchorPrefix)) anchors += 1
    else if (id.startsWith(rollingPrefix)) rolling += 1
    else foreign += 1
  }
  const total = pendingIds.length
  return {
    foreign,
    anchors,
    rolling,
    total,
    free: Math.max(0, CAPACITY.soft - total),
  }
}
