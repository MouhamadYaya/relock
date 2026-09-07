/**
 * Façade du moteur de notifications v2.
 *
 * Un seul point d'entrée pour tout le reste de l'app : `run()`. Il est
 * IDEMPOTENT — deux exécutions consécutives avec les mêmes sources produisent
 * exactement le même état côté iOS, ce qui autorise à l'appeler à chaque retour
 * au premier plan sans réfléchir.
 */

import type { HomeScoreSnapshot } from '@/features/home/types'
import { NOTIF_CATALOG } from '@/features/notifications/catalog'
import { Notif } from '@/shared/native/notifications'
import { capacityReport } from './engine/capacity'
import {
  buildNotifContext,
  type NotifContextSources,
  noteHomeScore,
} from './engine/context'
import { applyIdleDecay } from './engine/fatigue'
import {
  ANCHOR_PREFIX,
  planNotifications,
  ROLLING_PREFIX,
} from './engine/planner'
import {
  type ApplyResult,
  applyPlan,
  publishCelebrationState,
} from './engine/scheduler'
import {
  readEngineState,
  recordAppOpen,
  writeEngineState,
} from './engine/state'
import {
  hasAskedNotifPermission,
  markNotifPermissionAsked,
} from './prefs/prefs'
import { publishInAppNotices } from './store/intents.store'
import { NOTIF_FAMILIES, type NotifContext } from './types'

/**
 * Dernières sources connues. Permet aux Réglages de réappliquer IMMÉDIATEMENT
 * après un changement de préférence, sans avoir à recalculer les règles, les
 * statistiques et l'état natif.
 */
let lastSources: NotifContextSources | null = null

const EMPTY_RESULT: ApplyResult = {
  rolling: 0,
  anchors: 0,
  cancelledAnchors: [],
  suppressed: 0,
  capacity: null,
}

export const NotificationService = {
  /** Un passage complet du moteur. */
  async run(sources: NotifContextSources): Promise<ApplyResult> {
    lastSources = sources

    // La fatigue se décrémente sur le temps écoulé, pas sur le temps passé
    // dans l'app : la décroissance s'applique avant de lire le contexte.
    const decayed = applyIdleDecay(
      readEngineState(),
      sources.now,
      NOTIF_FAMILIES,
    )
    writeEngineState(decayed, sources.now)

    const ctx = await buildNotifContext(sources)
    await publishCelebrationState(ctx)

    const pending = await Notif.pendingIds().catch(() => [])
    const report = capacityReport(pending, ANCHOR_PREFIX, ROLLING_PREFIX)

    const plan = planNotifications({
      ctx,
      state: readEngineState(),
      catalog: NOTIF_CATALOG,
      foreignPending: report.foreign,
    })

    publishInAppNotices(
      plan.inApp.map(intent => ({
        nodeId: intent.definition.id,
        family: intent.definition.family,
        content: intent.content,
        priority: intent.definition.priority,
        at: sources.now,
      })),
    )

    return applyPlan(plan, ctx)
  },

  /**
   * Réapplique avec les dernières sources connues — effet immédiat après un
   * changement de préférence. Sans sources connues (Réglages ouverts avant le
   * premier passage), on ne fait rien plutôt que de planifier sur du vide.
   */
  async runFromLastKnown(): Promise<ApplyResult> {
    if (!lastSources) return EMPTY_RESULT
    return this.run({ ...lastSources, now: Date.now() })
  },

  /** Enregistre une ouverture de l'app (engagement, fatigue, ancres). */
  noteOpen(now: number = Date.now()): void {
    recordAppOpen(now)
  },

  /**
   * L'Accueil publie ici le score qu'il vient de calculer. Le moteur ne le
   * recalcule jamais : une seule source de vérité pour le score, et c'est
   * l'Accueil.
   */
  noteScore(snapshot: HomeScoreSnapshot | null): void {
    noteHomeScore(snapshot)
  },

  /**
   * Demande la permission SEULEMENT si elle n'a jamais été tranchée, et note
   * qu'on l'a demandée : le soft-ask ne se rejoue pas.
   */
  async ensurePermission(): Promise<boolean> {
    if (!Notif.isAvailable) return false
    const status = await Notif.permissionStatus()
    if (status === 'granted') return true
    if (status !== 'notDetermined') return false
    markNotifPermissionAsked()
    return (await Notif.requestPermission()) === 'granted'
  },

  /** Le soft-ask a-t-il déjà été proposé ? */
  hasAskedPermission: hasAskedNotifPermission,

  /** Utile aux tests et à l'écran de diagnostic. */
  async inspect(sources: NotifContextSources): Promise<NotifContext> {
    return buildNotifContext(sources)
  },
}
