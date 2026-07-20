import React, { useEffect, useRef, useState } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg'
import { fonts } from '@/shared/theme/tokens/fonts'
import {
  Footnote,
  GhostLink,
  GradientLine,
  Moon,
  Pill,
  StudyLine,
} from './bits'
import { Reveal } from './motion'
import { haptic, OB } from './tokens'

// ─── Acte 0 · L'allumage ────────────────────────────────────────────────

/**
 * Reprend EXACTEMENT le cadre du splash natif (lune 160 pt centrée sur
 * noir) : l'enchaînement paraît être une seule séquence. La lune respire,
 * son halo s'allume, puis on passe à la promesse. Un tap saute.
 */
export function SceneIgnition({ onDone }: { onDone: () => void }) {
  const breath = useSharedValue(1)
  const glow = useSharedValue(0)
  const done = useRef(false)

  useEffect(() => {
    glow.value = withDelay(300, withTiming(1, { duration: 1100 }))
    breath.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1050, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1050, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    )
    const t = setTimeout(() => {
      if (!done.current) {
        done.current = true
        onDone()
      }
    }, 2300)
    return () => clearTimeout(t)
  }, [breath, glow, onDone])

  const moonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value }],
  }))
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value }))

  return (
    <Pressable
      style={styles.ignition}
      onPress={() => {
        if (!done.current) {
          done.current = true
          onDone()
        }
      }}
    >
      <Animated.View style={glowStyle}>
        <Animated.View style={moonStyle}>
          <Moon size={160} glow />
        </Animated.View>
      </Animated.View>
    </Pressable>
  )
}

// ─── Acte 0 · La promesse ───────────────────────────────────────────────

export function SceneWelcome({
  onNext,
  onHaveAccount,
}: {
  onNext: () => void
  onHaveAccount: () => void
}) {
  const breath = useSharedValue(1)
  useEffect(() => {
    breath.value = withRepeat(
      withSequence(
        withTiming(1.04, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    )
  }, [breath])
  const moonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breath.value }],
  }))

  return (
    <View style={styles.scene}>
      <View style={styles.welcomeTopRow}>
        <GhostLink label="J'ai déjà un compte" onPress={onHaveAccount} dim />
      </View>
      <View style={styles.welcomeCenter}>
        <Reveal index={0}>
          <Animated.View style={moonStyle}>
            <Moon size={128} glow />
          </Animated.View>
        </Reveal>
        <Reveal index={1} style={styles.welcomeTitleBlock}>
          <Text style={styles.h1}>Reprends</Text>
          <GradientLine text="des années de ta vie." size={34} />
        </Reveal>
        <Reveal index={2}>
          <Text style={styles.sub}>
            Relock bloque ce qui te vole ton temps, et te le rend.
          </Text>
        </Reveal>
      </View>
      <Reveal index={3} style={styles.bottom}>
        <Pill label="Commencer" onPress={onNext} />
      </Reveal>
    </View>
  )
}

// ─── Acte 0 · La démo produit ───────────────────────────────────────────

const FEED_BLOCKS = [
  { h: 92, c: '#22222A' },
  { h: 64, c: '#26202E' },
  { h: 110, c: '#1E2430' },
  { h: 72, c: '#2A2230' },
  { h: 96, c: '#202A2C' },
  { h: 60, c: '#282832' },
]

/**
 * Mockup d'iPhone animé en boucle : un feed défile tard le soir, puis le
 * bouclier Relock monte et bloque. La magie du produit, vécue avant la
 * première question — le principe Cal AI, sans vidéo (tout est recréé).
 */
