import { IconName } from '@assets/icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import { router, useLocalSearchParams } from 'expo-router'
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
import Svg, { Circle, Path, Line as SvgLine } from 'react-native-svg'
import {
  BLOCK_DURATION_OPTIONS,
  DAILY_LIMIT_OPTIONS,
  DurationWheel,
  nearestDurationOption,
} from '@/features/blocking/components/DurationWheel'
import { HoldToConfirmButton } from '@/features/blocking/components/HoldToConfirmButton'
import { StrictCommitmentSheet } from '@/features/blocking/components/StrictCommitmentSheet'
import { useBlockRulesQuery } from '@/features/blocking/hooks/useBlockRulesQuery'
import { useCreateRuleMutation } from '@/features/blocking/hooks/useCreateRuleMutation'
import { useUpdateRuleMutation } from '@/features/blocking/hooks/useUpdateRuleMutation'
import { returnToBlocks } from '@/features/blocking/navigation/return-to-blocks'
import { daysLabel } from '@/features/blocking/session'
import {
  type BlockingEditorType,
  isBlockingEditorType,
} from '@/features/blocking/types'
import { NotificationService } from '@/features/notifications/notification.service'
import {
  hasAskedNotifPermission,
  markNotifPermissionAsked,
} from '@/features/notifications/prefs'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { nativeKindOf, ScreenTime } from '@/shared/native/screen-time'
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
const f = (w: keyof typeof FW) => FW[w]

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

type TypeKey = BlockingEditorType
const DB_TYPE: Record<TypeKey, BlockRuleType> = {
  block_now: 'progressive_delay',
  schedule: 'schedule',
  daily_limit: 'daily_limit',
}

/** Lecture inverse — retrouver le type d'éditeur d'une règle qu'on modifie. */
const EDITOR_TYPE: Record<BlockRuleType, TypeKey> = {
  progressive_delay: 'block_now',
  schedule: 'schedule',
  daily_limit: 'daily_limit',
}

const cfgNum = (value: unknown, fallback: number): number =>
  typeof value === 'number' ? value : fallback

const TYPES: {
  key: TypeKey
  icon: IconName | 'range'
  title: string
  desc: string
}[] = [
  {
    key: 'block_now',
    icon: IconName.CLOCK,
    title: 'Bloquer maintenant',
    desc: 'Une fois, pour une durée choisie',
  },
  {
    key: 'schedule',
    icon: 'range',
    title: 'Plage horaire',
    desc: 'Bloqué tous les jours sur un créneau',
  },
  {
    key: 'daily_limit',
    icon: IconName.CHART,
    title: 'Limite de temps',
    desc: 'Un quota par jour, puis bloqué',
  },
]

const timeToDate = (h: number, m: number) => {
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}
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

/**
 * Icône « plage horaire » : un cadran dont une TRANCHE est mise en évidence.
 * Un calendrier ne disait rien d'un créneau — il évoquait des dates. Ici on
 * dessine littéralement ce qu'on vend : une portion de la journée.
 */
function RangeGlyph({ size = 20, color }: { size?: number; color: string }) {
  const c = 12
  const r = 8.6
  const pt = (deg: number): [number, number] => {
    const a = ((deg - 90) * Math.PI) / 180
    return [c + r * Math.cos(a), c + r * Math.sin(a)]
  }
  const [x1, y1] = pt(40)
  const [x2, y2] = pt(170)
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle
        cx={c}
        cy={c}
        r={r}
        stroke={color}
        strokeWidth={1.5}
        opacity={0.32}
        fill="none"
      />
      <Path
        d={`M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`}
        stroke={color}
        strokeWidth={2.6}
        strokeLinecap="round"
        fill="none"
      />
      <SvgLine x1={c} y1={c} x2={x1} y2={y1} stroke={color} strokeWidth={1.5} />
      <SvgLine x1={c} y1={c} x2={x2} y2={y2} stroke={color} strokeWidth={1.5} />
      <Circle cx={c} cy={c} r={1.5} fill={color} />
    </Svg>
  )
}

// Deux questions DISTINCTES (§7) : « quels jours » et « combien de temps ».
// Surtout pas « est-ce répétitif ? » — une plage l'est par définition, et la
// question obligerait l'utilisateur à modéliser le système pour y répondre.
const DAY_PRESETS: { label: string; days: number[] | null }[] = [
  { label: 'Tous les jours', days: null },
  { label: 'Lun → Ven', days: [1, 2, 3, 4, 5] },
  { label: 'Week-end', days: [0, 6] },
]
const sameDays = (a: number[] | null, b: number[] | null) =>
  a === null || b === null ? a === b : a.join() === b.join()

function closeEditorRoute() {
  if (router.canGoBack()) router.back()
  else returnToBlocks()
}

