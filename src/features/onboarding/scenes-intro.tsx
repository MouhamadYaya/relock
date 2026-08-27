import { IconName } from '@assets/icons'
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
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'
import { IconSvg } from '@/shared/components/ui/IconSvg'
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
//
// Reproduction fidèle de la maquette `design/welcome/welcomeimg.png` :
// mockup de téléphone (démo de l'écran « Apps bloquées » + stats), gros
// titre à deux tons, puis CTA. Toutes les cotes du mockup sont dérivées
// d'une seule échelle `v()` calquée sur la largeur de la maquette source
// (863 px) pour rester fidèles à ses proportions sur n'importe quel écran.

const WELCOME_RED = '#FA4F72'
const WELCOME_FRAME_BORDER = 'rgba(205,199,224,0.55)'
const WELCOME_SURFACE = 'rgba(255,255,255,0.05)'

function BadgeBase({
  size,
  radius,
  children,
}: {
  size: number
  radius: number
  children: React.ReactNode
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        overflow: 'hidden',
      }}
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {children}
      </Svg>
    </View>
  )
}

function BadgeTikTok({ size }: { size: number }) {
  const note =
    'M16.6 3c.4 2.3 1.9 3.9 4.2 4.2v3.2c-1.6 0-3-.5-4.2-1.4v6.4a5.6 5.6 0 11-4.8-5.5v3.3a2.4 2.4 0 102.1 2.4V3h2.7z'
  return (
    <BadgeBase size={size} radius={size * 0.28}>
      <Rect width={24} height={24} fill="#000000" />
      <Path d={note} fill="#25F4EE" transform="translate(-0.9,-0.5)" />
      <Path d={note} fill="#FE2C55" transform="translate(0.9,0.5)" />
      <Path d={note} fill="#FFFFFF" />
    </BadgeBase>
  )
}

function BadgeInstagram({ size }: { size: number }) {
  return (
    <BadgeBase size={size} radius={size * 0.28}>
      <Defs>
        <LinearGradient id="igGrad" x1="0%" y1="100%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#FEDA75" />
          <Stop offset="34%" stopColor="#D62976" />
          <Stop offset="68%" stopColor="#962FBF" />
          <Stop offset="100%" stopColor="#4F5BD5" />
        </LinearGradient>
      </Defs>
      <Rect width={24} height={24} fill="url(#igGrad)" />
      <Rect
        x={5}
        y={5}
        width={14}
        height={14}
        rx={4.4}
        stroke="#fff"
        strokeWidth={1.7}
        fill="none"
      />
      <Circle
        cx={12}
        cy={12}
        r={3.6}
        stroke="#fff"
        strokeWidth={1.7}
        fill="none"
      />
      <Circle cx={16.3} cy={7.7} r={1.1} fill="#fff" />
    </BadgeBase>
  )
}

function BadgeYouTube({ size }: { size: number }) {
  return (
    <BadgeBase size={size} radius={size * 0.28}>
      <Rect width={24} height={24} fill="#FFFFFF" />
      <Rect x={2} y={6.5} width={20} height={11} rx={5} fill="#FF0033" />
      <Path d="M10.2 9.3l5.4 2.7-5.4 2.7z" fill="#fff" />
    </BadgeBase>
  )
}

function BadgeSnapchat({ size }: { size: number }) {
  return (
    <BadgeBase size={size} radius={size * 0.28}>
      <Rect width={24} height={24} fill="#FFFC00" />
      <Path
        d="M12 4.4c2.7 0 4.6 2 4.6 4.9 0 .9-.1 1.8-.3 2.6.5.2 1 .2 1.5.1.3 0 .5.2.4.5-.1.4-.6.7-1.2 1 .1.3.2.5.1.8-.1.3-.5.5-1 .7.1.2.1.5-.1.7-.3.3-.9.4-1.5.3-.4.5-1.2.8-2.2.8h-.1c-.8.8-1.7 1.2-2.5 1.2h0c-.8 0-1.7-.4-2.5-1.2H7c-1 0-1.8-.3-2.2-.8-.6.1-1.2 0-1.5-.3-.2-.2-.2-.5-.1-.7-.5-.2-.9-.4-1-.7-.1-.3 0-.5.1-.8-.6-.3-1.1-.6-1.2-1-.1-.3.1-.5.4-.5.5.1 1 .1 1.5-.1-.2-.8-.3-1.7-.3-2.6 0-2.9 1.9-4.9 4.6-4.9z"
        fill="#fff"
      />
    </BadgeBase>
  )
}

