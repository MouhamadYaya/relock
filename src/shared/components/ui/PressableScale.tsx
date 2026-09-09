import React from 'react'
import {
  type ColorValue,
  Pressable,
  type PressableProps,
  type StyleProp,
  StyleSheet,
  type ViewStyle,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { relockMaterial } from '@/shared/theme'
import { haptics } from '@/shared/utils/platform/haptics'

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

/**
 * Le retour haptique part au TOUCHER, pas au relâchement.
 *
 * C'est la moitié invisible du correctif de latence : un bouton qui ouvre un
 * écran lourd rend la main au bout de plusieurs dizaines de millisecondes, et
 * pendant ce temps rien ne confirmait l'appui. Le doigt le sent maintenant
 * avant que React ait commencé à travailler, donc l'attente est perçue comme
 * un chargement et non comme un bouton mort qu'on ré-appuie.
 */
/**
 * Le retour est nommé par le SENS de l'action, pas par sa force : c'est la
 * partition de `shared/utils/platform/haptics` qui décide comment chaque sens
 * se traduit en intensité et en netteté, et elle seule. Un écran qui écrirait
 * « moyen » ici figerait un dosage que la partition doit pouvoir réaccorder
 * partout d'un coup.
 */
type HapticKind =
  | 'tap'
  | 'graze'
  | 'select'
  | 'press'
  | 'commit'
  | 'none'
  // Anciens noms, gardés le temps que les appels existants migrent.
  | 'selection'
  | 'light'
  | 'medium'

const HAPTIC: Record<Exclude<HapticKind, 'none'>, () => void> = {
  tap: () => haptics.tap(),
  graze: () => haptics.graze(),
  select: () => haptics.select(),
  press: () => haptics.press(),
  commit: () => haptics.commit(),
  selection: () => haptics.select(),
  light: () => haptics.graze(),
  medium: () => haptics.press(),
}

/**
 * Le relief sous le doigt.
 *
 * Sur le fond nocturne de Relock (`blockingCanvas` ≈ #030504) une ombre NOIRE
 * ne se voit pas : elle tombe sur du noir. Le relief se fait donc à la
 * lumière — un halo coloré qui éclôt sous le doigt et s'éteint au
 * relâchement, en même temps que l'échelle revient.
 *
 * ⚠️ L'ombre AU REPOS est celle que le bouton déclare lui-même dans son
 * `style`, jamais celle-ci : on lit `shadowOpacity` / `shadowRadius` /
 * `elevation` du style aplati et on anime DEPUIS ces valeurs. Sans cette
 * lecture, poser un halo sur une carte qui portait déjà `shadow.glass`
 * l'effacerait au repos — on aurait corrigé un ressenti en cassant un décor.
 * Même règle pour `shadowColor` et `shadowOffset` : le style du bouton gagne.
 *
 * Reste une limite d'iOS qu'aucun réglage ne contourne : `overflow: 'hidden'`
 * pose `clipsToBounds`, qui supprime l'ombre de la couche. Un bouton qui
 * rogne ses enfants ne peut pas porter de halo — il faut alors déplacer le
 * rognage sur une vue intérieure (cf. `PurplePlusButton`).
 */
export interface PressShadow {
  /** Couleur du halo. Défaut : l'accent violet de l'app. */
  color?: string
  /** Opacité sous le doigt — jamais inférieure à celle du repos. */
  opacity?: number
  /** Rayon de flou sous le doigt — jamais inférieur à celui du repos. */
  radius?: number
  /** Décalage vertical, quand le style n'en déclare pas. */
  offsetY?: number
  /** Équivalent Android — l'ombre y est pilotée par cette seule valeur. */
  elevation?: number
}

const DEFAULT_SHADOW: Required<PressShadow> = {
  color: relockMaterial.colors.accentViolet,
  opacity: 0.42,
  radius: 16,
  offsetY: 8,
  elevation: 6,
}

/** Descente vive, remontée élastique : la courbe des contrôles iOS. */
const PRESS_IN_MS = 90
const RELEASE_SPRING = { damping: 18, stiffness: 320, mass: 0.6 } as const

/** Bornes `[repos, sous le doigt]` d'une valeur d'ombre. */
type Range = readonly [number, number]

interface Depth {
  color: ColorValue
  offsetY: number
  /** Le style déclare déjà un `shadowOffset` : on n'y touche pas. */
  keepsOwnOffset: boolean
  opacity: Range
  radius: Range
  elevation: Range
}

/** Une valeur de style peut être une chaîne ou une valeur animée : on trie. */
function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function mix([from, to]: Range, progress: number): number {
  'worklet'
  return from + (to - from) * progress
}

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>
  /** Échelle au press (défaut 0.96, jamais < 0.95). */
  scaleTo?: number
  /**
   * Retour haptique au toucher. `'tap'` par défaut — le toucher rond et franc
   * de l'app. Ce défaut compte : presque toute surface pressable de Relock
   * passe par ce composant, donc c'est lui qui donne le grain général.
   *
   * `'select'` pour un choix dans une liste, `'press'` pour un bouton qui
   * lance quelque chose, `'commit'` pour un engagement, `'graze'` pour un
   * élément secondaire. `'none'` pour les surfaces qui déclenchent leur propre
   * retour (maintiens, sélecteurs à crans) — sinon deux signaux se
   * chevauchent et il n'en reste qu'une bouillie.
   */
  haptic?: HapticKind
  /**
   * Halo au toucher. Absent (défaut) : aucune ombre n'est émise, le bouton
   * garde exactement le style qu'il déclare. `true` pour le réglage Relock,
   * ou un objet pour en changer la couleur / l'intensité.
   */
  shadow?: boolean | PressShadow
}

