import { IconName } from '@assets/icons'
import React, { useEffect, useMemo, useState } from 'react'
import {
  AppState,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native'
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { GradientLine, Pill } from '@/features/onboarding/bits'
import { ANTI_SCROLL_PLAN } from '@/features/onboarding/services/antiScrollPlan'
import { recoveryGoal } from '@/features/onboarding/services/recoveryGoal'
import {
  haptic,
  OB,
  PERSONALIZED_PLAN as PLAN,
  PLAN_SUMMARY as SUM,
} from '@/features/onboarding/tokens'
import type { PersonalizedPlan } from '@/features/onboarding/types/personalizedPlan'
import { translate } from '@/i18n/translate'
import { useT } from '@/i18n/useT'
import { IconSvg } from '@/shared/components/ui/IconSvg'
import { fonts } from '@/shared/theme/tokens/fonts'
import { relockMaterial } from '@/shared/theme/tokens/relock-material'

const ACTION_ICONS = {
  block: IconName.LOCK,
  pause: IconName.CLOCK,
  progress: IconName.CHART,
}

/** Un temps de lecture par bloc — c'est lui qui déverrouille le CTA. */
const BEATS = PLAN.readingDelays.length

/** Ce que le CTA engage vraiment : rien n'est encore bloqué à cette étape. */
const nextStep = () => translate('onboarding_plan_summary.next_step')

/**
 * « Ton plan est prêt » — la récompense du diagnostic.
 *
 * Deux règles de conception, non négociables :
 *
 * 1. AUCUN SCROLL. Tout tient dans un écran, sur tous les iPhone supportés :
 *    la composition est dessinée pour la référence de `PLAN_SUMMARY` puis
 *    remise à l'échelle de la hauteur réellement disponible, et chaque texte
 *    de longueur variable (l'écho des réponses, la note finale) est borné en
 *    nombre de lignes. Un écran qui demande de faire défiler pour découvrir sa
 *    propre conclusion se lit comme un formulaire, pas comme un verdict.
 * 2. LE CTA EST VISIBLE DÈS LA PREMIÈRE SECONDE, désactivé, avec sa jauge de
 *    remplissage : le temps d'attente est ainsi expliqué. Un bouton éteint
 *    sans explication se lit comme une panne — et un bouton qui apparaît d'un
 *    coup à la fin fait sursauter.
 *
 * La hiérarchie suit l'arc du diagnostic : ce que tu as dit (tes mots, au
 * liseré) → ce que tu récupères (le chiffre, en dégradé signature) → comment
 * (trois réflexes) → pourquoi ça tient cette fois.
 */
export function ScenePersonalizedPlan({
  plan,
  onNext,
}: {
  plan: PersonalizedPlan
  onNext: () => void
}) {
  const t = useT()
  const goal = recoveryGoal(plan.hours)
  const { height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  // La scène ne reçoit pas l'écran, mais l'écran MOINS les encoches et les
  // marges posées par `OnboardingFlow` : c'est cette hauteur-là qui décide de
  // la densité. La mesurer par `onLayout` provoquerait un ressaut à la
  // première image ; ici le calcul est exact dès le premier rendu.
  const layout = usePlanLayout(height - insets.top - insets.bottom - SUM.chrome)
  const styles = layout.styles
  const [stage, setStage] = useState(0)
  const [active, setActive] = useState(
    AppState.currentState !== 'background' &&
      AppState.currentState !== 'inactive',
  )
  const revealed = stage === BEATS
  const progress = useSharedValue(0)

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state =>
      setActive(state === 'active'),
    )
    return () => subscription.remove()
  }, [])
  useEffect(() => {
    if (!active || revealed) return
    const timer = setTimeout(
      () => setStage(value => value + 1),
      PLAN.readingDelays[stage],
    )
    return () => clearTimeout(timer)
  }, [active, revealed, stage])
  // La jauge du CTA avance bloc par bloc, exactement au rythme des textes :
  // elle s'arrête donc d'elle-même quand l'app passe en arrière-plan, comme
  // la révélation. Sans ce gel, on revenait sur une jauge pleine et un bouton
  // toujours verrouillé.
  useEffect(() => {
    if (revealed) {
      progress.value = 1
      return
    }
    if (!active) {
      cancelAnimation(progress)
      return
    }
    progress.value = withTiming((stage + 1) / BEATS, {
      duration: PLAN.readingDelays[stage],
      easing: Easing.linear,
    })
  }, [active, revealed, stage, progress])
  useEffect(() => {
    if (revealed) haptic.success()
  }, [revealed])

  return (
    <View style={styles.screen} testID="onboarding-personalized-plan">
      <View style={styles.column}>
        <View style={styles.stack}>
          <PlanBeat visible={stage >= 1} testID="plan-title">
            <View style={styles.heading}>
              <View
                style={styles.badge}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              >
                <IconSvg
                  name={IconName.CHECK}
                  size={layout.badgeIcon}
                  color={OB.accent}
                />
              </View>
              <Text
                accessibilityRole="header"
                style={styles.title}
                maxFontSizeMultiplier={SUM.maxFontScale}
              >
                Ton plan anti-scroll{'\n'}est prêt.
              </Text>
            </View>
          </PlanBeat>

          {/* Le plan ne se contente pas d'être personnalisé : il le PROUVE, en
              rendant à l'utilisateur ses propres réponses avant d'annoncer quoi
              que ce soit. Une seule coulée de texte au liseré, et non trois
              lignes empilées dans une carte : les phrases s'enchaînent sans
              gaspiller de demi-lignes, et l'alignement à gauche — seul de
              l'écran — signale que c'est SA voix, pas celle de l'app. */}
          <PlanBeat visible={stage >= 2} testID="plan-echo">
            <View style={styles.quote}>
              <View style={styles.quoteRule} />
              <View style={styles.quoteBody}>
                <Text
                  style={styles.eyebrow}
                  maxFontSizeMultiplier={SUM.maxFontScale}
                >
                  {t('onboarding_plan_summary.what_you_said')}
                </Text>
                <Text
                  style={styles.echo}
                  numberOfLines={SUM.echoLines}
                  maxFontSizeMultiplier={SUM.maxFontScale}
                >
                  {plan.recap}
                  {plan.feeling ? ` ${plan.feeling}` : ''}
                  {plan.loss ? (
                    <Text style={styles.echoLoss}> {plan.loss}</Text>
                  ) : null}
                </Text>
              </View>
            </View>
          </PlanBeat>

          <PlanBeat visible={stage >= 3} testID="plan-goal">
            <View style={styles.card}>
              <Text
                style={styles.cardEyebrow}
                maxFontSizeMultiplier={SUM.maxFontScale}
              >
                {t('onboarding_plan_summary.annual_goal')}
              </Text>
              {/* Le dégradé signature est réservé aux héros : sur cet écran,
                  le héros est ce chiffre-là. */}
              <View style={styles.hero}>
                <GradientLine
                  text={t('onboarding_plan_summary.days', {
                    count: goal.days,
                  })}
                  size={layout.goalSize}
                />
              </View>
              <Text
                style={styles.goalSummary}
                numberOfLines={SUM.goalSummaryLines}
                maxFontSizeMultiplier={SUM.maxFontScale}
              >
                {t('onboarding_plan_summary.for', {
                  what:
                    plan.aspirationSummary ??
                    t('onboarding_plan_summary.yourself'),
                })}
              </Text>
              <Text
                style={styles.cardNote}
                maxFontSizeMultiplier={SUM.maxFontScale}
              >
                {t('onboarding_plan_summary.less_per_day', {
                  time: goal.dailyTime,
                })}
                {'\n'}
                {goal.exceedsUsage
                  ? t('onboarding_plan_summary.cap_generic')
                  : t('onboarding_plan_summary.cap_goal')}
              </Text>
            </View>
          </PlanBeat>

          <PlanBeat visible={stage >= 4} testID="plan-method">
            <View style={styles.methods}>
              {ANTI_SCROLL_PLAN.map(action => (
                <View
                  key={action.id}
                  style={styles.method}
                  accessible
                  accessibilityLabel={translate(
                    `onboarding_plan_actions.${action.id}.title`,
                  )}
                >
                  <View
                    style={styles.tile}
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                  >
                    <IconSvg
                      name={ACTION_ICONS[action.id]}
                      size={layout.tileIcon}
                      color={OB.accent}
                    />
                  </View>
                  <Text
                    style={styles.methodLabel}
                    numberOfLines={2}
                    maxFontSizeMultiplier={SUM.maxFontScale}
                  >
                    {translate(`onboarding_plan_actions.${action.id}.title`)}
                  </Text>
                </View>
              ))}
            </View>
          </PlanBeat>

          <PlanBeat visible={stage >= 5} testID="plan-note">
            <Text
              style={styles.footnote}
              numberOfLines={SUM.footnoteLines}
              maxFontSizeMultiplier={SUM.maxFontScale}
            >
              {plan.defense ? `${plan.defense} ` : ''}
              {nextStep()}
            </Text>
          </PlanBeat>
        </View>

        <View style={styles.footer}>
          <Pill
            label={t('onboarding_plan_summary.cta')}
            disabled={!revealed}
            glow={revealed}
            progress={progress}
            // Garde explicite en plus du `disabled` de la pilule : le verrou
            // du CTA est une règle de cet écran, pas un effet de bord du
            // composant de bouton.
            onPress={() => {
              if (revealed) onNext()
            }}
          />
        </View>
      </View>
    </View>
  )
}

