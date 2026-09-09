/**
 * Acte 3 · Le rituel du sceau — LE moment signature de l'onboarding.
 *
 * On pose son doigt sur l'empreinte et on MAINTIENT : la lumière monte
 * dans les crêtes, l'anneau se referme, l'écran s'allume, les haptiques
 * accélèrent, puis le sceau claque. C'est le fist bump de Relock, et
 * c'est son nom : re-lock.
 *
 * Quatre états, et le passage de l'un à l'autre EST le message :
 *
 *   idle    l'empreinte respire, éteinte — rien n'est engagé
 *   hold    la lumière monte, l'écran s'allume, l'anneau se remplit
 *   paused  on a lâché trop tôt : la progression RESTE, elle redescend
 *           deux fois plus lentement qu'elle n'est montée
 *   sealed  impact, éclats, le CTA apparaît
 *
 * ⚠️ Le point délicat, c'est `paused`. Beaucoup de gens tapotent au lieu
 * de maintenir : si lâcher remettait à zéro, ils resteraient bloqués sans
 * comprendre. Ici la progression est mémorisée et REPRISE exactement là
 * où elle s'est arrêtée, autant de fois qu'il le faut.
 *
 * Pour que ça ne dérive jamais, la progression n'est PAS lue depuis
 * l'animation : elle se recalcule à partir d'horodatages (`baseRef` +
 * temps écoulé), et l'animation suit la même droite (durée = temps
 * restant, easing linéaire). Les deux racontent donc toujours la même
 * chose, même après dix reprises.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  AppState,
  type AppStateStatus,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  Ellipse,
  LinearGradient,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'
import { Pill } from '@/features/onboarding/bits'
import { FingerprintMark, FP_ASPECT } from '@/features/onboarding/Fingerprint'
import { Reveal } from '@/features/onboarding/motion'
import { haptic, OB } from '@/features/onboarding/tokens'
import { translate } from '@/i18n/translate'
import { useT } from '@/i18n/useT'
import { fonts } from '@/shared/theme/tokens/fonts'
import { haptics } from '@/shared/utils/platform/haptics'

// ─── Rythme ──────────────────────────────────────────────────────────────

/** Maintien complet, en partant de zéro. Assez long pour que ça engage. */
const HOLD_MS = 2400

/**
 * Temps qu'il faudrait au sceau pour retomber à zéro après un lâcher.
 * Plus du double du remplissage, volontairement : celui qui lâche par
 * réflexe retrouve sa progression quasi intacte en reposant le doigt.
 */
const DECAY_MS = 5600

/**
 * Les paliers haptiques, en fraction de progression. Les écarts se
 * resserrent : la vibration accélère à mesure que le verrou approche —
 * c'est ce crescendo qui donne envie de tenir jusqu'au bout.
 */
const HAPTIC_MARKS = [
  0.12, 0.24, 0.35, 0.45, 0.54, 0.62, 0.7, 0.77, 0.83, 0.88, 0.93, 0.97,
] as const

// ─── Géométrie ───────────────────────────────────────────────────────────

const RING_STROKE = 5
const RING_R = 104
const RING_R_COMPACT = 84
/** En dessous, l'écran est trop court pour l'anneau plein format. */
const COMPACT_HEIGHT = 720
/** Marge autour de l'anneau : la place où les ondes vont s'épanouir. */
const STAGE_RATIO = 1.42
/** Largeur de l'empreinte, en fraction du rayon de l'anneau. */
const MARK_RATIO = 1.45

/** Trois ondes, décalées d'un tiers de cycle — un battement continu. */
const RIPPLES = [0, 1 / 3, 2 / 3] as const

/** Les étincelles qui montent pendant le maintien (phase, dérive, vitesse). */
const MOTES = [
  { key: 'm0', phase: 0.0, dx: -0.9, speed: 1.0 },
  { key: 'm1', phase: 0.18, dx: 0.6, speed: 1.25 },
  { key: 'm2', phase: 0.34, dx: -0.35, speed: 0.9 },
  { key: 'm3', phase: 0.52, dx: 1.0, speed: 1.15 },
  { key: 'm4', phase: 0.68, dx: -0.7, speed: 1.05 },
  { key: 'm5', phase: 0.85, dx: 0.25, speed: 0.95 },
] as const

