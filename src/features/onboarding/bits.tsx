import React, { useEffect } from 'react'
import {
  Image,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
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
import {
  GUIDE_FRAME_ASPECT_RATIO,
  GUIDE_FRAME_GAP,
  GUIDE_SCENE_PADDING,
  haptic,
  OB,
} from './tokens'

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

// ─── Flèche de la carte-guide ───────────────────────────────────────────

/**
 * Asset fourni par le design (`design/Notifications/flecheUp.png`), copié
 * tel quel dans `assets/` — un dessin à la main n'a jamais rendu aussi net
 * ni aussi lisible sur fond sombre que ce PNG détouré (dégradé lavande →
 * bleu glacier déjà intégré à l'image).
 *
 * Géométrie mesurée au pixel dans le fichier source (992×1586, canal
 * alpha réel) : la pointe de la flèche (l'endroit qui doit s'aligner sur
 * le bouton) est à 62.15% de la largeur et 19.36% de la hauteur du
 * canevas — PAS au centre ni en haut strict, d'où ces fractions plutôt
 * que de deviner un point d'ancrage.
 */
const ARROW_IMG = require('../../../assets/onboarding-arrow.png')
const ARROW_ASPECT = 992 / 1586
const ARROW_TIP_X_FRACTION = 0.6215
const ARROW_TIP_Y_FRACTION = 0.1936

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
  const g = size * 1.6
  const blobR = size * 0.56
  const offset = size * 0.22
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
            <RadialGradient id="moonGlowL" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={OB.grad[1]} stopOpacity={0.75} />
              <Stop offset="50%" stopColor={OB.grad[0]} stopOpacity={0.36} />
              <Stop offset="100%" stopColor={OB.grad[0]} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="moonGlowR" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={OB.grad[2]} stopOpacity={0.72} />
              <Stop offset="50%" stopColor={OB.grad[2]} stopOpacity={0.34} />
              <Stop offset="100%" stopColor={OB.grad[2]} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle
            cx={g / 2 - offset}
            cy={g / 2}
            r={blobR}
            fill="url(#moonGlowL)"
          />
          <Circle
            cx={g / 2 + offset}
            cy={g / 2}
            r={blobR}
            fill="url(#moonGlowR)"
          />
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
  icon,
  glow = false,
}: {
  label: string
  sub?: string
  onPress: () => void
  kind?: PillKind
  disabled?: boolean
  icon?: React.ReactNode
  glow?: boolean
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
          glow && styles.pillGlow,
          aStyle,
        ]}
      >
        <View style={styles.pillRow}>
          {icon}
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
        </View>
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
  underline = false,
  accent = false,
}: {
  label: string
  onPress: () => void
  dim?: boolean
  underline?: boolean
  accent?: boolean
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
      <Text
        style={[
          styles.ghostLink,
          dim && { color: OB.ink40 },
          accent && { color: OB.accent },
          underline && styles.ghostLinkUnderline,
        ]}
      >
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
 * Carte-guide d'autorisation : cadre au dégradé signature (l'aperçu de la
 * fenêtre iOS à venir) autour d'une réplique sombre du dialogue système,
 * deux choix côte à côte, et une flèche pointant celui que l'utilisateur va
 * réellement obtenir. Un seul des deux boutons est réel — celui qui
 * déclenche la vraie permission (`activeSide`) ; l'autre reste une pure
 * prévisualisation du dialogue natif à venir, jamais interactif.
 */
/** Taille d'affichage de la flèche (l'aspect réel du PNG source est conservé). */
const ARROW_DISPLAY_W = 104
const ARROW_DISPLAY_H = Math.round(ARROW_DISPLAY_W / ARROW_ASPECT)
/** Espace visible entre la pointe de la flèche et le bouton visé — elle ne doit jamais le toucher. */
const ARROW_GAP_TO_BUTTON = 10
/** Géométrie partagée avec les styles; la hauteur de pilule ancre la flèche. */
const GUIDE_INNER_PAD_H = 18
const GUIDE_INNER_PAD_BOTTOM = 16
const GUIDE_ROW_GAP = 10
const GUIDE_PILL_HEIGHT = 50
const GUIDE_ARROW_TOP =
  GUIDE_PILL_HEIGHT +
  ARROW_GAP_TO_BUTTON -
  ARROW_DISPLAY_H * ARROW_TIP_Y_FRACTION
const GUIDE_ARROW_TRAILING_SPACE = 72

type GuideFrameVariant = 'permission' | 'notifications'