function PlanBeat({
  visible,
  testID,
  children,
}: {
  visible: boolean
  testID: string
  children: React.ReactNode
}) {
  const reducedMotion = useReducedMotion()
  const progress = useSharedValue(0)
  useEffect(() => {
    progress.value = withTiming(visible ? 1 : 0, {
      duration: reducedMotion ? 0 : PLAN.revealDuration,
      easing: Easing.out(Easing.cubic),
    })
  }, [visible, reducedMotion, progress])
  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { translateY: reducedMotion ? 0 : (1 - progress.value) * REVEAL_RISE },
    ],
  }))
  return (
    <Animated.View
      testID={testID}
      style={style}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    >
      {children}
    </Animated.View>
  )
}

/** Le bloc monte de si peu qu'il ne déplace jamais ses voisins. */
const REVEAL_RISE = 12

/**
 * La maquette de `PLAN_SUMMARY`, remise à l'échelle de la hauteur réellement
 * offerte à la scène. Tous les blocs sont montés dès le premier rendu (seule
 * leur opacité est animée) : la mise en page est donc figée d'emblée, et
 * connaître la hauteur disponible suffit à garantir qu'elle tient.
 */
function usePlanLayout(available: number) {
  return useMemo(() => {
    const scale = Math.min(
      SUM.maxScale,
      Math.max(SUM.minScale, available / SUM.referenceHeight),
    )
    /** Arrondi au demi-point : le rendu reste net sur les écrans @2x et @3x. */
    const v = (n: number) => Math.round(n * scale * 2) / 2
    return {
      badgeIcon: v(SUM.badgeIconSize),
      tileIcon: v(SUM.tileIconSize),
      goalSize: v(SUM.goalSize),
      styles: StyleSheet.create({
        screen: {
          flex: 1,
          paddingHorizontal: v(SUM.screenPaddingH),
          paddingTop: v(SUM.screenPaddingTop),
        },
        column: {
          flex: 1,
          width: '100%',
          maxWidth: SUM.maxWidth,
          alignSelf: 'center',
        },
        // Le surplus de hauteur d'un grand écran se répartit au-dessus et
        // au-dessous du bloc, jamais entre les sections : les écarts internes
        // portent le rythme de la composition et restent constants.
        stack: { flex: 1, justifyContent: 'center', gap: v(SUM.gap) },
        heading: { alignItems: 'center', gap: v(SUM.headingGap) },
        badge: {
          width: v(SUM.badgeSize),
          height: v(SUM.badgeSize),
          borderRadius: relockMaterial.radius.capsule,
          backgroundColor: OB.accentDim,
          alignItems: 'center',
          justifyContent: 'center',
        },
        title: {
          ...fonts.bold,
          fontSize: v(SUM.titleSize),
          lineHeight: v(SUM.titleLineHeight),
          letterSpacing: -0.4,
          color: OB.ink,
          textAlign: 'center',
        },
        quote: { flexDirection: 'row', gap: v(SUM.quoteGap) },
        quoteRule: {
          width: v(SUM.quoteRuleWidth),
          borderRadius: v(SUM.quoteRuleWidth) / 2,
          backgroundColor: OB.accent,
          opacity: 0.7,
        },
        quoteBody: { flex: 1, gap: v(SUM.echoGap) },
        eyebrow: {
          ...fonts.semiBold,
          fontSize: v(SUM.eyebrowSize),
          lineHeight: v(SUM.eyebrowLineHeight),
          letterSpacing: SUM.eyebrowTracking,
          textTransform: 'uppercase',
          color: OB.ink40,
        },
        echo: {
          ...fonts.regular,
          fontSize: v(SUM.echoSize),
          lineHeight: v(SUM.echoLineHeight),
          color: OB.ink70,
        },
        // Imbriqué dans la même coulée : la perte reste dans le fil de la
        // phrase, elle ne redémarre pas une ligne pour elle seule.
        echoLoss: { ...fonts.semiBold, color: OB.accent },
        card: {
          padding: v(SUM.cardPadding),
          gap: v(SUM.cardGap),
          borderRadius: relockMaterial.radius.panel,
          backgroundColor: OB.card,
          borderWidth: 1,
          borderColor: OB.hairline,
          alignItems: 'center',
        },
        cardEyebrow: {
          ...fonts.semiBold,
          fontSize: v(SUM.eyebrowSize),
          lineHeight: v(SUM.eyebrowLineHeight),
          letterSpacing: SUM.eyebrowTracking,
          textTransform: 'uppercase',
          color: OB.ink55,
          textAlign: 'center',
        },
        // `GradientLine` est un SVG en largeur relative : sans conteneur
        // étiré, le centrage de la carte le réduirait à une largeur nulle.
        hero: { alignSelf: 'stretch' },
        goalSummary: {
          ...fonts.semiBold,
          fontSize: v(SUM.goalSummarySize),
          lineHeight: v(SUM.goalSummaryLineHeight),
          color: OB.ink,
          textAlign: 'center',
        },
        cardNote: {
          ...fonts.regular,
          fontSize: v(SUM.noteSize),
          lineHeight: v(SUM.noteLineHeight),
          color: OB.ink55,
          textAlign: 'center',
        },
        methods: { flexDirection: 'row', alignItems: 'flex-start' },
        method: { flex: 1, alignItems: 'center', gap: v(SUM.tileGap) },
        tile: {
          width: v(SUM.tileSize),
          height: v(SUM.tileSize),
          borderRadius: relockMaterial.radius.compact,
          backgroundColor: OB.accentDim,
          alignItems: 'center',
          justifyContent: 'center',
        },
        methodLabel: {
          ...fonts.semiBold,
          fontSize: v(SUM.tileLabelSize),
          lineHeight: v(SUM.tileLabelLineHeight),
          color: OB.ink,
          textAlign: 'center',
        },
        footnote: {
          ...fonts.regular,
          fontSize: v(SUM.noteSize),
          lineHeight: v(SUM.noteLineHeight),
          color: OB.ink55,
          textAlign: 'center',
        },
        footer: { marginTop: v(SUM.footerGap) },
      }),
    }
  }, [available])
}
