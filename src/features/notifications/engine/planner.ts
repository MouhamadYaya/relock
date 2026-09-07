/**
 * Le planner — tout le raisonnement du moteur, sans le moindre effet de bord.
 *
 *              CONTEXTE
 *                 │
 *            ÉLIGIBILITÉ            when() · canal · permission · détectabilité
 *                 │
 *             INTENTION             « quel message veut-on faire passer ? »
 *          ┌──────┴──────┐
 *     UTILISATEUR      UTILISATEUR
 *      PRÉSENT           ABSENT
 *          │               │
 *       IN-APP         candidat
 *                          │
 *                    SUPERSESSION   groupes exclusifs, puis absorptions
 *                          │
 *                    HEURES CALMES  on décale, on ne supprime pas
 *                          │
 *                       BUDGET      par JOUR, cooldown et quota pondérés fatigue
 *                          │
 *                   CLASSE DE FILE  roulante 7 j · ancre hors horizon
 *                          │
 *                  GARDE CAPACITÉ   ancres d'abord, puis le roulant
 *                          │
 *                         iOS
 *
 * Deux écarts assumés par rapport au schéma d'origine :
 *
 *  • les heures calmes passent AVANT le budget. Décaler un tir peut le faire
 *    changer de jour ; l'ordre inverse aurait facturé le budget du mauvais jour ;
 *  • la fatigue n'est pas une étape mais un COEFFICIENT, replié dans le
 *    cooldown et le quota hebdomadaire. Une étape séparée aurait été un second
 *    endroit à penser à consulter — donc un endroit à oublier.
 */

import { effectiveQuietHours } from '@/features/notifications/prefs/prefs'
import type {
  NotifContentMeta,
  NotifContext,
  NotifDefinition,
  NotifIntent,
  NotifPayload,
  NotifPlan,
  NotifRoute,
  NotifSchedule,
  PlannedNotification,
  SuppressedNotification,
  SuppressionReason,
} from '@/features/notifications/types'
import { NOTIF_PAYLOAD_VERSION } from '@/features/notifications/types'
import {
  type BudgetLedger,
  budgetClassOf,
  consume,
  cooldownElapsed,
  hasRoom,
  openLedger,
  weeklyQuotaReached,
} from './budget'
import { fitToCapacity } from './capacity'
import { shiftOutOfQuietHours } from './quiet-hours'
import { dayKey, type NotifEngineState } from './state'

const DAY_MS = 86_400_000

/** Horizon de la file roulante. Au-delà, seule une ancre peut porter un tir. */
export const ROLLING_HORIZON_MS = 7 * DAY_MS

/** Délai par défaut avant de retenter en notification ce qui a été vu in-app. */
export const DEFAULT_ADAPTIVE_DEFER_MS = 6 * 3_600_000

export const ROLLING_PREFIX = 'relock.r.'
export const ANCHOR_PREFIX = 'relock.a.'
/** Ancien préfixe v1, purgé une seule fois à la première exécution du moteur. */
export const LEGACY_PREFIX = 'relock.sched.'

export interface PlanInput {
  ctx: NotifContext
  state: NotifEngineState
  catalog: readonly NotifDefinition[]
  /** Notifications déjà en attente qui ne viennent pas du moteur. */
  foreignPending: number
}

interface Candidate {
  definition: NotifDefinition
  schedule: NotifSchedule
  variant: string | null
  groupSize: number
}

// ─────────────────────────────────────────────────────────────────────
// Variantes — rotation DÉTERMINISTE
// ─────────────────────────────────────────────────────────────────────

/**
 * Deux fois le même texte à deux jours d'intervalle se lit comme un bug. On
 * fait donc tourner les variantes, mais sans aléatoire : un plan doit être
 * reproductible pour être testable, et deux passages le même jour doivent
 * produire exactement la même chose (sinon le remplacement par identifiant
 * réécrirait un texte différent à chaque retour au premier plan).
 */
function pickVariant(definition: NotifDefinition, now: number): string | null {
  const variants = definition.variants
  if (!variants || variants.length === 0) return null
  const seed = `${definition.id}:${dayKey(now)}`
  let hash = 0
  for (let i = 0; i < seed.length; i += 1) {
    // Modulo explicite plutôt qu'un `| 0` : on veut un entier borné, pas les
    // 32 bits signés du moteur JS, dont le débordement dépendrait de la
    // longueur de l'identifiant.
    hash = (hash * 31 + seed.charCodeAt(i)) % 1_000_003
  }
  return variants[hash % variants.length]
}

