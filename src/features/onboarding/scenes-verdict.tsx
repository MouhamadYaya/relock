import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Image,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { annualProjection } from '@/features/onboarding/services/annualProjection'
import { recoveryGoal } from '@/features/onboarding/services/recoveryGoal'
import { fonts } from '@/shared/theme/tokens/fonts'
import { Footnote, GradientLine, Pill } from './bits'
import { Reveal } from './motion'
import {
  GOOD_NEWS,
  haptic,
  OB,
  PERSONALIZED_PLAN,
  PROJECTION_MAX_BARS,
} from './tokens'

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
  const { daysPerYear: days } = annualProjection(hours)
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
          <Text style={styles.mirrorLabel}>À ton rythme, environ</Text>
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
          <Pill label="Voir la bonne nouvelle" onPress={onNext} />
          <Footnote
            text={`Estimation pour ta tranche : ${hours} h/jour × 365 ÷ 24. Arrondi en journées de 24 h.`}
          />
        </Animated.View>
      ) : null}
    </View>
  )
}

// ─── Acte 2 · La bonne nouvelle ─────────────────────────────────────────

/**
 * Decorative progress segments: one segment is NOT one day. Capping their
 * number preserves the original composition and duration for every estimate.
 */
const PROJECTION_BAR_H = 118
const PROJECTION_BAR_GAP = 6
const PROJECTION_BAR_MAX_W = 44
const PROJECTION_BAR_MIN_W = 8
/** Assez lent pour compter, assez vif pour ne pas attendre. */
const PROJECTION_BAR_FIRST_MS = 420
const PROJECTION_BAR_STEP_MS = 175

function projectionBarWidth(count: number, totalW: number) {
  return Math.max(
    PROJECTION_BAR_MIN_W,
    Math.min(PROJECTION_BAR_MAX_W, totalW / count - PROJECTION_BAR_GAP),
  )
}

/**
 * Un segment de la projection. Il pousse depuis le socle (la rangée est
 * alignée en bas), puis se resserre à chaque nouvelle voisine.
 */
function ProjectionBar({ w }: { w: number }) {
  const grow = useSharedValue(0)
  const width = useSharedValue(w)

  useEffect(() => {
    grow.value = withSpring(1, { damping: 14, stiffness: 180, mass: 0.7 })
  }, [grow])

  useEffect(() => {
    width.value = withSpring(w, { damping: 22, stiffness: 190 })
  }, [w, width])

  const style = useAnimatedStyle(() => ({
    width: width.value,
    height: PROJECTION_BAR_H * grow.value,
    // Le fondu court plus vite que la pousse : la barre est déjà pleine
    // quand elle finit de monter, sinon elle paraît fantomatique.
    opacity: Math.min(1, grow.value * 1.4),
  }))

  return <Animated.View style={[styles.goodBar, style]} />
}

/**
 * Le dernier mot du verdict défile : la même durée rendue, plusieurs vies
 * possibles. « Par an » ouvre la projection, les autres mots évoquent
 * des usages possibles de ce temps, sans promettre un résultat.
 */
const GOOD_WORDS = [
  'par an',
  'de Présence',
  'de Sommeil',
  'de Calme',
  'de Liberté',
  'de Vie',
] as const
const GOOD_WORD_MS = 1600