const BLOCKED_APPS: {
  id: string
  name: string
  Badge: React.ComponentType<{ size: number }>
}[] = [
  { id: 'tiktok', name: 'TikTok', Badge: BadgeTikTok },
  { id: 'instagram', name: 'Instagram', Badge: BadgeInstagram },
  { id: 'youtube', name: 'YouTube', Badge: BadgeYouTube },
  { id: 'snapchat', name: 'Snapchat', Badge: BadgeSnapchat },
]

function NoEntryIcon({ size, color }: { size: number; color: string }) {
  const c = size / 2
  const r = c - 1.6
  const o = r * 0.66
  return (
    <Svg width={size} height={size}>
      <Circle
        cx={c}
        cy={c}
        r={r}
        stroke={color}
        strokeWidth={1.8}
        fill="none"
      />
      <Path
        d={`M${c - o} ${c - o} L${c + o} ${c + o}`}
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </Svg>
  )
}

function SparkleIcon({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2c.7 3.7 2.5 5.5 6.2 6.2-3.7.7-5.5 2.5-6.2 6.2-.7-3.7-2.5-5.5-6.2-6.2C9.5 7.5 11.3 5.7 12 2z"
        fill={color}
      />
    </Svg>
  )
}

function ProgressRing({
  size,
  strokeWidth,
}: {
  size: number
  strokeWidth: number
}) {
  const r = (size - strokeWidth) / 2
  const c = size / 2
  const circumference = 2 * Math.PI * r
  const progress = 0.94
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={OB.grad[0]} />
            <Stop offset="100%" stopColor={OB.grad[2]} />
          </LinearGradient>
        </Defs>
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke="rgba(255,255,255,0.14)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke="url(#ringGrad)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={circumference * (1 - progress)}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </Svg>
      <View
        style={[
          StyleSheet.absoluteFillObject,
          { alignItems: 'center', justifyContent: 'center' },
        ]}
      >
        <IconSvg name={IconName.CLOCK} size={size * 0.32} color={OB.ink} />
      </View>
    </View>
  )
}

function AppRow({
  name,
  Badge,
  iconSize,
  nameFs,
  subFs,
  noEntrySize,
}: {
  name: string
  Badge: React.ComponentType<{ size: number }>
  iconSize: number
  nameFs: number
  subFs: number
  noEntrySize: number
}) {
  return (
    <View
      className="flex-row items-center"
      style={{ paddingVertical: subFs * 0.6, gap: iconSize * 0.24 }}
    >
      <Badge size={iconSize} />
      <View className="flex-1" style={{ gap: nameFs * 0.14 }}>
        <Text
          numberOfLines={1}
          style={{
            ...fonts.semiBold,
            fontSize: nameFs,
            color: OB.ink,
            letterSpacing: -0.2,
          }}
        >
          {name}
        </Text>
        <View className="flex-row items-center" style={{ gap: subFs * 0.3 }}>
          <IconSvg name={IconName.LOCK} size={subFs * 0.85} color={OB.accent} />
          <Text style={{ ...fonts.medium, fontSize: subFs, color: OB.accent }}>
            Bloquée
          </Text>
        </View>
      </View>
      <NoEntryIcon size={noEntrySize} color={WELCOME_RED} />
    </View>
  )
}