function PhoneDemo() {
  // Une seule horloge pilote toute la boucle : zéro dérive entre les
  // couches (défilement du feed, montée du bouclier, fondu de reprise).
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1 }),
        withTiming(1, { duration: 4400, easing: Easing.linear }),
      ),
      -1,
      false,
    )
  }, [t])

  const feedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          t.value,
          [0, 0.42, 1],
          [0, -180, -180],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }))
  const shieldStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          t.value,
          [0, 0.4, 0.5, 0.54, 1],
          [340, 340, -10, 0, 0],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }))
  const frameStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      t.value,
      [0, 0.05, 0.93, 1],
      [0.4, 1, 1, 0.4],
      Extrapolation.CLAMP,
    ),
  }))

  return (
    <Animated.View style={[styles.phone, frameStyle]}>
      <View style={styles.phoneScreen}>
        <View style={styles.phoneStatus}>
          <Text style={styles.phoneClock}>23:47</Text>
          <View style={styles.phonePill}>
            <Text style={styles.phonePillText}>Pour toi</Text>
          </View>
        </View>
        <Animated.View style={feedStyle}>
          {FEED_BLOCKS.concat(FEED_BLOCKS).map((b, i) => (
            <View
              key={`${b.c}-${i}`}
              style={[styles.feedBlock, { height: b.h, backgroundColor: b.c }]}
            />
          ))}
        </Animated.View>
        <Animated.View style={[styles.shield, shieldStyle]}>
          <Moon size={56} glow />
          <Text style={styles.shieldTitle}>Bloqué</Text>
          <Text style={styles.shieldSub}>Retrouve ta soirée.</Text>
          <View style={styles.shieldBtn}>
            <Text style={styles.shieldBtnText}>Fermer</Text>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  )
}

export function SceneDemo({ onNext }: { onNext: () => void }) {
  return (
    <View style={styles.scene}>
      <View style={styles.demoCenter}>
        <Reveal index={0}>
          <Text style={styles.h1}>Voilà ce qui se passe</Text>
          <GradientLine text="à 23 h 47." size={32} />
        </Reveal>
        <Reveal index={1} style={{ marginTop: 26 }}>
          <PhoneDemo />
        </Reveal>
        <Reveal index={2} style={{ marginTop: 22 }}>
          <Text style={styles.sub}>
            Relock s'interpose. Toi, tu récupères ta soirée.
          </Text>
        </Reveal>
      </View>
      <Reveal index={3} style={styles.bottom}>
        <Pill label="Je veux ça" onPress={onNext} />
      </Reveal>
    </View>
  )
}

// ─── Acte 1 · Prénom ────────────────────────────────────────────────────

export function SceneName({
  value,
  onChange,
  onNext,
}: {
  value: string
  onChange: (v: string) => void
  onNext: () => void
}) {
  return (
    <View style={styles.scene}>
      <View style={styles.questionTop}>
        <Reveal index={0}>
          <Text style={styles.h1}>Comment tu t'appelles ?</Text>
        </Reveal>
        <Reveal index={1}>
          <Text style={styles.subLeft}>Pour que ton plan te parle, à toi.</Text>
        </Reveal>
        <Reveal index={2} style={{ marginTop: 34 }}>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Ton prénom"
            placeholderTextColor={OB.ink28}
            style={styles.nameInput}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={onNext}
          />
        </Reveal>
      </View>
      <Reveal index={3} style={styles.bottom}>
        <Pill label="Continuer" onPress={onNext} disabled={false} />
        <GhostLink label="Passer" onPress={onNext} dim />
      </Reveal>
    </View>
  )
}

// ─── Acte 1 · Le jouet des heures ───────────────────────────────────────

const MIN_H = 1
const MAX_H = 10

/**
 * L'aveu central, transformé en jouet : un chiffre géant qui compte
 * pendant le geste, des ticks haptiques à chaque heure. Jamais un
 * formulaire.
 */
