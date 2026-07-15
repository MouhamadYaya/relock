import { IconName } from '@assets/icons'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import React, { useEffect, useState } from 'react'
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native'
import { HalfSheet } from '@/features/blocking/components/HalfSheet'
import { RingProgress } from '@/features/blocking/components/RingProgress'
import { useDeleteRuleMutation } from '@/features/blocking/hooks/useDeleteRuleMutation'
import { useToggleRuleMutation } from '@/features/blocking/hooks/useToggleRuleMutation'
import { armRule } from '@/features/blocking/services/arm'
import {
  appsSubtitle,
  type BlockRuleView,
  isLocked,
  RULE_TYPE_LABEL,
  ringInfo,
  ringLabel,
  scheduleActive,
  timedRunning,
  unlockTimeLabel,
} from '@/features/blocking/types'
import { goBack } from '@/navigation/helpers/navigation-helpers'
import type { RootStackParamList } from '@/navigation/root-param-list'
import { ROUTES } from '@/navigation/routes'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { nativeKindOf, ScreenTime } from '@/shared/native/screen-time'
import type { BlockRuleType } from '@/shared/services/supabase/database.types'
import { fonts } from '@/shared/theme/tokens/fonts'
import { showErrorToast } from '@/shared/utils/toast'

const FW = {
  400: fonts.regular,
  500: fonts.medium,
  600: fonts.semiBold,
  700: fonts.bold,
} as const
const f = (w: keyof typeof FW) => ({ fontFamily: FW[w] })

const C = {
  bg: '#0B0C10',
  surface: '#1A1D27',
  surface2: '#242836',
  ink: '#F0F0F4',
  ink2: '#A8ABBE',
  ink3: '#6B6F82',
  accent: '#A49AFE',
  danger: '#FF453A',
  ambient: 'rgba(164,154,254,0.14)',
  hair: 'rgba(255,255,255,0.06)',
}

const TYPE_ICON: Record<BlockRuleType, IconName> = {
  progressive_delay: IconName.CLOCK,
  schedule: IconName.CALENDAR,
  daily_limit: IconName.CHART,
}

type Props = NativeStackScreenProps<
  RootStackParamList,
  typeof ROUTES.BLOCK_DETAIL
>

const num = (v: unknown, d = 0): number => (typeof v === 'number' ? v : d)

function ruleName(rule: BlockRuleView): string {
  const custom = rule.config?.name
  return typeof custom === 'string' && custom.trim()
    ? custom
    : RULE_TYPE_LABEL[rule.type]
}
function timeLabel(h: number, m: number): string {
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}
function scheduleText(rule: BlockRuleView): string {
  const c = rule.config ?? {}
  return `${timeLabel(num(c.start_hour, 22), num(c.start_minute))} → ${timeLabel(num(c.end_hour, 8), num(c.end_minute))}`
}
function limitText(rule: BlockRuleView): string {
  const min = num(rule.config?.limit_min, 60)
  const h = Math.floor(min / 60)
  const r = min % 60
  if (h === 0) return `${r} min / jour`
  return r === 0 ? `${h} h / jour` : `${h} h ${r} / jour`
}

function Pill({ text, on }: { text: string; on: boolean }) {
  return (
    <View
      style={[styles.pill, { backgroundColor: on ? C.ambient : C.surface2 }]}
    >
      <Text style={[f(600), { fontSize: 12, color: on ? C.accent : C.ink3 }]}>
        {text}
      </Text>
    </View>
  )
}

function StatusBadge({ rule }: { rule: BlockRuleView }) {
  if (!rule.isActive) return <Pill text="En pause" on={false} />
  if (rule.type === 'schedule') {
    return scheduleActive(rule) ? (
      <Pill text="Actif maintenant" on />
    ) : (
      <Pill
        text={`Prochain à ${num(rule.config?.start_hour, 22)}h`}
        on={false}
      />
    )
  }
  return <Pill text="Actif" on />
}

