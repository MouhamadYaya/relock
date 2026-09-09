import { IconName } from '@assets/icons'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  Image,
  type LayoutRectangle,
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
  FadeInDown,
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
import { featureFlags } from '@/config/feature-flags'
import { ScienceSheet } from '@/features/onboarding/components/ScienceSheet'
import { ShieldRain } from '@/features/onboarding/components/ShieldRain'
import type { RainField } from '@/features/onboarding/shield-rain'
import { translate } from '@/i18n/translate'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { RelockWordmark } from '@/shared/components/ui/RelockWordmark'
import { fonts } from '@/shared/theme/tokens/fonts'
import {
  Footnote,
  GhostLink,
  GradientLine,
  HaloBackdrop,
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
  const insets = useSafeAreaInsets()
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
          // Le tout premier contact tactile entre quelqu'un et Relock. Il n'y
          // a rien d'autre à l'écran qu'une lune : c'est la vibration, et elle
          // seule, qui dit que l'app a répondu.
          haptic.tap()
          onDone()
        }
      }}
    >
      <Animated.View style={glowStyle}>
        <Animated.View style={moonStyle}>
          <Moon size={160} glow />
        </Animated.View>
      </Animated.View>
      {/*
        Le logotype est posé en ABSOLU, pas en frère de flux : la lune doit
        rester au centre exact de l'écran pour prolonger le splash natif sans
        saut. Il n'a pas non plus d'animation d'entrée — le splash natif
        l'affiche déjà, le faire réapparaître ferait clignoter la marque.
      */}
      <View style={[styles.ignitionBrand, { bottom: insets.bottom + 48 }]}>
        <RelockWordmark height={34} />
      </View>
    </Pressable>
  )
}

// ─── Acte 0 · La promesse ───────────────────────────────────────────────
//
// Le premier écran ne DÉCRIT pas le produit, il le montre : une averse de
// billes tombe, une bulle invisible la renvoie, le lecteur ne lève même pas
// les yeux. Tout l'onboarding découle de cette image — c'est la promesse en
// une seconde, avant le moindre mot.
//
// La simulation et son rendu vivent à part (`shield-rain.ts`,
// `components/ShieldRain.tsx`). Ce qui reste ici, c'est la composition — et
// la GÉOMÉTRIE qui relie les deux : le dôme de collision est déduit du cadre
// réellement occupé par l'illustration à l'écran, jamais d'une constante
// devinée. Une bille qui rebondirait à côté du halo ruinerait l'effet.

/**
 * Rapport largeur/hauteur de `assets/onboarding-welcome-hero.png`, recadré au
 * pixel sur sa boîte opaque (1130 × 1218). Nécessaire ici : avec
 * `resizeMode="contain"`, le dessin n'occupe pas toute sa boîte de mise en
 * page, et c'est le dessin — pas la boîte — que les billes doivent frôler.
 */
const HERO_ASPECT = 1130 / 1218

/**
 * Le dôme, en fractions du dessin — relevé sur l'illustration. Il épouse le
 * halo et la boucle extérieure de l'anneau, et laisse dehors les bulles
 * d'icônes et les jambes croisées : une bille qui les recouvre passe DERRIÈRE
 * elles (l'illustration se dessine par-dessus la pluie, cf. l'ordre des
 * frères dans la scène), ce qui se lit comme une glissade, pas comme un bug.
 */
const HERO_SHIELD = { cx: 0.49, cy: 0.5, rx: 0.445, ry: 0.405 } as const

/**
 * Part de la largeur d'écran occupée par l'illustration.
 *
 * C'est elle qui borne la taille du dessin sur presque tous les iPhone (la
 * cale est plus haute que large) — et donc, du même coup, le rayon du dôme.
 * Trop petite, les billes rebondissent au milieu du vide et il reste un trou
 * entre le lecteur et le bouton.
 */
const HERO_WIDTH_RATIO = 0.72