export function SceneHours({
  hours,
  setHours,
  onNext,
}: {
  hours: number
  setHours: (h: number) => void
  onNext: () => void
}) {
  const { width } = useWindowDimensions()
  const trackW = width - 40 - 44 * 2 - 24
  const pos = useSharedValue(((hours - MIN_H) / (MAX_H - MIN_H)) * trackW)

  const commit = (v: number) => {
    haptic.tick()
    setHours(v)
  }

  const pan = Gesture.Pan()
    .onChange(e => {
      const next = Math.min(trackW, Math.max(0, pos.value + e.changeX))
      pos.value = next
      const v = Math.round(MIN_H + (next / trackW) * (MAX_H - MIN_H))
      runOnJS(commitIfChanged)(v)
    })
    .onFinalize(() => {
      const v = Math.round(MIN_H + (pos.value / trackW) * (MAX_H - MIN_H))
      pos.value = withSpring(((v - MIN_H) / (MAX_H - MIN_H)) * trackW, {
        damping: 18,
        stiffness: 220,
      })
    })

  const last = useRef(hours)
  function commitIfChanged(v: number) {
    if (v !== last.current) {
      last.current = v
      commit(v)
    }
  }

  const step = (d: number) => {
    const v = Math.min(MAX_H, Math.max(MIN_H, last.current + d))
    if (v !== last.current) {
      last.current = v
      commit(v)
      pos.value = withSpring(((v - MIN_H) / (MAX_H - MIN_H)) * trackW, {
        damping: 18,
        stiffness: 220,
      })
    }
  }

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: pos.value }],
  }))
  const fillStyle = useAnimatedStyle(() => ({ width: pos.value + 14 }))

  return (
    <View style={styles.scene}>
      <View style={styles.questionTop}>
        <Reveal index={0}>
          <Text style={styles.h1}>Combien d'heures par jour, à ton avis ?</Text>
        </Reveal>
        <Reveal index={1}>
          <Text style={styles.subLeft}>Une estimation honnête suffit.</Text>
        </Reveal>
        <Reveal index={2} style={styles.hoursHero}>
          <GradientLine
            text={`${hours}${hours >= MAX_H ? '+' : ''}`}
            size={104}
          />
          <Text style={styles.hoursUnit}>heures par jour</Text>
        </Reveal>
        <Reveal index={3} style={styles.sliderRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Moins"
            onPress={() => step(-1)}
            style={styles.stepBtn}
          >
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <GestureDetector gesture={pan}>
            <View style={[styles.track, { width: trackW + 28 }]}>
              <Animated.View style={[styles.trackFill, fillStyle]} />
              <Animated.View style={[styles.thumb, thumbStyle]} />
            </View>
          </GestureDetector>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Plus"
            onPress={() => step(1)}
            style={styles.stepBtn}
          >
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </Reveal>
      </View>
      <Reveal index={4} style={styles.bottom}>
        <Pill label="Continuer" onPress={onNext} />
        <GhostLink
          label="Je ne sais pas"
          onPress={() => {
            setHours(4)
            onNext()
          }}
          dim
        />
      </Reveal>
    </View>
  )
}

// ─── Acte 1 · La preuve (courbe de divergence) ──────────────────────────

/**
 * L'interstitiel qui « donne » après les aveux : ta trajectoire sans
 * Relock, et avec. Les deux courbes se dessinent, la seconde en dégradé,
 * son point d'arrivée est la lune.
 */
const CURVE_LEN = 420

