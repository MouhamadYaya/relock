import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg'
import { fonts } from '@/shared/theme/tokens/fonts'
import { Footnote, GradientLine, Moon, Pill, StudyLine } from './bits'
import { Reveal } from './motion'
import { haptic, OB } from './tokens'

// ─── Acte 2 · Le battement ──────────────────────────────────────────────

/**
 * L'annonce en deux temps, façon bande-annonce : chaque phrase arrive à
 * son rythme, impossible de survoler. Le CTA n'existe qu'à la fin.
 */
export function SceneBeat({ onNext }: { onNext: () => void }) {
  const [stage, setStage] = useState(0)
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 1050)
    const t2 = setTimeout(() => setStage(2), 2050)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  return (
    <View className="flex-1 px-5">
      <View className="flex-1 justify-center gap-3">
        <Animated.Text
          entering={FadeInDown.duration(700).easing(Easing.out(Easing.cubic))}
          style={styles.beatLine}
        >
          Une nouvelle difficile.
        </Animated.Text>
        {stage >= 1 ? (
          <Animated.Text
            entering={FadeInDown.duration(700).easing(Easing.out(Easing.cubic))}
            style={[styles.beatLine, styles.beatAccent]}
          >
            Et une bonne.
          </Animated.Text>
        ) : null}
      </View>
      {stage >= 2 ? (
        <Animated.View entering={FadeIn.duration(400)} className="gap-2 pb-2.5">
          <Pill label="Voir la vérité" onPress={onNext} />
        </Animated.View>
      ) : null}
    </View>
  )
}

// ─── Acte 2 · Le choc (slot-machine) ────────────────────────────────────

/**
 * Le cœur émotionnel : le compteur décélère comme une machine à sous et
 * se FIGE sur le chiffre calculé depuis SES réponses. Ticks haptiques,
 * impact au verdict, méthodologie en note pour la crédibilité.
 */
export function SceneMirror({
  hours,
  onNext,
}: {
  hours: number
  onNext: () => void
}) {
  const days = Math.max(1, Math.round((hours * 365) / 24))
  const [n, setN] = useState(0)
  const [settled, setSettled] = useState(false)
  const lastTick = useRef(0)
  const pulse = useSharedValue(1)

  useEffect(() => {
    const started = Date.now()
    const DURATION = 1700
    let raf = 0
    const frame = () => {
      const t = Math.min(1, (Date.now() - started - 350) / DURATION)
      if (t < 0) {
        raf = requestAnimationFrame(frame)
        return
      }
      const eased = 1 - (1 - t) ** 3
      const value = Math.round(days * eased)
      setN(value)
      const now = Date.now()
      if (now - lastTick.current > 90 && t < 1) {
        lastTick.current = now
        haptic.tick()
      }
      if (t >= 1) {
        setSettled(true)
        haptic.heavy()
        pulse.value = withSequence(
          withSpring(1.06, { damping: 9, stiffness: 300 }),
          withSpring(1, { damping: 14, stiffness: 220 }),
        )
        return
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [days, pulse])

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }))

  return (
    <View className="flex-1 px-5">
      <View className="flex-1 justify-center">
        <Reveal index={0}>
          <Text style={styles.mirrorLabel}>À ce rythme, tu perds environ</Text>
        </Reveal>
        <Animated.View className="items-center mt-3.5" style={pulseStyle}>
          <GradientLine text={`${n} jours`} size={76} />
          <Text style={styles.mirrorPerYear}>par an</Text>
        </Animated.View>
        <Reveal index={1}>
          <Text style={styles.mirrorBody}>
            Des journées entières, les yeux baissés. Chaque année.
          </Text>
        </Reveal>
      </View>
      {settled ? (
        <Animated.View entering={FadeIn.duration(400)} className="gap-2 pb-2.5">
          <Pill label="Je veux changer ça" onPress={onNext} />
          <Footnote
            text={`Calcul : ${hours} h par jour × 365, converties en journées de 24 h.`}
          />
        </Animated.View>
      ) : null}
    </View>
  )
}

// ─── Acte 2 · Le renversement ───────────────────────────────────────────