export function SceneGoodNews({
  hours,
  onNext,
}: {
  hours: number
  onNext: () => void
}) {
  const { width } = useWindowDimensions()
  const goal = useMemo(() => recoveryGoal(hours), [hours])
  const days = goal.days
  const barCount = Math.max(1, Math.min(PROJECTION_MAX_BARS, days))
  const [shown, setShown] = useState(0)
  const [word, setWord] = useState(0)
  const pulse = useSharedValue(1)
  const done = shown >= barCount

  // La rangée respire avec l'écran : sur un SE elle ne doit pas toucher les
  // marges, sur un Pro Max elle ne doit pas s'étaler.
  const barsW = Math.min(214, width - 116)
  const barW = projectionBarWidth(Math.max(1, shown), barsW)
  const heroSize = Math.min(52, Math.round(width * 0.132))
  const heroLineH = Math.ceil(heroSize * 1.24)

  // Bounded decorative progression; the counter still reaches the exact estimate.
  useEffect(() => {
    setShown(0)
    setWord(0)
    const timers = Array.from({ length: barCount }, (_, i) =>
      setTimeout(
        () => {
          setShown(i + 1)
          if (i === barCount - 1) {
            haptic.heavy()
            pulse.value = withSequence(
              withSpring(1.07, { damping: 9, stiffness: 300 }),
              withSpring(1, { damping: 14, stiffness: 220 }),
            )
          } else {
            haptic.tick()
          }
        },
        PROJECTION_BAR_FIRST_MS + i * PROJECTION_BAR_STEP_MS,
      ),
    )
    return () => {
      for (const t of timers) clearTimeout(t)
    }
  }, [barCount, pulse])

  // Le défilé des mots ne démarre qu'une fois le compte posé : deux
  // mouvements à la fois, et plus personne ne lit le chiffre.
  useEffect(() => {
    if (!done) return
    const id = setInterval(() => {
      haptic.select()
      setWord(w => (w + 1) % GOOD_WORDS.length)
    }, GOOD_WORD_MS)
    return () => clearInterval(id)
  }, [done])

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }))

  const displayedDays = Math.round(
    (Math.min(shown, barCount) / barCount) * days,
  )
  const label = `${displayedDays} ${displayedDays === 1 ? 'jour' : 'jours'}`
  const suffix = GOOD_WORDS[word]

  return (
    <View className="flex-1 px-5">
      <View className="flex-1 justify-center">
        {/* Hauteur réservée : la rangée pousse vers le haut sans jamais
            déplacer le texte qui la suit. */}
        <View
          style={[styles.goodBars, { width: barsW }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {Array.from({ length: shown }, (_, i) => (
            <ProjectionBar key={`projection-${i}`} w={barW} />
          ))}
        </View>
        <Reveal index={0}>
          <Text testID="good-news-lead" style={styles.goodLead}>
            Relock va t’aider à récupérer{'\n'}du temps pour toi.
          </Text>
        </Reveal>
        <View style={{ height: heroLineH * 2 }}>
          {shown > 0 ? (
            <Animated.View
              entering={FadeIn.duration(300)}
              style={pulseStyle}
              accessibilityRole="text"
              accessibilityLabel={`Objectif : ${displayedDays} jours par an, à adapter à ton usage`}
            >
              <GradientLine text={label} size={heroSize} />
              <View style={{ height: heroLineH }}>
                <Animated.View
                  key={suffix}
                  entering={FadeInDown.duration(420).easing(
                    Easing.out(Easing.cubic),
                  )}
                  exiting={FadeOutUp.duration(280)}
                  style={StyleSheet.absoluteFill}
                >
                  <GradientLine text={suffix} size={heroSize} />
                </Animated.View>
              </View>
            </Animated.View>
          ) : null}
        </View>
      </View>
      {/* Le socle occupe sa place avant l'arrivée du CTA, sinon tout
          l'écran remonterait d'un cran au dernier tick. */}
      <View style={styles.goodFoot}>
        {done ? (
          <Animated.View entering={FadeIn.duration(420)} className="gap-2">
            <Pill label="Continuer" onPress={onNext} glow />
            <Text style={styles.goodNote}>{goal.note}</Text>
          </Animated.View>
        ) : null}
      </View>
    </View>
  )
}

// ─── Acte 2 · Le renversement ───────────────────────────────────────────

/**
 * Le dossier à charge. Trois coupures de presse s'empilent une par une,
 * la dernière recouvrant les précédentes dont seul le haut de la photo
 * dépasse — l'accusation se construit sous les yeux plutôt que de
 * s'afficher d'un bloc. Chaque carte reste seule en tête assez longtemps
 * pour être lue. Verdict et CTA n'apparaissent qu'avec la DERNIÈRE carte :
 * impossible de survoler le dossier.
 *
 * Ordre voulu : Meta (ils savaient) → tribunal (ils sont poursuivis) →
 * TikTok (l'addiction est un objectif produit, chiffré). On finit sur
 * TikTok, la plus concrète des trois.
 *
 * ⚠️ Faits publics réels, traduits et resserrés pour l'écran — à
 * revérifier mot pour mot avant publication (ils nomment de vraies
 * entreprises et de vrais médias) :
 * - « The Facebook Files », The Wall Street Journal, septembre 2021 :
 *   documents internes révélés par Frances Haugen.
 * - Octobre 2023 : 41 États américains + le district de Columbia
 *   assignent Meta pour des fonctionnalités jugées addictives pour les
 *   mineurs.
 * - Octobre 2024 : documents internes de TikTok descellés dans la plainte
 *   du procureur général du Kentucky (révélés par NPR) — le seuil de
 *   formation de l'habitude y est chiffré.
 *
 * ⚠️ Photos : `assets/press/*.jpg` (voir le README du dossier), recadrées
 * au ratio de la zone photo et déclinées en 1x/2x/3x. Ce sont des images
 * d'agence — licence à vérifier avant publication.
 */
const PRESS = [
  {
    id: 'meta',
    photo: require('@assets/press/meta.jpg'),
    quote: "« Facebook sait qu'Instagram est toxique pour les adolescentes. »",
    source: 'The Wall Street Journal',
    year: '2021',
    context: "Documents internes, révélés par une lanceuse d'alerte.",
  },
  {
    id: 'trial',
    photo: require('@assets/press/zuckerberg.jpg'),
    quote:
      '« 41 États poursuivent Meta pour avoir conçu des fonctions addictives. »',
    source: 'Plainte fédérale des procureurs généraux',
    year: '2023',
    context: "Visées : la notification, le scroll infini, les « j'aime ».",
  },
  {
    id: 'tiktok',
    photo: require('@assets/press/tiktok.jpg'),
    quote: "« Environ 260 vidéos, et l'habitude est formée. »",
    source: 'Documents internes TikTok',
    year: '2024',
    context: 'Moins de 35 minutes. Leur chiffre, pas le nôtre.',
  },
] as const

/** Bloc texte sous la photo : citation sur 2 lignes + source + contexte. */
const PRESS_TEXT_H = 110
/** Part de la carte précédente qui reste visible sous la suivante. */
const PRESS_PEEK = 26

/**
 * Hauteur de la photo, proportionnelle à l'écran.
 *
 * Fixe, elle obligeait à un cadrage très panoramique (les visuels
 * arrivaient tronqués) ou débordait des petits écrans. Bornée ainsi, la
 * pile tient sur un iPhone SE (667 pt) comme sur un Pro Max sans jamais
 * pousser le CTA hors de l'écran.
 */
function pressPhotoHeight(screenH: number) {
  return Math.round(Math.min(205, Math.max(142, screenH * 0.225)))
}
/**
 * Rythme calé pour que la dernière carte — celle qui ouvre le CTA — tombe
 * à 4,00 s pile : 620 ms + 2 × 1690 ms.
 */
const PRESS_FIRST_MS = 620
const PRESS_STEP_MS = 1690

/**
 * Une coupure. Elle monte depuis le bas, se pose sur la pile, puis
 * s'éteint d'un cran à chaque nouvelle arrivée (`depth`) pour que le
 * regard reste sur la dernière.
 */
function PressCard({
  item,
  index,
  depth,
  photoH,
}: {
  item: (typeof PRESS)[number]
  index: number
  depth: number
  photoH: number
}) {
  const enter = useSharedValue(0)
  const fade = useSharedValue(0)
  const dim = useSharedValue(1)

  useEffect(() => {
    enter.value = withSpring(1, { damping: 18, stiffness: 150, mass: 0.9 })
    fade.value = withTiming(1, { duration: 280 })
  }, [enter, fade])

  useEffect(() => {
    dim.value = withTiming(depth === 0 ? 1 : depth === 1 ? 0.5 : 0.26, {
      duration: 420,
    })
  }, [depth, dim])

  const style = useAnimatedStyle(() => ({
    // `fade` reste en timing : un ressort dépasserait 1 sur l'opacité.
    opacity: fade.value * dim.value,
    transform: [
      { translateY: index * PRESS_PEEK + (1 - enter.value) * 92 },
      { scale: 0.955 + enter.value * 0.045 },
    ],
  }))

  return (
    <Animated.View
      style={[
        styles.pressCard,
        { height: photoH + PRESS_TEXT_H, zIndex: index },
        style,
      ]}
    >
      <View style={[styles.pressPhotoWrap, { height: photoH }]}>
        <Image source={item.photo} style={styles.pressPhoto} />
        {/* Voile sombre : les visuels de presse sont sur fond blanc, ils
            brûleraient l'écran noir de l'onboarding sans ça. */}
        <View style={styles.pressScrim} pointerEvents="none" />
      </View>
      <View style={styles.pressBody}>
        <Text style={styles.pressQuote} numberOfLines={2}>
          {item.quote}
        </Text>
        <Text style={styles.pressSource} numberOfLines={1}>
          {item.source} · {item.year}
        </Text>
        <Text style={styles.pressContext} numberOfLines={1}>
          {item.context}
        </Text>
      </View>
    </Animated.View>
  )
}

export function SceneReversal({ onNext }: { onNext: () => void }) {
  const { height } = useWindowDimensions()
  const photoH = pressPhotoHeight(height)
  const [shown, setShown] = useState(0)
  const last = shown >= PRESS.length

  useEffect(() => {
    const timers = PRESS.map((_, i) =>
      setTimeout(
        () => {
          // La dernière carte frappe plus fort : c'est elle qui ouvre le CTA.
          if (i === PRESS.length - 1) haptic.tap()
          else haptic.tick()
          setShown(i + 1)
        },
        PRESS_FIRST_MS + i * PRESS_STEP_MS,
      ),
    )
    return () => {
      for (const t of timers) clearTimeout(t)
    }
  }, [])

  return (
    <View className="flex-1 px-5">
      <View className="flex-1 justify-center">
        <Reveal index={0}>
          <Text style={styles.reversalTitle}>Tu n'es pas le problème.</Text>
        </Reveal>
        <Reveal index={1}>
          <Text style={styles.reversalBody}>
            Ces apps sont réglées par des milliers d'ingénieurs pour te retenir.
          </Text>
        </Reveal>
        {/* Hauteur réservée dès le départ : les cartes arrivent en absolu,
            rien ne se décale quand la pile se remplit. */}
        <View
          style={[
            styles.pressStack,
            {
              height: photoH + PRESS_TEXT_H + PRESS_PEEK * (PRESS.length - 1),
            },
          ]}
        >
          {PRESS.slice(0, shown).map((item, i) => (
            <PressCard
              key={item.id}
              item={item}
              index={i}
              depth={shown - 1 - i}
              photoH={photoH}
            />
          ))}
        </View>
      </View>
      {/* Même principe en bas : le socle occupe sa place avant que le
          verdict n'apparaisse, sinon tout l'écran remonterait d'un cran. */}
      <View style={styles.reversalFoot}>
        {last ? (
          <Animated.View entering={FadeIn.duration(420)} className="gap-4">
            <Text style={styles.reversalVerdict}>
              Relock rééquilibre les règles,{'\n'}en ta faveur.
            </Text>
            <Pill label="Construire mon plan" onPress={onNext} />
          </Animated.View>
        ) : null}
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

  goodBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    alignSelf: 'center',
    gap: PROJECTION_BAR_GAP,
    height: PROJECTION_BAR_H,
    marginBottom: 34,
  },
  goodBar: {
    borderRadius: 7,
    backgroundColor: OB.ink,
    // Halo lavande : les barres restent blanches (lisibilité maximale)
    // mais baignent dans l'accent, sans peindre le dégradé dessus.
    shadowColor: OB.accent,
    shadowOpacity: 0.5,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  goodLead: {
    ...fonts.semiBold,
    fontSize: GOOD_NEWS.leadSize,
    lineHeight: GOOD_NEWS.leadLineHeight,
    color: OB.ink,
    textAlign: 'center',
    marginBottom: 10,
  },
  goodFoot: {
    minHeight: 96,
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  goodNote: {
    ...fonts.regular,
    fontSize: PERSONALIZED_PLAN.captionSize,
    lineHeight: PERSONALIZED_PLAN.captionLineHeight,
    color: OB.ink70,
    textAlign: 'center',
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
  reversalVerdict: {
    ...fonts.bold,
    fontSize: 22,
    lineHeight: 29,
    letterSpacing: -0.4,
    color: OB.ink,
    textAlign: 'center',
  },
  reversalFoot: {
    minHeight: 144,
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },

  pressStack: { marginTop: 26 },
  pressCard: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: OB.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: OB.hairline,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  pressPhotoWrap: { backgroundColor: OB.card2 },
  pressPhoto: { width: '100%', height: '100%', resizeMode: 'cover' },
  pressScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,5,7,0.26)',
  },
  pressBody: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 5,
  },
  pressQuote: {
    ...fonts.semiBold,
    fontSize: 15,
    lineHeight: 20,
    color: OB.ink,
  },
  pressSource: {
    ...fonts.medium,
    fontSize: 12,
    letterSpacing: 0.3,
    color: OB.accent,
  },
  pressContext: { ...fonts.regular, fontSize: 12, color: OB.ink40 },
})
