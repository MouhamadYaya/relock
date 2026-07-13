import { IconName } from '@assets/icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import React, { useMemo, useState } from 'react'
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native'
import { useCreateRuleMutation } from '@/features/blocking/hooks/useCreateRuleMutation'
import { goBack } from '@/navigation/helpers/navigation-helpers'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import { ScreenTime } from '@/shared/native/screen-time'
import type { BlockRuleType } from '@/shared/services/supabase/database.types'
import { fonts } from '@/shared/theme/tokens/fonts'
import { showErrorToast } from '@/shared/utils/toast'

const FW = {
  400: fonts.regular,
  500: fonts.medium,
  600: fonts.semiBold,
  700: fonts.bold,
  800: fonts.bold,
} as const
const f = (w: keyof typeof FW) => ({ fontFamily: FW[w] })

const C = {
  bg: '#0B0C10',
  surface: '#15171F',
  surface2: '#1C1F2B',
  ink: '#F0F0F4',
  ink2: '#A8ABBE',
  ink3: '#6B6F82',
  accent: '#A49AFE',
  hair: 'rgba(255,255,255,0.06)',
  ambient10: 'rgba(164,154,254,0.10)',
  ambient18: 'rgba(164,154,254,0.18)',
}

type TypeKey = 'block_now' | 'schedule' | 'daily_limit'
const DB_TYPE: Record<TypeKey, BlockRuleType> = {
  block_now: 'progressive_delay',
  schedule: 'schedule',
  daily_limit: 'daily_limit',
}

const TYPES: { key: TypeKey; icon: IconName; title: string; desc: string }[] = [
  {
    key: 'block_now',
    icon: IconName.CLOCK,
    title: 'Bloquer maintenant',
    desc: 'Pour une durée choisie',
  },
  {
    key: 'schedule',
    icon: IconName.CALENDAR,
    title: 'Plage horaire',
    desc: 'Chaque jour, sur un créneau',
  },
  {
    key: 'daily_limit',
    icon: IconName.CHART,
    title: 'Limite de temps',
    desc: "Un quota d'usage par jour",
  },
]