// ─────────────────────────────────────────────────────────────────────
// Étape 1 — éligibilité
// ─────────────────────────────────────────────────────────────────────

function gateReason(
  definition: NotifDefinition,
  ctx: NotifContext,
  state: NotifEngineState,
): SuppressionReason | null {
  if (!definition.enabled) return 'node_disabled'

  // Une célébration partie de l'extension bouclier ne doit pas être planifiée
  // en plus : ce serait deux notifications pour un seul événement.
  if (definition.emitter && definition.emitter !== 'engine') {
    return 'external_emitter'
  }

  // Garde-fou de détectabilité : un nœud de protection dont on n'a pas VÉRIFIÉ
  // qui observe le signal ne part pas. « immédiat » sans observateur est un
  // mensonge, et un mensonge sur la protection est le pire de tous ici.
  if (
    definition.family === 'health' &&
    definition.detectability.offlineSignal === 'unverified'
  ) {
    return 'detectability'
  }

  if (definition.channel !== 'protection') {
    if (!ctx.prefs.master) return 'master_off'
    if (!ctx.prefs.channels[definition.channel]) return 'channel_off'
  }

  // Une intention purement in-app n'a pas besoin de l'autorisation système.
  if (definition.delivery !== 'inApp' && ctx.permission !== 'granted') {
    return 'permission'
  }

  if (!definition.when(ctx)) return 'condition_changed'
  if (!cooldownElapsed(definition, state, ctx.now)) return 'cooldown'
  return null
}

// ─────────────────────────────────────────────────────────────────────
// Étape 2 — supersession
// ─────────────────────────────────────────────────────────────────────

function sameLocalDay(a: number, b: number): boolean {
  return dayKey(a) === dayKey(b)
}

/**
 * Groupes exclusifs, puis absorptions explicites.
 *
 * Trois messages à 19h le dimanche (bilan, record personnel, jalon de série)
 * ne valent pas trois interruptions : le plus prioritaire parle, et il sait
 * combien de nœuds il absorbe (`groupSize`) pour composer un message unique.
 */
function resolveSupersession(
  candidates: Candidate[],
  suppress: (definition: NotifDefinition, reason: SuppressionReason) => void,
): Candidate[] {
  const byGroup = new Map<string, Candidate[]>()
  const ungrouped: Candidate[] = []
  for (const candidate of candidates) {
    const group = candidate.definition.exclusiveGroup
    if (!group) {
      ungrouped.push(candidate)
      continue
    }
    const bucket = byGroup.get(group)
    if (bucket) bucket.push(candidate)
    else byGroup.set(group, [candidate])
  }

  const winners: Candidate[] = [...ungrouped]
  for (const bucket of byGroup.values()) {
    const sorted = [...bucket].sort(
      (a, b) =>
        b.definition.priority - a.definition.priority ||
        a.definition.id.localeCompare(b.definition.id),
    )
    const [winner, ...losers] = sorted
    for (const loser of losers) suppress(loser.definition, 'exclusive_group')
    winners.push({ ...winner, groupSize: bucket.length })
  }

  // Absorptions dirigées : elles ne valent que pour le MÊME jour local. Un
  // record de la semaine n'a aucune raison d'effacer un bilan prévu six jours
  // plus tard.
  const absorbed = new Set<string>()
  for (const candidate of winners) {
    for (const target of candidate.definition.supersedes ?? []) {
      const victim = winners.find(c => c.definition.id === target)
      if (!victim) continue
      if (!sameLocalDay(candidate.schedule.at, victim.schedule.at)) continue
      absorbed.add(target)
    }
  }

  const kept: Candidate[] = []
  for (const candidate of winners) {
    if (absorbed.has(candidate.definition.id)) {
      suppress(candidate.definition, 'superseded')
      continue
    }
    const absorbedHere = (candidate.definition.supersedes ?? []).filter(id =>
      absorbed.has(id),
    ).length
    kept.push({
      ...candidate,
      groupSize: candidate.groupSize + absorbedHere,
    })
  }
  return kept
}

