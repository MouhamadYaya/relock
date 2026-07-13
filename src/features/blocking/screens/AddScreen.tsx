import { IconName } from '@assets/icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import React, { useMemo, useState } from 'react'
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useCreateRuleMutation } from '@/features/blocking/hooks/useCreateRuleMutation'
import { goBack } from '@/navigation/helpers/navigation-helpers'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import { ScreenTime } from '@/shared/native/screen-time'
import type { BlockRuleType } from '@/shared/services/supabase/database.types'
import { fonts } from '@/shared/theme/tokens/fonts'
import { showErrorToast, showToast } from '@/shared/utils/toast'

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
  surface: '#161821',
  surface2: '#1C1F2B',
  ink: '#F0F0F4',
  ink2: '#A8ABBE',
  ink3: '#6B6F82',
  accent: '#A49AFE',
  border: 'rgba(148,152,178,0.16)',
  ambient08: 'rgba(164,154,254,0.08)',
  ambient16: 'rgba(164,154,254,0.16)',
  radioBorder: 'rgba(148,152,178,0.4)',
}

// clé UI → valeur d'enum DB (réutilisée avec un nouveau sens, pas de migration)
type TypeKey = 'block_now' | 'schedule' | 'daily_limit'
const DB_TYPE: Record<TypeKey, BlockRuleType> = {
  block_now: 'progressive_delay',
  schedule: 'schedule',
  daily_limit: 'daily_limit',
}

const TYPES: {
  key: TypeKey
  icon: IconName
  title: string
  desc: string
}[] = [
  {
    key: 'block_now',
    icon: IconName.CLOCK,
    title: 'Bloquer maintenant',
    desc: 'Bloque tout de suite pour une durée choisie',
  },
  {
    key: 'schedule',
    icon: IconName.CALENDAR,
    title: 'Plage horaire',
    desc: 'Bloque chaque jour sur un créneau (ex : 22h – 8h)',
  },
  {
    key: 'daily_limit',
    icon: IconName.CHART,
    title: 'Limite de temps / jour',
    desc: "Au-delà d'un temps d'usage, blocage jusqu'au lendemain",
  },
]

