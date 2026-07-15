import { IconName } from '@assets/icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  type LayoutChangeEvent,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useCreateRuleMutation } from '@/features/blocking/hooks/useCreateRuleMutation'
import { NotificationService } from '@/features/notifications/notification.service'
import {
  hasAskedNotifPermission,
  markNotifPermissionAsked,
} from '@/features/notifications/prefs'
import { goBack } from '@/navigation/helpers/navigation-helpers'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { ScreenTime } from '@/shared/native/screen-time'
import type { BlockRuleType } from '@/shared/services/supabase/database.types'
import { fonts } from '@/shared/theme/tokens/fonts'
import { showErrorToast } from '@/shared/utils/toast'
import { genUUID } from '@/shared/utils/uuid'

// Libs natives (flou + taptic) chargées en douceur : si le module natif n'est
// pas encore lié, on retombe sur un fond assombri / pas de haptic.
let BlurView: React.ComponentType<{
  style?: unknown
  blurType?: string
  blurAmount?: number
  reducedTransparencyFallbackColor?: string
}> | null = null
try {
  BlurView = require('@react-native-community/blur').BlurView
} catch {}
let HapticModule: { trigger: (t: string, o?: unknown) => void } | null = null
try {
  HapticModule = require('react-native-haptic-feedback').default
} catch {}
const tapHaptic = () => {
  try {
    HapticModule?.trigger('impactLight', {
      enableVibrateFallback: true,
      ignoreAndroidSystemSettings: false,
    })
  } catch {}
}

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
  sheet: '#14161E',
  surface: '#1A1D27',
  surface2: '#242836',
  ink: '#F0F0F4',
  ink2: '#A8ABBE',
  ink3: '#6B6F82',
  accent: '#A49AFE',
  hair: 'rgba(255,255,255,0.06)',
  ambient10: 'rgba(164,154,254,0.10)',
  ambient18: 'rgba(164,154,254,0.18)',
}

const GRAB = 26 // hauteur de la zone poignée
const BOTTOM = 30 // marge basse (home indicator + air)

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
const minutesToDate = (min: number) =>
  timeToDate(Math.floor(min / 60), min % 60)
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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/** Ligne de type (étape 1) — flèche + léger scale au press. */
function TypeRow({
  icon,
  title,
  desc,
  onPress,
}: {
  icon: IconName
  title: string
  desc: string
  onPress: () => void
}) {
  const scale = useSharedValue(1)
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))
  return (
    <AnimatedPressable
      onPressIn={() => {
        scale.value = withSpring(0.96, { damping: 22, stiffness: 320 })
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 22, stiffness: 320 })
      }}
      onPress={onPress}
      style={[styles.typeRow, style]}
    >
      <View style={styles.typeIcon}>
        <IconSvg name={icon} size={20} color={C.accent} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[f(600), { fontSize: 15.5, color: C.ink }]}>{title}</Text>
        <Text style={[f(400), { fontSize: 13, color: C.ink2, marginTop: 3 }]}>
          {desc}
        </Text>
      </View>
      <IconSvg name={IconName.FORWARD} size={18} color={C.ink3} />
    </AnimatedPressable>
  )
}