/**
 * Un <Text> RN natif imbriqué (pas de SVG) : react-native-svg ne fiabilise
 * pas `textLength`/`lengthAdjust` sur du texte à tspans multiples (constaté
 * à l'écran — dépassement silencieux), alors que le moteur de texte natif
 * enroule et centre correctement quel que soit l'appareil. Couleur unie
 * (au lieu du dégradé signature) : compromis assumé pour cette fiabilité.
 */
function HeroLine2({
  fontSize,
  lineHeight,
}: {
  fontSize: number
  lineHeight: number
}) {
  return (
    <Text
      style={{
        ...fonts.bold,
        fontSize,
        lineHeight,
        letterSpacing: -1.2,
        textAlign: 'center',
      }}
    >
      <Text style={{ color: OB.ink }}>qui </Text>
      <Text style={{ color: OB.grad[1] }}>te volent ton temps.</Text>
    </Text>
  )
}

/**
 * Halo « projecteur » derrière le mockup, plus large et plus vif que
 * `HaloBackdrop` (fond commun de l'onboarding) : la maquette de cet écran
 * en fait un élément central, pas une simple nappe de fond en haut d'écran.
 */
function WelcomeGlow({
  top,
  width,
  height,
}: {
  top: number
  width: number
  height: number
}) {
  return (
    // Centrage explicite (left 50% + marge négative de la moitié de la
    // largeur) plutôt que de compter sur `alignItems` du parent : constaté
    // à l'écran, Yoga ne centre pas de façon fiable un enfant en position
    // absolute sur son axe croisé (contrairement à un enfant en flux
    // normal, comme le mockup lui-même) — le halo se retrouvait collé à
    // gauche alors que le téléphone était bien centré.
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top,
        left: '50%',
        marginLeft: -width / 2,
        width,
        height,
      }}
    >
      <Svg width={width} height={height}>
        <Defs>
          <RadialGradient id="welcomeGlow" cx="50%" cy="38%" r="55%">
            <Stop offset="0%" stopColor={OB.accent} stopOpacity={0.55} />
            <Stop offset="40%" stopColor={OB.accent} stopOpacity={0.28} />
            <Stop offset="70%" stopColor="#5B7FE0" stopOpacity={0.14} />
            <Stop offset="100%" stopColor={OB.bg} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={width} height={height} fill="url(#welcomeGlow)" />
      </Svg>
    </View>
  )
}

