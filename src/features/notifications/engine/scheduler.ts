/**
 * Écriture du plan côté iOS. La seule pièce du moteur avec des effets de bord.
 *
 * Deux files, deux traitements :
 *  • ROULANTE — purgée par préfixe puis réécrite intégralement. Idempotente par
 *    construction : deux passages consécutifs produisent le même résultat ;
 *  • ANCRAGE — réconciliée par DIFF. Une purge en masse détruirait justement ce
 *    qu'elle protège : un tir à J+14 écrit hier et que plus personne ne
 *    réécrira si l'app n'est jamais rouverte.
 */

import type {
  NotifContentSpec,
  NotifContext,
  NotifFamily,
  NotifPlan,
  PlannedNotification,
} from '@/features/notifications/types'
import { i18n } from '@/i18n'
import { Notif, type NotifOptions } from '@/shared/native/notifications'
import { type CapacityReport, capacityReport } from './capacity'
import { logNotifEvents } from './log'
import { ANCHOR_PREFIX, LEGACY_PREFIX, ROLLING_PREFIX } from './planner'
import {
  dayKey,
  type NotifEngineState,
  nodeWeekKey,
  readEngineState,
  weekKey,
  writeEngineState,
} from './state'

export interface ApplyResult {
  rolling: number
  anchors: number
  cancelledAnchors: string[]
  suppressed: number
  capacity: CapacityReport | null
}

/**
 * Le catalogue construit ses clés à l'exécution : elles ne peuvent pas être
 * connues du typage littéral de `t()`. On isole donc l'unique endroit où cette
 * contrainte est levée, plutôt que de la disséminer.
 */
export function translateNotifKey(
  key: string,
  params?: Record<string, string | number>,
): string {
  return i18n.t(key as never, params as never) as unknown as string
}

function render(content: NotifContentSpec): { title: string; body: string } {
  return {
    title: translateNotifKey(content.titleKey, content.params),
    body: translateNotifKey(content.bodyKey, content.params),
  }
}

function optionsFor(planned: PlannedNotification): NotifOptions {
  return {
    payload: { ...planned.payload },
    // Regroupe par famille : cinq bilans empilés font une pile, pas cinq.
    threadId: planned.content.threadId ?? planned.family,
    interruptionLevel: planned.interruption,
    // Le centre de notifications trie par pertinence : autant lui donner la
    // nôtre plutôt que de le laisser trier par ordre d'arrivée.
    relevanceScore: Math.min(1, Math.max(0, planned.priority / 100)),
  }
}

async function write(planned: PlannedNotification): Promise<boolean> {
  const { title, body } = render(planned.content)
  const options = optionsFor(planned)
  const { schedule } = planned

  if (schedule.kind === 'wallClock') {
    // Trigger CALENDRIER : « dimanche 19h » reste 19h après un changement de
    // fuseau. Apple compte les jours à partir de 1 = dimanche, JavaScript à
    // partir de 0 : la conversion se fait ici et nulle part ailleurs.
    return Notif.scheduleCalendar(
      planned.id,
      {
        hour: schedule.hour,
        minute: schedule.minute,
        weekday:
          schedule.weekday === undefined ? undefined : schedule.weekday + 1,
        day: schedule.day,
      },
      schedule.repeats === true,
      title,
      body,
      options,
    )
  }

  return Notif.schedule(
    planned.id,
    Math.floor(schedule.at / 1000),
    title,
    body,
    options,
  )
}

/** Purge unique de l'ancien préfixe v1 — sinon les rappels v1 survivraient. */
async function purgeLegacyOnce(
  state: NotifEngineState,
): Promise<NotifEngineState> {
  if (state.legacyPurged) return state
  await Notif.cancelWithPrefix(LEGACY_PREFIX).catch(() => false)
  return { ...state, legacyPurged: true }
}

