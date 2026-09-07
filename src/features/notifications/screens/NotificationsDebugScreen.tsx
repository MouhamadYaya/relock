/**
 * Écran de diagnostic du moteur de notifications (DEV uniquement).
 *
 * Sans lui, ce système est indébuggable : tout se décide hors écran, et une
 * notification qui ne part pas ressemble exactement à une notification qui
 * n'avait pas lieu d'être. On rend donc visibles les trois choses qui manquent
 * toujours au moment où on en a besoin :
 *
 *   1. ce qu'iOS a RÉELLEMENT en attente, et sous quel plafond ;
 *   2. l'état de chaque nœud du catalogue, avec sa dernière décision ;
 *   3. la répartition des refus par raison, sur sept jours.
 */
import { router } from 'expo-router'
import React from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  catalogIntegrityIssues,
  NOTIF_CATALOG,
} from '@/features/notifications/catalog'
import {
  CAPACITY,
  type CapacityReport,
  capacityReport,
} from '@/features/notifications/engine/capacity'
import {
  lastDecisionFor,
  readNotifLog,
  suppressionBreakdown,
} from '@/features/notifications/engine/log'
import {
  ANCHOR_PREFIX,
  ROLLING_PREFIX,
} from '@/features/notifications/engine/planner'
import { readEngineState } from '@/features/notifications/engine/state'
import { NotificationService } from '@/features/notifications/notification.service'
import type { NotifDefinition } from '@/features/notifications/types'
import { ScreenHeader } from '@/shared/components/ui/ScreenHeader'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import { Notif } from '@/shared/native/notifications'
import { settingsTheme } from '@/shared/theme'

const { colors, spacing } = settingsTheme
const DAY_MS = 86_400_000

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.kv}>
      <Text style={styles.kvLabel}>{label}</Text>
      <Text style={styles.kvValue}>{value}</Text>
    </View>
  )
}

function NodeLine({ node, now }: { node: NotifDefinition; now: number }) {
  const decision = lastDecisionFor(node.id)
  const unverified =
    node.family === 'health' &&
    node.detectability.offlineSignal === 'unverified'

  return (
    <View style={styles.node}>
      <View style={styles.nodeHead}>
        <Text
          style={[styles.nodeId, node.enabled ? styles.on : styles.off]}
          numberOfLines={1}
        >
          {node.id}
        </Text>
        <Text style={styles.nodePriority}>{node.priority}</Text>
      </View>
      <Text style={styles.nodeMeta}>
        {node.channel} · {node.scheduling} · {node.delivery} ·{' '}
        {node.interruption}
        {node.emitter === 'shieldExtension' ? ' · extension' : ''}
      </Text>
      {/* La matrice de détectabilité : « immédiat » sans observateur est un
          mensonge, autant l'avoir sous les yeux. */}
      <Text style={[styles.nodeMeta, unverified && styles.warn]}>
        signal {node.detectability.offlineSignal} ·{' '}
        {node.detectability.observer}
        {node.detectability.firesWithoutReopen ? ' · sans réouverture' : ''}
      </Text>
      {decision ? (
        <Text style={styles.nodeDecision}>
          {decision.k}
          {decision.reason ? ` · ${decision.reason}` : ''} ·{' '}
          {Math.round((now - decision.t) / 60_000)} min
        </Text>
      ) : (
        <Text style={styles.nodeDecisionMuted}>
          aucune décision enregistrée
        </Text>
      )}
    </View>
  )
}

