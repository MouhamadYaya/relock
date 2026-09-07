/**
 * L'illustration animée de l'écran « Les règles bloquent les Apps à des heures
 * précises » — entièrement dessinée et animée en JS (aucune vidéo).
 *
 * Elle raconte une boucle en quatre temps : les distractions sont verrouillées,
 * la règle s'éteint et les cadenas sautent, la règle se rallume en émettant une
 * onde, et les cadenas RETOMBENT DANS LE SILLAGE DE L'ONDE — de l'app la plus
 * proche de la carte à la plus lointaine. Le Téléphone reste vert et libre du
 * début à la fin, alors même que l'onde lui passe dessus : c'est lui qui fait
 * comprendre qu'on bloque les distractions, pas le téléphone.
 *
 * ⚠️ Cette scène est une DÉMONSTRATION, pas une décoration : si l'utilisateur
 * ne voit pas que les icônes se ferment, l'écran ne sert à rien. D'où trois
 * partis pris volontairement appuyés, à ne pas « adoucir » :
 *   1. le cadenas est posé sur une PASTILLE sombre cerclée d'accent — un
 *      glyphe blanc nu se noyait dans les icônes colorées ;
 *   2. le verrouillage est un IMPACT (le cadenas s'abat, l'icône encaisse,
 *      un anneau claque autour de la tuile), pas un fondu ;
 *   3. l'onde traverse tout l'écran de l'appareil au lieu de ceinturer la
 *      carte — c'est le lien de cause à effet entre la règle et les apps.
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
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg'
import { AppLogo } from '@/shared/components/ui/AppLogo'
import { fonts } from '@/shared/theme/tokens/fonts'
import { CalculatorIcon, FacebookIcon, PhoneIcon } from './decor-icons'
import { OB } from './tokens'

// ─── Chronologie (fractions de la boucle) ────────────────────────────────

/**
 * Plus lent que le premier jet (4200 ms) : chaque temps fort a besoin d'être
 * TENU pour être lu. La boucle s'ouvre et se ferme sur un palier « tout est
 * bloqué » — sans lui, l'œil arrive toujours au milieu d'une transition.
 */
const LOOP_MS = 5400

/**
 * Repères de la boucle, en fraction de `LOOP_MS`. Les garder groupés ici est
 * ce qui rend l'enchaînement lisible : on voit d'un coup d'œil que les
 * cadenas retombent PENDANT que l'onde se propage, pas après.
 */
const T = {
  /** Les cadenas sautent, échelonnés (la règle s'éteint). */
  unlockStart: 0.14,
  unlockStagger: 0.03,
  unlockDuration: 0.07,
  /** La carte se décolore, se tasse et descend légèrement. */
  cardOffStart: 0.15,
  cardOffEnd: 0.25,
  /** Creux de la respiration : la carte est au plus bas / au plus petit. */
  cardRest: 0.36,
  /** La carte se rallume — le bouclier d'abord, le titre juste après. */
  shieldOnStart: 0.46,
  shieldOnEnd: 0.54,
  titleOnStart: 0.5,
  titleOnEnd: 0.6,
  /** L'onde part de la carte et balaie l'appareil en s'estompant. */
  pulseStart: 0.48,
  pulseEnd: 0.9,
  /** Décalage de la seconde onde — une seule ligne se lit comme un artefact. */
  pulseStagger: 0.075,
  /** Les trois cadenas s'abattent, échelonnés, dans le sillage de l'onde. */
  lockStart: 0.56,
  lockStagger: 0.075,
  lockDuration: 0.1,
} as const

/**
 * Débordement maximal de l'onde, en multiples de la carte. À 2.4 (donc une
 * échelle finale de 3.4) le front dépasse la rangée d'icônes AVANT de
 * s'éteindre : l'onde arrive vraiment jusqu'aux apps qu'elle referme.
 */
const PULSE_MAX_GROWTH = 2.4

/** Échelle d'une icône verrouillée : elle se retire un peu, comme désactivée. */
const LOCKED_TILE_SCALE = 0.93

/** Les six tuiles de la fausse grille d'accueil, dans l'ordre de lecture. */
type TileId =
  | 'instagram'
  | 'phone'
  | 'tiktok'
  | 'facebook'
  | 'calendar'
  | 'calculator'

/**
 * Seules les distractions se verrouillent — et dans CET ordre : de la tuile la
 * plus proche de la carte à la plus lointaine. C'est ce qui fait lire la
 * cascade comme la conséquence de l'onde, et non comme une animation qui
 * tourne à côté (un balayage gauche→droite, à l'inverse du front, cassait le
 * lien de cause à effet).
 */
const LOCK_ORDER: TileId[] = ['facebook', 'tiktok', 'instagram']

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

/**
 * Le cadenas posé sur une app bloquée : pastille sombre, cerclée d'accent,
 * arceau blanc plein.
 *
 * ⚠️ Ne pas revenir au glyphe blanc posé nu sur l'icône. Les logos d'apps sont
 * clairs, saturés et bavards : un cadenas blanc sans fond s'y dissolvait, et
 * l'écran perdait sa seule information. La pastille garantit le contraste quel
 * que soit ce qu'il y a dessous, et son cercle accent la relie visuellement à
 * l'onde émise par la carte — même couleur, même cause.
 */
