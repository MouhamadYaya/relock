import React, { useEffect } from 'react'
import {
  Image,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import Animated, {
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg'
import { fonts } from '@/shared/theme/tokens/fonts'
import { haptic, OB } from './tokens'

// ─── Fond ────────────────────────────────────────────────────────────────

/**
 * Halo « projecteur » : nappe violette sombre ancrée en haut d'écran,
 * fondue vers le noir — l'architecture d'Opal V1. Respire très lentement.
 */
export function HaloBackdrop({ intensity = 1 }: { intensity?: number }) {
  const breath = useSharedValue(0)
  useEffect(() => {
    breath.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3600 }),
        withTiming(0, { duration: 3600 }),
      ),
      -1,
      true,
    )
  }, [breath])
  const style = useAnimatedStyle(() => ({
    opacity: (0.75 + breath.value * 0.25) * intensity,
  }))
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, style]}
    >
      <Svg width="100%" height="52%">
        <Defs>
          <RadialGradient id="obHalo" cx="50%" cy="0%" r="95%">
            <Stop offset="0%" stopColor={OB.halo} stopOpacity={0.9} />
            <Stop offset="55%" stopColor={OB.halo} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={OB.bg} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#obHalo)" />
      </Svg>
    </Animated.View>
  )
}

// ─── Lune ────────────────────────────────────────────────────────────────

const MOON = require('../../../assets/moon.png')

/** Le logo lune, détouré. `glow` ajoute un halo doux derrière. */
export function Moon({
  size,
  glow = false,
  style,
}: {
  size: number
  glow?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const g = size * 2.1
  return (
    <View
      style={[{ width: size, height: size }, styles.moonWrap, style]}
      pointerEvents="none"
    >
      {glow ? (
        <Svg
          width={g}
          height={g}
          style={{
            position: 'absolute',
            left: (size - g) / 2,
            top: (size - g) / 2,
          }}
        >
          <Defs>
            <RadialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={OB.accent} stopOpacity={0.34} />
              <Stop offset="60%" stopColor={OB.accent} stopOpacity={0.1} />
              <Stop offset="100%" stopColor={OB.accent} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={g / 2} cy={g / 2} r={g / 2} fill="url(#moonGlow)" />
        </Svg>
      ) : null}
      <Image
        source={MOON}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </View>
  )
}

// ─── Typo héros ──────────────────────────────────────────────────────────

/**
 * Une ligne de texte remplie du dégradé signature. Réservée aux héros :
 * chiffres projetés, mots-clés de titre. (Le dégradé de texte n'existe pas
 * en RN pur : on passe par un texte SVG.)
 */
export function GradientLine({
  text,
  size,
  weight = '800',
  align = 'center',
}: {
  text: string
  size: number
  weight?: '600' | '700' | '800'
  align?: 'center' | 'left'
}) {
  const h = Math.ceil(size * 1.24)
  const x = align === 'center' ? '50%' : 0
  const anchor = align === 'center' ? 'middle' : 'start'
  return (
    <Svg width="100%" height={h}>
      <Defs>
        <LinearGradient id="obGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor={OB.grad[0]} />
          <Stop offset="55%" stopColor={OB.grad[1]} />
          <Stop offset="100%" stopColor={OB.grad[2]} />
        </LinearGradient>
      </Defs>
      <SvgText
        x={x}
        y={size}
        fill="url(#obGrad)"
        fontSize={size}
        fontWeight={weight}
        textAnchor={anchor}
        letterSpacing={-0.8}
      >
        {text}
      </SvgText>
    </Svg>
  )
}

// ─── Boutons ─────────────────────────────────────────────────────────────

type PillKind = 'primary' | 'ghost' | 'danger'

/** CTA pilule avec ressort au toucher + haptique. `sub` : réassurance intégrée. */
export function Pill({
  label,
  sub,
  onPress,
  kind = 'primary',
  disabled = false,
}: {
  label: string
  sub?: string
  onPress: () => void
  kind?: PillKind
  disabled?: boolean
}) {
  const scale = useSharedValue(1)
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPressIn={() => {
        scale.value = withSpring(0.965, { damping: 20, stiffness: 400 })
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 16, stiffness: 300 })
      }}
      onPress={() => {
        haptic.tap()
        onPress()
      }}
    >
      <Animated.View
        style={[
          styles.pill,
          kind === 'primary' && styles.pillPrimary,
          kind === 'ghost' && styles.pillGhost,
          kind === 'danger' && styles.pillDanger,
          disabled && styles.pillDisabled,
          aStyle,
        ]}
      >
        <Text
          style={[
            styles.pillLabel,
            kind === 'primary'
              ? styles.pillLabelPrimary
              : styles.pillLabelGhost,
            kind === 'danger' && styles.pillLabelDanger,
            disabled && styles.pillLabelDisabled,
          ]}
        >
          {label}
        </Text>
        {sub ? <Text style={styles.pillSub}>{sub}</Text> : null}
      </Animated.View>
    </Pressable>
  )
}