/**
 * Pressable avec retour tactile : échelle + halo au press, piloté par
 * Reanimated, et retour haptique dès le toucher.
 * Respecte prefers-reduced-motion (pas d'échelle, pas de halo).
 */
export function PressableScale({
  style,
  scaleTo = 0.96,
  haptic = 'tap',
  shadow,
  onPressIn,
  onPressOut,
  onPress,
  onLongPress,
  disabled,
  children,
  ...rest
}: Props) {
  const reduce = useReducedMotion()
  const press = useSharedValue(0)

  // Le repos se lit dans le style du bouton, la cible dans le `shadow` reçu.
  // Tout est décomposé en NOMBRES avant la mémoïsation : un appelant qui écrit
  // `shadow={{ color: c.primary }}` en ligne passe un objet neuf à chaque
  // rendu, et `useAnimatedStyle` reconstruirait son worklet aussi souvent.
  const spec = shadow === true || !shadow ? undefined : shadow
  const enabled = shadow !== undefined && shadow !== false
  const flat = StyleSheet.flatten(style) as ViewStyle | undefined
  const restOpacity = num(flat?.shadowOpacity)
  const restRadius = num(flat?.shadowRadius)
  const restElevation = num(flat?.elevation)
  const color = flat?.shadowColor ?? spec?.color ?? DEFAULT_SHADOW.color
  const opacity = Math.max(restOpacity, spec?.opacity ?? DEFAULT_SHADOW.opacity)
  const radius = Math.max(restRadius, spec?.radius ?? DEFAULT_SHADOW.radius)
  const offsetY = spec?.offsetY ?? DEFAULT_SHADOW.offsetY
  const elevation = Math.max(
    restElevation,
    spec?.elevation ?? DEFAULT_SHADOW.elevation,
  )
  const keepsOwnOffset = flat?.shadowOffset !== undefined

  const depth = React.useMemo<Depth | null>(
    () =>
      enabled
        ? {
            color,
            offsetY,
            keepsOwnOffset,
            opacity: [restOpacity, opacity],
            radius: [restRadius, radius],
            elevation: [restElevation, elevation],
          }
        : null,
    [
      enabled,
      color,
      offsetY,
      keepsOwnOffset,
      restOpacity,
      opacity,
      restRadius,
      radius,
      restElevation,
      elevation,
    ],
  )

  // Une surface sans action ne doit rien promettre : ni vibration, ni relief.
  const actionable =
    !disabled && (onPress !== undefined || onLongPress !== undefined)

  const animatedStyle = useAnimatedStyle(() => {
    const p = press.value
    const base = { transform: [{ scale: 1 - p * (1 - scaleTo) }] }
    if (!depth) return base
    return {
      ...base,
      shadowOpacity: mix(depth.opacity, p),
      shadowRadius: mix(depth.radius, p),
      elevation: mix(depth.elevation, p),
    }
  })

  // `shadowColor` et `shadowOffset` restent STATIQUES : `withTiming` ne sait
  // pas animer un objet (`shadowOffset`), et une couleur qui ne change jamais
  // n'a rien à faire dans un worklet rejoué à chaque image.
  const shadowAnchor = React.useMemo(
    () =>
      depth && !depth.keepsOwnOffset
        ? {
            shadowColor: depth.color,
            shadowOffset: { width: 0, height: depth.offsetY },
          }
        : depth
          ? { shadowColor: depth.color }
          : null,
    [depth],
  )

  return (
    <AnimatedPressable
      {...rest}
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      onPressIn={e => {
        if (actionable && haptic !== 'none') HAPTIC[haptic]()
        if (!reduce && actionable) {
          press.value = withTiming(1, { duration: PRESS_IN_MS })
        }
        onPressIn?.(e)
      }}
      onPressOut={e => {
        press.value = withSpring(0, RELEASE_SPRING)
        onPressOut?.(e)
      }}
      style={[style, shadowAnchor, animatedStyle]}
    >
      {children}
    </AnimatedPressable>
  )
}
