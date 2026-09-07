/**
 * Réplique animée de la feuille « Apps à bloquer » d'Apple, pour l'écran qui
 * précède le vrai sélecteur.
 *
 * Le geste que personne ne devine tout seul : les apps ne sont PAS listées à
 * plat, il faut déplier une catégorie pour les atteindre. On le montre donc
 * plutôt que de l'écrire — liste repliée, tap sur « Social », dépliage, deux
 * apps cochées, le compteur qui apparaît sur la ligne, puis repli.
 *
 * Redessiné et non capturé : une image d'écran est figée à une largeur de
 * device, ne se localise pas, et pèse là où ce rendu ne coûte rien. La
 * géométrie et les libellés viennent d'une vraie feuille iOS en français.
 *
 * Une seule `progress` en boucle pilote tout par `interpolate` — mêmes règles
 * que `LockAnimation`, pour que les deux démonstrations vieillissent ensemble.
 */
import React, { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
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
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg'
import { type AppId, AppLogo } from '@/shared/components/ui/AppLogo'
import { fonts } from '@/shared/theme/tokens/fonts'
import { AllAppsGlyph, FacebookIcon, SocialGlyph } from './decor-icons'

/**
 * Durée d'un tour complet. Volontairement serrée : cette démonstration est un
 * passage obligé avant le vrai sélecteur, et chaque seconde d'attente en plus
 * se paie en abandons. Le geste enseigné — déplier, cocher — reste lisible.
 */
const LOOP_MS = 5000

/** Repères de la boucle, en fraction de `LOOP_MS`. */
const T = {
  tapSocial: 0.1,
  expandStart: 0.14,
  expandEnd: 0.27,
  tapFirst: 0.36,
  checkFirst: 0.39,
  tapSecond: 0.5,
  checkSecond: 0.53,
  countIn: 0.58,
  tapCollapse: 0.76,
  collapseStart: 0.79,
  collapseEnd: 0.89,
} as const

/** Durée d'un halo de tap et d'une apparition de coche. */
const BEAT = 0.06

/**
 * Instant où la seconde coche a fini d'apparaître : le geste est alors montré
 * en entier, le repli qui suit n'apprend plus rien. `ScenePickerDemo` s'en
 * sert pour déverrouiller son bouton — la chronologie n'est définie qu'ici.
 */
export const PICKER_DEMO_TAUGHT_MS = Math.round(
  (T.checkSecond + BEAT) * LOOP_MS,
)

/** Couleurs relevées sur une vraie feuille iOS sombre. */
const C = {
  card: '#1C1C1E',
  child: '#2A2A2C',
  sep: 'rgba(255,255,255,0.09)',
  label: '#FFFFFF',
  muted: '#8E8E93',
  ring: '#6E6E73',
  /** Le bleu système : cette liste est une réplique d'Apple, pas notre écran. */
  check: '#0A84FF',
} as const

const ROW_H = 52
const PAD_L = 16
const RADIO = 22
const ICON = 28
/** Début du texte — et donc du séparateur, calé dessus comme chez Apple. */
const TEXT_L = PAD_L + RADIO + 12 + ICON + 14
/**
 * Hauteur FIXE de la feuille : déplier une catégorie doit pousser les
 * suivantes hors champ, exactement comme la vraie liste défilante d'iOS. Sans
 * ce plafond, la carte s'allongeait de 260 pt d'un coup et venait buter dans
 * le bouton.
 */
const CARD_H = Math.round(ROW_H * 7.4)

type Category = { id: string; label: string; glyph: 'all' | 'social' | string }

/** Les huit catégories de la feuille, dans l'ordre réel d'iOS en français. */
const CATEGORIES: Category[] = [
  { id: 'all', label: 'Toutes apps et catégories', glyph: 'all' },
  { id: 'social', label: 'Social', glyph: 'social' },
  { id: 'games', label: 'Jeux', glyph: '🚀' },
  { id: 'fun', label: 'Divertissement', glyph: '🍿' },
  { id: 'creative', label: 'Créativité', glyph: '🎨' },
  { id: 'reading', label: 'Information et lecture', glyph: '📖' },
  { id: 'shopping', label: 'Magasinage et nourriture', glyph: '🛍️' },
  { id: 'work', label: 'Productivité et finance', glyph: '✈️' },
]

/**
 * Les apps de la catégorie dépliée. On montre les nôtres — celles dont on a
 * déjà le logo — plutôt que de redessiner Discord, FaceTime ou LinkedIn : ce
 * qu'on enseigne ici c'est le GESTE, pas un inventaire d'apps.
 */
const SOCIAL_APPS: { id: string; label: string; app?: AppId }[] = [
  { id: 'facebook', label: 'Facebook' },
  { id: 'instagram', label: 'Instagram', app: 'instagram' },
  { id: 'snapchat', label: 'Snapchat', app: 'snapchat' },
  { id: 'tiktok', label: 'TikTok', app: 'tiktok' },
  { id: 'x', label: 'X', app: 'x' },
]

/** Les deux qu'on coche — celles de la référence. */
const CHECKED = ['facebook', 'instagram'] as const

// ─── Briques ─────────────────────────────────────────────────────────────

function CheckMark({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5.5 12.6 10 17l8.5-9.4"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function Chevron({ size, color }: { size: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M9 5l7 7-7 7"
        fill="none"
        stroke={color}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

function Glyph({ glyph, size }: { glyph: string; size: number }) {
  if (glyph === 'all') return <AllAppsGlyph size={size} />
  if (glyph === 'social') return <SocialGlyph size={size} />
  return <Text style={{ fontSize: size * 0.86 }}>{glyph}</Text>
}

/** Le cercle vide, ou la pastille bleue cochée qui vient le recouvrir. */
function Radio({ checkStyle }: { checkStyle?: object }) {
  return (
    <View style={styles.radioWrap}>
      <View style={styles.radioRing} />
      {checkStyle ? (
        <Animated.View style={[styles.radioChecked, checkStyle]}>
          <CheckMark size={RADIO * 0.7} />
        </Animated.View>
      ) : null}
    </View>
  )
}

/** Halo de tap : ce qui fait comprendre qu'on TOUCHE la ligne. */
function TapHalo({
  progress,
  at,
  frozen,
}: {
  progress: SharedValue<number>
  at: number
  frozen: boolean
}) {
  const style = useAnimatedStyle(() => {
    if (frozen) return { opacity: 0 }
    const k = interpolate(
      progress.value,
      [at, at + BEAT],
      [0, 1],
      Extrapolation.CLAMP,
    )
    const live = progress.value >= at && progress.value <= at + BEAT
    return {
      opacity: live ? interpolate(k, [0, 0.3, 1], [0, 0.85, 0]) : 0,
      transform: [{ scale: 0.6 + k * 0.9 }],
    }
  })
  return <Animated.View pointerEvents="none" style={[styles.halo, style]} />
}

function Row({
  label,
  glyph,
  app,
  child,
  trailing,
  checkStyle,
  halo,
}: {
  label: string
  glyph?: string
  app?: AppId
  child?: boolean
  trailing?: React.ReactNode
  checkStyle?: object
  halo?: React.ReactNode
}) {
  return (
    <View style={[styles.row, child && styles.rowChild]}>
      {halo}
      <Radio checkStyle={checkStyle} />
      <View style={styles.iconSlot}>
        {app ? (
          <AppLogo app={app} size={ICON} />
        ) : glyph === 'facebook' ? (
          <FacebookIcon size={ICON} />
        ) : glyph ? (
          <Glyph glyph={glyph} size={ICON} />
        ) : null}
      </View>
      <Text numberOfLines={1} style={styles.label}>
        {label}
      </Text>
      <View style={styles.trailing}>{trailing}</View>
    </View>
  )
}

// ─── La scène ────────────────────────────────────────────────────────────

export function PickerAnimation({ width }: { width: number }) {
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

  // Le tiroir : hauteur animée, contenu rogné. Animer la hauteur plutôt que
  // de monter/démonter les lignes garde les coches en place pendant le repli.
  const drawerStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { height: 0 }
    const open = interpolate(
      progress.value,
      [T.expandStart, T.expandEnd, T.collapseStart, T.collapseEnd],
      [0, 1, 1, 0],
      Extrapolation.CLAMP,
    )
    return { height: open * SOCIAL_APPS.length * ROW_H, opacity: open }
  })

  const chevronStyle = useAnimatedStyle(() => {
    if (reduceMotion) return {}
    const open = interpolate(
      progress.value,
      [T.expandStart, T.expandEnd, T.collapseStart, T.collapseEnd],
      [0, 1, 1, 0],
      Extrapolation.CLAMP,
    )
    return { transform: [{ rotate: `${open * 90}deg` }] }
  })

  const countStyle = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 0 }
    return {
      opacity: interpolate(
        progress.value,
        [T.countIn, T.countIn + BEAT, 0.96, 1],
        [0, 1, 1, 0],
        Extrapolation.CLAMP,
      ),
    }
  })

  const checkStyleFor = (index: number) => {
    const at = index === 0 ? T.checkFirst : T.checkSecond
    // biome-ignore lint/correctness/useHookAtTopLevel: appelé un nombre fixe de fois (CHECKED est constant)
    return useAnimatedStyle(() => {
      if (reduceMotion) return { opacity: 0, transform: [{ scale: 1 }] }
      const k = interpolate(
        progress.value,
        [at, at + BEAT, T.collapseStart, T.collapseEnd],
        [0, 1, 1, 0],
        Extrapolation.CLAMP,
      )
      return { opacity: k, transform: [{ scale: 0.6 + k * 0.4 }] }
    })
  }

  const checkFirst = checkStyleFor(0)
  const checkSecond = checkStyleFor(1)

  return (
    <View style={[styles.card, { width, height: CARD_H }]}>
      {CATEGORIES.map(cat => {
        if (cat.id !== 'social') {
          return (
            <View key={cat.id} style={styles.rowWrap}>
              <Row
                label={cat.label}
                glyph={cat.glyph}
                trailing={
                  cat.id === 'all' ? null : <Chevron size={18} color={C.ring} />
                }
              />
              <View style={styles.sep} />
            </View>
          )
        }

        return (
          <View key={cat.id}>
            <View style={styles.rowWrap}>
              <Row
                label={cat.label}
                glyph={cat.glyph}
                halo={
                  <>
                    <TapHalo
                      progress={progress}
                      at={T.tapSocial}
                      frozen={reduceMotion}
                    />
                    <TapHalo
                      progress={progress}
                      at={T.tapCollapse}
                      frozen={reduceMotion}
                    />
                  </>
                }
                trailing={
                  <View style={styles.trailingRow}>
                    <Animated.Text style={[styles.count, countStyle]}>
                      2
                    </Animated.Text>
                    <Animated.View style={chevronStyle}>
                      <Chevron size={18} color={C.ring} />
                    </Animated.View>
                  </View>
                }
              />
              <View style={styles.sep} />
            </View>

            <Animated.View style={[styles.drawer, drawerStyle]}>
              {SOCIAL_APPS.map((a, i) => {
                const checkedIndex = CHECKED.indexOf(
                  a.id as (typeof CHECKED)[number],
                )
                return (
                  <View key={a.id} style={styles.rowWrap}>
                    <Row
                      child
                      label={a.label}
                      app={a.app}
                      glyph={a.app ? undefined : 'facebook'}
                      checkStyle={
                        checkedIndex === 0
                          ? checkFirst
                          : checkedIndex === 1
                            ? checkSecond
                            : undefined
                      }
                      halo={
                        checkedIndex >= 0 ? (
                          <TapHalo
                            progress={progress}
                            at={checkedIndex === 0 ? T.tapFirst : T.tapSecond}
                            frozen={reduceMotion}
                          />
                        ) : undefined
                      }
                    />
                    {i < SOCIAL_APPS.length - 1 ? (
                      <View style={styles.sep} />
                    ) : null}
                  </View>
                )
              })}
            </Animated.View>
          </View>
        )
      })}
      <Svg
        pointerEvents="none"
        style={styles.cardFade}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <Defs>
          <LinearGradient id="pickerFade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={C.card} stopOpacity={0} />
            <Stop offset="1" stopColor={C.card} stopOpacity={0.92} />
          </LinearGradient>
        </Defs>
        <Rect width={100} height={100} fill="url(#pickerFade)" />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 26,
    overflow: 'hidden',
  },
  rowWrap: {},
  row: {
    height: ROW_H,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: PAD_L,
    paddingRight: 16,
  },
  rowChild: { backgroundColor: C.child },
  radioWrap: {
    width: RADIO,
    height: RADIO,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIO / 2,
    borderWidth: 1.6,
    borderColor: C.ring,
  },
  radioChecked: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIO / 2,
    backgroundColor: C.check,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconSlot: {
    width: ICON,
    height: ICON,
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...fonts.regular,
    flex: 1,
    marginLeft: 14,
    fontSize: 15.5,
    color: C.label,
  },
  trailing: { minWidth: 18, alignItems: 'flex-end' },
  trailingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  count: { ...fonts.regular, fontSize: 15, color: C.muted },
  sep: {
    height: StyleSheet.hairlineWidth,
    marginLeft: TEXT_L,
    backgroundColor: C.sep,
  },
  drawer: { overflow: 'hidden' },
  cardFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: ROW_H,
  },
  halo: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 2,
    bottom: 2,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
})