/** Lien texte discret (échappatoires : « Passer », « Je ne sais pas »…). */
export function GhostLink({
  label,
  onPress,
  dim = false,
}: {
  label: string
  onPress: () => void
  dim?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={() => {
        haptic.select()
        onPress()
      }}
      hitSlop={10}
    >
      <Text style={[styles.ghostLink, dim && { color: OB.ink40 }]}>
        {label}
      </Text>
    </Pressable>
  )
}

// ─── Cartes de choix ─────────────────────────────────────────────────────

/**
 * Carte de réponse. Sélection = INVERSION complète (fond clair, texte
 * sombre), le langage d'Opal et Cal AI : dans un univers sombre, le
 * contraste maximal est la couleur.
 */
export function ChoiceCard({
  label,
  emoji,
  selected,
  onPress,
  index = 0,
}: {
  label: string
  emoji?: string
  selected: boolean
  onPress: () => void
  index?: number
}) {
  const t = useSharedValue(selected ? 1 : 0)
  useEffect(() => {
    t.value = withSpring(selected ? 1 : 0, { damping: 18, stiffness: 220 })
  }, [selected, t])

  const cardStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(t.value, [0, 1], [OB.card, OB.ink]),
    transform: [{ scale: 1 + t.value * 0.012 }],
  }))
  const labelStyle = useAnimatedStyle(() => ({
    color: interpolateColor(t.value, [0, 1], [OB.ink, '#0B0B10']),
  }))
  const dotStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(t.value, [0, 1], [OB.ink28, OB.accent]),
    backgroundColor: interpolateColor(
      t.value,
      [0, 1],
      ['rgba(0,0,0,0)', OB.accent],
    ),
  }))

  return (
    <Animated.View entering={FadeInDown.duration(400).delay(80 + index * 55)}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => {
          haptic.select()
          onPress()
        }}
      >
        <Animated.View style={[styles.choice, cardStyle]}>
          {emoji ? <Text style={styles.choiceEmoji}>{emoji}</Text> : null}
          <Animated.Text
            style={[styles.choiceLabel, labelStyle]}
            numberOfLines={2}
          >
            {label}
          </Animated.Text>
          <Animated.View style={[styles.choiceDot, dotStyle]}>
            {selected ? <Text style={styles.choiceCheck}>✓</Text> : null}
          </Animated.View>
        </Animated.View>
      </Pressable>
    </Animated.View>
  )
}

// ─── Progression / retour ────────────────────────────────────────────────

/** Barre de progression fine, remplissage animé au dégradé d'accent. */
export function OBProgress({ step, total }: { step: number; total: number }) {
  const w = useSharedValue(0)
  useEffect(() => {
    w.value = withSpring(step / total, { damping: 20, stiffness: 140 })
  }, [step, total, w])
  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }))
  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, fill]} />
    </View>
  )
}

/** Bouton retour (chevron dessiné, pas un glyphe texte). */
export function BackBtn({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Retour"
      onPress={() => {
        haptic.select()
        onPress()
      }}
      hitSlop={10}
      style={styles.backBtn}
    >
      <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
        <Path
          d="M15 5l-7 7 7 7"
          stroke={OB.ink70}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </Pressable>
  )
}

// ─── Divers ──────────────────────────────────────────────────────────────

/** Note de bas d'écran (méthodologie, mentions) — la crédibilité du chiffre. */
export function Footnote({ text }: { text: string }) {
  return <Text style={styles.footnote}>{text}</Text>
}

/** Vérité d'étude / appartenance, en pilule discrète. */
export function StudyLine({ text }: { text: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(380)} style={styles.study}>
      <View style={styles.studyDot} />
      <Text style={styles.studyText}>{text}</Text>
    </Animated.View>
  )
}

/**
 * Alerte rouge minimaliste, intégrée au design (jamais un Alert système) :
 * l'explication du refus d'une autorisation indispensable.
 */
export function RedAlert({ text }: { text: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(320)} style={styles.redAlert}>
      <View style={styles.redDot} />
      <Text style={styles.redText}>{text}</Text>
    </Animated.View>
  )
}

/**
 * Réplique du dialogue d'autorisation iOS, encadrée du dégradé signature,
 * avec le choix « autoriser » lumineux et l'autre éteint — le pré-prompt
 * pédagogique d'Opal : l'utilisateur apprend le geste avant de le faire.
 */
