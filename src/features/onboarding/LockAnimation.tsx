/**
 * L'illustration animée de l'écran « Les règles bloquent les Apps à des heures
 * précises » — entièrement dessinée et animée en JS (aucune vidéo).
 *
 * Elle raconte une boucle en quatre temps : les distractions sont verrouillées,
 * la règle s'éteint et les cadenas sautent, la règle se rallume en émettant une
 * onde, et les cadenas retombent UN PAR UN dans son sillage. Le Téléphone reste
 * vert et libre du début à la fin : c'est lui qui fait comprendre qu'on bloque
 * les distractions, pas le téléphone.
 *
 * Tout est piloté par UNE seule `progress` en boucle linéaire : chaque élément
 * lit la même horloge via `interpolate`. Ça garantit que rien ne dérive les uns
 * par rapport aux autres, même après des heures d'affichage.
 */
import React, { useEffect, useMemo } from 'react'
import {
  type StyleProp,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native'
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg'
import { AppLogo } from '@/shared/components/ui/AppLogo'
import { fonts } from '@/shared/theme/tokens/fonts'
import { CalculatorIcon, FacebookIcon, PhoneIcon } from './decor-icons'
import { OB } from './tokens'

// ─── Chronologie (fractions de la boucle) ────────────────────────────────

const LOOP_MS = 4200

/**
 * Repères de la boucle, en fraction de `LOOP_MS`. Les garder groupés ici est
 * ce qui rend l'enchaînement lisible : on voit d'un coup d'œil que les
 * cadenas retombent PENDANT que l'onde se propage, pas après.
 */
const T = {
  /** Les cadenas s'effacent (la règle s'éteint). */
  unlockStart: 0.19,
  unlockEnd: 0.25,
  /** La carte se décolore et descend légèrement. */
  cardOffStart: 0.2,
  cardOffEnd: 0.3,
  /** La carte se rallume — le bouclier d'abord, le titre juste après. */
  shieldOnStart: 0.45,
  shieldOnEnd: 0.53,
  titleOnStart: 0.5,
  titleOnEnd: 0.58,
  /** L'onde part de la carte et s'estompe en s'agrandissant. */
  pulseStart: 0.5,
  pulseEnd: 0.74,
  /** Les trois cadenas retombent, échelonnés. */
  lockStart: 0.55,
  lockStagger: 0.055,
  lockDuration: 0.07,
} as const

/** Débordement maximal de l'onde au-delà du bord de la carte. */
const PULSE_MAX_GROWTH = 0.22

/** Les six tuiles de la fausse grille d'accueil, dans l'ordre de lecture. */
type TileId =
  | 'instagram'
  | 'phone'
  | 'tiktok'
  | 'facebook'
  | 'calendar'
  | 'calculator'

/** Seules les distractions se verrouillent — et dans cet ordre. */
const LOCK_ORDER: TileId[] = ['instagram', 'tiktok', 'facebook']

// ─── Icônes du décor ─────────────────────────────────────────────────────

/**
 * Instagram et TikTok viennent d'`AppLogo` (déjà dans le projet). Les quatre
 * autres sont dessinées ici : ce sont des figurants de maquette, pas des
 * marques que l'app sait bloquer — les mettre dans `AppLogo` laisserait croire
 * qu'on peut les cibler.
 */

function CalendarIcon({ size }: { size: number }) {
  return (
    <View
      style={[
        styles.systemTile,
        { width: size, height: size, borderRadius: size * 0.24 },
      ]}
    >
      <Text
        style={[styles.calendarDay, { fontSize: size * 0.17 }]}
        numberOfLines={1}
      >
        Mar
      </Text>
      <Text
        style={[styles.calendarDate, { fontSize: size * 0.46 }]}
        numberOfLines={1}
      >
        1
      </Text>
    </View>
  )
}

function TileGlyph({ id, size }: { id: TileId; size: number }) {
  if (id === 'instagram' || id === 'tiktok') {
    return <AppLogo app={id} size={size} />
  }
  if (id === 'facebook') return <FacebookIcon size={size} />
  if (id === 'phone') return <PhoneIcon size={size} />
  if (id === 'calendar') return <CalendarIcon size={size} />
  return <CalculatorIcon size={size} />
}

/** Le cadenas posé sur une app bloquée — plaque sombre + arceau clair. */
function LockBadge({ size }: { size: number }) {
  const s = size * 0.52
  return (
    <View style={styles.lockCenter}>
      <Svg width={s} height={s} viewBox="0 0 24 24">
        <Path
          d="M8 10V7.5a4 4 0 0 1 8 0V10"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={2.3}
          strokeLinecap="round"
        />
        <Rect
          x={4.8}
          y={10}
          width={14.4}
          height={10.5}
          rx={3.2}
          fill="#FFFFFF"
        />
      </Svg>
    </View>
  )
}

// ─── Les tuiles ──────────────────────────────────────────────────────────

function AppTile({
  id,
  size,
  progress,
  lockIndex,
  frozen,
}: {
  id: TileId
  size: number
  progress: SharedValue<number>
  /** Rang dans la cascade, ou -1 pour une app jamais bloquée. */
  lockIndex: number
  frozen: boolean
}) {
  const locked = lockIndex >= 0
  const start = T.lockStart + lockIndex * T.lockStagger

  // Le cadenas est présent au repos (début ET fin de boucle), absent pendant
  // la fenêtre déverrouillée. D'où les quatre points plutôt que deux.
  const lockStyle = useAnimatedStyle(() => {
    if (!locked) return { opacity: 0 }
    if (frozen) return { opacity: 1 }
    const o = interpolate(
      progress.value,
      [0, T.unlockStart, T.unlockEnd, start, start + T.lockDuration, 1],
      [1, 1, 0, 0, 1, 1],
      Extrapolation.CLAMP,
    )
    return { opacity: o }
  })

  // L'icône s'assombrit exactement au même rythme que son cadenas.
  const shadeStyle = useAnimatedStyle(() => {
    if (!locked) return { opacity: 0 }
    if (frozen) return { opacity: 1 }
    const o = interpolate(
      progress.value,
      [0, T.unlockStart, T.unlockEnd, start, start + T.lockDuration, 1],
      [1, 1, 0, 0, 1, 1],
      Extrapolation.CLAMP,
    )
    return { opacity: o }
  })

  return (
    <View style={{ width: size, height: size }}>
      <TileGlyph id={id} size={size} />
      <Animated.View
        pointerEvents="none"
        style={[styles.tileShade, { borderRadius: size * 0.24 }, shadeStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, lockStyle]}
      >
        <LockBadge size={size} />
      </Animated.View>
    </View>
  )
}

/** Emplacement vide : ce qui donne l'illusion d'un vrai écran d'accueil. */
function EmptySlot({ size, dim }: { size: number; dim: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.24,
        backgroundColor: `rgba(255,255,255,${0.075 * dim})`,
      }}
    />
  )
}

