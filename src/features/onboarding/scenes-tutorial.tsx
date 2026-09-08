/**
 * Acte 6 · Tutoriel — les six écrans qui suivent le paywall.
 *
 * Ce n'est pas de la pédagogie décorative : les trois derniers écrans
 * PRODUISENT l'état de départ de l'app. L'utilisateur choisit ses apps dans
 * le vrai sélecteur d'Apple, choisit une règle parmi les préréglages réels,
 * et arrive dans l'app avec ce blocage déjà armé (voir `useActivateFirstRule`).
 *
 * Les démonstrations sont des vidéos en boucle plutôt que des captures
 * fixes : montrer le rituel de respiration et le sélecteur système en
 * mouvement dit en trois secondes ce qu'un paragraphe explique mal.
 *
 * Textes FR en dur, comme le reste de l'onboarding (exception i18n assumée
 * de cet espace narratif). Les cartes de règles font exception : elles
 * réutilisent telles quelles les 12 fiches de `rule-templates.ts`, donc leur
 * copie passe par `t()` — une seule définition de « ce que propose Travail ».
 */
import { IconName } from '@assets/icons'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  Easing,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg'
import { NEW_RULE_PRESET_IDS } from '@/features/blocking/presets'
import {
  buildRuleTemplates,
  type RuleTemplateCard as RuleTemplate,
} from '@/features/blocking/rule-templates'
import { prioritizePlanTemplates } from '@/features/onboarding/services/personalizedPlan'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { ScreenTime } from '@/shared/native/screen-time'
import { fonts } from '@/shared/theme/tokens/fonts'
import { spacing } from '@/shared/theme/tokens/spacing'
import { showErrorToast } from '@/shared/utils/toast'
import { Footnote, GhostLink, Moon, Pill, RedAlert } from './bits'
import { LockAnimation } from './LockAnimation'
import { Reveal } from './motion'
import { OnboardingRuleCard } from './OnboardingRuleCard'
import { PICKER_DEMO_TAUGHT_MS, PickerAnimation } from './PickerAnimation'
import { RuleInfoSheet, type RuleInfoTarget } from './RuleInfoSheet'
import { haptic, OB } from './tokens'

/** Hauteur prise par le titre, le CTA et les marges sûres de l'écran verrouillage. */
const LOCK_SCENE_CHROME = 300
/**
 * Attente imposée sur l'écran de démonstration du sélecteur. Elle SUIT la
 * chronologie de `PickerAnimation` au lieu de la recopier : accélérer la
 * boucle raccourcit le verrou du même coup, sans re-calage manuel.
 */
const PICKER_UNLOCK_MS = PICKER_DEMO_TAUGHT_MS

/** Proportion de l'appareil dessiné par `LockAnimation` (partiel, bas effacé). */
const LOCK_PHONE_RATIO = 1.42

/** Nombre de préréglages proposés à la fin — assez pour choisir, pas pour hésiter. */
const RULES_SHOWN = 8

/**
 * Deux règles cochées d'entrée : un écran qui n'attend qu'un geste laisse
 * croire qu'il n'y a rien à faire, et un onboarding qui se termine sur zéro
 * protection a échoué. Ce sont les deux premières du carrousel — il n'a rien
 * à chercher pour comprendre ce que « sélectionné » veut dire.
 */
export const DEFAULT_RULE_PRESET_IDS: string[] = [
  NEW_RULE_PRESET_IDS.work,
  NEW_RULE_PRESET_IDS.focus,
]

// ─── Gabarits partagés ───────────────────────────────────────────────────

/**
 * Gabarit des écrans du tutoriel : titre centré, sous-titre, une scène
 * visuelle qui prend toute la place restante, un CTA en bas. C'est le rythme
 * des six écrans — la constance vaut mieux que six mises en page.
 */