const HERO = require('@assets/onboarding-welcome-hero.png')

/**
 * « Soutenu par la science », et la porte derrière.
 *
 * Il ne réutilise pas `StudyLine` (la pilule discrète du reste du parcours)
 * pour une raison de fond : celle-ci ÉNONCE un fait et s'arrête là, alors que
 * celui-ci PROMET une explication. Sans le chevron d'information à droite,
 * rien ne dit qu'il y a quelque chose à toucher — et l'affirmation resterait
 * une affirmation nue, ce qu'on ne veut pas ici (cf. `ScienceSheet`).
 */
function ScienceBadge({
  label,
  onPress,
}: {
  label: string
  onPress: () => void
}) {
  return (
    <Pressable
      testID="science-badge"
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={translate('onboarding_intro.science.open_a11y')}
      hitSlop={10}
      onPressIn={() => haptic.tick()}
      onPress={onPress}
      style={styles.scienceBadge}
    >
      <IconSvg
        name={IconName.PULSE}
        size={15}
        color={OB.accent}
        strokeWidth={1.9}
      />
      <Text style={styles.scienceBadgeText}>{label}</Text>
      <IconSvg
        name={IconName.INFO}
        size={14}
        color={OB.ink40}
        strokeWidth={1.9}
      />
    </Pressable>
  )
}