export function SceneProof({ onNext }: { onNext: () => void }) {
  // Tracé progressif des courbes : un progrès JS suffit largement ici
  // (33 valeurs par seconde sur un strokeDashoffset).
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start - 500) / 1400)
      setProgress(Math.max(0, t))
      if (t >= 1) clearInterval(id)
    }, 32)
    return () => clearInterval(id)
  }, [])

  return (
    <View style={styles.scene}>
      <View style={styles.demoCenter}>
        <Reveal index={0}>
          <Text style={styles.h1}>Deux semaines.</Text>
          <Text style={styles.h1Dim}>
            C'est ce qu'il faut pour sentir la différence.
          </Text>
        </Reveal>
        <Reveal index={1} style={styles.chartCard}>
          <Svg width="100%" height={190} viewBox="0 0 320 190">
            <Defs>
              <LinearGradient id="proofGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor={OB.grad[0]} />
                <Stop offset="100%" stopColor={OB.grad[2]} />
              </LinearGradient>
            </Defs>
            {/* Sans Relock : plate, haute. */}
            <Path
              d="M16 52 C 90 46, 180 54, 304 44"
              stroke={OB.ink28}
              strokeWidth={3}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={CURVE_LEN}
              strokeDashoffset={CURVE_LEN * (1 - progress)}
            />
            {/* Avec Relock : plonge. */}
            <Path
              d="M16 56 C 110 62, 170 130, 296 152"
              stroke="url(#proofGrad)"
              strokeWidth={4}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={CURVE_LEN}
              strokeDashoffset={CURVE_LEN * (1 - progress)}
            />
            {progress >= 1 ? (
              <Circle cx={296} cy={152} r={7} fill={OB.accent} />
            ) : null}
          </Svg>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: OB.ink28 }]} />
              <Text style={styles.legendText}>
                Ton temps d'écran, sans rien
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View
                style={[styles.legendDot, { backgroundColor: OB.accent }]}
              />
              <Text style={styles.legendText}>Avec Relock</Text>
            </View>
          </View>
        </Reveal>
        <Reveal index={2} style={{ marginTop: 18 }}>
          <StudyLine text="En moyenne, on consulte son téléphone plus de 140 fois par jour." />
        </Reveal>
      </View>
      <Reveal index={3} style={styles.bottom}>
        <Pill label="Continuer" onPress={onNext} />
        <Footnote text="Projection basée sur tes blocages planifiés. Pas une promesse magique." />
      </Reveal>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  ignition: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  scene: { flex: 1, paddingHorizontal: 20 },
  bottom: { gap: 8, paddingBottom: 10 },

  h1: {
    ...fonts.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: OB.ink,
  },
  h1Dim: {
    ...fonts.bold,
    fontSize: 26,
    lineHeight: 33,
    letterSpacing: -0.6,
    color: OB.ink55,
    marginTop: 4,
  },
  sub: {
    ...fonts.regular,
    fontSize: 16.5,
    lineHeight: 24,
    color: OB.ink55,
    textAlign: 'center',
  },
  subLeft: {
    ...fonts.regular,
    fontSize: 16,
    lineHeight: 23,
    color: OB.ink55,
    marginTop: 8,
  },

  welcomeTopRow: { alignItems: 'flex-end', paddingTop: 4 },
  welcomeCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  welcomeTitleBlock: { alignItems: 'center', alignSelf: 'stretch', gap: 2 },

  demoCenter: { flex: 1, justifyContent: 'center' },

  phone: {
    alignSelf: 'center',
    width: 218,
    height: 442,
    borderRadius: 42,
    borderWidth: 5,
    borderColor: '#26262E',
    backgroundColor: '#0B0B10',
    overflow: 'hidden',
  },
  phoneScreen: { flex: 1, overflow: 'hidden' },
  phoneStatus: {
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  phoneClock: { ...fonts.semiBold, fontSize: 13, color: OB.ink70 },
  phonePill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  phonePillText: { ...fonts.medium, fontSize: 11, color: OB.ink55 },
  feedBlock: { marginHorizontal: 12, marginBottom: 10, borderRadius: 14 },
  shield: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,5,7,0.97)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  shieldTitle: { ...fonts.bold, fontSize: 20, color: OB.ink, marginTop: 6 },
  shieldSub: { ...fonts.regular, fontSize: 12.5, color: OB.ink55 },
  shieldBtn: {
    marginTop: 12,
    backgroundColor: OB.accent,
    borderRadius: 15,
    paddingHorizontal: 22,
    paddingVertical: 8,
  },
  shieldBtnText: { ...fonts.semiBold, fontSize: 13, color: OB.onAccent },

  questionTop: { flex: 1, paddingTop: 12 },
  nameInput: {
    ...fonts.semiBold,
    fontSize: 26,
    color: OB.ink,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: OB.accentDim,
  },

  hoursHero: { alignItems: 'center', marginTop: 40 },
  hoursUnit: { ...fonts.medium, fontSize: 15, color: OB.ink40, marginTop: 2 },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 34,
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { ...fonts.semiBold, fontSize: 22, color: OB.ink70, marginTop: -2 },
  track: {
    height: 30,
    justifyContent: 'center',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    height: 6,
    borderRadius: 3,
    backgroundColor: OB.accent,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: OB.ink,
  },

  chartCard: {
    marginTop: 26,
    backgroundColor: OB.card,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 6,
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 18,
    marginTop: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...fonts.medium, fontSize: 12.5, color: OB.ink55 },
})