// ─────────────────────────────────────────────────────────────────────
// Étape 3 — plan
// ─────────────────────────────────────────────────────────────────────

function buildPayload(
  definition: NotifDefinition,
  route: NotifRoute,
  at: number,
  variant: string | null,
): NotifPayload {
  const payload: NotifPayload = {
    v: NOTIF_PAYLOAD_VERSION,
    n: definition.id,
    f: definition.family,
    s: Math.floor(at / 1000),
    r: { p: route.pathname },
  }
  if (variant) payload.va = variant
  if (route.params) payload.r.q = route.params
  return payload
}

function toPlanned(
  candidate: Candidate,
  ctx: NotifContext,
  at: number,
): PlannedNotification {
  const { definition } = candidate
  const meta: NotifContentMeta = {
    groupSize: candidate.groupSize,
    variant: candidate.variant,
  }
  const prefix =
    definition.scheduling === 'anchor' ? ANCHOR_PREFIX : ROLLING_PREFIX
  const route = definition.route(ctx)
  return {
    id: `${prefix}${definition.id}`,
    nodeId: definition.id,
    family: definition.family,
    priority: definition.priority,
    scheduling: definition.scheduling,
    schedule: { ...candidate.schedule, at },
    content: definition.content(ctx, meta),
    interruption: definition.interruption,
    payload: buildPayload(definition, route, at, candidate.variant),
    route,
  }
}