export function SceneWelcome({ onNext }: { onNext: () => void }) {
  const t = useT()
  const insets = useSafeAreaInsets()

  // Mesuré, pas déduit de `useWindowDimensions` : cette scène possède sa
  // safe area (cf. `ownsSafeArea` dans OnboardingFlow), et c'est la boîte
  // RÉELLE qu'on lui donne qui définit le champ de la pluie.
  const [field, setField] = useState<RainField | null>(null)
  // La place laissée à l'illustration par la colonne de contenu. Elle est
  // mesurée sur une CALE vide, et l'illustration est ensuite dessinée en
  // absolu dans ce cadre : c'est le seul moyen de la faire passer par-dessus
  // la pluie tout en la laissant se comprimer avec la mise en page.
  const [slot, setSlot] = useState<LayoutRectangle | null>(null)
  const [scienceOpen, setScienceOpen] = useState(false)

  const hero = useMemo(() => {
    if (!field || !slot) return null
    const width = Math.min(
      field.width * HERO_WIDTH_RATIO,
      slot.height * HERO_ASPECT,
    )
    const height = width / HERO_ASPECT
    const left = slot.x + (slot.width - width) / 2
    const top = slot.y + (slot.height - height) / 2
    return {
      frame: { position: 'absolute' as const, left, top, width, height },
      shield: {
        cx: left + width * HERO_SHIELD.cx,
        cy: top + height * HERO_SHIELD.cy,
        rx: width * HERO_SHIELD.rx,
        ry: height * HERO_SHIELD.ry,
      },
    }
  }, [field, slot])

  return (
    <View
      style={styles.welcome}
      onLayout={e => {
        const { width, height } = e.nativeEvent.layout
        setField(prev =>
          prev && prev.width === width && prev.height === height
            ? prev
            : { width, height },
        )
      }}
    >
      {/* Le fond de l'onboarding, tel quel. La scène possède sa safe area
          (`ownsSafeArea`), donc le flux ne le pose plus pour elle : c'est à
          elle de le peindre, et depuis le tout premier pixel — le halo doit
          couvrir la status bar comme sur tous les autres écrans du récit. */}
      <HaloBackdrop />

      <View
        style={{
          flex: 1,
          paddingTop: insets.top + 58,
          paddingBottom: insets.bottom + 14,
        }}
      >
        <Reveal index={0} style={styles.welcomeCopy}>
          <Text style={styles.welcomeHero}>
            {t('onboarding_intro.welcome.hero_before')}
            <Text style={styles.welcomeHeroAccent}>
              {t('onboarding_intro.welcome.hero_gain')}
            </Text>
            {t('onboarding_intro.welcome.hero_middle')}
            <Text style={styles.welcomeHeroAccent}>
              {t('onboarding_intro.welcome.hero_span')}
            </Text>
            {t('onboarding_intro.welcome.hero_after')}
          </Text>
        </Reveal>

        <Reveal index={1} style={styles.welcomeProof}>
          <ScienceBadge
            label={t('onboarding_intro.science.badge')}
            onPress={() => {
              haptic.select()
              setScienceOpen(true)
            }}
          />
        </Reveal>

        <View
          style={styles.welcomeStage}
          onLayout={e => setSlot(e.nativeEvent.layout)}
        />

        {/* `kind="gradient"` : le même bouton que les deux autres bascules du
            récit (la preuve, le rituel). Le `primary` blanc est celui des
            écrans de question — il ne porte pas un premier écran. */}
        <Reveal index={3} style={styles.welcomeCta}>
          <Pill
            label={t('paywall.continue')}
            kind="gradient"
            onPress={onNext}
          />
        </Reveal>
      </View>

      {/* ⚠️ ORDRE DES FRÈRES = ORDRE DE PROFONDEUR, et c'est lui qui
          reproduit la référence : la pluie passe DEVANT le titre, le lecteur
          passe DEVANT la pluie. Déplacer l'un de ces deux blocs, c'est faire
          passer une bille devant son visage. */}
      {field && hero ? <ShieldRain field={field} shield={hero.shield} /> : null}
      {hero ? (
        <Reveal index={2} style={hero.frame}>
          <Image
            source={HERO}
            style={styles.welcomeHeroArt}
            resizeMode="contain"
          />
        </Reveal>
      ) : null}

      <ScienceSheet
        visible={scienceOpen}
        onClose={() => setScienceOpen(false)}
      />
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

// Une seule horloge pilote toute la boucle du mockup (défilement du feed,
// montée du bouclier, fondu de reprise) : ces constantes fixent son rythme
// et sont réutilisées par `SceneDemo` pour savoir, en JS, quand le mur de
// blocage apparaît à l'écran (`DEMO_WALL_REVEAL_T`) et activer le CTA à ce
// moment précis plutôt que de deviner un délai indépendant de l'animation.
const DEMO_CYCLE_MS = 4400
const DEMO_WALL_REVEAL_T = 0.54
const DEMO_WALL_REVEAL_MS = DEMO_CYCLE_MS * DEMO_WALL_REVEAL_T

/**
 * Mockup d'iPhone animé en boucle : un feed défile tard le soir, puis le
 * bouclier Relock monte et bloque. La magie du produit, vécue avant la
 * première question — le principe Cal AI, sans vidéo (tout est recréé).
 */
function PhoneDemo() {
  const t = useSharedValue(0)
  useEffect(() => {
    t.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1 }),
        withTiming(1, { duration: DEMO_CYCLE_MS, easing: Easing.linear }),
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
          [0, 0.4, 0.5, DEMO_WALL_REVEAL_T, 1],
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
            <Text style={styles.phonePillText}>
              {translate('onboarding_intro.demo.feed_tab')}
            </Text>
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
          <Text style={styles.shieldTitle}>{translate('blocking.locked')}</Text>
          <Text style={styles.shieldSub}>
            {translate('onboarding_intro.demo.shield_sub')}
          </Text>
          <View style={styles.shieldBtn}>
            <Text style={styles.shieldBtnText}>
              {translate('common.close')}
            </Text>
          </View>
        </Animated.View>
      </View>
    </Animated.View>
  )
}

export function SceneDemo({ onNext }: { onNext: () => void }) {
  const t = useT()
  // Le CTA reste désactivé tant que le mur de blocage n'est pas apparu dans
  // l'animation du mockup (cf. `DEMO_WALL_REVEAL_MS`) : on guide l'utilisateur
  // à regarder la démo avant de pouvoir continuer, plutôt que de laisser
  // passer directement à côté du moment qui vend le produit.
  const [ctaReady, setCtaReady] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setCtaReady(true), DEMO_WALL_REVEAL_MS)
    return () => clearTimeout(id)
  }, [])

  return (
    <View className="flex-1 px-5">
      <View className="flex-1 justify-center">
        <Reveal index={0}>
          <Text style={[styles.h1, styles.h1Center]}>
            {t('onboarding_intro.demo.title')}
          </Text>
          <GradientLine
            text={t('onboarding_intro.demo.title_accent')}
            size={32}
          />
        </Reveal>
        <Reveal index={1} style={{ marginTop: 26 }}>
          <PhoneDemo />
        </Reveal>
        <Reveal index={2} style={{ marginTop: 22 }}>
          <Text style={styles.sub}>{t('onboarding_intro.demo.sub')}</Text>
        </Reveal>
      </View>
      <Reveal index={3} className="gap-2 pb-2.5">
        <Pill
          label={t('onboarding_intro.demo.cta')}
          onPress={onNext}
          disabled={!ctaReady}
        />
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
  // Le prénom n'est pas optionnel : tout le reste de l'onboarding s'adresse
  // à l'utilisateur par son prénom (question d'intention, plan personnalisé,
  // écran de victoire). Sans lui, ces écrans perdent leur raison d'être — donc
  // pas de lien « Passer », et le CTA reste éteint tant que le champ est vide.
  const t = useT()
  const canContinue = value.trim().length > 0

  return (
    <View className="flex-1 px-5">
      <View className="flex-1 pt-3">
        <Reveal index={0}>
          <Text style={styles.h1}>{t('onboarding_intro.name.title')}</Text>
        </Reveal>
        <Reveal index={1}>
          <Text style={styles.subLeft}>{t('onboarding_intro.name.sub')}</Text>
        </Reveal>
        <Reveal index={2} style={{ marginTop: 34 }}>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder={t('onboarding_intro.name.placeholder')}
            placeholderTextColor={OB.ink28}
            style={styles.nameInput}
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (canContinue) onNext()
            }}
          />
        </Reveal>
      </View>
      <Reveal index={3} className="gap-2 pb-2.5">
        <Pill
          label={t('paywall.continue')}
          onPress={onNext}
          disabled={!canContinue}
        />
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
  const t = useT()
  const { width } = useWindowDimensions()
  const trackW = width - 40 - 44 * 2 - 24
  const pos = useSharedValue(((hours - MIN_H) / (MAX_H - MIN_H)) * trackW)

  const commit = (v: number) => {
    // Un cran par heure franchie, même en glissant vite : sans le caractère
    // rythmique, le doigt traverserait trois heures pour une seule vibration
    // et le curseur se sentirait mou.
    haptic.detent()
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
          <Text style={styles.h1}>{t('onboarding_intro.hours.title')}</Text>
        </Reveal>
        <Reveal index={1}>
          <Text style={styles.subLeft}>{t('onboarding_intro.hours.sub')}</Text>
        </Reveal>
        <Reveal index={2} className="items-center mt-10">
          <GradientLine
            text={`${hours}${hours >= MAX_H ? '+' : ''}`}
            size={104}
          />
          <Text style={styles.hoursUnit}>
            {t('onboarding_intro.hours.unit')}
          </Text>
        </Reveal>
        <Reveal index={3} className="flex-row items-center gap-3 mt-[34px]">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('onboarding_intro.hours.less')}
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
            accessibilityLabel={t('onboarding_intro.hours.more')}
            onPress={() => step(1)}
            style={styles.stepBtn}
          >
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </Reveal>
      </View>
      <Reveal index={4} className="gap-2 pb-2.5">
        <Pill label={t('paywall.continue')} onPress={onNext} />
        <GhostLink
          label={t('onboarding_intro.hours.unknown')}
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
 * Preuve sociale de l'écran d'acquisition — MASQUÉE tant qu'elle est inventée.
 *
 * Le contenu est conservé ici exprès (il ne coûte rien et évite de le
 * réécrire), mais il ne s'affiche que si `featureFlags.showUnverifiedSocialProof`
 * passe à `true` — et ce flag porte la marche à suivre complète, y compris
 * pourquoi le rallumer tel quel serait une allégation trompeuse.
 *
 * Masqué, ce n'est pas un trou : la ligne d'étude (`StudyLine`) reprend la
 * place, avec un chiffre vérifiable qui ne parle pas de Relock.
 */