/** Les éclats de l'impact final. */
const PARTICLES = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2
  return { dx: Math.cos(angle), dy: Math.sin(angle), key: `p${i}` }
})

const AnimatedCircle = Animated.createAnimatedComponent(Circle)

type Phase = 'idle' | 'hold' | 'paused' | 'sealed'

/** Le texte de chaque phase, dans la langue courante. */
const phaseCopy = (phase: Phase) => ({
  title: translate(`onboarding_ritual.${phase}.title`),
  sub: translate(`onboarding_ritual.${phase}.sub`),
})

// ─── Couches animées ─────────────────────────────────────────────────────

/** Une onde concentrique : elle naît sous l'empreinte et s'ouvre. */
function Ripple({
  phase,
  amp,
  clock,
  size,
}: {
  phase: number
  amp: SharedValue<number>
  clock: SharedValue<number>
  size: number
}) {
  const style = useAnimatedStyle(() => {
    const t = (clock.value + phase) % 1
    return {
      opacity: amp.value * (1 - t) * 0.5,
      transform: [{ scale: 0.64 + t * 0.6 }],
    }
  })
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.ripple,
        { width: size, height: size, borderRadius: size / 2 },
        style,
      ]}
    />
  )
}

/** Une étincelle qui s'élève de l'empreinte pendant le maintien. */
function Mote({
  mote,
  amp,
  clock,
  rise,
}: {
  mote: (typeof MOTES)[number]
  amp: SharedValue<number>
  clock: SharedValue<number>
  rise: number
}) {
  const style = useAnimatedStyle(() => {
    const t = (clock.value * mote.speed + mote.phase) % 1
    // Apparition très courte puis extinction : sans ça, l'étincelle
    // « pop » à pleine opacité au moment où elle boucle.
    const fadeIn = t < 0.14 ? t / 0.14 : 1
    return {
      opacity: amp.value * fadeIn * (1 - t) * 0.9,
      transform: [
        { translateX: mote.dx * (5 + t * 16) },
        { translateY: -(t * rise) },
        { scale: 0.45 + (1 - t) * 0.55 },
      ],
    }
  })
  return <Animated.View pointerEvents="none" style={[styles.mote, style]} />
}

/** Un éclat de l'impact (hooks isolés du parent). */
function Particle({
  dx,
  dy,
  burst,
  reach,
}: {
  dx: number
  dy: number
  burst: SharedValue<number>
  reach: number
}) {
  const style = useAnimatedStyle(() => ({
    opacity: burst.value === 0 ? 0 : 1 - burst.value,
    transform: [
      { translateX: dx * burst.value * reach },
      { translateY: dy * burst.value * reach },
      { scale: 1 - burst.value * 0.4 },
    ],
  }))
  return <Animated.View pointerEvents="none" style={[styles.particle, style]} />
}

// ─── La scène ────────────────────────────────────────────────────────────