export function planNotifications(input: PlanInput): NotifPlan {
  const { ctx, state, catalog, foreignPending } = input
  const suppressed: SuppressedNotification[] = []
  const suppress = (
    definition: NotifDefinition,
    reason: SuppressionReason,
  ): void => {
    suppressed.push({
      nodeId: definition.id,
      family: definition.family,
      reason,
    })
  }

  // ── Éligibilité ────────────────────────────────────────────────────
  const candidates: Candidate[] = []
  for (const definition of catalog) {
    const reason = gateReason(definition, ctx, state)
    if (reason) {
      suppress(definition, reason)
      continue
    }
    const schedule = definition.schedule(ctx)
    if (!schedule) {
      suppress(definition, 'condition_changed')
      continue
    }
    // Un tir déjà passé n'est pas une notification en retard, c'est une
    // notification qui n'a plus lieu d'être. Le calendrier récurrent est la
    // seule exception : sa prochaine occurrence est calculée par iOS.
    const recurring = schedule.kind === 'wallClock' && schedule.repeats === true
    if (!recurring && schedule.at <= ctx.now) {
      suppress(definition, 'past')
      continue
    }
    candidates.push({
      definition,
      schedule,
      variant: pickVariant(definition, ctx.now),
      groupSize: 1,
    })
  }

  // ── Intention : in-app ou notification ─────────────────────────────
  const inApp: NotifIntent[] = []
  const toNotify: Candidate[] = []
  for (const candidate of candidates) {
    const { definition } = candidate
    const meta: NotifContentMeta = {
      groupSize: candidate.groupSize,
      variant: candidate.variant,
    }
    const asIntent = (): NotifIntent => ({
      definition,
      schedule: candidate.schedule,
      content: definition.content(ctx, meta),
      variant: candidate.variant,
      groupSize: candidate.groupSize,
    })

    if (definition.delivery === 'inApp') {
      inApp.push(asIntent())
      continue
    }
    if (definition.delivery === 'adaptive') {
      // L'utilisateur a l'app ouverte sous les yeux : lui envoyer une
      // notification serait le degré zéro du respect de son attention.
      if (ctx.userActive) {
        inApp.push(asIntent())
        continue
      }
      const shownAt = state.inAppAt[definition.id]
      const defer = definition.adaptiveDeferMs ?? DEFAULT_ADAPTIVE_DEFER_MS
      // Déjà montré dans l'app, et le délai de grâce n'est pas écoulé : on
      // laisse à l'utilisateur le temps de régler le problème lui-même.
      if (shownAt !== undefined && ctx.now - shownAt < defer) {
        suppress(definition, 'delivered_in_app')
        continue
      }
    }
    toNotify.push(candidate)
  }

  // ── Supersession ───────────────────────────────────────────────────
  const survivors = resolveSupersession(toNotify, suppress)

  // ── Heures calmes ──────────────────────────────────────────────────
  const quiet = effectiveQuietHours(ctx.prefs)
  const timed = survivors.map(candidate => {
    if (candidate.definition.quietHours === 'ignore') {
      return { candidate, at: candidate.schedule.at }
    }
    return {
      candidate,
      at: shiftOutOfQuietHours(candidate.schedule.at, quiet),
    }
  })

  // ── Budget, par JOUR ───────────────────────────────────────────────
  //
  // Le compteur persisté ne vaut que pour aujourd'hui : planifier sept jours à
  // l'avance impose un registre par journée, sinon toute la semaine se ferait
  // refuser sur le budget d'aujourd'hui.
  const ledgers = new Map<string, BudgetLedger>()
  const ledgerFor = (at: number): BudgetLedger => {
    const key = dayKey(at)
    const existing = ledgers.get(key)
    if (existing) return existing
    const fresh =
      key === dayKey(ctx.now)
        ? openLedger(state, ctx.now)
        : {
            standardDay: 0,
            standardWeek: 0,
            userRequestedDay: 0,
            protectionDay: 0,
          }
    // Le quota hebdomadaire est global à la semaine : il se reporte d'un jour
    // à l'autre, contrairement au quota journalier.
    fresh.standardWeek = openLedger(state, ctx.now).standardWeek
    ledgers.set(key, fresh)
    return fresh
  }

  const sorted = [...timed].sort(
    (a, b) =>
      b.candidate.definition.priority - a.candidate.definition.priority ||
      a.at - b.at,
  )

  const rolling: PlannedNotification[] = []
  const anchors: PlannedNotification[] = []
  let weeklySpent = openLedger(state, ctx.now).standardWeek

  for (const { candidate, at } of sorted) {
    const { definition } = candidate
    const isAnchor = definition.scheduling === 'anchor'

    if (!isAnchor && at - ctx.now > ROLLING_HORIZON_MS) {
      // C'est exactement le bug que la file d'ancrage corrige : hors horizon,
      // un nœud roulant n'est écrit par personne — il faut le déclarer `anchor`.
      suppress(definition, 'outside_horizon')
      continue
    }

    // Les ancres ne passent PAS par le budget, et c'est délibéré.
    //
    // Un budget se raisonne sur une journée dont on connaît le contenu. Une
    // ancre vise un instant à 28 jours : le budget de ce jour-là est
    // inconnaissable aujourd'hui, et deux fins d'essai posées la même semaine
    // se refuseraient l'une l'autre sur un compteur qui n'a aucun sens à cette
    // distance. Refuser une ancre pour cette raison recréerait exactement le
    // défaut qu'elle corrige : la notification la plus importante du produit,
    // jamais écrite, sans que personne ne le sache.
    //
    // Leur rareté est garantie autrement : douze créneaux réservés (garde de
    // capacité) et un test d'intégrité du catalogue qui refuse d'en activer
    // davantage. Le scheduler ne les compte pas non plus dans les compteurs.
    if (!isAnchor) {
      // Quota PROPRE au nœud, avant le budget global : « cinq messages par
      // semaine » n'a jamais voulu dire « cinq fois le même message ».
      if (weeklyQuotaReached(definition, state, at)) {
        suppress(definition, 'budget_weekly')
        continue
      }

      const budget = budgetClassOf(definition.family)
      const ledger = ledgerFor(at)
      ledger.standardWeek = weeklySpent

      const room = hasRoom(ledger, budget)
      if (!room.ok) {
        suppress(definition, room.reason)
        continue
      }

      const updated = consume(ledger, budget)
      ledgers.set(dayKey(at), updated)
      if (budget === 'standard') weeklySpent = updated.standardWeek
    }

    const planned = toPlanned(candidate, ctx, at)
    if (isAnchor) anchors.push(planned)
    else rolling.push(planned)
  }

  // ── Garde de capacité ──────────────────────────────────────────────
  const fitted = fitToCapacity(anchors, rolling, foreignPending)
  for (const dropped of fitted.dropped) {
    suppressed.push({
      nodeId: dropped.nodeId,
      family: dropped.family,
      reason: 'capacity',
    })
  }

  return {
    inApp,
    rolling: fitted.rolling,
    anchors: fitted.anchors,
    suppressed,
  }
}