export async function applyPlan(
  plan: NotifPlan,
  ctx: NotifContext,
): Promise<ApplyResult> {
  if (!Notif.hasRoutingSupport) {
    // Binaire antérieur au socle v2 : planifier maintenant produirait des
    // notifications sans destination. Se taire est le comportement honnête.
    return {
      rolling: 0,
      anchors: 0,
      cancelledAnchors: [],
      suppressed: plan.suppressed.length,
      capacity: null,
    }
  }

  let state = await purgeLegacyOnce(readEngineState())

  // ── File roulante : ardoise propre, puis réécriture ──────────────────
  await Notif.cancelWithPrefix(ROLLING_PREFIX).catch(() => false)

  // ── File d'ancrage : réconciliation par DIFF ─────────────────────────
  const desiredAnchors = new Set(plan.anchors.map(anchor => anchor.id))
  const obsolete = state.anchors.filter(id => !desiredAnchors.has(id))
  if (obsolete.length > 0) await Notif.cancel(obsolete).catch(() => false)

  const written: PlannedNotification[] = []
  for (const planned of [...plan.anchors, ...plan.rolling]) {
    const ok = await write(planned).catch(() => false)
    if (ok) written.push(planned)
  }

  // ── État ─────────────────────────────────────────────────────────────
  const lastSent = { ...state.lastSent }
  const dailyCount = { ...state.dailyCount }
  const weeklyCount = { ...state.weeklyCount }
  const sentPerWeek = { ...state.sentPerWeek }
  for (const planned of written) {
    // Les ancres ne consomment PAS le budget : elles décrivent un futur
    // lointain et conditionnel, pas une sollicitation d'aujourd'hui. Les
    // compter reviendrait à dépenser le budget de la semaine prochaine pour
    // une notification qui, la plupart du temps, sera annulée avant de partir.
    if (planned.scheduling === 'anchor') continue
    lastSent[planned.nodeId] = planned.schedule.at
    const day = dayKey(planned.schedule.at)
    const week = weekKey(planned.schedule.at)
    const nodeWeek = nodeWeekKey(planned.nodeId, planned.schedule.at)
    dailyCount[day] = (dailyCount[day] ?? 0) + 1
    weeklyCount[week] = (weeklyCount[week] ?? 0) + 1
    sentPerWeek[nodeWeek] = (sentPerWeek[nodeWeek] ?? 0) + 1
  }

  const inAppAt = { ...state.inAppAt }
  for (const intent of plan.inApp) {
    inAppAt[intent.definition.id] = ctx.now
  }

  state = {
    ...state,
    lastSent,
    dailyCount,
    weeklyCount,
    sentPerWeek,
    inAppAt,
    anchors: written
      .filter(planned => planned.scheduling === 'anchor')
      .map(planned => planned.id),
  }
  writeEngineState(state, ctx.now)

  // ── Journal ──────────────────────────────────────────────────────────
  logNotifEvents([
    ...written.map(planned => ({
      t: ctx.now,
      k: 'scheduled' as const,
      n: planned.nodeId,
      f: planned.family,
      va: planned.payload.va,
      for: planned.schedule.at,
    })),
    ...plan.inApp.map(intent => ({
      t: ctx.now,
      k: 'in_app' as const,
      n: intent.definition.id,
      f: intent.definition.family,
      va: intent.variant ?? undefined,
    })),
    ...obsolete.map(id => {
      const nodeId = id.replace(ANCHOR_PREFIX, '')
      return {
        t: ctx.now,
        k: 'cancelled' as const,
        n: nodeId,
        // La famille se lit dans l'identifiant du nœud, qui en est préfixé
        // (invariant vérifié par le test d'intégrité du catalogue).
        f: nodeId.split('.')[0] as NotifFamily,
      }
    }),
    ...plan.suppressed.map(entry => ({
      t: ctx.now,
      k: 'suppressed' as const,
      n: entry.nodeId,
      f: entry.family,
      reason: entry.reason,
    })),
  ])

  const pending = await Notif.pendingIds().catch(() => [])
  return {
    rolling: written.filter(p => p.scheduling === 'rolling').length,
    anchors: written.filter(p => p.scheduling === 'anchor').length,
    cancelledAnchors: obsolete,
    suppressed: plan.suppressed.length,
    capacity: capacityReport(pending, ANCHOR_PREFIX, ROLLING_PREFIX),
  }
}

/**
 * Publie l'état et les TEXTES des célébrations pour l'extension bouclier.
 *
 * L'extension ne peut pas charger i18next : elle écrivait donc du français en
 * dur, quelle que soit la langue de l'utilisateur. On lui dépose ici le texte
 * déjà traduit, remis à jour à chaque passage du moteur — donc à chaque
 * changement de langue.
 */
export async function publishCelebrationState(
  ctx: NotifContext,
): Promise<void> {
  const enabled = ctx.prefs.master && ctx.prefs.channels.progression
  await Notif.setCelebrationsEnabled(enabled).catch(() => false)
  if (!enabled) return
  await Notif.setCelebrationCopy({
    firstTitle: translateNotifKey('notifications.progress.first_resist.title'),
    firstBody: translateNotifKey('notifications.progress.first_resist.body'),
    milestoneTitle: translateNotifKey(
      'notifications.progress.milestone_resists.title',
      { total: '{total}' },
    ),
    milestoneBody: translateNotifKey(
      'notifications.progress.milestone_resists.body',
      { total: '{total}' },
    ),
  }).catch(() => false)
}