function TutorialScene({
  title,
  sub,
  badge,
  children,
  footer,
}: {
  title: string
  sub?: string
  badge?: string
  children: React.ReactNode
  footer: React.ReactNode
}) {
  return (
    <View style={styles.scene}>
      <View style={styles.header}>
        {badge ? (
          <Reveal index={0}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          </Reveal>
        ) : null}
        <Reveal index={badge ? 1 : 0}>
          <Text style={styles.title}>{title}</Text>
        </Reveal>
        {sub ? (
          <Reveal index={badge ? 2 : 1}>
            <Text style={styles.sub}>{sub}</Text>
          </Reveal>
        ) : null}
      </View>
      <View style={styles.stage}>{children}</View>
      <Reveal index={3} style={styles.footer}>
        {footer}
      </Reveal>
    </View>
  )
}

/**
 * Cadre de téléphone : la maquette doit se lire comme « un écran de l'app »,
 * pas comme une image collée dans la page. Le ratio suit celui des captures
 * (2.17), et le contenu est rogné dedans plutôt qu'étiré.
 */
function PhoneFrame({
  width,
  children,
}: {
  width: number
  children: React.ReactNode
}) {
  return (
    <View
      style={[
        styles.phone,
        {
          width,
          height: width * PHONE_RATIO,
          borderRadius: width * 0.155,
        },
      ]}
    >
      <View
        style={[styles.phoneScreen, { borderRadius: width * 0.155 - 4 }]}
        // Purement illustratif : rien n'est cliquable dans le cadre.
        pointerEvents="none"
      >
        {children}
      </View>
    </View>
  )
}

const PHONE_RATIO = 2.17

/** Largeur du cadre téléphone : la scène disponible commande, jamais l'inverse. */
function usePhoneWidth(maxHeightRatio = 1) {
  const { width, height } = useWindowDimensions()
  return useMemo(() => {
    const byWidth = width * 0.62
    const byHeight = (height * 0.46 * maxHeightRatio) / PHONE_RATIO
    return Math.round(Math.min(byWidth, byHeight))
  }, [width, height, maxHeightRatio])
}

// ─── 1 · Les règles de base ──────────────────────────────────────────────

/** Respiration entre le paywall et le tutoriel : la lune, une phrase, rien d'autre. */
export function SceneGroundRules({ onNext }: { onNext: () => void }) {
  const t = useT()
  // `OnboardingFlow` pose la scène dans un conteneur à `paddingTop`. Sans ce
  // débord, le dégradé démarrerait SOUS la status bar : couture nette entre le
  // noir uni du haut et le violet du ciel (même piège que `HaloBackdrop`).
  const insets = useSafeAreaInsets()
  const overscan = insets.top + 6
  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        key: `t${i}`,
        x: (i * 137.5) % 100,
        y: ((i * 61.8) % 92) + 3,
        r: 0.6 + ((i * 7) % 10) / 9,
        o: 0.2 + ((i * 13) % 10) / 24,
      })),
    [],
  )

  return (
    <View style={styles.ground}>
      <Svg
        style={[StyleSheet.absoluteFill, { top: -overscan }]}
        width="100%"
        height="100%"
      >
        <Defs>
          <LinearGradient id="tutoSky" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor="#0E0B1E" />
            <Stop offset="100%" stopColor="#050507" />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#tutoSky)" />
        {stars.map(s => (
          <Circle
            key={s.key}
            cx={`${s.x}%`}
            cy={`${s.y}%`}
            r={s.r}
            fill="#FFFFFF"
            opacity={s.o}
          />
        ))}
      </Svg>
      <View style={styles.groundContent}>
        <View style={styles.groundCenter}>
          <Reveal index={0}>
            <Moon size={168} glow />
          </Reveal>
          <Reveal index={2}>
            <Text style={styles.groundTitle}>
              {t('onboarding_tutorial.ground.title')}
            </Text>
          </Reveal>
        </View>
        <Reveal index={3} style={styles.footer}>
          <Pill label={t('paywall.continue')} onPress={onNext} />
        </Reveal>
      </View>
    </View>
  )
}

// ─── 2 · Ce que fait une règle ───────────────────────────────────────────

/**
 * La démonstration du blocage programmé, dessinée et animée en JS — pas une
 * vidéo : une capture pèse des mégaoctets, met du temps à s'amorcer, et fige
 * un rendu qui ne suivra jamais un futur changement de palette.
 */