export default function NotificationsDebugScreen() {
  const now = Date.now()
  const [pending, setPending] = React.useState<string[]>([])
  const [capacity, setCapacity] = React.useState<CapacityReport | null>(null)

  const refresh = React.useCallback(() => {
    Notif.pendingIds()
      .then(ids => {
        setPending(ids)
        setCapacity(capacityReport(ids, ANCHOR_PREFIX, ROLLING_PREFIX))
      })
      .catch(() => {})
  }, [])

  React.useEffect(refresh, [refresh])

  const state = readEngineState()
  const log = readNotifLog()
  const breakdown = suppressionBreakdown(now, 7 * DAY_MS, log)
  const issues = catalogIntegrityIssues()

  return (
    <ScreenWrapper
      backgroundColor={colors.bg}
      header={
        <ScreenHeader title="Notifications · diagnostic" onBack={router.back} />
      }
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.section}>File iOS</Text>
        <Row
          label="En attente"
          value={`${pending.length} / ${CAPACITY.soft} (plafond dur ${CAPACITY.hard})`}
        />
        <Row label="Roulantes" value={String(capacity?.rolling ?? 0)} />
        <Row
          label="Ancres"
          value={`${capacity?.anchors ?? 0} / ${CAPACITY.anchorMax} réservés`}
        />
        <Row label="Hors moteur" value={String(capacity?.foreign ?? 0)} />
        <Row label="Créneaux libres" value={String(capacity?.free ?? 0)} />
        {Notif.hasRoutingSupport ? null : (
          <Text style={styles.warn}>
            Binaire antérieur au socle v2 : le moteur se tait volontairement
            (aucune destination ne pourrait être transportée).
          </Text>
        )}

        <Text style={styles.section}>Fatigue par famille</Text>
        {Object.keys(state.fatigue).length === 0 ? (
          <Text style={styles.muted}>Aucun signal encore enregistré.</Text>
        ) : (
          Object.entries(state.fatigue).map(([family, score]) => (
            <Row
              key={family}
              label={family}
              value={`${score}${score <= -4 ? ' · cadence ÷2' : ''}`}
            />
          ))
        )}

        <Text style={styles.section}>Refus sur 7 jours</Text>
        {Object.keys(breakdown).length === 0 ? (
          <Text style={styles.muted}>Aucun refus enregistré.</Text>
        ) : (
          Object.entries(breakdown)
            .sort((a, b) => b[1] - a[1])
            .map(([reason, count]) => (
              <Row key={reason} label={reason} value={String(count)} />
            ))
        )}

        {issues.length > 0 ? (
          <>
            <Text style={styles.section}>Intégrité du catalogue</Text>
            {issues.map(issue => (
              <Text key={issue} style={styles.warn}>
                {issue}
              </Text>
            ))}
          </>
        ) : null}

        <Text style={styles.section}>
          Catalogue · {NOTIF_CATALOG.filter(n => n.enabled).length} actifs sur{' '}
          {NOTIF_CATALOG.length}
        </Text>
        {NOTIF_CATALOG.map(node => (
          <NodeLine key={node.id} node={node} now={now} />
        ))}

        <Text
          style={styles.action}
          onPress={() => {
            NotificationService.runFromLastKnown()
              .then(refresh)
              .catch(() => {})
          }}
        >
          Rejouer un passage du moteur
        </Text>
      </ScrollView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  content: { padding: spacing.screenH, paddingBottom: 64, gap: 4 },
  section: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 22,
    marginBottom: 6,
  },
  kv: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  kvLabel: { color: colors.textSecondary, fontSize: 13 },
  kvValue: {
    color: colors.textPrimary,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  muted: { color: colors.textTertiary, fontSize: 13 },
  warn: { color: colors.danger, fontSize: 12, marginTop: 4 },
  node: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.divider,
    paddingVertical: 8,
  },
  nodeHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  nodeId: { fontSize: 13, fontWeight: '600', flex: 1 },
  on: { color: colors.textPrimary },
  off: { color: colors.textTertiary },
  nodePriority: {
    color: colors.textSecondary,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  nodeMeta: { color: colors.textTertiary, fontSize: 11, marginTop: 2 },
  nodeDecision: { color: colors.accent, fontSize: 11, marginTop: 3 },
  nodeDecisionMuted: { color: colors.textTertiary, fontSize: 11, marginTop: 3 },
  action: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 28,
    paddingVertical: 12,
  },
})