export function SceneReversal({ onNext }: { onNext: () => void }) {
  return (
    <View className="flex-1 px-5">
      <View className="flex-1 justify-center gap-3">
        <Reveal index={0}>
          <Text style={styles.reversalTitle}>Tu n'es pas le problème.</Text>
        </Reveal>
        <Reveal index={1}>
          <Text style={styles.reversalBody}>
            Ces apps sont réglées par des milliers d'ingénieurs pour te retenir.
            Relock rééquilibre les règles, en ta faveur.
          </Text>
        </Reveal>
        <Reveal index={2} style={{ marginTop: 26 }}>
          <StudyLine text="Merci pour ton honnêteté. On peut construire, maintenant." />
        </Reveal>
      </View>
      <Reveal index={3} className="gap-2 pb-2.5">
        <Pill label="Construire mon plan" onPress={onNext} />
      </Reveal>
    </View>
  )
}

// ─── Acte 3 · La reformulation ──────────────────────────────────────────

export function ScenePlan({
  apps,
  momentPhrase,
  hours,
  onNext,
}: {
  apps: string[]
  momentPhrase: string
  hours: number
  onNext: () => void
}) {
  const list =
    apps.length === 0
      ? 'tes apps à scroll'
      : apps.slice(0, 2).join(' et ') +
        (apps.length > 2 ? ', entre autres' : '')
  return (
    <View className="flex-1 px-5">
      <View className="flex-1 justify-center gap-3">
        <Reveal index={0}>
          <Text style={styles.reversalTitle}>Ton plan, en une phrase.</Text>
        </Reveal>
        <Reveal index={1} style={styles.planCard}>
          <Text style={styles.planText}>
            Bloquer <Text style={styles.planAccent}>{list}</Text>,{' '}
            {momentPhrase}, et te rendre{' '}
            <Text style={styles.planAccent}>{hours} h chaque jour</Text>.
          </Text>
        </Reveal>
      </View>
      <Reveal index={2} className="gap-2 pb-2.5">
        <Pill label="Générer mon plan" onPress={onNext} />
      </Reveal>
    </View>
  )
}

// ─── Acte 3 · Le chargement théâtral ────────────────────────────────────

const LOAD_STEPS = [
  'Analyse de tes réponses',
  'Calibrage de tes blocages',
  'Préparation de ton espace',
  'Dernier réglage',
]