const timeToDate = (h: number, m: number) => {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}
const minutesToDate = (min: number) => timeToDate(Math.floor(min / 60), min % 60)
const dateToMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes()
const hhmm = (d: Date) =>
  `${d.getHours()}h${d.getMinutes() ? String(d.getMinutes()).padStart(2, '0') : ''}`

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} h`
  return `${h} h ${m}`
}

export default function AddScreen() {
  const [type, setType] = useState<TypeKey>('block_now')
  const [count, setCount] = useState(0)
  const [working, setWorking] = useState(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const createRule = useCreateRuleMutation()

  const [durationMin, setDurationMin] = useState(30)
  const [strict, setStrict] = useState(false)
  const [start, setStart] = useState(() => timeToDate(22, 0))
  const [end, setEnd] = useState(() => timeToDate(8, 0))
  const [limitMin, setLimitMin] = useState(60)

  const durationValue = useMemo(() => minutesToDate(durationMin), [durationMin])
  const limitValue = useMemo(() => minutesToDate(limitMin), [limitMin])

  const appsLabel =
    count === 0
      ? 'Aucune app'
      : `${count} app${count > 1 ? 's' : ''}`

  const onPickApps = async () => {
    if (!ScreenTime.isAvailable) {
      setCount(2)
      return
    }
    try {
      const auth = await ScreenTime.requestAuthorization()
      if (auth !== 'approved') return
      const res = await ScreenTime.presentPicker()
      setCount(res.count)
    } catch (e) {
      showErrorToast(e)
    }
  }

  const explainStrict = () =>
    Alert.alert(
      'Mode strict',
      "Une fois activé, tu ne peux pas arrêter le blocage avant la fin — même en rouvrant Relock. Idéal pour tenir un engagement.",
      [{ text: 'Compris' }],
    )

  const buildConfig = (): Record<string, unknown> => {
    if (type === 'block_now')
      return { mode: 'block_now', duration_min: durationMin, strict }
    if (type === 'schedule')
      return {
        start_hour: start.getHours(),
        start_minute: start.getMinutes(),
        end_hour: end.getHours(),
        end_minute: end.getMinutes(),
      }
    return { limit_min: limitMin }
  }

  const summary = (): string => {
    const apps = `${count} app${count > 1 ? 's' : ''}`
    if (type === 'block_now')
      return `${apps} · bloquée${count > 1 ? 's' : ''} ${fmtDuration(durationMin)}${strict ? ' · mode strict' : ''}`
    if (type === 'schedule')
      return `${apps} · chaque jour ${hhmm(start)} → ${hhmm(end)}`
    return `${apps} · limite ${fmtDuration(limitMin)} / jour`
  }

  const runNative = async () => {
    if (type === 'block_now')
      await ScreenTime.startTimedBlock(durationMin, strict)
    else if (type === 'schedule')
      await ScreenTime.startSchedule(
        start.getHours(),
        start.getMinutes(),
        end.getHours(),
        end.getMinutes(),
      )
    else await ScreenTime.startDailyLimit(limitMin)
  }

  const onSubmit = async () => {
    if (count === 0 || working || createRule.isPending) return
    setWorking(true)
    try {
      if (ScreenTime.isAvailable) {
        const auth = await ScreenTime.requestAuthorization()
        if (auth !== 'approved') {
          Alert.alert('Autorisation requise', "Active l'accès Temps d'écran.")
          return
        }
        await runNative()
      }
      await createRule.mutateAsync({
        type: DB_TYPE[type],
        appIds: [],
        count,
        config: buildConfig(),
      })
      setSuccessMsg(summary())
    } catch (e) {
      showErrorToast(e)
    } finally {
      setWorking(false)
    }
  }

  const submitting = working || createRule.isPending
  const disabled = count === 0 || submitting

  return (
    <ScreenWrapper>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retour"
            onPress={() => goBack()}
            hitSlop={8}
            style={styles.backBtn}
          >
            <IconSvg name={IconName.BACK} size={18} color={C.ink} />
          </Pressable>
          <Text style={[f(700), { fontSize: 17, color: C.ink }]}>
            Nouveau blocage
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* 1. Type */}
        <Text style={[f(500), styles.section]}>Comment veux-tu bloquer ?</Text>
        <View style={{ gap: 12 }}>
          {TYPES.map(tp => {
            const sel = type === tp.key
            return (
              <Pressable
                key={tp.key}
                accessibilityRole="radio"
                accessibilityState={{ selected: sel }}
                onPress={() => setType(tp.key)}
                style={[
                  styles.typeCard,
                  sel && { backgroundColor: C.ambient10, borderColor: C.accent },
                ]}
              >
                <View
                  style={[
                    styles.typeIcon,
                    { backgroundColor: sel ? C.ambient18 : C.surface2 },
                  ]}
                >
                  <IconSvg
                    name={tp.icon}
                    size={20}
                    color={sel ? C.accent : C.ink2}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[f(600), { fontSize: 15.5, color: C.ink }]}>
                    {tp.title}
                  </Text>
                  <Text
                    style={[
                      f(400),
                      { fontSize: 13, color: C.ink2, marginTop: 3 },
                    ]}
                  >
                    {tp.desc}
                  </Text>
                </View>
                <View style={[styles.dot, sel && styles.dotOn]}>
                  {sel && (
                    <IconSvg name={IconName.CHECK} size={13} color={C.bg} />
                  )}
                </View>
              </Pressable>
            )
          })}
        </View>

        {/* 2. Réglage du type */}
        <Text style={[f(500), styles.section]}>Réglage</Text>

        {type === 'block_now' && (
          <>
            <View style={styles.card}>
              <View style={styles.cardHeadRow}>
                <Text style={[f(600), { fontSize: 15, color: C.ink }]}>
                  Durée
                </Text>
                <Text style={[f(600), { fontSize: 15, color: C.accent }]}>
                  {fmtDuration(durationMin)}
                </Text>
              </View>
              <View style={styles.pickerWrap}>
                <DateTimePicker
                  mode="countdown"
                  display="spinner"
                  value={durationValue}
                  minuteInterval={5}
                  themeVariant="dark"
                  onChange={(_e, d) => d && setDurationMin(dateToMinutes(d))}
                />
              </View>
              <Text style={[f(400), styles.hint]}>Minimum 15 minutes.</Text>
            </View>

            <View style={[styles.card, styles.strictCard]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={styles.strictTitleRow}>
                  <Text style={[f(600), { fontSize: 15.5, color: C.ink }]}>
                    Mode strict
                  </Text>
                  <Pressable onPress={explainStrict} hitSlop={12}>
                    <View style={styles.help}>
                      <Text style={[f(700), { fontSize: 12, color: C.ink2 }]}>
                        ?
                      </Text>
                    </View>
                  </Pressable>
                </View>
                <Text style={[f(400), { fontSize: 13, color: C.ink2, marginTop: 3 }]}>
                  Impossible d'arrêter avant la fin.
                </Text>
              </View>
              <Switch
                value={strict}
                onValueChange={setStrict}
                trackColor={{ false: C.surface2, true: C.accent }}
                thumbColor="#FFFFFF"
                ios_backgroundColor={C.surface2}
              />
            </View>
          </>
        )}

        {type === 'schedule' && (
          <View style={styles.card}>
            <View style={styles.timeRow}>
              <Text style={[f(600), { fontSize: 15, color: C.ink }]}>Début</Text>
              <DateTimePicker
                mode="time"
                display="compact"
                value={start}
                themeVariant="dark"
                onChange={(_e, d) => d && setStart(d)}
              />
            </View>
            <View style={styles.hairline} />
            <View style={styles.timeRow}>
              <Text style={[f(600), { fontSize: 15, color: C.ink }]}>Fin</Text>
              <DateTimePicker
                mode="time"
                display="compact"
                value={end}
                themeVariant="dark"
                onChange={(_e, d) => d && setEnd(d)}
              />
            </View>
            <Text style={[f(400), styles.hint]}>
              Bloqué chaque jour {hhmm(start)} → {hhmm(end)}. Une fin avant le
              début traverse la nuit.
            </Text>
          </View>
        )}

        {type === 'daily_limit' && (
          <View style={styles.card}>
            <View style={styles.cardHeadRow}>
              <Text style={[f(600), { fontSize: 15, color: C.ink }]}>
                Limite / jour
              </Text>
              <Text style={[f(600), { fontSize: 15, color: C.accent }]}>
                {fmtDuration(limitMin)}
              </Text>
            </View>
            <View style={styles.pickerWrap}>
              <DateTimePicker
                mode="countdown"
                display="spinner"
                value={limitValue}
                minuteInterval={5}
                themeVariant="dark"
                onChange={(_e, d) => d && setLimitMin(dateToMinutes(d))}
              />
            </View>
            <Text style={[f(400), styles.hint]}>
              Au-delà, blocage jusqu'au lendemain.
            </Text>
          </View>
        )}

        {/* 3. Apps */}
        <Text style={[f(500), styles.section]}>Applications</Text>
        <Pressable onPress={onPickApps} style={styles.card}>
          <View style={styles.appsRow}>
            <View style={styles.appsIcon}>
              <IconSvg name={IconName.BLOCK} size={20} color={C.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[f(600), { fontSize: 15.5, color: C.ink }]}>
                {count === 0 ? 'Choisir les apps' : appsLabel}
              </Text>
              <Text style={[f(400), { fontSize: 13, color: C.ink2, marginTop: 3 }]}>
                {count === 0 ? "Sélecteur d'Apple" : 'Touche pour modifier'}
              </Text>
            </View>
            <IconSvg name={IconName.PLUS} size={20} color={C.accent} />
          </View>
        </Pressable>
      </ScrollView>

      {/* CTA fixe en bas */}
      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          disabled={disabled}
          onPress={onSubmit}
          style={[styles.cta, { backgroundColor: disabled ? C.surface2 : C.accent }]}
        >
          <Text style={[f(700), { fontSize: 16, color: disabled ? C.ink3 : C.bg }]}>
            {submitting ? 'Activation…' : 'Activer le blocage'}
          </Text>
        </Pressable>
      </View>

      {/* Succès */}
      <Modal visible={!!successMsg} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.successCard}>
            <View style={styles.successCheck}>
              <IconSvg name={IconName.CHECK} size={30} color={C.bg} />
            </View>
            <Text style={[f(700), { fontSize: 20, color: C.ink, marginTop: 16 }]}>
              C'est activé
            </Text>
            <Text
              style={[
                f(400),
                {
                  fontSize: 14.5,
                  color: C.ink2,
                  textAlign: 'center',
                  marginTop: 8,
                  lineHeight: 21,
                },
              ]}
            >
              {successMsg}
            </Text>
            <Pressable
              onPress={() => {
                setSuccessMsg(null)
                goBack()
              }}
              style={styles.successBtn}
            >
              <Text style={[f(700), { fontSize: 15.5, color: C.bg }]}>
                Terminé
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 120 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 44,
    marginBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    fontSize: 13.5,
    color: C.ink3,
    marginTop: 30,
    marginBottom: 14,
  },
  typeCard: {
    borderRadius: 18,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(148,152,178,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotOn: { backgroundColor: C.accent, borderColor: C.accent },
  card: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 20,
  },
  cardHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerWrap: { alignItems: 'center', marginTop: 6 },
  hint: { fontSize: 12.5, color: C.ink3, marginTop: 8, lineHeight: 17 },
  strictCard: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  strictTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  help: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  hairline: { height: 1, backgroundColor: C.hair, marginVertical: 12 },
  appsRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  appsIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    backgroundColor: C.bg,
  },
  cta: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  successCard: {
    alignSelf: 'stretch',
    backgroundColor: '#1A1D27',
    borderRadius: 26,
    padding: 28,
    alignItems: 'center',
  },
  successCheck: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successBtn: {
    alignSelf: 'stretch',
    height: 52,
    borderRadius: 16,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
})