const timeToDate = (h: number, m: number) => {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}
const minutesToDate = (min: number) => timeToDate(Math.floor(min / 60), min % 60)
const dateToMinutes = (d: Date) => d.getHours() * 60 + d.getMinutes()

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
  const createRule = useCreateRuleMutation()

  // Paramètres par type
  const [durationMin, setDurationMin] = useState(30)
  const [strict, setStrict] = useState(false)
  const [start, setStart] = useState(() => timeToDate(22, 0))
  const [end, setEnd] = useState(() => timeToDate(8, 0))
  const [limitMin, setLimitMin] = useState(60)

  const durationValue = useMemo(() => minutesToDate(durationMin), [durationMin])
  const limitValue = useMemo(() => minutesToDate(limitMin), [limitMin])

  const onPickApps = async () => {
    if (!ScreenTime.isAvailable) {
      setCount(2)
      showToast('Simulateur : sélection factice (2 apps)')
      return
    }
    try {
      const auth = await ScreenTime.requestAuthorization()
      if (auth !== 'approved') {
        showToast("Autorisation Temps d'écran refusée")
        return
      }
      const res = await ScreenTime.presentPicker()
      setCount(res.count)
    } catch (e) {
      showErrorToast(e)
    }
  }

  const explainStrict = () =>
    Alert.alert(
      'Mode strict',
      "Une fois activé, tu ne peux PAS désactiver le blocage avant la fin de la durée — même en rouvrant Relock. Utile pour tenir un engagement. (Un blocage non strict peut être arrêté à tout moment.)",
      [{ text: 'Compris' }],
    )

  const buildConfig = (): Record<string, unknown> => {
    if (type === 'block_now') {
      return { mode: 'block_now', duration_min: durationMin, strict }
    }
    if (type === 'schedule') {
      return {
        start_hour: start.getHours(),
        start_minute: start.getMinutes(),
        end_hour: end.getHours(),
        end_minute: end.getMinutes(),
      }
    }
    return { limit_min: limitMin }
  }

  const runNative = async () => {
    if (type === 'block_now') {
      await ScreenTime.startTimedBlock(durationMin, strict)
    } else if (type === 'schedule') {
      await ScreenTime.startSchedule(
        start.getHours(),
        start.getMinutes(),
        end.getHours(),
        end.getMinutes(),
      )
    } else {
      await ScreenTime.startDailyLimit(limitMin)
    }
  }

  const onSubmit = async () => {
    if (count === 0 || working || createRule.isPending) return
    setWorking(true)
    try {
      if (ScreenTime.isAvailable) {
        const auth = await ScreenTime.requestAuthorization()
        if (auth !== 'approved') {
          showToast("Autorisation Temps d'écran refusée")
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
      showToast('Blocage activé')
      goBack()
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
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.container}>
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
            <View style={{ width: 36 }} />
          </View>

          {/* Type de blocage */}
          <Text style={[f(600), styles.sectionLabel]}>Type de blocage</Text>
          <View style={{ gap: 10 }}>
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
                    sel
                      ? {
                          backgroundColor: C.ambient08,
                          borderColor: C.accent,
                          borderWidth: 1.5,
                        }
                      : {
                          backgroundColor: C.surface,
                          borderColor: C.border,
                          borderWidth: 1,
                        },
                  ]}
                >
                  <View
                    style={[
                      styles.typeIcon,
                      { backgroundColor: sel ? C.ambient16 : C.surface2 },
                    ]}
                  >
                    <IconSvg
                      name={tp.icon}
                      size={21}
                      color={sel ? C.accent : C.ink2}
                    />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[f(600), { fontSize: 15, color: C.ink }]}>
                      {tp.title}
                    </Text>
                    <Text
                      style={[
                        f(400),
                        {
                          fontSize: 12.5,
                          color: C.ink2,
                          marginTop: 2,
                          lineHeight: 17,
                        },
                      ]}
                    >
                      {tp.desc}
                    </Text>
                  </View>
                  {sel ? (
                    <View style={styles.radioOn}>
                      <IconSvg name={IconName.CHECK} size={14} color={C.bg} />
                    </View>
                  ) : (
                    <View style={styles.radioOff} />
                  )}
                </Pressable>
              )
            })}
          </View>

          {/* Paramètres du type */}
          <Text style={[f(600), styles.sectionLabel]}>Réglages</Text>
          <View style={styles.paramCard}>
            {type === 'block_now' && (
              <>
                <Text style={[f(600), styles.paramTitle]}>
                  Durée du blocage
                </Text>
                <Text style={[f(400), styles.paramHint]}>
                  {fmtDuration(durationMin)} · minimum 15 min
                </Text>
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
                <Pressable
                  onPress={() => setStrict(s => !s)}
                  style={styles.strictRow}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                    <Text style={[f(600), { fontSize: 15, color: C.ink }]}>
                      Mode strict
                    </Text>
                    <Pressable onPress={explainStrict} hitSlop={10}>
                      <View style={styles.help}>
                        <Text style={[f(700), { fontSize: 11, color: C.ink2 }]}>
                          ?
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                  <View
                    style={[
                      styles.toggle,
                      { backgroundColor: strict ? C.accent : C.surface2 },
                    ]}
                  >
                    <View
                      style={[
                        styles.knob,
                        strict
                          ? { right: 3 }
                          : { left: 3, backgroundColor: C.ink3 },
                      ]}
                    />
                  </View>
                </Pressable>
              </>
            )}

            {type === 'schedule' && (
              <View style={{ gap: 4 }}>
                <View style={styles.timeRow}>
                  <Text style={[f(600), { fontSize: 15, color: C.ink }]}>
                    Début
                  </Text>
                  <DateTimePicker
                    mode="time"
                    display="compact"
                    value={start}
                    themeVariant="dark"
                    onChange={(_e, d) => d && setStart(d)}
                  />
                </View>
                <View style={styles.sep} />
                <View style={styles.timeRow}>
                  <Text style={[f(600), { fontSize: 15, color: C.ink }]}>
                    Fin
                  </Text>
                  <DateTimePicker
                    mode="time"
                    display="compact"
                    value={end}
                    themeVariant="dark"
                    onChange={(_e, d) => d && setEnd(d)}
                  />
                </View>
                <Text style={[f(400), styles.paramHint, { marginTop: 8 }]}>
                  Chaque jour de {start.getHours()}h à {end.getHours()}h. Une fin
                  avant le début traverse la nuit.
                </Text>
              </View>
            )}

            {type === 'daily_limit' && (
              <>
                <Text style={[f(600), styles.paramTitle]}>
                  Limite d'usage par jour
                </Text>
                <Text style={[f(400), styles.paramHint]}>
                  {fmtDuration(limitMin)} d'usage, puis blocage jusqu'au lendemain
                </Text>
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
              </>
            )}
          </View>

          {/* Choix des apps (sélecteur système Apple) */}
          <Text style={[f(600), styles.sectionLabel]}>Applications</Text>
          <Pressable onPress={onPickApps} style={styles.pickApps}>
            <View style={styles.pickIcon}>
              <IconSvg name={IconName.BLOCK} size={20} color={C.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={[f(600), { fontSize: 15, color: C.ink }]}>
                {count === 0
                  ? 'Choisir les apps à bloquer'
                  : `${count} app${count > 1 ? 's' : ''} sélectionnée${count > 1 ? 's' : ''}`}
              </Text>
              <Text style={[f(400), { fontSize: 12.5, color: C.ink2, marginTop: 2 }]}>
                Sélecteur système d'Apple
              </Text>
            </View>
            <IconSvg name={IconName.PLUS} size={20} color={C.accent} />
          </Pressable>

          {/* CTA */}
          <Pressable
            accessibilityRole="button"
            disabled={disabled}
            onPress={onSubmit}
            style={[
              styles.cta,
              { backgroundColor: disabled ? C.surface2 : C.accent },
            ]}
          >
            <Text
              style={[f(700), { fontSize: 16, color: disabled ? C.ink3 : C.bg }]}
            >
              {submitting ? 'Activation…' : 'Activer le blocage'}
            </Text>
          </Pressable>

          <View style={{ height: 24 }} />
        </View>
      </ScrollView>
    </ScreenWrapper>
  )
}

const styles = StyleSheet.create({
  scrollContent: { flexGrow: 1 },
  container: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 13,
    color: C.ink2,
    marginTop: 22,
    marginBottom: 12,
  },
  typeCard: {
    borderRadius: 16,
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  typeIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: C.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOff: {
    width: 23,
    height: 23,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: C.radioBorder,
  },
  paramCard: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
  },
  paramTitle: { fontSize: 15, color: C.ink },
  paramHint: { fontSize: 12.5, color: C.ink2, marginTop: 3, lineHeight: 17 },
  pickerWrap: { alignItems: 'center', marginTop: 4 },
  strictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingTop: 14,
  },
  help: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  sep: { height: 1, backgroundColor: C.border },
  toggle: {
    width: 44,
    height: 26,
    borderRadius: 99,
    justifyContent: 'center',
  },
  knob: {
    position: 'absolute',
    top: 3,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: C.bg,
  },
  pickApps: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  pickIcon: {
    width: 40,
    height: 40,
    borderRadius: 11,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
  },
})