export function SceneLockDemo({ onNext }: { onNext: () => void }) {
  const t = useT()
  // Cet appareil-là n'est pas rogné au ratio d'un vrai iPhone : on n'en montre
  // que le haut (le bas s'efface). On dimensionne donc sur la hauteur
  // réellement libre, pas sur le ratio d'un cadre complet.
  const { width: screenW, height: screenH } = useWindowDimensions()
  const width = Math.round(
    Math.min(screenW * 0.74, (screenH - LOCK_SCENE_CHROME) / LOCK_PHONE_RATIO),
  )

  return (
    <TutorialScene
      title={t('onboarding_tutorial.lock.title')}
      footer={<Pill label={t('paywall.continue')} onPress={onNext} />}
    >
      <Reveal index={2}>
        <LockAnimation width={width} />
      </Reveal>
    </TutorialScene>
  )
}

// ─── 3 · Le Hard Mode ────────────────────────────────────────────────────

/**
 * Une VITRINE, pas un réglage. Cet écran annonce que le Hard Mode existe dans
 * l'app ; il ne l'active pas, et n'écrit rien dans les règles créées à la fin
 * du parcours (elles restent non strictes — voir `useActivateFirstRule`).
 *
 * ⚠️ NE PAS y remettre de contrôle manipulable — ni `Switch`, ni carte de
 * choix, ni `Pressable`. Un interrupteur qu'on peut basculer ici fait croire
 * qu'on allume la fonctionnalité pour toute l'app, alors que le Hard Mode se
 * décide blocage par blocage, plus tard, au moment de créer le blocage. C'est
 * exactement l'ambiguïté que cet écran a causée en production.
 *
 * L'interrupteur dessiné ci-dessous est donc en Views pures, figé en position
 * allumée : rien à toucher, rien qui réponde au doigt. Trois garde-fous le
 * disent au lieu d'un seul — le badge « DANS L'APP » en tête d'écran, la
 * maquette de téléphone qui pose la scène ailleurs qu'ici, et la note de bas
 * d'écran qui dit où et quand il s'active vraiment.
 */
export function SceneHardMode({ onNext }: { onNext: () => void }) {
  const t = useT()
  const width = usePhoneWidth()

  return (
    <TutorialScene
      badge={t('onboarding_tutorial.hard.badge')}
      title={t('onboarding_tutorial.hard.title')}
      sub={t('onboarding_tutorial.hard.sub')}
      footer={
        <>
          <Pill label={t('paywall.continue')} onPress={onNext} />
          <Footnote text={t('onboarding_tutorial.hard.footnote')} />
        </>
      }
    >
      <Reveal index={2}>
        {/* Une image, pas une interface : le lecteur d'écran ne doit pas
            annoncer un interrupteur que personne ne peut actionner. */}
        <View
          style={{ width, height: width * PHONE_RATIO }}
          accessible={false}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
          pointerEvents="none"
        >
          <PhoneFrame width={width}>
            <View style={styles.mockList}>
              {[1, 0.72, 0.5, 0.32].map(o => (
                <View
                  key={`row-${o}`}
                  style={[styles.mockRow, { opacity: o }]}
                />
              ))}
            </View>
          </PhoneFrame>
          {/* Posée par-dessus le cadre, à cheval sur ses bords : c'est le
              réglage qui compte, pas le décor derrière. */}
          <View style={styles.hardModeBar}>
            <Text style={styles.hardModeLabel}>
              {t('onboarding_tutorial.hard.switch')}
            </Text>
            {/* Interrupteur DESSINÉ, jamais un `Switch` : un vrai composant
                reste focusable et basculable au lecteur d'écran même
                `disabled`, et `disabled` le grise — ce qui donnerait une
                fonctionnalité qui a l'air cassée. */}
            <View style={styles.fauxSwitch}>
              <View style={styles.fauxSwitchKnob} />
            </View>
          </View>
        </View>
      </Reveal>
    </TutorialScene>
  )
}

// ─── 4 · La démo du sélecteur ────────────────────────────────────────────