export function SceneRitual({ onDone }: { onDone: () => void }) {
  const t = useT()
  const { height } = useWindowDimensions()
  const reduced = useReducedMotion()

  const ringR = height < COMPACT_HEIGHT ? RING_R_COMPACT : RING_R
  const ringBox = (ringR + RING_STROKE) * 2
  const stage = Math.round(ringBox * STAGE_RATIO)
  const ringC = 2 * Math.PI * ringR
  const markW = Math.round(ringR * MARK_RATIO)
  const markH = Math.round(markW * FP_ASPECT)

  const [phase, setPhase] = useState<Phase>('idle')
  /** VoiceOver ne sait pas « maintenir » : on lui offre un simple appui. */
  const [assistive, setAssistive] = useState(false)

  // Progression affichée (0→1). Miroir animé de la vérité horodatée.
  const progress = useSharedValue(0)
  // Enfoncement du doigt (ressort), séparé de la progression : c'est lui
  // qui dit « je te sens », même si la progression bouge à peine.
  const press = useSharedValue(0)
  const breath = useSharedValue(0)
  const clock = useSharedValue(0)
  /** Amplitude des ondes et des étincelles : 1 pendant le maintien. */
  const amp = useSharedValue(0)
  const pop = useSharedValue(1)
  const burst = useSharedValue(0)

  // ── La vérité, en horodatages (jamais lue depuis l'animation) ──
  const holding = useRef(false)
  /** Progression au moment où le doigt s'est posé. */
  const base = useRef(0)
  const startedAt = useRef(0)
  /** Progression au moment du lâcher, et l'instant de ce lâcher. */
  const decayFrom = useRef(0)
  const decayAt = useRef(0)
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearTimers = useCallback(() => {
    for (const t of timers.current) clearTimeout(t)
    timers.current = []
  }, [])

  /** Où en est RÉELLEMENT le sceau, à la milliseconde près. */
  const currentProgress = useCallback(() => {
    const now = Date.now()
    if (holding.current) {
      return Math.min(1, base.current + (now - startedAt.current) / HOLD_MS)
    }
    return Math.max(0, decayFrom.current - (now - decayAt.current) / DECAY_MS)
  }, [])

  const seal = useCallback(() => {
    if (!holding.current) return
    holding.current = false
    clearTimers()
    base.current = 1
    decayFrom.current = 1
    decayAt.current = Date.now()
    setPhase('sealed')

    // Un seul signal, celui de la porte qui se ferme : c'est littéralement ce
    // que le geste vient de faire. Deux signaux collés (un choc PUIS un
    // succès) ne s'entendent pas comme deux — le moteur n'a pas fini le
    // premier que le second l'écrase, et il n'en reste qu'une bouillie tiède.
    haptics.lock()
    progress.value = withTiming(1, { duration: 140 })
    press.value = withSpring(0, { damping: 18, stiffness: 260 })
    amp.value = withTiming(0, { duration: 220 })
    pop.value = withSequence(
      withSpring(0.9, { damping: 10, stiffness: 380 }),
      withSpring(1.07, { damping: 9, stiffness: 240 }),
      withSpring(1, { damping: 14, stiffness: 200 }),
    )
    burst.value = 0
    burst.value = withTiming(1, {
      duration: 780,
      easing: Easing.out(Easing.cubic),
    })
  }, [amp, burst, clearTimers, pop, press, progress])

  const onPressIn = useCallback(() => {
    if (holding.current || phase === 'sealed') return
    // Reprise : on repart de la progression restante, pas de zéro.
    const from = currentProgress()
    clearTimers()
    holding.current = true
    base.current = from
    startedAt.current = Date.now()
    setPhase('hold')
    haptic.select()

    const remaining = HOLD_MS * (1 - from)
    press.value = withSpring(1, { damping: 15, stiffness: 320 })
    amp.value = withTiming(1, { duration: 260 })
    breath.value = withTiming(0, { duration: 200 })
    // Linéaire, comme le calcul : l'anneau et l'horloge disent la même chose.
    progress.value = withTiming(1, {
      duration: remaining,
      easing: Easing.linear,
    })

    for (const mark of HAPTIC_MARKS) {
      if (mark <= from) continue
      const at = (mark - from) * HOLD_MS
      timers.current.push(
        // Le martèlement monte AVEC la progression, en continu : trois
        // paliers d'intensité se sentaient comme trois vibrations
        // différentes, là où le geste, lui, est un seul effort qui se tend.
        setTimeout(() => haptics.rumble(mark), at),
      )
    }
    timers.current.push(setTimeout(seal, remaining))
  }, [amp, breath, clearTimers, currentProgress, phase, press, progress, seal])

  const release = useCallback(() => {
    if (!holding.current) return
    const from = currentProgress()
    holding.current = false
    clearTimers()
    decayFrom.current = from
    decayAt.current = Date.now()

    // Un tick sec : on SENT qu'on a lâché, on ne le découvre pas.
    haptic.tick()
    press.value = withSpring(0, { damping: 16, stiffness: 280 })
    amp.value = withTiming(0, { duration: 320 })
    progress.value = withTiming(0, {
      duration: DECAY_MS * from,
      easing: Easing.linear,
    })

    if (from <= 0.015) {
      setPhase('idle')
      return
    }
    setPhase('paused')
    // Retour à l'état vierge quand la dernière goutte s'est évaporée.
    timers.current.push(setTimeout(() => setPhase('idle'), DECAY_MS * from))
  }, [amp, clearTimers, currentProgress, press, progress])

  /** VoiceOver : un appui vaut le maintien complet. */
  const sealFromAssistive = useCallback(() => {
    if (phase === 'sealed') return
    holding.current = true
    base.current = 1
    startedAt.current = Date.now()
    progress.value = withTiming(1, { duration: 320 })
    seal()
  }, [phase, progress, seal])

  // Respiration au repos : une empreinte immobile ne demande pas qu'on la touche.
  useEffect(() => {
    if (reduced) return
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1700, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    )
    return () => cancelAnimation(breath)
  }, [breath, reduced])

  // Une seule horloge pour les ondes ET les étincelles : elles ne peuvent
  // pas se désynchroniser, et rien ne se démarre ni ne s'arrête à la main.
  useEffect(() => {
    if (reduced) return
    clock.value = 0
    clock.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.linear }),
      -1,
      false,
    )
    return () => cancelAnimation(clock)
  }, [clock, reduced])

  // Doigt parti sans `onPressOut` : app en arrière-plan, appel entrant,
  // Centre de contrôle… Sans ça le sceau se fermerait tout seul, écran éteint.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state !== 'active') release()
    })
    return () => sub.remove()
  }, [release])

  useEffect(() => {
    let alive = true
    AccessibilityInfo.isScreenReaderEnabled()
      .then(on => {
        if (alive) setAssistive(on)
      })
      .catch(() => {})
    const sub = AccessibilityInfo.addEventListener(
      'screenReaderChanged',
      (on: boolean) => setAssistive(on),
    )
    return () => {
      alive = false
      sub?.remove?.()
    }
  }, [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: purge des timers au démontage uniquement
  useEffect(() => clearTimers, [])

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: ringC * (1 - progress.value),
  }))

  // La lumière ambiante suit la progression : l'écran s'allume à mesure
  // qu'on s'engage. C'est le seul moment de l'onboarding où le halo
  // signature envahit la scène — d'où sa force.
  const bloomStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + progress.value * 0.88 + press.value * 0.1,
    transform: [{ scale: 0.74 + progress.value * 0.42 }],
  }))

  const markStyle = useAnimatedStyle(() => ({
    transform: [
      {
        scale:
          pop.value * (1 + breath.value * 0.018) * (1 - press.value * 0.055),
      },
    ],
  }))

  const ghostStyle = useAnimatedStyle(() => ({
    opacity: 0.9 + press.value * 0.1,
  }))

  const haloStyle = useAnimatedStyle(() => ({
    opacity: progress.value * 0.95,
  }))

  // Le remplissage : un cache à hauteur variable, ancré en bas. La lumière
  // monte donc dans les crêtes du bord vers le cœur.
  const revealStyle = useAnimatedStyle(() => ({
    height: progress.value * markH,
  }))

  const scanStyle = useAnimatedStyle(() => ({
    opacity:
      progress.value > 0.004 && progress.value < 0.996 ? 0.55 + amp.value : 0,
  }))

  const headStyle = useAnimatedStyle(() => ({
    // Disparaît une fois le tour bouclé : l'anneau est fermé, la tête
    // n'a plus rien à montrer et resterait posée comme une poussière.
    opacity: progress.value > 0.012 && progress.value < 0.995 ? 1 : 0,
    transform: [{ rotate: `${progress.value * 360}deg` }],
  }))

  /** L'aura déborde de la marque d'un quart de sa taille, tout autour. */
  const glowBox = {
    left: -markW * 0.25,
    top: -markH * 0.25,
    width: markW * 1.5,
    height: markH * 1.5,
  }

  const sealed = phase === 'sealed'
  const copy = phaseCopy(phase)
  const rippleSize = useMemo(() => ringBox, [ringBox])

  return (
    <View className="flex-1 px-5">
      <View className="flex-1 items-center justify-center">
        <Reveal index={0}>
          <Animated.Text
            key={copy.title}
            entering={FadeIn.duration(380)}
            style={styles.title}
          >
            {copy.title}
          </Animated.Text>
        </Reveal>
        <Reveal index={1}>
          <Animated.Text
            key={copy.sub}
            entering={FadeIn.duration(300)}
            style={styles.sub}
          >
            {copy.sub}
          </Animated.Text>
        </Reveal>

        <Reveal
          index={2}
          style={[styles.stage, { width: stage, height: stage }]}
        >
          {/* Nappe de lumière — dessous tout le reste. */}
          <Animated.View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.center, bloomStyle]}
          >
            <Svg width={stage * 1.9} height={stage * 1.9}>
              <Defs>
                <RadialGradient id="ritualBloom" cx="50%" cy="50%" r="50%">
                  <Stop offset="0%" stopColor={OB.grad[1]} stopOpacity={0.58} />
                  <Stop
                    offset="42%"
                    stopColor={OB.grad[0]}
                    stopOpacity={0.26}
                  />
                  <Stop offset="100%" stopColor={OB.bg} stopOpacity={0} />
                </RadialGradient>
              </Defs>
              <Circle
                cx={stage * 0.95}
                cy={stage * 0.95}
                r={stage * 0.95}
                fill="url(#ritualBloom)"
              />
            </Svg>
          </Animated.View>

          {reduced
            ? null
            : RIPPLES.map(p => (
                <View
                  key={`ripple-${p}`}
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, styles.center]}
                >
                  <Ripple phase={p} amp={amp} clock={clock} size={rippleSize} />
                </View>
              ))}

          {/* L'anneau : la promesse de la fin du geste. */}
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.center]}
          >
            <Svg width={ringBox} height={ringBox}>
              <Defs>
                <LinearGradient
                  id="ritualRing"
                  x1="0%"
                  y1="100%"
                  x2="0%"
                  y2="0%"
                >
                  <Stop offset="0%" stopColor={OB.grad[2]} />
                  <Stop offset="55%" stopColor={OB.grad[1]} />
                  <Stop offset="100%" stopColor={OB.grad[0]} />
                </LinearGradient>
              </Defs>
              <Circle
                cx={ringBox / 2}
                cy={ringBox / 2}
                r={ringR}
                stroke="rgba(255,255,255,0.10)"
                strokeWidth={RING_STROKE}
                fill="none"
              />
              <AnimatedCircle
                cx={ringBox / 2}
                cy={ringBox / 2}
                r={ringR}
                stroke="url(#ritualRing)"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                fill="none"
                strokeDasharray={ringC}
                animatedProps={ringProps}
                transform={`rotate(-90 ${ringBox / 2} ${ringBox / 2})`}
              />
            </Svg>
          </View>

          {/* La tête de l'anneau : le point vif qui marque « on en est là ». */}
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.center]}
          >
            <Animated.View
              style={[{ width: ringBox, height: ringBox }, headStyle]}
            >
              <View
                style={[
                  styles.ringHead,
                  { left: ringBox / 2 - 5, top: ringBox / 2 - ringR - 5 },
                ]}
              />
            </Animated.View>
          </View>

          {reduced
            ? null
            : MOTES.map(m => (
                <View
                  key={m.key}
                  pointerEvents="none"
                  style={[StyleSheet.absoluteFill, styles.center]}
                >
                  <Mote mote={m} amp={amp} clock={clock} rise={markH * 0.92} />
                </View>
              ))}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('onboarding_ritual.seal_a11y')}
            accessibilityHint={
              assistive
                ? t('onboarding_ritual.seal_hint_assistive')
                : t('onboarding_ritual.seal_hint')
            }
            accessibilityState={{ disabled: sealed }}
            hitSlop={20}
            onPressIn={onPressIn}
            onPressOut={release}
            onPress={assistive ? sealFromAssistive : undefined}
          >
            <Animated.View style={[{ width: markW, height: markH }, markStyle]}>
              {/* L'aura de la marque : elle monte en intensité SANS être
                  découpée par le cache. Un halo qui suivrait le tracé et se
                  ferait trancher dessinerait une barre en travers du dessin. */}
              <Animated.View
                pointerEvents="none"
                style={[styles.markGlow, glowBox, haloStyle]}
              >
                <Svg width={markW * 1.5} height={markH * 1.5}>
                  <Defs>
                    <RadialGradient
                      id="ritualMarkGlow"
                      cx="50%"
                      cy="50%"
                      r="50%"
                    >
                      <Stop
                        offset="0%"
                        stopColor={OB.grad[1]}
                        stopOpacity={0.5}
                      />
                      <Stop
                        offset="55%"
                        stopColor={OB.grad[0]}
                        stopOpacity={0.16}
                      />
                      <Stop offset="100%" stopColor={OB.bg} stopOpacity={0} />
                    </RadialGradient>
                  </Defs>
                  <Ellipse
                    cx={markW * 0.75}
                    cy={markH * 0.75}
                    rx={markW * 0.75}
                    ry={markH * 0.75}
                    fill="url(#ritualMarkGlow)"
                  />
                </Svg>
              </Animated.View>
              <Animated.View style={[StyleSheet.absoluteFill, ghostStyle]}>
                <FingerprintMark width={markW} tone="ghost" />
              </Animated.View>
              <Animated.View style={[styles.reveal, revealStyle]}>
                <View
                  style={[styles.revealInner, { width: markW, height: markH }]}
                >
                  <FingerprintMark width={markW} tone="live" />
                </View>
                {/* Le front de lumière, qui « scanne » l'empreinte. Dégradé
                    éteint sur les bords : un trait plein se lirait comme une
                    coupure nette au milieu du dessin. */}
                <Animated.View
                  style={[
                    styles.scanLine,
                    { width: markW * 0.86, left: markW * 0.07 },
                    scanStyle,
                  ]}
                >
                  <Svg width={markW * 0.86} height={3}>
                    <Defs>
                      <LinearGradient id="ritualScan" x1="0%" x2="100%">
                        <Stop
                          offset="0%"
                          stopColor={OB.grad[1]}
                          stopOpacity={0}
                        />
                        <Stop
                          offset="50%"
                          stopColor={OB.grad[1]}
                          stopOpacity={0.9}
                        />
                        <Stop
                          offset="100%"
                          stopColor={OB.grad[1]}
                          stopOpacity={0}
                        />
                      </LinearGradient>
                    </Defs>
                    <Rect
                      x={0}
                      y={0}
                      width={markW * 0.86}
                      height={3}
                      fill="url(#ritualScan)"
                    />
                  </Svg>
                </Animated.View>
              </Animated.View>
            </Animated.View>
          </Pressable>

          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, styles.center]}
          >
            {PARTICLES.map(p => (
              <Particle
                key={p.key}
                dx={p.dx}
                dy={p.dy}
                burst={burst}
                reach={ringR * 1.25}
              />
            ))}
          </View>
        </Reveal>
      </View>

      {/* Le socle garde sa place dès le départ : quand le CTA apparaît,
          rien ne remonte sous les yeux de celui qui vient de sceller. */}
      <View style={styles.foot}>
        {sealed ? (
          <Animated.View entering={FadeInDown.duration(420)}>
            <Pill
              label={t('paywall.continue')}
              onPress={onDone}
              kind="gradient"
              glow
            />
          </Animated.View>
        ) : null}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  title: {
    ...fonts.bold,
    fontSize: 30,
    lineHeight: 37,
    letterSpacing: -0.7,
    color: OB.ink,
    textAlign: 'center',
  },
  sub: {
    ...fonts.regular,
    fontSize: 16,
    lineHeight: 23,
    color: OB.ink55,
    textAlign: 'center',
    marginTop: 10,
  },
  stage: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
  center: { alignItems: 'center', justifyContent: 'center' },
  ripple: {
    borderWidth: 1.5,
    borderColor: OB.grad[1],
  },
  mote: {
    position: 'absolute',
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: OB.grad[1],
  },
  particle: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: OB.accent,
  },
  ringHead: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: OB.grad[1],
    shadowColor: OB.accent,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  markGlow: { position: 'absolute' },
  /** Cache du remplissage : ancré en bas, sa hauteur EST la progression. */
  reveal: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
  },
  revealInner: { position: 'absolute', left: 0, bottom: 0 },
  scanLine: { position: 'absolute', top: 0, height: 3 },
  foot: {
    minHeight: 116,
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
})