export function GuideCard({
  title,
  body,
  leftLabel,
  rightLabel,
  activeSide,
  onActivePress,
  activeBusy = false,
  interactive = true,
  dimmed = false,
  frameVariant = 'permission',
}: {
  title: string
  body: string
  leftLabel: string
  rightLabel: string
  activeSide: 'left' | 'right'
  onActivePress?: () => void
  activeBusy?: boolean
  /** false : les deux choix restent une pure prévisualisation (aucun n'est réel). */
  interactive?: boolean
  /**
   * true dès que la vraie demande système est lancée : la carte s'efface
   * (fondu) pour ne jamais rester visible à côté d'une fenêtre native dont
   * ni la taille ni la position exactes ne sont prévisibles — deux boîtes
   * qui se chevauchent mal est pire qu'une carte qui s'efface proprement.
   */
  dimmed?: boolean
  frameVariant?: GuideFrameVariant
}) {
  const { width: screenWidth } = useWindowDimensions()
  const frameAspectRatio = GUIDE_FRAME_ASPECT_RATIO[frameVariant]
  const frameWidth = screenWidth - GUIDE_SCENE_PADDING * 2
  const frameHeight = frameWidth / frameAspectRatio
  const scale = useSharedValue(1)
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: withTiming(dimmed ? 0.05 : 1, { duration: 180 }),
  }))

  const renderPill = (label: string, side: 'left' | 'right') => {
    const active = side === activeSide
    const text = (
      <Text
        style={[
          styles.guidePillLabel,
          active ? styles.guidePillLabelActive : styles.guidePillLabelDim,
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.9}
      >
        {label}
      </Text>
    )
    const pill =
      active && interactive && onActivePress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={label}
          disabled={activeBusy}
          style={styles.guidePillPressable}
          onPressIn={() => {
            scale.value = withSpring(0.96, { damping: 20, stiffness: 400 })
          }}
          onPressOut={() => {
            scale.value = withSpring(1, { damping: 16, stiffness: 300 })
          }}
          onPress={() => {
            haptic.tap()
            onActivePress()
          }}
        >
          <Animated.View
            style={[styles.guidePill, styles.guidePillActive, aStyle]}
          >
            {text}
          </Animated.View>
        </Pressable>
      ) : (
        <View style={[styles.guidePill, active && styles.guidePillActive]}>
          {text}
        </View>
      )

    return (
      <View style={styles.guidePillSlot}>
        {pill}
        {active ? (
          <View pointerEvents="none" style={styles.guideArrow}>
            <Image
              source={ARROW_IMG}
              resizeMode="contain"
              style={styles.guideArrowImage}
            />
          </View>
        ) : null}
      </View>
    )
  }

  return (
    <Animated.View style={[styles.guideContainer, fadeStyle]}>
      <View
        style={[
          styles.guideFrame,
          frameVariant === 'notifications' && styles.guideFrameNotifications,
        ]}
      >
        <Svg
          style={StyleSheet.absoluteFill}
          width={frameWidth}
          height={frameHeight}
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id="guideGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={OB.grad[0]} />
              <Stop offset="100%" stopColor={OB.grad[2]} />
            </LinearGradient>
          </Defs>
          <Rect
            x={1}
            y={1}
            width={frameWidth - 2}
            height={frameHeight - 2}
            rx={40}
            fill="url(#guideGrad)"
            fillOpacity={0.07}
            stroke="url(#guideGrad)"
            strokeWidth={1.4}
            strokeOpacity={0.9}
          />
        </Svg>
        <View style={styles.guideInner}>
          <Text style={styles.guideTitle}>{title}</Text>
          <Text style={styles.guideBody}>{body}</Text>
          <View style={styles.guideRow}>
            {renderPill(leftLabel, 'left')}
            {renderPill(rightLabel, 'right')}
          </View>
        </View>
      </View>
      <View pointerEvents="none" style={styles.guideArrowTrailingSpace} />
    </Animated.View>
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
    backgroundColor: 'rgba(20,18,32,0.4)',
    borderWidth: 1,
    borderColor: 'rgba(164,154,254,0.28)',
  },
  pillDanger: { backgroundColor: OB.accent },
  pillDisabled: { backgroundColor: 'rgba(255,255,255,0.09)' },
  pillGlow: {
    shadowColor: OB.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 12,
  },
  pillRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  ghostLinkUnderline: {
    textDecorationLine: 'underline',
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

  guideContainer: { alignSelf: 'stretch' },
  guideFrame: {
    alignSelf: 'stretch',
    aspectRatio: GUIDE_FRAME_ASPECT_RATIO.permission,
    borderRadius: 40,
    justifyContent: 'center',
    shadowColor: OB.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.32,
    shadowRadius: 28,
    elevation: 10,
  },
  guideFrameNotifications: {
    aspectRatio: GUIDE_FRAME_ASPECT_RATIO.notifications,
  },
  guideInner: {
    borderRadius: 20,
    backgroundColor: '#141416',
    marginHorizontal: GUIDE_FRAME_GAP,
    paddingTop: 18,
    paddingBottom: GUIDE_INNER_PAD_BOTTOM,
    paddingHorizontal: GUIDE_INNER_PAD_H,
  },
  guideTitle: {
    ...fonts.semiBold,
    fontSize: 18,
    lineHeight: 23,
    color: OB.ink,
    textAlign: 'center',
  },
  guideBody: {
    ...fonts.regular,
    fontSize: 14,
    lineHeight: 19,
    color: OB.ink55,
    textAlign: 'center',
    marginTop: 8,
  },
  guideRow: { flexDirection: 'row', gap: GUIDE_ROW_GAP, marginTop: 16 },
  guidePillSlot: {
    flexBasis: 0,
    flexGrow: 1,
    width: 0,
    minWidth: 0,
    minHeight: GUIDE_PILL_HEIGHT,
  },
  guidePillPressable: { flex: 1, width: '100%' },
  guidePill: {
    flex: 1,
    width: '100%',
    minHeight: GUIDE_PILL_HEIGHT,
    borderRadius: GUIDE_PILL_HEIGHT / 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  guidePillActive: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: OB.ink28,
    backgroundColor: 'rgba(164,154,254,0.14)',
  },
  guidePillLabel: { ...fonts.semiBold, fontSize: 13.5, letterSpacing: -0.2 },
  guidePillLabelActive: { color: OB.accent },
  guidePillLabelDim: { color: OB.ink40 },
  guideArrow: {
    position: 'absolute',
    zIndex: 2,
    left: '50%',
    top: GUIDE_ARROW_TOP,
    width: ARROW_DISPLAY_W,
    height: ARROW_DISPLAY_H,
    transform: [{ translateX: -ARROW_TIP_X_FRACTION * ARROW_DISPLAY_W }],
    shadowColor: OB.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.85,
    shadowRadius: 8,
  },
  guideArrowImage: { width: '100%', height: '100%' },
  guideArrowTrailingSpace: { height: GUIDE_ARROW_TRAILING_SPACE },
})