// ─── La carte « règle » ──────────────────────────────────────────────────

function CalendarGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x={2} y={3.5} width={20} height={18} rx={5} fill={color} />
      <Rect x={4.5} y={9} width={15} height={10} rx={2.5} fill="#141418" />
      <Path
        d="M7.5 2v4M16.5 2v4"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
      />
      {[8, 12, 16].map(x => (
        <Circle key={`a${x}`} cx={x} cy={13} r={1.25} fill={color} />
      ))}
      {[8, 12].map(x => (
        <Circle key={`b${x}`} cx={x} cy={17} r={1.25} fill={color} />
      ))}
    </Svg>
  )
}

function ShieldGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 2.6 4.5 5.8v6c0 4.6 3.2 8.4 7.5 9.6 4.3-1.2 7.5-5 7.5-9.6v-6L12 2.6z"
        fill={color}
      />
    </Svg>
  )
}

function ArrowGlyph({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size * 0.62} viewBox="0 0 32 20">
      <Path
        d="M3 10h25M22 4l6 6-6 6"
        fill="none"
        stroke={color}
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

/**
 * Chaque élément coloré est dessiné DEUX fois — une version éteinte, une
 * version accent par-dessus dont on anime l'opacité. C'est ce qui évite
 * d'animer des propriétés SVG (fragile selon les versions) tout en donnant
 * exactement la même transition qu'un changement de couleur.
 */
function TintPair({
  children,
  style,
}: {
  children: [React.ReactNode, React.ReactNode]
  style: StyleProp<ViewStyle>
}) {
  return (
    <View>
      {children[0]}
      <Animated.View style={[StyleSheet.absoluteFill, style]}>
        {children[1]}
      </Animated.View>
    </View>
  )
}

function RuleCard({
  width,
  progress,
  frozen,
}: {
  width: number
  progress: SharedValue<number>
  frozen: boolean
}) {
  const height = width * 1.05
  const pad = width * 0.12
  const glyph = width * 0.17
  const barH = width * 0.082
  const inner = width - pad * 2

  // Le bouclier et les glyphes se rallument ensemble, le titre juste après :
  // c'est ce décalage qui donne l'impression que la règle « se réveille »
  // plutôt que de changer d'état d'un bloc.
  const glyphTint = useAnimatedStyle(() => {
    if (frozen) return { opacity: 1 }
    return {
      opacity: interpolate(
        progress.value,
        [0, T.cardOffStart, T.cardOffEnd, T.shieldOnStart, T.shieldOnEnd, 1],
        [1, 1, 0, 0, 1, 1],
        Extrapolation.CLAMP,
      ),
    }
  })

  const titleTint = useAnimatedStyle(() => {
    if (frozen) return { opacity: 1 }
    return {
      opacity: interpolate(
        progress.value,
        [0, T.cardOffStart, T.cardOffEnd, T.titleOnStart, T.titleOnEnd, 1],
        [1, 1, 0, 0, 1, 1],
        Extrapolation.CLAMP,
      ),
    }
  })

  // Respiration : la carte descend et grossit un peu pendant qu'elle est
  // éteinte, puis reprend sa place en se rallumant.
  const cardStyle = useAnimatedStyle(() => {
    if (frozen) return {}
    const k = interpolate(
      progress.value,
      [0, T.cardOffStart, 0.42, T.titleOnEnd, 1],
      [0, 0, 1, 0, 0],
      Extrapolation.CLAMP,
    )
    return {
      transform: [{ translateY: k * height * 0.05 }, { scale: 1 + k * 0.05 }],
    }
  })

  return (
    <Animated.View
      style={[
        styles.card,
        { width, height, borderRadius: width * 0.23, padding: pad },
        cardStyle,
      ]}
    >
      <View style={styles.cardFlow}>
        <TintPair style={glyphTint}>
          <CalendarGlyph size={glyph} color={OB.ink28} />
          <CalendarGlyph size={glyph} color={OB.accent} />
        </TintPair>
        <TintPair style={glyphTint}>
          <ArrowGlyph size={glyph * 1.15} color={OB.ink28} />
          <ArrowGlyph size={glyph * 1.15} color={OB.ink40} />
        </TintPair>
        <TintPair style={glyphTint}>
          <ShieldGlyph size={glyph} color={OB.ink28} />
          <ShieldGlyph size={glyph} color={OB.accent} />
        </TintPair>
      </View>

      <View style={[styles.cardBars, { marginTop: width * 0.2 }]}>
        <TintPair style={titleTint}>
          <View
            style={[
              styles.bar,
              { width: inner * 0.56, height: barH, backgroundColor: OB.ink28 },
            ]}
          />
          <View
            style={[
              styles.bar,
              { width: inner * 0.56, height: barH, backgroundColor: OB.accent },
            ]}
          />
        </TintPair>
        <View
          style={[
            styles.bar,
            {
              width: inner * 0.78,
              height: barH,
              marginTop: barH * 0.55,
              backgroundColor: 'rgba(255,255,255,0.16)',
            },
          ]}
        />
        <View
          style={[
            styles.bar,
            {
              width: inner * 0.46,
              height: barH,
              marginTop: barH * 0.55,
              backgroundColor: 'rgba(255,255,255,0.16)',
            },
          ]}
        />
      </View>
    </Animated.View>
  )
}

/** L'onde : le contour de la carte qui se détache et s'étend vers le haut-gauche. */
function PulseRing({
  width,
  progress,
}: {
  width: number
  progress: SharedValue<number>
}) {
  const height = width * 1.05
  const style = useAnimatedStyle(() => {
    const k = interpolate(
      progress.value,
      [T.pulseStart, T.pulseEnd],
      [0, 1],
      Extrapolation.CLAMP,
    )
    const live = progress.value >= T.pulseStart && progress.value <= T.pulseEnd
    return {
      opacity: live ? interpolate(k, [0, 0.18, 1], [0, 0.55, 0]) : 0,
      // Aucune translation : l'onde reste CONCENTRIQUE à la carte. Elle avait
      // une dérive vers le haut-gauche, et l'anneau se détachait au lieu de
      // ceinturer la carte. Elle part de son bord exact (échelle 1) et ne
      // s'en éloigne que du peu qu'il faut pour qu'on la voie respirer.
      transform: [{ scale: 1 + k * PULSE_MAX_GROWTH }],
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulse,
        { width, height, borderRadius: width * 0.23 },
        style,
      ]}
    />
  )
}

// ─── La scène complète ───────────────────────────────────────────────────

export function LockAnimation({ width }: { width: number }) {
  const reduceMotion = useReducedMotion()
  const progress = useSharedValue(0)

  useEffect(() => {
    if (reduceMotion) return
    progress.value = withRepeat(
      withTiming(1, { duration: LOOP_MS, easing: Easing.linear }),
      -1,
      false,
    )
  }, [progress, reduceMotion])

  const height = Math.round(width * 1.42)
  const tile = Math.round(width * 0.145)
  const padH = Math.round(width * 0.085)
  const rowGap = Math.round(width * 0.052)
  const cardW = Math.round(width * 0.47)

  const rows = useMemo<(TileId | null)[][]>(
    () => [
      ['instagram', 'phone', 'tiktok', 'facebook'],
      ['calendar', 'calculator', null, null],
      [null, null, null, null],
      [null, null, null, null],
      [null, null, null, null],
    ],
    [],
  )

  return (
    <View style={{ width, height }}>
      {/* L'appareil est dessiné PLUS HAUT que la fenêtre qui le rogne : son
          bord inférieur tombe hors champ. Sans ça la coque se refermait en
          bas, là où la référence la laisse simplement s'effacer dans le fond.
          La carte et l'onde vivent HORS de cette fenêtre — sinon l'onde
          serait coupée net au bord de l'appareil. */}
      <View style={[styles.clip, { width, height }]}>
        <View
          style={[
            styles.phone,
            { width, height: height * 1.6, borderRadius: width * 0.155 },
          ]}
        >
          <View
            style={[
              styles.screen,
              { borderRadius: width * 0.155 - 4, paddingTop: width * 0.06 },
            ]}
          >
            <View
              style={[
                styles.island,
                {
                  width: width * 0.3,
                  height: width * 0.075,
                  borderRadius: width * 0.04,
                },
              ]}
            />
            <View style={{ paddingHorizontal: padH, paddingTop: width * 0.09 }}>
              {rows.map((row, r) => (
                <View
                  key={`row-${r}`}
                  style={[styles.row, { marginBottom: rowGap }]}
                >
                  {row.map((id, c) =>
                    id ? (
                      <AppTile
                        key={id}
                        id={id}
                        size={tile}
                        progress={progress}
                        lockIndex={LOCK_ORDER.indexOf(id)}
                        frozen={reduceMotion}
                      />
                    ) : (
                      <EmptySlot
                        key={`slot-${r}-${c}`}
                        size={tile}
                        dim={Math.max(0, 1 - r * 0.2)}
                      />
                    ),
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Le fondu couvre la FENÊTRE, pas la coque : c'est lui qui fait
            disparaître le bas de l'appareil dans le fond de l'écran. */}
        <Svg
          pointerEvents="none"
          style={styles.fade}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <Defs>
            <LinearGradient id="tutoPhoneFade" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={OB.bg} stopOpacity={0} />
              <Stop offset="0.52" stopColor={OB.bg} stopOpacity={0.18} />
              <Stop offset="0.82" stopColor={OB.bg} stopOpacity={0.8} />
              <Stop offset="1" stopColor={OB.bg} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect width={100} height={100} fill="url(#tutoPhoneFade)" />
        </Svg>
      </View>

      <View
        pointerEvents="none"
        style={[styles.cardLayer, { right: -width * 0.02, top: height * 0.42 }]}
      >
        {reduceMotion ? null : <PulseRing width={cardW} progress={progress} />}
        <RuleCard width={cardW} progress={progress} frozen={reduceMotion} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  phone: {
    borderWidth: 4,
    borderColor: '#1B1B1F',
    backgroundColor: '#08080A',
    overflow: 'hidden',
  },
  screen: { flex: 1, overflow: 'hidden', alignItems: 'stretch' },
  island: {
    alignSelf: 'center',
    backgroundColor: '#2A2A2E',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  tileShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6,6,9,0.52)',
  },
  lockCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  systemTile: {
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDay: {
    ...fonts.semiBold,
    color: '#FF3B30',
    marginBottom: -2,
  },
  calendarDate: { ...fonts.regular, color: '#0A0A0A' },
  fade: { ...StyleSheet.absoluteFillObject },
  clip: { overflow: 'hidden' },

  cardLayer: { position: 'absolute' },
  card: {
    backgroundColor: 'rgba(44,44,52,0.93)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  cardFlow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardBars: {},
  bar: { borderRadius: 999 },
  pulse: {
    position: 'absolute',
    borderWidth: 1.6,
    borderColor: OB.accent,
  },
})