export default function AddScreen() {
  const { height: SCREEN_H, width: SCREEN_W } = useWindowDimensions()
  const MAXH = Math.round(SCREEN_H * 0.9)

  const [step, setStep] = useState<0 | 1>(0)
  const [type, setType] = useState<TypeKey>('block_now')
  const [name, setName] = useState('')
  const [count, setCount] = useState(0)
  const [working, setWorking] = useState(false)
  // Verrou SYNCHRONE anti double-soumission : `working` (state) ne se met à
  // jour qu'au prochain render, donc deux taps rapides le liraient à false et
  // créeraient deux règles. Un ref bloque dès le premier tap.
  const submitting = useRef(false)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [warn, setWarn] = useState<string | null>(null)
  const createRule = useCreateRuleMutation()

  const [durationMin, setDurationMin] = useState(30)
  const [strict, setStrict] = useState(false)
  const [start, setStart] = useState(() => timeToDate(22, 0))
  const [end, setEnd] = useState(() => timeToDate(8, 0))
  const [limitMin, setLimitMin] = useState(60)
  const durationValue = useMemo(() => minutesToDate(durationMin), [durationMin])
  const limitValue = useMemo(() => minutesToDate(limitMin), [limitMin])

  // Hauteur adaptative : on mesure le contenu de chaque étape.
  const [contentH, setContentH] = useState<[number, number]>([
    Math.round(SCREEN_H * 0.42),
    Math.round(SCREEN_H * 0.58),
  ])
  const measure = (i: 0 | 1) => (e: LayoutChangeEvent) => {
    const h = Math.round(e.nativeEvent.layout.height)
    setContentH(prev =>
      prev[i] === h ? prev : i === 0 ? [h, prev[1]] : [prev[0], h],
    )
  }

  // Animations
  const translateY = useSharedValue(SCREEN_H)
  const backdrop = useSharedValue(0)
  const stepX = useSharedValue(0)
  const sheetH = useSharedValue(Math.round(SCREEN_H * 0.42) + GRAB)
  const firstMeasure = useRef(true)

  const target = Math.min(MAXH, GRAB + contentH[step])

  // Entrée : simple glissé vers le haut, sans rebond.
  useEffect(() => {
    translateY.value = withTiming(0, {
      duration: 340,
      easing: Easing.out(Easing.cubic),
    })
    backdrop.value = withTiming(1, { duration: 240 })
    // Valeurs partagées Reanimated : références stables → mount-only.
  }, [backdrop, translateY])

  // Ajuste la hauteur au contenu (instantané au 1er layout, animé ensuite).
  useEffect(() => {
    if (firstMeasure.current) {
      sheetH.value = target
      firstMeasure.current = false
    } else {
      sheetH.value = withTiming(target, {
        duration: 300,
        easing: Easing.out(Easing.cubic),
      })
    }
  }, [sheetH, target])

  const close = () => {
    backdrop.value = withTiming(0, { duration: 200 })
    translateY.value = withTiming(
      SCREEN_H,
      { duration: 240, easing: Easing.in(Easing.cubic) },
      fin => {
        if (fin) runOnJS(goBack)()
      },
    )
  }

  const goStep = (s: 0 | 1) => {
    setStep(s)
    stepX.value = withTiming(s, {
      duration: 300,
      easing: Easing.out(Easing.cubic),
    })
  }

  const onSelectType = (k: TypeKey) => {
    tapHaptic()
    setType(k)
    goStep(1)
  }

  const pan = Gesture.Pan()
    .onUpdate(e => {
      translateY.value = Math.max(0, e.translationY)
    })
    .onEnd(e => {
      if (e.translationY > 110 || e.velocityY > 900) {
        runOnJS(close)()
      } else {
        translateY.value = withSpring(0, { damping: 30, stiffness: 240 })
      }
    })

  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }))
  const sheetStyle = useAnimatedStyle(() => ({
    height: sheetH.value,
    transform: [{ translateY: translateY.value }],
  }))
  const pagerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: -stepX.value * SCREEN_W }],
  }))

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
      'Une fois activé, tu ne peux pas arrêter le blocage avant la fin — même en rouvrant Relock. Idéal pour tenir un engagement.',
      [{ text: 'Compris' }],
    )

  // Engagement EXPLICITE avant d'armer un strict : le blocage devient non
  // annulable dans l'app jusqu'à la fin. On rend ce choix conscient (pas un
  // simple toggle qu'on active sans réaliser).
  const confirmStrictCommitment = (): Promise<boolean> =>
    new Promise(resolve => {
      const endLabel = hhmm(new Date(Date.now() + durationMin * 60_000))
      Alert.alert(
        'Mode strict — tu t’engages',
        `Tu ne pourras plus arrêter ce blocage avant ${endLabel}, même en fermant Relock. C’est le but : tenir.`,
        [
          { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
          {
            text: 'Je m’engage',
            style: 'destructive',
            onPress: () => resolve(true),
          },
        ],
        { cancelable: false },
      )
    })

  const buildConfig = (): Record<string, unknown> => {
    const base = name.trim() ? { name: name.trim() } : {}
    if (type === 'block_now')
      return { ...base, mode: 'block_now', duration_min: durationMin, strict }
    if (type === 'schedule')
      return {
        ...base,
        start_hour: start.getHours(),
        start_minute: start.getMinutes(),
        end_hour: end.getHours(),
        end_minute: end.getMinutes(),
      }
    return { ...base, limit_min: limitMin }
  }

  const summary = (): string => {
    const apps = `${count} app${count > 1 ? 's' : ''}`
    if (type === 'block_now')
      return `${apps} · bloquée${count > 1 ? 's' : ''} ${fmtDuration(durationMin)}${strict ? ' · mode strict' : ''}`
    if (type === 'schedule')
      return `${apps} · chaque jour ${hhmm(start)} → ${hhmm(end)}`
    return `${apps} · limite ${fmtDuration(limitMin)} / jour`
  }

  const runNative = async (ruleId: string) => {
    if (type === 'block_now')
      await ScreenTime.startTimedBlock(ruleId, durationMin, strict)
    else if (type === 'schedule')
      await ScreenTime.startSchedule(
        ruleId,
        start.getHours(),
        start.getMinutes(),
        end.getHours(),
        end.getMinutes(),
      )
    else await ScreenTime.startDailyLimit(ruleId, limitMin)
  }

  const nativeKind = () =>
    type === 'schedule'
      ? 'schedule'
      : type === 'daily_limit'
        ? 'limit'
        : 'timed'

  // Soft-ask CONTEXTUEL : après le tout premier blocage (moment de valeur), on
  // propose UNE fois les rappels — jamais au lancement de l'app.
  const maybeAskNotifPermission = () => {
    if (hasAskedNotifPermission() || !NotificationService) return
    markNotifPermissionAsked()
    Alert.alert(
      'Un coup de pouce discret ?',
      "Relock peut t'envoyer un rappel si ta série est en danger — jamais de spam, et tu gardes le contrôle depuis les Réglages.",
      [
        { text: 'Non merci', style: 'cancel' },
        {
          text: 'Activer les rappels',
          onPress: () => {
            NotificationService.ensurePermission().catch(() => {})
          },
        },
      ],
    )
  }

  const onSubmit = async () => {
    if (count === 0 || working || createRule.isPending || submitting.current)
      return
    // iOS impose des fenêtres DeviceActivity d'au moins 15 min.
    if (type === 'schedule') {
      const s = start.getHours() * 60 + start.getMinutes()
      const e = end.getHours() * 60 + end.getMinutes()
      if (s === e) {
        setWarn(
          'Le début et la fin doivent être différents (sinon la plage dure 24 h).',
        )
        return
      }
      const win = e - s > 0 ? e - s : e - s + 1440
      if (win < 15) {
        setWarn(
          'Ta plage est trop courte. Choisis un créneau d’au moins 15 minutes.',
        )
        return
      }
    }
    // Blocage strict = engagement irréversible dans l'app → double confirmation.
    if (type === 'block_now' && strict) {
      const committed = await confirmStrictCommitment()
      if (!committed) return
    }
    submitting.current = true
    setWorking(true)
    // Id CLIENT : lie la mécanique native à la future ligne DB.
    const ruleId = genUUID()
    let nativeArmed = false
    try {
      if (ScreenTime.isAvailable) {
        const auth = await ScreenTime.requestAuthorization()
        if (auth !== 'approved') {
          Alert.alert('Autorisation requise', "Active l'accès Temps d'écran.")
          return
        }
        await ScreenTime.bindSelection(ruleId)
        await runNative(ruleId)
        nativeArmed = true
      }
      await createRule.mutateAsync({
        id: ruleId,
        type: DB_TYPE[type],
        appIds: [],
        count,
        config: buildConfig(),
      })
      setSuccessMsg(summary())
      maybeAskNotifPermission()
    } catch (e) {
      // La règle DB a échoué : on désarme le natif pour ne pas laisser un
      // blocage orphelin (invisible dans l'app).
      if (nativeArmed) {
        await ScreenTime.clearRuleData(ruleId, nativeKind()).catch(() => {})
      }
      const msg = String((e as { message?: string })?.message ?? e ?? '')
      if (/too short|schedule/i.test(msg)) {
        setWarn(
          'Ta plage est trop courte. Choisis un créneau d’au moins 15 minutes.',
        )
      } else {
        showErrorToast(e)
      }
    } finally {
      setWorking(false)
      submitting.current = false
    }
  }

  const disabled = count === 0 || working || createRule.isPending
  const typeTitle = TYPES.find(t => t.key === type)?.title ?? ''

  return (
    <View style={styles.root}>
      {/* Fond flouté (léger) + assombri, tap pour fermer */}
      <AnimatedPressable
        style={[StyleSheet.absoluteFill, backdropStyle]}
        onPress={close}
      >
        {BlurView ? (
          <BlurView
            style={StyleSheet.absoluteFill as object}
            blurType="dark"
            blurAmount={9}
            reducedTransparencyFallbackColor="#0B0C10"
          />
        ) : null}
        <View style={styles.dim} />
      </AnimatedPressable>

      {/* Demi-feuille */}
      <Animated.View style={[styles.sheet, sheetStyle]}>
        <GestureDetector gesture={pan}>
          <View style={styles.grabZone}>
            <View style={styles.grabber} />
          </View>
        </GestureDetector>

        <Animated.View
          style={[styles.pager, { width: SCREEN_W * 2 }, pagerStyle]}
        >
          {/* Étape 1 : choix du type */}
          <View style={{ width: SCREEN_W }}>
            <View style={styles.panel} onLayout={measure(0)}>
              <Text style={[f(700), styles.h1]}>Nouveau blocage</Text>
              <Text style={[f(400), styles.sub]}>Quel type de blocage ?</Text>
              <View style={{ gap: 14, marginTop: 24 }}>
                {TYPES.map(tp => (
                  <TypeRow
                    key={tp.key}
                    icon={tp.icon}
                    title={tp.title}
                    desc={tp.desc}
                    onPress={() => onSelectType(tp.key)}
                  />
                ))}
              </View>
            </View>
          </View>

          {/* Étape 2 : réglage + apps + CTA */}
          <View style={{ width: SCREEN_W }}>
            <View style={styles.panel} onLayout={measure(1)}>
              <View style={styles.step2Head}>
                <Pressable
                  onPress={() => goStep(0)}
                  hitSlop={10}
                  style={styles.backBtn}
                >
                  <IconSvg name={IconName.BACK} size={18} color={C.ink} />
                </Pressable>
                <Text style={[f(700), { fontSize: 17, color: C.ink }]}>
                  {typeTitle}
                </Text>
                <View style={{ width: 36 }} />
              </View>

              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Nom (optionnel)"
                placeholderTextColor={C.ink3}
                maxLength={30}
                style={[f(500), styles.nameInput]}
              />

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
                        onChange={(_e, d) =>
                          d && setDurationMin(dateToMinutes(d))
                        }
                      />
                    </View>
                  </View>
                  <View style={[styles.card, styles.strictCard]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <View style={styles.strictTitleRow}>
                        <Text
                          style={[f(600), { fontSize: 15.5, color: C.ink }]}
                        >
                          Mode strict
                        </Text>
                        <Pressable onPress={explainStrict} hitSlop={12}>
                          <View style={styles.help}>
                            <Text
                              style={[f(700), { fontSize: 12, color: C.ink2 }]}
                            >
                              ?
                            </Text>
                          </View>
                        </Pressable>
                      </View>
                      <Text
                        style={[
                          f(400),
                          { fontSize: 13, color: C.ink2, marginTop: 3 },
                        ]}
                      >
                        Impossible d'arrêter avant la fin.
                      </Text>
                    </View>
                    <Switch
                      value={strict}
                      onValueChange={v => {
                        tapHaptic()
                        setStrict(v)
                      }}
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
                  <View style={styles.hairline} />
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
                  <Text style={[f(400), styles.hint]}>
                    Chaque jour {hhmm(start)} → {hhmm(end)}.
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
                </View>
              )}

              <Pressable
                onPress={onPickApps}
                style={[styles.card, styles.appsCard]}
              >
                <View style={styles.appsIcon}>
                  <IconSvg name={IconName.BLOCK} size={20} color={C.accent} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[f(600), { fontSize: 15.5, color: C.ink }]}>
                    {count === 0
                      ? 'Choisir les apps'
                      : `${count} app${count > 1 ? 's' : ''}`}
                  </Text>
                  <Text
                    style={[
                      f(400),
                      { fontSize: 13, color: C.ink2, marginTop: 3 },
                    ]}
                  >
                    {count === 0 ? "Sélecteur d'Apple" : 'Touche pour modifier'}
                  </Text>
                </View>
                <IconSvg name={IconName.PLUS} size={20} color={C.accent} />
              </Pressable>

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
                  style={[
                    f(700),
                    { fontSize: 16, color: disabled ? C.ink3 : C.bg },
                  ]}
                >
                  {working || createRule.isPending
                    ? 'Activation…'
                    : 'Activer le blocage'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Animated.View>
      </Animated.View>

      {/* Succès */}
      <Modal visible={!!successMsg} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.successCard}>
            <View style={styles.successCheck}>
              <IconSvg name={IconName.CHECK} size={30} color={C.bg} />
            </View>
            <Text
              style={[f(700), { fontSize: 20, color: C.ink, marginTop: 16 }]}
            >
              C'est activé
            </Text>
            <Text style={[f(400), styles.successSub]}>{successMsg}</Text>
            <Pressable
              onPress={() => {
                setSuccessMsg(null)
                close()
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

      {/* Avertissement (ex : plage trop courte) */}
      <Modal visible={!!warn} transparent animationType="fade">
        <View style={styles.modalBg}>
          <View style={styles.successCard}>
            <View style={styles.warnBadge}>
              <IconSvg name={IconName.CALENDAR} size={28} color={C.accent} />
            </View>
            <Text
              style={[f(700), { fontSize: 20, color: C.ink, marginTop: 16 }]}
            >
              Plage trop courte
            </Text>
            <Text style={[f(400), styles.successSub]}>{warn}</Text>
            <Pressable onPress={() => setWarn(null)} style={styles.successBtn}>
              <Text style={[f(700), { fontSize: 15.5, color: C.bg }]}>
                Compris
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,7,10,0.28)',
  },
  sheet: {
    backgroundColor: C.sheet,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
    // Ombre violette douce et diffuse (remplace la bordure brillante)
    shadowColor: C.accent,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.32,
    shadowRadius: 26,
  },
  grabZone: { alignItems: 'center', paddingTop: 10, paddingBottom: 10 },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  pager: { flexDirection: 'row' },
  panel: { paddingHorizontal: 22, paddingBottom: BOTTOM },
  h1: { fontSize: 22, color: C.ink, letterSpacing: -0.3 },
  sub: { fontSize: 14.5, color: C.ink2, marginTop: 6 },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: C.surface,
    borderRadius: 18,
    padding: 16,
  },
  typeIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: C.ambient10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  step2Head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  nameInput: {
    backgroundColor: C.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    height: 48,
    fontSize: 15,
    color: C.ink,
    marginBottom: 14,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: { backgroundColor: C.surface, borderRadius: 20, padding: 18 },
  cardHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerWrap: { alignItems: 'center', marginTop: 2 },
  hint: { fontSize: 12.5, color: C.ink3, marginTop: 8, lineHeight: 17 },
  strictCard: {
    marginTop: 16,
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
  appsCard: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  appsIcon: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: C.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cta: {
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 22,
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
  warnBadge: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: C.ambient18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successSub: {
    fontSize: 14.5,
    color: C.ink2,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
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