/** Après une création réussie : direction Blocages, peu importe d'où on vient. */
function goToBlocksAfterCreate() {
  returnToBlocks()
}

function Chip({
  label,
  on,
  onPress,
}: {
  label: string
  on: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[styles.chip, on && styles.chipOn]}
    >
      <Text style={[f(600), { fontSize: 13, color: on ? C.bg : C.ink2 }]}>
        {label}
      </Text>
    </Pressable>
  )
}

/** Ligne de type (étape 1) — flèche + léger scale au press. */
function TypeRow({
  icon,
  title,
  desc,
  onPress,
}: {
  icon: IconName | 'range'
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
        {icon === 'range' ? (
          <RangeGlyph color={C.accent} />
        ) : (
          <IconSvg name={icon} size={20} color={C.accent} />
        )}
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
  const t = useT()
  const { type: typeParam, id: editId } = useLocalSearchParams<{
    type?: string
    id?: string
  }>()
  const initialType = isBlockingEditorType(typeParam) ? typeParam : null
  // Édition : même écran, même réglages — seule la sortie change (on met à
  // jour la règle au lieu d'en créer une, et on revient à sa fiche).
  const editing = typeof editId === 'string' && editId.length > 0

  const [step, setStep] = useState<0 | 1>(() => (initialType ? 1 : 0))
  const [type, setType] = useState<TypeKey>(() => initialType ?? 'block_now')
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
  const updateRule = useUpdateRuleMutation()
  const { rules } = useBlockRulesQuery()
  const editedRule = editing
    ? rules.find(rule => rule.id === editId)
    : undefined
  // La sélection d'apps n'est ré-écrite QUE si l'utilisateur a rouvert le
  // sélecteur : sinon on recopierait le brouillon global sur cette règle.
  const appsRepicked = useRef(false)
  const prefilled = useRef(false)
  // Engagement du mode strict : la feuille rend sa réponse à la promesse que
  // `onSubmit` attend, exactement comme le faisait l'alerte système.
  const [strictPrompt, setStrictPrompt] = useState(false)
  const strictAnswer = useRef<((committed: boolean) => void) | null>(null)

  const [durationMin, setDurationMin] = useState(30)
  const [strict, setStrict] = useState(false)
  // Jours d'application (plage + limite). `null` ⇒ tous les jours.
  // Un blocage vit jusqu'à ce que l'utilisateur le mette en pause ou le
  // supprime : rien ne s'auto-détruit dans son dos.
  const [days, setDays] = useState<number[] | null>(null)
  const [start, setStart] = useState(() => timeToDate(22, 0))
  const [end, setEnd] = useState(() => timeToDate(8, 0))
  const [limitMin, setLimitMin] = useState(60)

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

  useEffect(() => {
    if (!initialType) return
    if (initialType !== 'block_now') setStrict(false)
    setType(initialType)
    setStep(1)
    stepX.value = 1
  }, [initialType, stepX])

  // Pré-remplissage : une seule fois, dès que la règle arrive du cache. Le
  // verrou évite qu'une invalidation React Query ne réécrase, en plein
  // réglage, ce que l'utilisateur vient de changer.
  useEffect(() => {
    if (!editedRule || prefilled.current) return
    prefilled.current = true
    const config = editedRule.config ?? {}
    const editorType = EDITOR_TYPE[editedRule.type]
    setType(editorType)
    setStep(1)
    stepX.value = 1
    setName(typeof config.name === 'string' ? config.name : '')
    setCount(editedRule.count ?? 0)
    setDays(Array.isArray(config.days) ? (config.days as number[]) : null)
    if (editorType === 'block_now') {
      setDurationMin(
        nearestDurationOption(
          cfgNum(config.duration_min, 30),
          BLOCK_DURATION_OPTIONS,
        ),
      )
      setStrict(config.strict === true)
      return
    }
    if (editorType === 'schedule') {
      setStart(
        timeToDate(
          cfgNum(config.start_hour, 22),
          cfgNum(config.start_minute, 0),
        ),
      )
      setEnd(
        timeToDate(cfgNum(config.end_hour, 8), cfgNum(config.end_minute, 0)),
      )
      return
    }
    setLimitMin(
      nearestDurationOption(cfgNum(config.limit_min, 60), DAILY_LIMIT_OPTIONS),
    )
  }, [editedRule, stepX])

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

  const close = (onDone: () => void = closeEditorRoute) => {
    backdrop.value = withTiming(0, { duration: 200 })
    translateY.value = withTiming(
      SCREEN_H,
      { duration: 240, easing: Easing.in(Easing.cubic) },
      fin => {
        if (fin) runOnJS(onDone)()
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
    // Le strict n'existe que sur le timer : repartir d'un état propre évite
    // qu'un réglage invisible ne s'applique au type suivant.
    if (k !== 'block_now') setStrict(false)
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
      // Édition : le sélecteur doit s'ouvrir sur les apps DE CETTE RÈGLE,
      // pas sur le dernier brouillon global.
      if (editing && editId) {
        await ScreenTime.seedSelection(editId).catch(() => {})
      }
      const res = await ScreenTime.presentPicker()
      setCount(res.count)
      if (editing) appsRepicked.current = true
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

  // Engagement EXPLICITE avant d'armer un strict. Il n'existe QUE sur
  // « Bloquer maintenant » : un blocage qui a une fin connue peut être
  // verrouillé sans piéger personne. Une plage ou une limite vivent sans fin —
  // les verrouiller reviendrait à confisquer le téléphone pour toujours.
  /** Heure à laquelle le verrou tombera — le seul chiffre qui engage. */
  const strictEndLabel = () => hhmm(new Date(Date.now() + durationMin * 60_000))

  const confirmStrictCommitment = (): Promise<boolean> =>
    new Promise(resolve => {
      strictAnswer.current = resolve
      setStrictPrompt(true)
    })

  const answerStrict = (committed: boolean) => {
    setStrictPrompt(false)
    const resolve = strictAnswer.current
    strictAnswer.current = null
    resolve?.(committed)
  }

  const buildConfig = (): Record<string, unknown> => {
    // `strict` n'existe que sur le timer. `days` n'est écrit que si on s'écarte
    // du défaut (tous les jours), pour garder une config lisible.
    const base: Record<string, unknown> = {
      ...(name.trim() ? { name: name.trim() } : {}),
    }
    if (type === 'block_now')
      return { ...base, mode: 'block_now', duration_min: durationMin, strict }
    const recurrence = { ...(days ? { days } : {}) }
    if (type === 'schedule')
      return {
        ...base,
        ...recurrence,
        start_hour: start.getHours(),
        start_minute: start.getMinutes(),
        end_hour: end.getHours(),
        end_minute: end.getMinutes(),
      }
    return { ...base, ...recurrence, limit_min: limitMin }
  }

  const summary = (): string => {
    const apps = `${count} app${count > 1 ? 's' : ''}`
    if (type === 'block_now')
      return `${apps} · bloquée${count > 1 ? 's' : ''} ${fmtDuration(durationMin)}${strict ? ' · mode strict' : ''}`
    if (type === 'schedule')
      return `${apps} · ${daysLabel(days).toLowerCase()} ${hhmm(start)} → ${hhmm(end)}`
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
        days ?? [],
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

  /** iOS impose des fenêtres DeviceActivity d'au moins 15 min. */
  const scheduleIsValid = (): boolean => {
    if (type !== 'schedule') return true
    const s = start.getHours() * 60 + start.getMinutes()
    const e = end.getHours() * 60 + end.getMinutes()
    if (s === e) {
      setWarn(
        'Le début et la fin doivent être différents (sinon la plage dure 24 h).',
      )
      return false
    }
    const win = e - s > 0 ? e - s : e - s + 1440
    if (win < 15) {
      setWarn(
        'Ta plage est trop courte. Choisis un créneau d’au moins 15 minutes.',
      )
      return false
    }
    return true
  }

  /**
   * ENREGISTRER une règle existante.
   *
   * On éteint l'ancienne mécanique native avant de la relancer avec les
   * nouveaux réglages — `stopRule` (et non `clearRuleData`) : la sélection
   * d'apps de la règle doit survivre à une modification de durée.
   */
  const onSubmitEdit = async () => {
    if (!editedRule || !editId) return
    if (count === 0 || working || updateRule.isPending || submitting.current)
      return
    if (!scheduleIsValid()) return
    // L'engagement ne se redemande QUE si le strict vient d'être activé :
    // le réafficher à chaque édition d'une règle déjà stricte ne protège rien.
    if (strict && editedRule.config?.strict !== true) {
      const committed = await confirmStrictCommitment()
      if (!committed) return
    }
    submitting.current = true
    setWorking(true)
    try {
      if (ScreenTime.isAvailable) {
        const auth = await ScreenTime.requestAuthorization()
        if (auth !== 'approved') {
          Alert.alert('Autorisation requise', "Active l'accès Temps d'écran.")
          return
        }
        await ScreenTime.stopRule(editId, nativeKindOf(editedRule.type)).catch(
          () => {},
        )
        if (appsRepicked.current) await ScreenTime.bindSelection(editId)
        await runNative(editId)
      }
      await updateRule.mutateAsync({
        id: editId,
        type: DB_TYPE[type],
        count,
        config: buildConfig(),
      })
      setSuccessMsg(summary())
    } catch (e) {
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

  const onSubmit = async () => {
    if (editing) return onSubmitEdit()
    if (count === 0 || working || createRule.isPending || submitting.current)
      return
    if (!scheduleIsValid()) return
    // Strict = engagement irréversible dans l'app (sur les 3 types) → confirmation.
    if (strict) {
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

  const typeTitle = TYPES.find(item => item.key === type)?.title ?? ''

  return (
    <View style={styles.root}>
      {/* Fond flouté (léger) + assombri, tap pour fermer */}
      <AnimatedPressable
        style={[StyleSheet.absoluteFill, backdropStyle]}
        onPress={() => close()}
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
              <View style={{ gap: 18, marginTop: 28, paddingBottom: 12 }}>
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
                  // En édition, le type FAIT partie de l'identité de la règle :
                  // revenir en arrière referme l'éditeur, il ne rejoue pas le
                  // choix du type.
                  onPress={() => (editing ? close() : goStep(0))}
                  hitSlop={10}
                  style={styles.backBtn}
                >
                  <IconSvg name={IconName.BACK} size={18} color={C.ink} />
                </Pressable>
                <Text style={[f(700), { fontSize: 17, color: C.ink }]}>
                  {editing ? t('blocking.edit_rule.title') : typeTitle}
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
                      <DurationWheel
                        testID="duration-wheel"
                        accessibilityLabel="Durée du blocage"
                        minutes={durationMin}
                        options={BLOCK_DURATION_OPTIONS}
                        onChange={setDurationMin}
                      />
                    </View>
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
                    {daysLabel(days)} · {hhmm(start)} → {hhmm(end)}.
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
                    <DurationWheel
                      testID="limit-wheel"
                      accessibilityLabel="Limite par jour"
                      minutes={limitMin}
                      options={DAILY_LIMIT_OPTIONS}
                      onChange={setLimitMin}
                    />
                  </View>
                </View>
              )}

              {/* Jours — plage & limite seulement : un timer est éphémère par
                  nature, la question ne se pose pas. */}
              {type !== 'block_now' && (
                <View style={styles.card}>
                  <Text style={[f(600), styles.cfgLabel]}>Jours</Text>
                  <View style={styles.chips}>
                    {DAY_PRESETS.map(p => (
                      <Chip
                        key={p.label}
                        label={p.label}
                        on={sameDays(days, p.days)}
                        onPress={() => {
                          tapHaptic()
                          setDays(p.days)
                        }}
                      />
                    ))}
                  </View>
                </View>
              )}

              {/* Mode strict — timer UNIQUEMENT : seul un blocage à fin connue
                  peut être verrouillé sans devenir une prison. */}
              {type === 'block_now' && (
                <View style={[styles.card, styles.strictCard]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={styles.strictTitleRow}>
                      <Text style={[f(600), { fontSize: 15.5, color: C.ink }]}>
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
                      Impossible d'arrêter avant la fin, même en fermant Relock.
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

              {/* Armer un blocage s'ENGAGE — qu'on le crée ou qu'on le
                  modifie : on le tient, avec la même onde et le même
                  martèlement que la suppression, aux couleurs de la marque.
                  Enregistrer une modification RÉ-ARME la mécanique native :
                  ça mérite le même geste que l'activation. */}
              <HoldToConfirmButton
                testID={editing ? 'save-block' : 'activate-block'}
                idleLabel={
                  editing
                    ? t('blocking.hold.save')
                    : t('blocking.hold.activate')
                }
                holdingLabel={t('blocking.hold.keep_holding')}
                disabled={count === 0}
                pending={
                  working ||
                  (editing ? updateRule.isPending : createRule.isPending)
                }
                onConfirm={onSubmit}
                style={styles.holdCta}
              />
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
              {editing ? t('blocking.edit_rule.saved') : "C'est activé"}
            </Text>
            <Text style={[f(400), styles.successSub]}>{successMsg}</Text>
            <Pressable
              // Après une édition on retombe sur la fiche d'où l'on vient ;
              // après une création, sur la liste des blocages.
              onPress={() => {
                setSuccessMsg(null)
                close(editing ? closeEditorRoute : goToBlocksAfterCreate)
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

      <StrictCommitmentSheet
        visible={strictPrompt}
        endsAtLabel={strictEndLabel()}
        onCancel={() => answerStrict(false)}
        onCommit={() => answerStrict(true)}
      />

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
    padding: 20,
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
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 20,
    padding: 18,
    marginTop: 14,
  },
  cardHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pickerWrap: { alignItems: 'center', marginTop: 2 },
  hint: { fontSize: 12.5, color: C.ink3, marginTop: 8, lineHeight: 17 },
  cfgLabel: { fontSize: 15, color: C.ink, marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 13,
    borderRadius: 999,
    backgroundColor: C.surface2,
  },
  chipOn: { backgroundColor: C.accent },
  cfgSep: { height: 1, backgroundColor: C.hair, marginVertical: 16 },
  cfgHint: { fontSize: 12.5, color: C.ink2, marginTop: 12, lineHeight: 18 },
  strictCard: {
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
  holdCta: {
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