export default function BlockDetailScreen({ route }: Props) {
  const { rule } = route.params
  const del = useDeleteRuleMutation()
  const toggle = useToggleRuleMutation()

  const isSession = rule.type === 'progressive_delay'
  // Tick : pour un « Bloquer maintenant », l'anneau, le « restant » et le
  // passage « en cours → terminé » doivent avancer tant que la feuille est
  // ouverte (sinon on affiche « Arrêter » sur un blocage déjà fini).
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    if (!isSession) return
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [isSession])
  const locked = isLocked(rule)
  const running = timedRunning(rule, now)
  const ring = ringInfo(rule, now)

  const removeAnd = async (close: () => void) => {
    try {
      // Stop CIBLÉ : n'affecte jamais les autres blocages en cours.
      if (ScreenTime.isAvailable) {
        await ScreenTime.clearRuleData(rule.id, nativeKindOf(rule.type)).catch(
          () => {},
        )
      }
      await del.mutateAsync({ id: rule.id })
      close()
    } catch (e) {
      showErrorToast(e)
    }
  }

  const confirmStop = (close: () => void) =>
    Alert.alert(
      'Ne vous mentez pas !',
      'Veux-tu vraiment arrêter ce blocage ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Arrêter le blocage',
          style: 'destructive',
          onPress: () => removeAnd(close),
        },
      ],
    )

  const confirmDelete = (close: () => void) =>
    Alert.alert('Supprimer ce blocage ?', 'Action définitive.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => removeAnd(close),
      },
    ])

  const togglePause = async (close: () => void) => {
    const next = !rule.isActive
    try {
      if (ScreenTime.isAvailable) {
        // Pause/reprise CIBLÉE : la sélection de la règle reste liée côté
        // natif, seule SA fenêtre s'arrête ou se ré-arme.
        if (next) await armRule(rule)
        else await ScreenTime.stopRule(rule.id, nativeKindOf(rule.type))
      }
      await toggle.mutateAsync({ id: rule.id, isActive: next })
      close()
    } catch (e) {
      showErrorToast(e)
    }
  }

  return (
    <HalfSheet onClose={() => goBack()}>
      {close => (
        <View>
          {/* En-tête commun */}
          <View style={styles.head}>
            <View style={styles.icon}>
              <IconSvg name={TYPE_ICON[rule.type]} size={22} color={C.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[f(700), { fontSize: 18, color: C.ink }]}>
                {ruleName(rule)}
              </Text>
              <Text
                style={[
                  f(400),
                  { fontSize: 13.5, color: C.ink2, marginTop: 2 },
                ]}
              >
                {appsSubtitle(rule.appIds, rule.count)}
              </Text>
            </View>
          </View>

          {/* Milieu selon le type */}
          {isSession ? (
            locked ? (
              <View style={styles.lockCard}>
                <IconSvg name={IconName.LOCK} size={20} color={C.accent} />
                <Text
                  style={[f(600), { fontSize: 15, color: C.ink, marginTop: 8 }]}
                >
                  Verrouillé jusqu'à {unlockTimeLabel(rule)}
                </Text>
                <Text style={[f(400), styles.lockSub]}>
                  Mode strict — impossible d'arrêter avant la fin. C'est ce que
                  tu as choisi pour tenir.
                </Text>
              </View>
            ) : running ? (
              <View style={styles.center}>
                <RingProgress
                  size={136}
                  stroke={8}
                  fraction={ring.fraction}
                  color={C.accent}
                >
                  <View style={{ alignItems: 'center' }}>
                    <Text
                      style={[
                        f(700),
                        {
                          fontSize: 24,
                          color: C.ink,
                          fontVariant: ['tabular-nums'],
                        },
                      ]}
                    >
                      {ringLabel(rule, now)}
                    </Text>
                    <Text
                      style={[
                        f(400),
                        { fontSize: 11.5, color: C.ink3, marginTop: 2 },
                      ]}
                    >
                      restant
                    </Text>
                  </View>
                </RingProgress>
              </View>
            ) : (
              <Text style={[f(400), styles.doneText]}>
                Ce blocage est terminé.
              </Text>
            )
          ) : (
            <View style={styles.infoCard}>
              <View style={styles.infoRow}>
                <Text style={[f(500), { fontSize: 14, color: C.ink2 }]}>
                  {rule.type === 'schedule' ? 'Plage' : 'Limite'}
                </Text>
                <Text style={[f(600), { fontSize: 15, color: C.ink }]}>
                  {rule.type === 'schedule'
                    ? scheduleText(rule)
                    : limitText(rule)}
                </Text>
              </View>
              <View style={styles.hair} />
              <View style={styles.infoRow}>
                <Text style={[f(500), { fontSize: 14, color: C.ink2 }]}>
                  État
                </Text>
                <StatusBadge rule={rule} />
              </View>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            {isSession ? (
              locked ? null : running ? (
                <Pressable
                  onPress={() => confirmStop(close)}
                  style={styles.dangerBtn}
                >
                  <Text style={[f(700), { fontSize: 16, color: C.danger }]}>
                    Arrêter le blocage
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => confirmDelete(close)}
                  style={styles.dangerBtn}
                >
                  <Text style={[f(700), { fontSize: 16, color: C.danger }]}>
                    Supprimer
                  </Text>
                </Pressable>
              )
            ) : (
              <>
                <Pressable
                  onPress={() => togglePause(close)}
                  style={styles.primaryBtn}
                >
                  <Text style={[f(700), { fontSize: 16, color: C.bg }]}>
                    {rule.isActive ? 'Mettre en pause' : 'Reprendre'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => confirmDelete(close)}
                  style={styles.ghostBtn}
                >
                  <Text style={[f(600), { fontSize: 15, color: C.danger }]}>
                    Supprimer
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      )}
    </HalfSheet>
  )
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 4 },
  icon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: C.ambient,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: { alignItems: 'center', marginTop: 26, marginBottom: 6 },
  doneText: {
    fontSize: 14,
    color: C.ink3,
    textAlign: 'center',
    marginTop: 24,
  },
  lockCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 20,
    alignItems: 'center',
    marginTop: 20,
  },
  lockSub: {
    fontSize: 13,
    color: C.ink3,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },
  infoCard: {
    backgroundColor: C.surface,
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 6,
    marginTop: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
  },
  hair: { height: 1, backgroundColor: C.hair },
  pill: { borderRadius: 99, paddingVertical: 5, paddingHorizontal: 11 },
  actions: { marginTop: 22, gap: 10 },
  dangerBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(255,69,58,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtn: {
    height: 54,
    borderRadius: 16,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ghostBtn: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