/** Le « travail » qui fabrique la valeur du plan. Avance tout seul. */
export function SceneLoading({ onDone }: { onDone: () => void }) {
  const [pct, setPct] = useState(0)
  const doneRef = useRef(false)
  const DURATION = 3000

  useEffect(() => {
    const started = Date.now()
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - started) / DURATION)
      const eased = 1 - (1 - t) ** 2
      setPct(Math.round(eased * 100))
      if (t >= 1 && !doneRef.current) {
        doneRef.current = true
        clearInterval(id)
        haptic.success()
        setTimeout(onDone, 420)
      }
    }, 40)
    return () => clearInterval(id)
  }, [onDone])

  const checked = Math.floor((pct / 100) * LOAD_STEPS.length)

  return (
    <View className="flex-1 px-5">
      <View className="flex-1 justify-center">
        <GradientLine text={`${pct} %`} size={64} />
        <View style={styles.loadTrack}>
          <View style={[styles.loadFill, { width: `${pct}%` }]} />
        </View>
        <View className="mt-7 gap-3.5">
          {LOAD_STEPS.map((s, i) => (
            <View key={s} className="flex-row items-center gap-3">
              <View
                style={[styles.loadDot, i < checked && styles.loadDotDone]}
              />
              <Text
                style={[styles.loadText, i < checked && styles.loadTextDone]}
              >
                {s}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}

// ─── Acte 3 · La révélation ─────────────────────────────────────────────

export function SceneSuccess({
  name,
  apps,
  momentLabel,
  days,
  onNext,
}: {
  name: string
  apps: string[]
  momentLabel: string
  days: number
  onNext: () => void
}) {
  const list = apps.length === 0 ? 'Tes apps à scroll' : apps.join(', ')
  return (
    <View className="flex-1 px-5">
      <View className="flex-1 pt-[26px] gap-[18px]">
        <Reveal index={0} className="items-center">
          <Moon size={84} glow />
        </Reveal>
        <Reveal index={1}>
          <Text style={styles.successTitle}>
            Ton plan est prêt{name ? `, ${name}` : ''}.
          </Text>
        </Reveal>
        <View className="gap-2.5 mt-2">
          {[
            { k: 'Apps bloquées', v: list },
            { k: 'Fenêtre critique', v: momentLabel },
            { k: 'Objectif', v: `Environ ${days} jours récupérés par an` },
          ].map((row, i) => (
            <Reveal key={row.k} index={2 + i} style={styles.successCard}>
              <Text style={styles.successK}>{row.k}</Text>
              <Text style={styles.successV}>{row.v}</Text>
            </Reveal>
          ))}
        </View>
      </View>
      <Reveal index={5} className="gap-2 pb-2.5">
        <Pill label="Sceller mon engagement" onPress={onNext} />
      </Reveal>
    </View>
  )
}

// ─── Acte 3 · Le rituel du verrou ───────────────────────────────────────

const RING_R = 84
const RING_C = 2 * Math.PI * RING_R
const AnimatedCircle = Animated.createAnimatedComponent(Circle)
const HOLD_MS = 1150

const PARTICLES = Array.from({ length: 10 }, (_, i) => {
  const angle = (i / 10) * Math.PI * 2
  return { dx: Math.cos(angle), dy: Math.sin(angle), key: `p${i}` }
})

/** Un éclat de l'explosion du verrou (hooks isolés du parent). */
function Particle({
  dx,
  dy,
  burst,
}: {
  dx: number
  dy: number
  burst: SharedValue<number>
}) {
  const style = useAnimatedStyle(() => ({
    opacity: burst.value === 0 ? 0 : 1 - burst.value,
    transform: [
      { translateX: dx * burst.value * 104 },
      { translateY: dy * burst.value * 104 },
      { scale: 1 - burst.value * 0.4 },
    ],
  }))
  return <Animated.View style={[styles.particle, style]} />
}

/**
 * LE moment signature : maintenir la lune jusqu'au verrou. Anneau qui se
 * remplit, haptiques en crescendo, impact lourd et éclat de particules au
 * verrouillage. C'est le fist bump de Relock, et c'est son nom : re-lock.
 */
export function SceneRitual({ onDone }: { onDone: () => void }) {
  const progress = useSharedValue(0)
  const burst = useSharedValue(0)
  const moonScale = useSharedValue(1)
  const [locked, setLocked] = useState(false)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = () => {
    for (const t of timers.current) clearTimeout(t)
    timers.current = []
  }

  const lock = () => {
    clearTimers()
    setLocked(true)
    haptic.heavy()
    haptic.success()
    moonScale.value = withSequence(
      withSpring(0.92, { damping: 10, stiffness: 340 }),
      withSpring(1.05, { damping: 9, stiffness: 260 }),
      withSpring(1, { damping: 14, stiffness: 200 }),
    )
    burst.value = 0
    burst.value = withTiming(1, {
      duration: 750,
      easing: Easing.out(Easing.cubic),
    })
    timers.current.push(setTimeout(onDone, 1250))
  }

  const onPressIn = () => {
    if (locked) return
    haptic.select()
    progress.value = withTiming(1, {
      duration: HOLD_MS,
      easing: Easing.out(Easing.quad),
    })
    timers.current.push(setTimeout(() => haptic.tick(), 300))
    timers.current.push(setTimeout(() => haptic.select(), 600))
    timers.current.push(setTimeout(() => haptic.tap(), 880))
    timers.current.push(setTimeout(lock, HOLD_MS))
  }

  const onPressOut = () => {
    if (locked) return
    clearTimers()
    progress.value = withTiming(0, { duration: 260 })
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: purge des timers au démontage uniquement
  useEffect(() => clearTimers, [])

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: RING_C * (1 - progress.value),
  }))
  const moonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: moonScale.value }],
  }))

  return (
    <View className="flex-1 px-5">
      <View className="flex-1 items-center justify-center">
        <Reveal index={0}>
          <Text style={styles.reversalTitle}>
            {locked ? 'Engagement scellé.' : 'Scellons ton engagement.'}
          </Text>
        </Reveal>
        <Reveal index={1}>
          <Text style={styles.ritualSub}>
            {locked
              ? 'Ta parole est verrouillée avec ton plan.'
              : "Maintiens la lune jusqu'au verrou."}
          </Text>
        </Reveal>
        <Reveal
          index={2}
          className="items-center justify-center mt-10"
          style={{ width: RING_R * 2 + 20, height: RING_R * 2 + 20 }}
        >
          <Svg
            width={RING_R * 2 + 20}
            height={RING_R * 2 + 20}
            style={StyleSheet.absoluteFill}
          >
            <Defs>
              <LinearGradient id="ritualGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor={OB.grad[0]} />
                <Stop offset="100%" stopColor={OB.grad[2]} />
              </LinearGradient>
            </Defs>
            <Circle
              cx={RING_R + 10}
              cy={RING_R + 10}
              r={RING_R}
              stroke="rgba(255,255,255,0.10)"
              strokeWidth={5}
              fill="none"
            />
            <AnimatedCircle
              cx={RING_R + 10}
              cy={RING_R + 10}
              r={RING_R}
              stroke="url(#ritualGrad)"
              strokeWidth={5}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={RING_C}
              animatedProps={ringProps}
              transform={`rotate(-90 ${RING_R + 10} ${RING_R + 10})`}
            />
          </Svg>
          {PARTICLES.map(p => (
            <Particle key={p.key} dx={p.dx} dy={p.dy} burst={burst} />
          ))}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Maintenir pour sceller"
            onPressIn={onPressIn}
            onPressOut={onPressOut}
          >
            <Animated.View style={moonStyle}>
              <Moon size={124} glow />
            </Animated.View>
          </Pressable>
        </Reveal>
      </View>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  beatLine: {
    ...fonts.bold,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.7,
    color: OB.ink,
  },
  beatAccent: { color: OB.accent },

  mirrorLabel: {
    ...fonts.medium,
    fontSize: 17,
    color: OB.ink55,
    textAlign: 'center',
  },
  mirrorPerYear: {
    ...fonts.semiBold,
    fontSize: 19,
    color: OB.ink70,
    marginTop: -2,
  },
  mirrorBody: {
    ...fonts.regular,
    fontSize: 16,
    lineHeight: 23,
    color: OB.ink55,
    textAlign: 'center',
    marginTop: 18,
  },

  reversalTitle: {
    ...fonts.bold,
    fontSize: 30,
    lineHeight: 37,
    letterSpacing: -0.7,
    color: OB.ink,
    textAlign: 'center',
  },
  reversalBody: {
    ...fonts.regular,
    fontSize: 16.5,
    lineHeight: 25,
    color: OB.ink55,
    textAlign: 'center',
    marginTop: 14,
  },

  planCard: {
    marginTop: 26,
    backgroundColor: OB.card,
    borderRadius: 22,
    padding: 22,
  },
  planText: {
    ...fonts.semiBold,
    fontSize: 21,
    lineHeight: 31,
    color: OB.ink,
    textAlign: 'center',
  },
  planAccent: { color: OB.accent },

  loadTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
    marginTop: 10,
  },
  loadFill: { height: 6, borderRadius: 3, backgroundColor: OB.accent },
  loadDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.6,
    borderColor: OB.ink28,
  },
  loadDotDone: { backgroundColor: OB.accent, borderColor: OB.accent },
  loadText: { ...fonts.medium, fontSize: 15, color: OB.ink40 },
  loadTextDone: { color: OB.ink },

  successTitle: {
    ...fonts.bold,
    fontSize: 28,
    letterSpacing: -0.6,
    color: OB.ink,
    textAlign: 'center',
  },
  successCard: {
    backgroundColor: OB.card,
    borderRadius: 18,
    paddingVertical: 15,
    paddingHorizontal: 18,
  },
  successK: { ...fonts.medium, fontSize: 12.5, color: OB.ink40 },
  successV: { ...fonts.semiBold, fontSize: 16, color: OB.ink, marginTop: 3 },

  ritualSub: {
    ...fonts.regular,
    fontSize: 16,
    color: OB.ink55,
    textAlign: 'center',
    marginTop: 10,
  },
  particle: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: OB.accent,
  },
})