/**
 * Passage obligé AVANT le vrai sélecteur : personne ne devine seul qu'il faut
 * déplier une catégorie pour atteindre les apps, et découvrir ça dans la
 * feuille d'Apple — qu'on ne contrôle pas — c'est l'abandon assuré.
 *
 * Le même écran ressert d'aide facultative depuis la sélection (« Voir
 * comment faire ») ; seul le libellé du bouton change, d'où `cta`. La
 * démonstration ne modifie jamais la sélection enregistrée par Apple.
 */
export function ScenePickerDemo({
  onNext,
  cta,
}: {
  onNext: () => void
  /** Libellé une fois la démonstration vue — la suite diffère selon l'appelant. */
  cta?: string
}) {
  const t = useT()
  const { width } = useWindowDimensions()
  const reduceMotion = useReducedMotion()
  const [ready, setReady] = useState(false)
  const gate = useSharedValue(0)

  // Passage OBLIGÉ : sans ce verrou, l'écran se saute en une demi-seconde et
  // l'utilisateur ouvre le vrai sélecteur d'Apple sans avoir vu qu'il faut
  // déplier une catégorie — c'est précisément là qu'il se bloque.
  //
  // On déverrouille dès la seconde coche : le repli qui suit n'apprend plus
  // rien, et chaque seconde d'attente en plus se paie en abandons.
  useEffect(() => {
    if (reduceMotion) {
      // Illustration figée : rien à regarder, donc rien à imposer.
      gate.value = 1
      setReady(true)
      return
    }
    gate.value = withTiming(1, {
      duration: PICKER_UNLOCK_MS,
      easing: Easing.linear,
    })
    const timer = setTimeout(() => setReady(true), PICKER_UNLOCK_MS)
    return () => clearTimeout(timer)
  }, [gate, reduceMotion])

  return (
    <TutorialScene
      title={t('onboarding_tutorial.picker_demo.title')}
      sub={t('onboarding_tutorial.picker_demo.sub')}
      footer={
        <Pill
          label={
            ready
              ? (cta ?? t('onboarding_tutorial.picker_demo.understood'))
              : t('onboarding_tutorial.picker_demo.watch')
          }
          onPress={onNext}
          disabled={!ready}
          progress={gate}
        />
      }
    >
      <Reveal index={2}>
        <PickerAnimation width={Math.min(width - 40, 380)} />
      </Reveal>
    </TutorialScene>
  )
}

// ─── 5 · Le vrai sélecteur ───────────────────────────────────────────────

/**
 * Le seul passage obligé du tutoriel. Sans sélection, il n'y a rien à
 * bloquer : on refuse d'avancer, et on renvoie vers la démo plutôt que de
 * répéter la même consigne — s'il n'a rien choisi, c'est souvent qu'il n'a
 * pas compris l'écran système, pas qu'il a changé d'avis.
 *
 * La feuille d'Apple s'ouvre D'ELLE-MÊME à l'arrivée. La carte « + » qui la
 * précédait n'annonçait que ce qui vient d'être montré à l'écran d'avant, au
 * prix d'un tap de plus avant le seul geste de l'écran.
 */