const SOCIAL_PROOF: { stars: number; text: string } | null =
  featureFlags.showUnverifiedSocialProof
    ? { stars: 5, text: '12K+ avis · 300K d’utilisateurs' }
    : null

/** Repère du graphe, en unités viewBox. Tout se positionne à partir de là. */
const CHART_VB_W = 390
const CHART_VB_H = 208
/** Longueurs de tracé (légèrement surestimées : garantit un tracé complet). */
const GREY_LEN = 520
const ACCENT_LEN = 480
/** Fin de la courbe Relock — le point d'arrivée, ancre de la bulle. */
const END_X = 322
const END_Y = 158
/** Hauteur de la ligne « sans rien », où s'accroche l'étiquette grise. */
const FLAT_Y = 40

const BENEFITS = [
  { id: 'focus', Icon: IconShield },
  { id: 'time', Icon: IconCalendar },
  { id: 'presence', Icon: IconPeople },
] as const

/**
 * L'interstitiel qui « donne » après les aveux : ta trajectoire sans
 * Relock, et avec. Le graphe est plein cadre (bord à bord), les deux
 * courbes se dessinent, celle de Relock plonge sous une aire dégradée et
 * son point d'arrivée porte l'étiquette. Sous le graphe : l'axe du temps,
 * les trois bénéfices, la preuve, le CTA.
 */