function LockBadge({ size }: { size: number }) {
  const plate = size * 0.7
  const glyph = plate * 0.6
  return (
    <View style={styles.lockCenter}>
      <View
        style={[
          styles.lockPlate,
          {
            width: plate,
            height: plate,
            borderRadius: plate / 2,
            borderWidth: Math.max(1.3, plate * 0.055),
          },
        ]}
      >
        <Svg width={glyph} height={glyph} viewBox="0 0 24 24">
          <Path
            d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9"
            fill="none"
            stroke="#FFFFFF"
            strokeWidth={2.7}
            strokeLinecap="round"
          />
          <Rect
            x={4.6}
            y={10}
            width={14.8}
            height={11}
            rx={3.3}
            fill="#FFFFFF"
          />
        </Svg>
      </View>
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
  const off = T.unlockStart + lockIndex * T.unlockStagger
  const offEnd = off + T.unlockDuration
  const on = T.lockStart + lockIndex * T.lockStagger
  const onMid = on + T.lockDuration * 0.5
  const onEnd = on + T.lockDuration

  // Une seule grille de temps pour les trois calques de la tuile : le cadenas
  // est présent au repos (début ET fin de boucle), absent pendant la fenêtre
  // déverrouillée. D'où les sept points plutôt que deux.
  const stops = [0, off, offEnd, on, onMid, onEnd, 1]

  // Le cadenas s'abat : il arrive surdimensionné, dépasse sa taille au contact,
  // puis se pose. Un simple fondu passait inaperçu à cette échelle.
  const lockStyle = useAnimatedStyle(() => {
    if (!locked) return { opacity: 0 }
    if (frozen) return { opacity: 1 }
    return {
      opacity: interpolate(
        progress.value,
        stops,
        [1, 1, 0, 0, 1, 1, 1],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          scale: interpolate(
            progress.value,
            stops,
            [1, 1, 1.75, 1.95, 0.88, 1, 1],
            Extrapolation.CLAMP,
          ),
        },
      ],
    }
  })

  // L'icône s'assombrit exactement au même rythme que son cadenas.
  const shadeStyle = useAnimatedStyle(() => {
    if (!locked) return { opacity: 0 }
    if (frozen) return { opacity: 1 }
    return {
      opacity: interpolate(
        progress.value,
        stops,
        [1, 1, 0, 0, 0.85, 1, 1],
        Extrapolation.CLAMP,
      ),
    }
  })

  // L'icône encaisse le choc (elle se tasse au contact) et reste légèrement
  // en retrait tant qu'elle est bloquée — la même app, mais éteinte.
  const glyphStyle = useAnimatedStyle(() => {
    if (!locked) return {}
    if (frozen) return { transform: [{ scale: LOCKED_TILE_SCALE }] }
    return {
      transform: [
        {
          scale: interpolate(
            progress.value,
            stops,
            [
              LOCKED_TILE_SCALE,
              LOCKED_TILE_SCALE,
              1,
              1,
              0.84,
              LOCKED_TILE_SCALE,
              LOCKED_TILE_SCALE,
            ],
            Extrapolation.CLAMP,
          ),
        },
      ],
    }
  })

  // L'anneau d'impact : il se resserre sur la tuile au moment exact du
  // verrouillage. C'est lui qui donne le « clac » que l'opacité seule ne
  // pouvait pas rendre.
  const impactStyle = useAnimatedStyle(() => {
    if (!locked || frozen) return { opacity: 0 }
    const span = T.lockDuration * 1.3
    const live = progress.value >= on && progress.value <= on + span
    if (!live) return { opacity: 0 }
    const k = interpolate(
      progress.value,
      [on, on + span],
      [0, 1],
      Extrapolation.CLAMP,
    )
    return {
      opacity: interpolate(k, [0, 0.22, 1], [0, 1, 0]),
      transform: [{ scale: 1.95 - k * 0.95 }],
    }
  })

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={glyphStyle}>
        <TileGlyph id={id} size={size} />
      </Animated.View>
      <Animated.View
        pointerEvents="none"
        style={[styles.tileShade, { borderRadius: size * 0.24 }, shadeStyle]}
      />
      <Animated.View
        pointerEvents="none"
        style={[
          styles.tileImpact,
          { borderRadius: size * 0.3, borderWidth: Math.max(1.4, size * 0.05) },
          impactStyle,
        ]}
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

  // Respiration : la carte se tasse et descend pendant qu'elle est éteinte,
  // puis DÉTONNE en se rallumant (elle dépasse sa taille avant de se poser).
  // Ce sursaut est le geste qui déclenche l'onde — sans lui, l'onde semble
  // arriver de nulle part.
  const cardStyle = useAnimatedStyle(() => {
    if (frozen) return {}
    const stops = [
      0,
      T.cardOffStart,
      T.cardRest,
      T.shieldOnStart,
      T.pulseStart + 0.03,
      T.titleOnEnd,
      1,
    ]
    return {
      transform: [
        {
          translateY: interpolate(
            progress.value,
            stops,
            [0, 0, height * 0.06, height * 0.06, 0, 0, 0],
            Extrapolation.CLAMP,
          ),
        },
        {
          scale: interpolate(
            progress.value,
            stops,
            [1, 1, 0.93, 0.93, 1.1, 1, 1],
            Extrapolation.CLAMP,
          ),
        },
      ],
    }
  })

  // Liseré accent qui claque à l'allumage, par-dessus le liseré neutre de la
  // carte : la règle s'ARME, puis retombe à son état sobre.
  const ringStyle = useAnimatedStyle(() => {
    if (frozen) return { opacity: 0.5 }
    return {
      opacity: interpolate(
        progress.value,
        [
          0,
          T.cardOffStart,
          T.cardOffEnd,
          T.shieldOnStart,
          T.pulseStart + 0.04,
          T.pulseEnd,
          1,
        ],
        [0.5, 0.5, 0, 0, 1, 0.5, 0.5],
        Extrapolation.CLAMP,
      ),
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
      <Animated.View
        pointerEvents="none"
        style={[
          styles.cardRing,
          { borderRadius: width * 0.23, borderWidth: width * 0.014 },
          ringStyle,
        ]}
      />
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

/**
 * Le halo de la carte : il s'éteint avec la règle et enfle à l'allumage. Rendu
 * en dégradé radial SVG plutôt qu'en ombre portée — une ombre native ne
 * s'anime pas de la même façon sur les deux plateformes, et n'accepte pas la
 * teinte accent sur Android.
 */
function CardGlow({
  width,
  progress,
  frozen,
}: {
  width: number
  progress: SharedValue<number>
  frozen: boolean
}) {
  const size = width * 2.8
  const style = useAnimatedStyle(() => {
    if (frozen) return { opacity: 0.45 }
    return {
      opacity: interpolate(
        progress.value,
        [
          0,
          T.cardOffStart,
          T.cardOffEnd,
          T.shieldOnStart,
          T.pulseStart + 0.05,
          T.pulseEnd,
          1,
        ],
        [0.45, 0.45, 0.05, 0.05, 1, 0.45, 0.45],
        Extrapolation.CLAMP,
      ),
    }
  })

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.glow,
        {
          width: size,
          height: size,
          left: width / 2 - size / 2,
          top: (width * 1.05) / 2 - size / 2,
        },
        style,
      ]}
    >
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id="tutoCardGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={OB.accent} stopOpacity={0.5} />
            <Stop offset="0.45" stopColor={OB.accent} stopOpacity={0.16} />
            <Stop offset="1" stopColor={OB.accent} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill="url(#tutoCardGlow)" />
      </Svg>
    </Animated.View>
  )
}

/**
 * L'onde : le contour de la carte qui se détache et BALAIE l'appareil.
 *
 * Elle reste concentrique à la carte (une dérive vers le haut-gauche avait
 * fait décrocher l'anneau au lieu de le faire ceinturer la carte), mais elle
 * grandit désormais jusqu'à dépasser la rangée d'icônes : c'est ce passage du
 * front sur les tuiles qui rend le verrouillage lisible comme une conséquence.
 * Le départ est franc puis décélère — l'œil attrape le premier tiers.
 */
function PulseRing({
  width,
  progress,
  delay,
}: {
  width: number
  progress: SharedValue<number>
  /** Décalage de cette onde dans la boucle (une seule onde se lit mal). */
  delay: number
}) {
  const height = width * 1.05
  const style = useAnimatedStyle(() => {
    const start = T.pulseStart + delay
    const end = T.pulseEnd + delay
    if (progress.value < start || progress.value > end) return { opacity: 0 }
    const span = end - start
    const k = interpolate(
      progress.value,
      [start, start + span * 0.22, start + span * 0.55, end],
      [0, 0.42, 0.78, 1],
      Extrapolation.CLAMP,
    )
    return {
      opacity: interpolate(k, [0, 0.12, 0.5, 1], [0, 0.95, 0.45, 0]),
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
        <CardGlow width={cardW} progress={progress} frozen={reduceMotion} />
        {reduceMotion ? null : (
          <>
            <PulseRing width={cardW} progress={progress} delay={0} />
            <PulseRing
              width={cardW}
              progress={progress}
              delay={T.pulseStagger}
            />
          </>
        )}
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
    // Un voile plus dense (et légèrement violacé) que le gris d'origine :
    // l'icône doit rester reconnaissable, mais visiblement ÉTEINTE.
    backgroundColor: 'rgba(7,6,16,0.74)',
  },
  tileImpact: {
    ...StyleSheet.absoluteFillObject,
    borderColor: OB.accent,
  },
  lockCenter: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockPlate: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B0A12',
    borderColor: OB.accent,
    shadowColor: '#000000',
    shadowOpacity: 0.55,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
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
  cardRing: {
    ...StyleSheet.absoluteFillObject,
    borderColor: OB.accent,
  },
  cardFlow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardBars: {},
  bar: { borderRadius: 999 },
  glow: { position: 'absolute' },
  pulse: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: OB.accent,
  },
})