export function ScenePickApps({
  count,
  onCount,
  onNext,
}: {
  count: number
  onCount: (n: number) => void
  onNext: () => void
}) {
  const t = useT()
  const [busy, setBusy] = useState(false)
  const [emptyTry, setEmptyTry] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const pickerOpen = useRef(false)

  const pick = useCallback(async () => {
    if (pickerOpen.current) return
    pickerOpen.current = true
    setBusy(true)
    try {
      if (!ScreenTime.isAvailable) {
        // Android / build sans le module : il n'y a pas de sélecteur système,
        // donc rien à exiger. Bloquer ici enfermerait dans l'onboarding pour
        // une étape que la plateforme ne peut pas rendre.
        onNext()
        return
      }
      const { count: picked } = await ScreenTime.presentPicker()
      onCount(picked)
      if (picked > 0) {
        haptic.success()
        setEmptyTry(false)
      } else {
        setEmptyTry(true)
      }
    } catch (e) {
      showErrorToast(e)
    } finally {
      pickerOpen.current = false
      setBusy(false)
    }
  }, [onCount, onNext])

  // UNE seule fois : s'il ferme la feuille sans rien choisir, la relancer
  // dans son dos l'enfermerait dans un sélecteur qu'il ne peut plus quitter.
  // Sans module natif (Android, build sans Family Controls), il n'y a aucune
  // feuille à ouvrir — on laisse l'écran et son bouton faire le passage.
  const autoOpened = useRef(false)
  useEffect(() => {
    if (autoOpened.current || !ScreenTime.isAvailable) return
    autoOpened.current = true
    void pick()
  }, [pick])

  const picked = count > 0

  if (showHelp) {
    return <ScenePickerDemo onNext={() => setShowHelp(false)} />
  }

  return (
    <TutorialScene
      title={t('onboarding_tutorial.pick_apps.title')}
      sub={t('onboarding_tutorial.pick_apps.sub')}
      footer={
        <>
          <Pill
            label={
              picked
                ? t('paywall.continue')
                : t('onboarding_tutorial.pick_apps.open_picker')
            }
            onPress={picked ? onNext : pick}
            disabled={busy}
          />
          <View style={{ paddingVertical: spacing.sm }}>
            <GhostLink
              label={t('onboarding_tutorial.pick_apps.how_to')}
              onPress={() => {
                if (!pickerOpen.current) setShowHelp(true)
              }}
              accent
            />
          </View>
        </>
      }
    >
      <View style={styles.pickStage}>
        {/* Rien à inviter tant que la feuille est ouverte ou qu'elle n'a rien
            rendu : la scène ne montre QUE le résultat du geste. */}
        {picked ? (
          <Reveal index={2}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('onboarding_tutorial.pick_apps.selected', { count })}. ${t('onboarding_tutorial.pick_apps.edit_selection')}`}
              onPress={pick}
              disabled={busy}
              style={[styles.pickCard, styles.pickCardDone]}
            >
              <View style={[styles.pickIcon, styles.pickIconDone]}>
                <IconSvg name={IconName.CHECK} size={26} color={OB.onAccent} />
              </View>
              <Text style={styles.pickCount}>
                {t('onboarding_tutorial.pick_apps.selected', { count })}
              </Text>
              <Text style={styles.pickHint}>{t('add_rule.tap_to_edit')}</Text>
            </Pressable>
          </Reveal>
        ) : busy ? (
          <ActivityIndicator color={OB.accent} />
        ) : emptyTry ? (
          <View style={styles.pickAlert}>
            <RedAlert text={t('onboarding_tutorial.pick_apps.empty')} />
          </View>
        ) : null}
      </View>
    </TutorialScene>
  )
}

// ─── 6 · Les règles proposées ────────────────────────────────────────────

/**
 * Les VRAIES fiches de préréglages de l'app (`rule-templates.ts`), pas des
 * illustrations : ce qu'il choisit ici est exactement ce qu'il retrouvera
 * dans l'onglet Blocages une minute plus tard.
 *
 * ⚠️ Défaut de naissance corrigé ici, à ne pas réintroduire : l'écran
 * demandait de choisir des règles sans jamais redire sur QUOI elles
 * porteraient. Les apps ont été cochées deux écrans plus tôt, dans le
 * sélecteur d'Apple, et plus rien ne les mentionnait — les testeurs lisaient
 * huit vignettes décoratives sans savoir ce qu'elles allaient bloquer. Trois
 * rappels y répondent, à trois distances de lecture : le sous-titre compte
 * les apps, chaque carte porte leurs icônes RÉELLES, et le « ? » de la carte
 * ouvre l'explication complète de cette règle-là.
 */
export function SceneRules({
  name,
  recommendedIds,
  selectedIds,
  onToggle,
  busy,
  onActivate,
  appCount,
}: {
  name: string
  recommendedIds: string[]
  selectedIds: string[]
  onToggle: (template: RuleTemplate) => void
  busy: boolean
  onActivate: () => void
  /** Éléments rendus par le sélecteur d'Apple à l'écran précédent. */
  appCount: number
}) {
  const t = useT()
  const { width } = useWindowDimensions()
  const [info, setInfo] = useState<RuleInfoTarget | null>(null)
  // Résolues UNE fois pour les huit cartes : la sélection est la même pour
  // toutes — `bindSelection` la recopiera telle quelle dans chaque règle — donc
  // huit interrogations du natif rendraient huit fois la même liste.
  const [appKeys, setAppKeys] = useState<string[]>([])

  useEffect(() => {
    // Sélection vide (Android, sélecteur passé, apps décochées au retour) :
    // rien à résoudre, et on RETIRE les vignettes précédentes — des icônes
    // survivantes affirmeraient un blocage que plus rien ne porte.
    if (!ScreenTime.isAvailable || appCount === 0) {
      setAppKeys([])
      return
    }
    let cancelled = false
    ScreenTime.draftAppKeys()
      .then(keys => {
        if (!cancelled) setAppKeys(keys)
      })
      .catch(() => {
        // Sélection illisible : les cartes restent sans vignette plutôt que de
        // montrer une icône devinée. Le sous-titre garde le compte, qui lui
        // vient du sélecteur.
      })
    return () => {
      cancelled = true
    }
    // `appCount` bouge quand il revient modifier sa sélection : c'est le seul
    // signal disponible pour recharger les jetons.
  }, [appCount])
  const templates = useMemo(
    () =>
      prioritizePlanTemplates(
        buildRuleTemplates(t),
        recommendedIds,
        RULES_SHOWN,
      ),
    [t, recommendedIds],
  )

  // Carte volontairement plus large que haute : en `cover`, une carte étroite
  // et haute ne montrait qu'une bande verticale centrale de photos en 3:2 —
  // « tronquées ». À 298×255 le recadrage ne mange plus que les bords.
  const cardWidth = Math.round(width * 0.76)
  const gap = 14
  const sidePad = Math.round((width - cardWidth) / 2)
  const count = selectedIds.length
  // Le sous-titre porte à lui seul le lien entre les deux écrans : c'est la
  // première chose lue, avant même que les vignettes ne soient remarquées.
  // Sans sélection connue (Android, sélecteur passé), on ne bluffe pas un
  // nombre — la phrase reste vraie, simplement moins précise.
  const appsLabel =
    appCount > 0
      ? t('onboarding_tutorial.rules.applies_to', { count: appCount })
      : t('onboarding_tutorial.rules.applies_future')
  const sub =
    appCount > 0
      ? t('onboarding_tutorial.rules.sub', { count: appCount })
      : t('onboarding_tutorial.rules.sub_generic')
  // Les vignettes ne couvrent que les apps : une catégorie ou un domaine web
  // cochés n'ont pas d'icône propre et se replient sur le « +N », pour que le
  // total montré colle à celui annoncé par le sélecteur.
  const appOthers = Math.max(0, appCount - appKeys.length)

  return (
    <TutorialScene
      title={
        name
          ? t('onboarding_tutorial.rules.title_named', { name })
          : t('onboarding_tutorial.rules.title')
      }
      sub={sub}
      footer={
        <>
          <Pill
            label={
              busy
                ? t('onboarding_tutorial.rules.activating')
                : t('onboarding_tutorial.rules.activate', { count })
            }
            onPress={onActivate}
            disabled={count === 0 || busy}
          />
          <Footnote text={t('onboarding_tutorial.rules.footnote', { count })} />
        </>
      }
    >
      <View style={styles.railStage}>
        <ScrollView
          horizontal
          decelerationRate="fast"
          snapToInterval={cardWidth + gap}
          snapToAlignment="start"
          disableIntervalMomentum
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: sidePad, gap }}
        >
          {templates.map(template => (
            <View
              key={template.id}
              style={[styles.railSlot, { width: cardWidth }]}
            >
              <OnboardingRuleCard
                image={template.image}
                kind={template.kind}
                time={template.time}
                title={template.title}
                description={template.description}
                selected={selectedIds.includes(template.presetId)}
                onToggle={() => {
                  haptic.select()
                  onToggle(template)
                }}
                appKeys={appKeys}
                appOthers={appOthers}
                appsLabel={appsLabel}
                onInfo={() =>
                  setInfo({
                    presetId: template.presetId,
                    title: template.title,
                  })
                }
              />
            </View>
          ))}
        </ScrollView>
      </View>
      {/*
        Une seule feuille pour les huit cartes : huit `Modal` montés en
        parallèle pour n'en ouvrir qu'un coûtent huit vues natives, et
        `RuleInfoSheet` lit de toute façon la règle dans `info`.
      */}
      <RuleInfoSheet
        target={info}
        onClose={() => setInfo(null)}
        appKeys={appKeys}
        appCount={appCount}
      />
    </TutorialScene>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scene: { flex: 1, paddingHorizontal: 20 },
  header: { paddingTop: 18, alignItems: 'center' },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { gap: 10, paddingBottom: 10 },

  title: {
    ...fonts.bold,
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -0.6,
    color: OB.ink,
    textAlign: 'center',
  },
  sub: {
    ...fonts.regular,
    fontSize: 15,
    lineHeight: 21,
    color: OB.ink55,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 6,
  },
  badge: {
    alignSelf: 'center',
    borderWidth: 1.2,
    borderColor: OB.accent,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 14,
  },
  badgeText: {
    ...fonts.bold,
    fontSize: 11,
    letterSpacing: 1.1,
    color: OB.accent,
  },

  // Pas de padding ici : le ciel est un enfant `absoluteFill` direct de
  // `ground` — en RN un padding sur ce parent resserre l'enfant absolu, ce qui
  // laissait une bande noire à droite. Le padding vit dans `groundContent`.
  ground: { flex: 1 },
  groundContent: { flex: 1, paddingHorizontal: 20 },
  groundCenter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  groundTitle: {
    ...fonts.bold,
    fontSize: 27,
    lineHeight: 34,
    letterSpacing: -0.6,
    color: OB.ink,
    textAlign: 'center',
    marginTop: 40,
  },

  phone: {
    borderWidth: 4,
    borderColor: '#1B1B1F',
    backgroundColor: '#000000',
    overflow: 'hidden',
  },
  phoneScreen: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: '#0A0A0C',
  },

  mockList: { flex: 1, padding: 14, gap: 12, justifyContent: 'center' },
  mockRow: {
    height: 64,
    borderRadius: 18,
    backgroundColor: 'rgba(164,154,254,0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  hardModeBar: {
    position: 'absolute',
    left: -18,
    right: -18,
    top: '52%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: 'rgba(28,28,32,0.94)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  hardModeLabel: { ...fonts.semiBold, fontSize: 18, color: OB.ink },
  // Cotes de l'interrupteur iOS (51×31, pastille de 27) : le dessin doit
  // passer pour le vrai, sinon la vitrine ne montre pas ce qu'elle promet.
  fauxSwitch: {
    width: 51,
    height: 31,
    borderRadius: 999,
    backgroundColor: OB.accent,
    padding: 2,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  fauxSwitchKnob: {
    width: 27,
    height: 27,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
  },

  pickStage: { alignItems: 'center', gap: 18, alignSelf: 'stretch' },
  pickCard: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 34,
    paddingHorizontal: 28,
    borderRadius: 26,
    backgroundColor: OB.card,
    borderWidth: 1.4,
    borderColor: OB.hairline,
    minWidth: 260,
  },
  pickCardDone: { borderColor: OB.accent, backgroundColor: '#191721' },
  pickIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: OB.accentDim,
    marginBottom: 6,
  },
  pickIconDone: { backgroundColor: OB.accent },
  pickCount: { ...fonts.semiBold, fontSize: 16, color: OB.ink },
  pickHint: {
    ...fonts.regular,
    fontSize: 13,
    color: OB.ink55,
    textAlign: 'center',
  },
  pickAlert: { alignSelf: 'stretch' },

  railStage: { alignSelf: 'stretch', marginHorizontal: -20 },
  railSlot: { height: 255 },
})