export function MockDialog({
  title,
  body,
  allowLabel,
  denyLabel,
}: {
  title: string
  body: string
  allowLabel: string
  denyLabel: string
}) {
  return (
    <View style={styles.mockWrap}>
      <Svg
        style={StyleSheet.absoluteFill}
        width="100%"
        height="100%"
        pointerEvents="none"
      >
        <Defs>
          <LinearGradient id="mockGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={OB.grad[0]} />
            <Stop offset="100%" stopColor={OB.grad[2]} />
          </LinearGradient>
        </Defs>
        <Rect
          x={1.5}
          y={1.5}
          width="99%"
          height="97%"
          rx={18}
          fill="none"
          stroke="url(#mockGrad)"
          strokeWidth={1.6}
          opacity={0.85}
        />
      </Svg>
      <View style={styles.mockCard}>
        <Text style={styles.mockTitle}>{title}</Text>
        <Text style={styles.mockBody}>{body}</Text>
        <View style={styles.mockSep} />
        <Text style={styles.mockAllow}>{allowLabel}</Text>
        <View style={styles.mockSep} />
        <Text style={styles.mockDeny}>{denyLabel}</Text>
      </View>
      {/* Flèche « dessinée à la main » vers le choix lumineux. */}
      <Svg
        width={64}
        height={72}
        style={styles.mockArrow}
        viewBox="0 0 64 72"
        fill="none"
      >
        <Path
          d="M54 66 C 30 58, 20 40, 30 12"
          stroke={OB.accent}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeDasharray="1 7"
        />
        <Path
          d="M22 20 L30 8 L38 20"
          stroke={OB.accent}
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  moonWrap: { alignItems: 'center', justifyContent: 'center' },

  pill: {
    minHeight: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 11,
  },
  pillPrimary: { backgroundColor: OB.ink },
  pillGhost: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: OB.hairline,
  },
  pillDanger: { backgroundColor: OB.accent },
  pillDisabled: { backgroundColor: 'rgba(255,255,255,0.09)' },
  pillLabel: { ...fonts.semiBold, fontSize: 17, letterSpacing: -0.2 },
  pillLabelPrimary: { color: '#0B0B10' },
  pillLabelGhost: { color: OB.ink },
  pillLabelDanger: { color: OB.onAccent },
  pillLabelDisabled: { color: OB.ink28 },
  pillSub: {
    ...fonts.medium,
    fontSize: 12.5,
    color: 'rgba(11,11,16,0.55)',
    marginTop: 2,
  },

  ghostLink: {
    ...fonts.semiBold,
    fontSize: 15,
    color: OB.ink55,
    textAlign: 'center',
    paddingVertical: 10,
  },

  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    paddingVertical: 17,
    paddingHorizontal: 18,
    marginBottom: 10,
  },
  choiceEmoji: { fontSize: 22 },
  choiceLabel: {
    ...fonts.semiBold,
    flex: 1,
    fontSize: 16,
    letterSpacing: -0.2,
  },
  choiceDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  choiceCheck: { ...fonts.bold, fontSize: 13, color: OB.onAccent },

  progressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.10)',
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: OB.accent,
  },

  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  footnote: {
    ...fonts.regular,
    fontSize: 12.5,
    lineHeight: 18,
    color: OB.ink28,
    textAlign: 'center',
  },

  study: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    alignSelf: 'center',
    backgroundColor: OB.accentDim,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  studyDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: OB.accent,
  },
  studyText: { ...fonts.medium, fontSize: 13, color: OB.ink70, flexShrink: 1 },

  redAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: OB.dangerBg,
    borderWidth: 1,
    borderColor: OB.dangerBorder,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  redDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: OB.danger,
  },
  redText: {
    ...fonts.medium,
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: '#FCA5A5',
  },

  mockWrap: { alignSelf: 'stretch' },
  mockCard: {
    margin: 8,
    borderRadius: 14,
    backgroundColor: OB.card2,
    paddingTop: 16,
    overflow: 'hidden',
  },
  mockTitle: {
    ...fonts.semiBold,
    fontSize: 15,
    color: OB.ink,
    textAlign: 'center',
    paddingHorizontal: 18,
  },
  mockBody: {
    ...fonts.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: OB.ink55,
    textAlign: 'center',
    paddingHorizontal: 18,
    marginTop: 4,
    marginBottom: 12,
  },
  mockSep: { height: StyleSheet.hairlineWidth, backgroundColor: OB.hairline },
  mockAllow: {
    ...fonts.semiBold,
    fontSize: 16,
    color: OB.accent,
    textAlign: 'center',
    paddingVertical: 12,
  },
  mockDeny: {
    ...fonts.regular,
    fontSize: 16,
    color: OB.ink28,
    textAlign: 'center',
    paddingVertical: 12,
  },
  mockArrow: { position: 'absolute', right: -6, bottom: -34 },
})