export function SceneWelcome({ onNext }: { onNext: () => void }) {
  const { width: windowW, height: windowH } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const availableH = windowH - insets.top - insets.bottom - 12
  const widthScale = windowW / 863

  // Un canevas-hauteur codé en dur (« la maquette mesure 2400 ») s'est avéré
  // peu fiable d'un appareil à l'autre (polices système, densité, marges de
  // sécurité…) : au lieu de deviner, on mesure la hauteur RÉELLEMENT rendue
  // à l'échelle "pleine largeur", puis on corrige l'échelle une fois si ça
  // dépasse l'espace disponible. Convergent en un aller-retour (la 2de
  // mesure ne fait que confirmer, `measuredH` n'est donc capturé qu'une
  // fois — cf. la garde dans l'onLayout).
  const [measuredH, setMeasuredH] = useState<number | null>(null)
  const scale =
    measuredH && measuredH > availableH
      ? widthScale * (availableH / measuredH)
      : widthScale
  const v = (n: number) => n * scale

  return (
    <View style={{ flex: 1, paddingHorizontal: 20 }}>
      <View
        onLayout={e => {
          if (measuredH === null) setMeasuredH(e.nativeEvent.layout.height)
        }}
      >
        <Reveal index={0} style={{ alignItems: 'center', marginTop: v(40) }}>
          <WelcomeGlow top={-v(80)} width={v(480) * 2.3} height={v(1050)} />
          <View
            style={{
              width: v(480),
              borderRadius: v(60),
              borderWidth: v(9),
              borderColor: WELCOME_FRAME_BORDER,
              backgroundColor: '#0A0A10',
              paddingHorizontal: v(28),
              paddingTop: v(10),
              paddingBottom: v(24),
            }}
          >
            <View
              className="self-center"
              style={{
                width: v(140),
                height: v(26),
                borderRadius: v(13),
                backgroundColor: 'rgba(0,0,0,0.85)',
                marginTop: v(4),
                marginBottom: v(42),
              }}
            />

            <View className="flex-row items-center justify-between">
              <View style={{ width: v(32) }} />
              <Text style={{ ...fonts.bold, fontSize: v(30), color: OB.ink }}>
                Relock
              </Text>
              <IconSvg name={IconName.SETTINGS} size={v(32)} color={OB.ink} />
            </View>

            <View
              className="flex-row items-center"
              style={{ gap: v(18), marginTop: v(46) }}
            >
              <View
                className="items-center justify-center"
                style={{
                  width: v(64),
                  height: v(64),
                  borderRadius: v(32),
                  backgroundColor: 'rgba(164,154,254,0.24)',
                }}
              >
                <IconSvg name={IconName.LOCK} size={v(30)} color={OB.accent} />
              </View>
              <Text
                style={{
                  ...fonts.bold,
                  fontSize: v(54),
                  color: OB.ink,
                  letterSpacing: -1,
                }}
              >
                Apps bloquées
              </Text>
            </View>
            <Text
              style={{
                ...fonts.regular,
                fontSize: v(21),
                color: OB.ink55,
                marginTop: v(18),
              }}
            >
              Reste concentré sur l'essentiel.
            </Text>

            <View
              style={{
                marginTop: v(40),
                borderRadius: v(28),
                backgroundColor: WELCOME_SURFACE,
                paddingHorizontal: v(20),
                paddingVertical: v(6),
              }}
            >
              {BLOCKED_APPS.map((app, i) => (
                <React.Fragment key={app.id}>
                  <AppRow
                    name={app.name}
                    Badge={app.Badge}
                    iconSize={v(58)}
                    nameFs={v(24)}
                    subFs={v(19)}
                    noEntrySize={v(28)}
                  />
                  {i < BLOCKED_APPS.length - 1 ? (
                    <View
                      style={{
                        height: StyleSheet.hairlineWidth,
                        backgroundColor: OB.hairline,
                      }}
                    />
                  ) : null}
                </React.Fragment>
              ))}
            </View>

            <View
              style={{
                marginTop: v(36),
                borderRadius: v(28),
                backgroundColor: WELCOME_SURFACE,
                paddingHorizontal: v(28),
                paddingVertical: v(28),
              }}
            >
              <View className="flex-row items-center" style={{ gap: v(24) }}>
                <ProgressRing size={v(148)} strokeWidth={v(18)} />
                <View style={{ gap: v(4) }}>
                  <Text
                    style={{
                      ...fonts.regular,
                      fontSize: v(25),
                      color: OB.ink55,
                    }}
                  >
                    Temps récupéré
                  </Text>
                  <GradientLine text="2h 47" size={v(52)} align="left" />
                  <Text
                    style={{
                      ...fonts.regular,
                      fontSize: v(25),
                      color: OB.ink55,
                    }}
                  >
                    Aujourd'hui
                  </Text>
                </View>
              </View>
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: OB.hairline,
                  marginVertical: v(24),
                }}
              />
              <View className="flex-row items-center" style={{ gap: v(8) }}>
                <SparkleIcon size={v(20)} color={OB.accent} />
                <Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  style={{
                    ...fonts.medium,
                    fontSize: v(24),
                    color: OB.accent,
                    flexShrink: 1,
                  }}
                >
                  Bravo, tu reprends le contrôle.
                </Text>
              </View>
            </View>
          </View>
        </Reveal>

        <Reveal index={1} style={{ alignItems: 'center', marginTop: v(66) }}>
          <Text
            style={{
              ...fonts.bold,
              fontSize: v(70),
              lineHeight: v(70) * 1.06,
              letterSpacing: -1.2,
              color: OB.ink,
              textAlign: 'center',
            }}
          >
            Bloque les apps
          </Text>
          <HeroLine2 fontSize={v(70)} lineHeight={v(70) * 1.06} />
        </Reveal>

        <Reveal index={2} style={{ marginTop: v(42) }}>
          <Text
            style={{
              ...fonts.regular,
              fontSize: v(27),
              lineHeight: v(36),
              color: OB.ink55,
              textAlign: 'center',
            }}
          >
            Relock bloque les distractions,{'\n'}et t'aide à récupérer ce qui
            compte vraiment.
          </Text>
        </Reveal>

        <View style={{ height: v(70) }} />

        <Reveal index={3} style={{ paddingBottom: 10 }}>
          <Pill label="Commencer" onPress={onNext} />
        </Reveal>
      </View>
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
      <View className="flex-1 overflow-hidden">
        <View className="z-[2] flex-row items-center justify-between px-4 pt-3 pb-2">
          <Text style={styles.phoneClock}>23:47</Text>
          <View style={styles.phonePill}>
            <Text style={styles.phonePillText}>Pour toi</Text>
          </View>
        </View>
        <Animated.View style={feedStyle}>
          {FEED_BLOCKS.concat(FEED_BLOCKS).map((b, i) => (
            <View
              key={`${b.c}-${i}`}
              className="mx-3 mb-2.5 rounded-[14px]"
              style={{ height: b.h, backgroundColor: b.c }}
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
    <View className="flex-1 px-5">
      <View className="flex-1 justify-center">
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
      <Reveal index={3} className="gap-2 pb-2.5">
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
    <View className="flex-1 px-5">
      <View className="flex-1 pt-3">
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
      <Reveal index={3} className="gap-2 pb-2.5">
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
    <View className="flex-1 px-5">
      <View className="flex-1 pt-3">
        <Reveal index={0}>
          <Text style={styles.h1}>Combien d'heures par jour, à ton avis ?</Text>
        </Reveal>
        <Reveal index={1}>
          <Text style={styles.subLeft}>Une estimation honnête suffit.</Text>
        </Reveal>
        <Reveal index={2} className="items-center mt-10">
          <GradientLine
            text={`${hours}${hours >= MAX_H ? '+' : ''}`}
            size={104}
          />
          <Text style={styles.hoursUnit}>heures par jour</Text>
        </Reveal>
        <Reveal index={3} className="flex-row items-center gap-3 mt-[34px]">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Moins"
            onPress={() => step(-1)}
            style={styles.stepBtn}
          >
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <GestureDetector gesture={pan}>
            <View
              className="justify-center h-[30px]"
              style={{ width: trackW + 28 }}
            >
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
      <Reveal index={4} className="gap-2 pb-2.5">
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
    <View className="flex-1 px-5">
      <View className="flex-1 justify-center">
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
          <View className="flex-row justify-center gap-[18px] mt-1">
            <View className="flex-row items-center gap-[7px]">
              <View
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: OB.ink28 }}
              />
              <Text style={styles.legendText}>
                Ton temps d'écran, sans rien
              </Text>
            </View>
            <View className="flex-row items-center gap-[7px]">
              <View
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: OB.accent }}
              />
              <Text style={styles.legendText}>Avec Relock</Text>
            </View>
          </View>
        </Reveal>
        <Reveal index={2} style={{ marginTop: 18 }}>
          <StudyLine text="En moyenne, on consulte son téléphone plus de 140 fois par jour." />
        </Reveal>
      </View>
      <Reveal index={3} className="gap-2 pb-2.5">
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
  phoneClock: { ...fonts.semiBold, fontSize: 13, color: OB.ink70 },
  phonePill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  phonePillText: { ...fonts.medium, fontSize: 11, color: OB.ink55 },
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

  nameInput: {
    ...fonts.semiBold,
    fontSize: 26,
    color: OB.ink,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: OB.accentDim,
  },

  hoursUnit: { ...fonts.medium, fontSize: 15, color: OB.ink40, marginTop: 2 },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { ...fonts.semiBold, fontSize: 22, color: OB.ink70, marginTop: -2 },
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
  legendText: { ...fonts.medium, fontSize: 12.5, color: OB.ink55 },
})