export function SceneProof({ onNext }: { onNext: () => void }) {
  const t = useT()
  const { width } = useWindowDimensions()
  // Tracé progressif des courbes : un progrès JS suffit largement ici
  // (33 valeurs par seconde sur un strokeDashoffset).
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => {
      const t = Math.min(1, (Date.now() - start - 400) / 1400)
      setProgress(Math.max(0, t))
      if (t >= 1) clearInterval(id)
    }, 32)
    return () => clearInterval(id)
  }, [])

  // Le graphe occupe toute la largeur : les étiquettes flottantes sont des
  // vues RN (vraies polices système) posées sur le SVG, donc converties du
  // repère viewBox vers les points écran.
  const scale = width / CHART_VB_W
  const chartH = CHART_VB_H * scale
  const px = (v: number) => v * scale
  const settled = progress >= 1

  return (
    <View className="flex-1">
      <Reveal index={0} className="px-6 pt-1">
        <Text style={styles.proofTitle}>
          {t('onboarding_intro.proof.title_before')}
          <Text style={styles.proofTitleAccent}>
            {t('onboarding_intro.proof.title_accent')}
          </Text>
          {t('onboarding_intro.proof.title_after')}
        </Text>
      </Reveal>

      <View style={styles.hairline} className="mt-5" />

      <View style={{ height: chartH }}>
        <Svg
          width={width}
          height={chartH}
          viewBox={`0 0 ${CHART_VB_W} ${CHART_VB_H}`}
        >
          <Defs>
            <LinearGradient id="proofGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={OB.grad[0]} />
              <Stop offset="55%" stopColor={OB.grad[1]} />
              <Stop offset="100%" stopColor={OB.grad[2]} />
            </LinearGradient>
            <LinearGradient id="proofFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={OB.grad[1]} stopOpacity={0.32} />
              <Stop offset="45%" stopColor={OB.grad[2]} stopOpacity={0.11} />
              <Stop offset="100%" stopColor={OB.grad[2]} stopOpacity={0} />
            </LinearGradient>
          </Defs>

          {/* Grille : trois repères horizontaux à peine perceptibles. */}
          {[26, 88, 150].map(y => (
            <Rect
              key={y}
              x={0}
              y={y}
              width={CHART_VB_W}
              height={0.75}
              fill="rgba(255,255,255,0.055)"
            />
          ))}

          {/* Aire sous la courbe Relock : le « territoire » regagné. */}
          <Path
            d={`M -30 52 C 55 58, 105 84, 160 106 C 225 132, 268 150, ${END_X} ${END_Y} L 420 ${END_Y + 7} L 420 ${CHART_VB_H} L -30 ${CHART_VB_H} Z`}
            fill="url(#proofFill)"
            opacity={progress}
          />

          {/* Sans Relock : plate, haute, elle sort du cadre. */}
          <Path
            d="M -30 40 C 60 30, 150 44, 240 42 C 300 41, 350 44, 420 40"
            stroke={OB.ink28}
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={GREY_LEN}
            strokeDashoffset={GREY_LEN * (1 - progress)}
          />
          {/* Avec Relock : plonge. */}
          <Path
            d={`M -30 52 C 55 58, 105 84, 160 106 C 225 132, 268 150, ${END_X} ${END_Y}`}
            stroke="url(#proofGrad)"
            strokeWidth={4.5}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={ACCENT_LEN}
            strokeDashoffset={ACCENT_LEN * (1 - progress)}
          />

          {settled ? (
            <>
              <Circle cx={END_X} cy={END_Y} r={12} fill={OB.grad[1]} />
              <Circle cx={END_X} cy={END_Y} r={7.5} fill="#0A0A0E" />
              <Circle cx={END_X} cy={END_Y} r={4} fill={OB.grad[1]} />
            </>
          ) : null}
        </Svg>

        {settled ? (
          <>
            {/* Étiquette « sans rien » : pilule sombre + avatar, ancrée sur
                la ligne plate et coupée par le bord droit, comme la réf. */}
            <Animated.View
              entering={FadeInDown.duration(340)}
              style={[styles.tagRow, { top: px(FLAT_Y) - 19 }]}
              pointerEvents="none"
            >
              <View style={styles.tagDim}>
                <Text style={styles.tagDimText}>
                  {t('onboarding_intro.proof.tag_without')}
                </Text>
              </View>
              <View style={styles.tagAvatar}>
                <IconPerson />
              </View>
            </Animated.View>

            {/* Étiquette « avec Relock » : bulle en dégradé, queue pointant
                le point d'arrivée. */}
            <Animated.View
              entering={FadeInDown.duration(340).delay(120)}
              style={[
                styles.tagAccentWrap,
                { top: px(END_Y) - 26 - 36, right: width - px(END_X) - 23 },
              ]}
              pointerEvents="none"
            >
              <View style={styles.tagAccent}>
                <Text style={styles.tagAccentText}>
                  {t('onboarding_intro.proof.tag_with')}
                </Text>
              </View>
              <View style={styles.tagTail} />
            </Animated.View>
          </>
        ) : null}
      </View>

      <View style={styles.hairline} />
      <Reveal index={1} className="flex-row justify-between px-6 py-3">
        <Text style={styles.axisDim}>{t('home.score_today')}</Text>
        <Text style={styles.axisAccent}>
          {t('onboarding_intro.proof.axis_future')}
        </Text>
      </Reveal>
      <View style={styles.hairline} />

      <View className="flex-1 justify-center px-6 gap-[18px] py-4">
        {BENEFITS.map((b, i) => (
          <Reveal
            key={b.id}
            index={2 + i}
            className="flex-row items-center gap-[14px]"
          >
            <b.Icon />
            <Text style={styles.benefitText} className="flex-1">
              <Text style={styles.benefitLead}>
                {translate(`onboarding_intro.proof.benefit.${b.id}.lead`)}
              </Text>
              {translate(`onboarding_intro.proof.benefit.${b.id}.rest`)}
            </Text>
          </Reveal>
        ))}
      </View>

      <Reveal index={5} className="px-6 items-center">
        {SOCIAL_PROOF ? (
          <>
            <View className="flex-row gap-1">
              {Array.from({ length: SOCIAL_PROOF.stars }, (_, i) => (
                <IconStar key={`star-${i}`} />
              ))}
            </View>
            <Text style={styles.socialText}>{SOCIAL_PROOF.text}</Text>
          </>
        ) : (
          <StudyLine text={t('onboarding_intro.proof.study')} />
        )}
      </Reveal>

      <Reveal index={6} className="gap-2 px-5 pt-5 pb-2.5">
        <Pill label={t('paywall.continue')} kind="gradient" onPress={onNext} />
        <Footnote text={t('onboarding_intro.proof.footnote')} />
      </Reveal>
    </View>
  )
}

// ─── Glyphes de l'écran de preuve ───────────────────────────────────────
// Dessinés ici plutôt que tirés d'`assets/icons.ts` : ils portent le
// dégradé signature et une graisse propre à cet écran.

function IconShield() {
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      <Path
        d="M13 2.4 22 6.1v6.6c0 5.4-3.8 9.3-9 11-5.2-1.7-9-5.6-9-11V6.1Z"
        fill={OB.accentDim}
        stroke={OB.grad[1]}
        strokeWidth={1.7}
        strokeLinejoin="round"
      />
      <Path
        d="M10.6 12.2v-1.8a2.4 2.4 0 0 1 4.8 0v1.8"
        stroke={OB.grad[1]}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />
      <Rect
        x={9.5}
        y={12.1}
        width={7}
        height={5.6}
        rx={1.6}
        fill={OB.grad[1]}
      />
    </Svg>
  )
}

function IconCalendar() {
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      <Rect
        x={3}
        y={5}
        width={20}
        height={18}
        rx={4.5}
        fill={OB.accentDim}
        stroke={OB.grad[1]}
        strokeWidth={1.7}
      />
      <Path
        d="M3.8 10.6h18.4"
        stroke={OB.grad[1]}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
      <Path
        d="M8.6 3.2v3.4M17.4 3.2v3.4"
        stroke={OB.grad[1]}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
      {[9, 13, 17].map(x =>
        [14.6, 18.4].map(y => (
          <Circle key={`${x}-${y}`} cx={x} cy={y} r={1.25} fill={OB.grad[1]} />
        )),
      )}
    </Svg>
  )
}

function IconPeople() {
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      {/* Silhouette d'arrière-plan, en retrait. */}
      <Circle cx={18.6} cy={9.2} r={3.3} fill={OB.grad[1]} opacity={0.45} />
      <Path
        d="M12.4 21.2c0-3.4 2.8-5.6 6.2-5.6s6.2 2.2 6.2 5.6Z"
        fill={OB.grad[1]}
        opacity={0.45}
      />
      {/* Silhouette de premier plan, pleine. */}
      <Circle cx={9.4} cy={8.4} r={4.2} fill={OB.grad[1]} />
      <Path
        d="M1.8 21.6c0-4.2 3.4-6.8 7.6-6.8s7.6 2.6 7.6 6.8Z"
        fill={OB.grad[1]}
      />
    </Svg>
  )
}

function IconPerson() {
  return (
    <Svg width={18} height={18} viewBox="0 0 18 18">
      <Circle cx={9} cy={6.2} r={3.1} fill={OB.ink70} />
      <Path
        d="M2.8 16c0-3.3 2.8-5.4 6.2-5.4s6.2 2.1 6.2 5.4Z"
        fill={OB.ink70}
      />
    </Svg>
  )
}

function IconStar() {
  return (
    <Svg width={17} height={17} viewBox="0 0 20 20">
      <Path
        d="M10 1.6 12.47 6.6 18 7.4l-4 3.9.94 5.5L10 14.2l-4.94 2.6L6 11.3 2 7.4l5.53-.8Z"
        fill="#F5C451"
      />
    </Svg>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  welcome: { flex: 1, backgroundColor: OB.bg },
  welcomeCopy: { paddingHorizontal: 22 },
  welcomeHero: {
    ...fonts.bold,
    fontSize: 31,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: OB.ink,
    textAlign: 'center',
  },
  welcomeHeroAccent: { color: OB.grad[0] },
  welcomeProof: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 22,
    marginTop: 16,
  },
  // `alignSelf` plutôt qu'une largeur : posé dans une rangée centrée, le
  // badge ne prend que sa largeur de texte et reste sur l'axe du titre.
  scienceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 8,
    backgroundColor: OB.accentDim,
    borderRadius: 14,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  scienceBadgeText: {
    ...fonts.medium,
    fontSize: 13,
    color: OB.ink70,
    flexShrink: 1,
  },
  // La cale de l'illustration : elle prend toute la hauteur libre et se
  // comprime avant tout le reste, mais jamais en dessous de quoi rester une
  // image (iPhone SE, titre sur quatre lignes).
  welcomeStage: { flexGrow: 1, flexShrink: 1, minHeight: 190 },
  welcomeHeroArt: { width: '100%', height: '100%' },
  welcomeCta: { paddingHorizontal: 20, paddingTop: 10 },

  ignition: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },

  // Bande de marque du bas : pleine largeur pour centrer le logotype sans
  // dépendre de sa largeur, et hors flux pour ne pas décaler la lune.
  ignitionBrand: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },

  h1: {
    ...fonts.bold,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: -0.8,
    color: OB.ink,
  },
  h1Center: {
    textAlign: 'center',
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
    // Hauteur explicite plutôt que du padding : à 26 pt, la hauteur
    // intrinsèque d'un TextInput iOS rogne l'accent et le jambage du
    // placeholder (« Ton prénom »). Avec une hauteur fixe, la ligne est
    // centrée dans le champ au lieu d'être découpée.
    height: 58,
    paddingVertical: 0,
    textAlignVertical: 'center',
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

  hairline: { height: StyleSheet.hairlineWidth, backgroundColor: OB.hairline },

  proofTitle: {
    ...fonts.bold,
    fontSize: 27,
    lineHeight: 34,
    letterSpacing: -0.7,
    color: OB.ink,
    textAlign: 'center',
  },
  proofTitleAccent: { color: OB.grad[1] },

  tagRow: {
    position: 'absolute',
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tagDim: {
    backgroundColor: '#2A2A31',
    borderRadius: 19,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  tagDimText: { ...fonts.bold, fontSize: 15, color: OB.ink },
  tagAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#2A2A31',
    alignItems: 'center',
    justifyContent: 'center',
  },

  tagAccentWrap: { position: 'absolute', alignItems: 'flex-end' },
  tagAccent: {
    backgroundColor: OB.grad[1],
    borderRadius: 19,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  tagAccentText: { ...fonts.bold, fontSize: 15, color: OB.onAccent },
  tagTail: {
    width: 13,
    height: 13,
    marginTop: -7,
    marginRight: 17,
    borderRadius: 3,
    backgroundColor: OB.grad[1],
    transform: [{ rotate: '45deg' }],
  },

  axisDim: { ...fonts.medium, fontSize: 14, color: OB.ink40 },
  axisAccent: { ...fonts.semiBold, fontSize: 14, color: OB.grad[1] },

  benefitText: {
    ...fonts.regular,
    fontSize: 15.5,
    lineHeight: 21,
    color: OB.ink70,
  },
  benefitLead: { ...fonts.bold, color: OB.ink },

  socialText: {
    ...fonts.bold,
    fontSize: 16,
    color: OB.ink,
    marginTop: 8,
  },
})
