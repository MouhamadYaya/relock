import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DeviceEventEmitter, StyleSheet, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { RuleTemplateCard as RuleTemplate } from '@/features/blocking/rule-templates'
import { ScenePersonalizedPlan } from '@/features/onboarding/components/ScenePersonalizedPlan'
import { ScenePlanPreparation } from '@/features/onboarding/components/ScenePlanPreparation'
import { SceneRecognition } from '@/features/onboarding/components/SceneRecognition'
import { SceneRitual } from '@/features/onboarding/components/SceneRitual'
import { SceneVictory } from '@/features/onboarding/components/SceneVictory'
import { SCREEN_TIME_ESTIMATES } from '@/features/onboarding/services/annualProjection'
import { buildPersonalizedPlan } from '@/features/onboarding/services/personalizedPlan'
import { completeOnboarding } from '@/session/bootstrap'
import { DEV_EVENT_ONBOARDING_JUMP } from '@/session/dev-test-bridge'
import { useSocialSignIn } from '@/session/useSocialSignIn'
import { useTrackingPrompt } from '@/shared/native/useTrackingPrompt'
import { fonts } from '@/shared/theme/tokens/fonts'
import { showErrorToast } from '@/shared/utils/toast'
import {
  BackBtn,
  ChoiceCard,
  ChoiceGrid,
  type GridChoice,
  HaloBackdrop,
  OBProgress,
  Pill,
  StudyLine,
} from './bits'
import { enterBack, enterFwd, exitBack, exitFwd, Reveal } from './motion'
import { SceneAuth } from './scenes-auth'
import { SceneIgnition, SceneName, SceneWelcome } from './scenes-intro'
import { SceneNotifs, ScenePaywall, ScenePermission } from './scenes-power'
import {
  DEFAULT_RULE_PRESET_IDS,
  SceneGroundRules,
  SceneHardMode,
  SceneLockDemo,
  ScenePickApps,
  SceneRules,
} from './scenes-tutorial'
import {
  SceneBeat,
  SceneGoodNews,
  SceneMirror,
  SceneReversal,
} from './scenes-verdict'
import { haptic, OB } from './tokens'
import { useActivateFirstRule } from './useActivateFirstRule'

/**
 * Onboarding « Reprends tes nuits » — la refonte validée écran par écran.
 *
 * Arc : miroir → diagnostic → verdict → plan → rituel → offre → compte
 * → tutoriel → accès Temps d'écran → apps → règles → notifications.
 *
 * Une seule route ; les étapes vivent ici. Textes français locaux :
 * exception i18n assumée de cet espace narratif (comme sa palette).
 */

type StepId =
  | 'ignition'
  | 'welcome'
  | 'recognition'
  | 'name'
  | 'trigger'
  | 'apps'
  | 'moment'
  | 'feelings'
  | 'screenTime'
  | 'plan'
  | 'beat'
  | 'mirror'
  | 'goodNews'
  | 'reversal'
  | 'loading'
  | 'ritual'
  | 'permission'
  | 'notifs'
  | 'auth'
  | 'paywall'
  | 'tutoGround'
  | 'tutoLock'
  | 'tutoHard'
  | 'tutoApps'
  | 'tutoRules'
  | 'victory'

const STEPS: StepId[] = [
  'ignition',
  'welcome',
  'recognition',
  'name',
  'trigger',
  'apps',
  'moment',
  'feelings',
  'screenTime',
  'beat',
  'mirror',
  'goodNews',
  'reversal',
  'loading',
  'plan',
  'ritual',
  'paywall',
  'auth',
  'tutoGround',
  'tutoLock',
  'tutoHard',
  'permission',
  'tutoApps',
  'tutoRules',
  'notifs',
  'victory',
]

/** Le chapitre diagnostic : seul endroit avec barre de progression. */
const DIAGNOSTIC: StepId[] = [
  'name',
  'trigger',
  'apps',
  'moment',
  'feelings',
  'screenTime',
]

/** Étapes où revenir en arrière a du sens. */
const BACKABLE: StepId[] = [
  'trigger',
  'apps',
  'moment',
  'feelings',
  'screenTime',
]

const TRIGGERS = [
  { id: 'time', emoji: '⏳', label: 'Je perds trop de temps' },
  { id: 'bed', emoji: '🌙', label: 'Je scrolle au lit' },
  { id: 'focus', emoji: '🎯', label: "Je n'arrive plus à me concentrer" },
  { id: 'control', emoji: '🔒', label: 'Je veux reprendre le contrôle' },
]

const APPS = ['TikTok', 'Instagram', 'YouTube', 'Snapchat', 'X', 'Reddit']

const MOMENTS = [
  { id: 'bed', emoji: '🌙', label: 'Le soir, au lit' },
  { id: 'wake', emoji: '☀️', label: 'Dès le réveil' },
  { id: 'work', emoji: '💻', label: 'Pendant le travail ou les cours' },
  { id: 'always', emoji: '🌀', label: 'Un peu tout le temps' },
]

/**
 * L'aveu émotionnel : ce que le scroll laisse derrière lui. Choix multiple
 * — personne ne ressent une seule de ces choses à la fois.
 */
const FEELINGS: readonly GridChoice[] = [
  { id: 'guilt', emoji: '😔', label: 'Coupable' },
  { id: 'empty', emoji: '😶', label: 'Vide' },
  { id: 'anxious', emoji: '😰', label: 'Anxieux' },
  { id: 'wasted', emoji: '⏳', label: 'Je perds ma vie' },
  { id: 'drained', emoji: '🪫', label: 'Sans énergie' },
  { id: 'overwhelmed', emoji: '😵‍💫', label: 'Débordé' },
  { id: 'foggy', emoji: '🌫️', label: 'Esprit brouillé' },
  { id: 'regret', emoji: '😓', label: 'Des regrets' },
  { id: 'unproductive', emoji: '😞', label: 'Improductif' },
  { id: 'disconnected', emoji: '🫥', label: 'Déconnecté du réel' },
  { id: 'angry', emoji: '😡', label: 'Énervé' },
  { id: 'hopeless', emoji: '🤕', label: 'Sans espoir' },
]

/**
 * Estimation du temps de scroll quotidien. `hours` est la valeur retenue
 * pour la suite du récit (la projection du miroir la multiplie par 365) :
 * on prend le milieu de chaque tranche, une borne honnête plutôt que
 * flatteuse aux extrémités.
 */
const SCREEN_TIME = SCREEN_TIME_ESTIMATES

export default function OnboardingFlow() {
  const insets = useSafeAreaInsets()
  const [index, setIndex] = useState(0)
  const dirRef = useRef<'fwd' | 'back'>('fwd')

  // Réponses (elles nourrissent la projection et le plan).
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState<string | null>(null)
  const [apps, setApps] = useState<string[]>([])
  const [moment, setMoment] = useState<string | null>(null)
  const [feelings, setFeelings] = useState<string[]>([])
  const [screenTime, setScreenTime] = useState<string | null>(null)
  const [hours, setHours] = useState(4)
  const personalizedPlan = useMemo(
    () =>
      buildPersonalizedPlan({ name, apps, moment, trigger, feelings, hours }),
    [name, apps, moment, trigger, feelings, hours],
  )

  // Tutoriel post-paywall : ces trois réponses produisent la règle réellement
  // armée à la sortie de l'onboarding.
  const [hardMode, setHardMode] = useState(true)
  const [appCount, setAppCount] = useState(0)
  const [rulePresetIds, setRulePresetIds] = useState<string[]>(
    DEFAULT_RULE_PRESET_IDS,
  )
  const [activating, setActivating] = useState(false)
  const activationStarted = useRef(false)

  const step = STEPS[index]

  // Autorisation de suivi (ATT) : à la toute première page tenue à l'écran.
  // Pas sur `ignition`, qui prolonge le splash et s'enchaîne tout seul —
  // l'alerte système s'y poserait sur une animation en cours.
  useTrackingPrompt(step === 'welcome')

  const goNext = useCallback(() => {
    dirRef.current = 'fwd'
    setIndex(i => Math.min(STEPS.length - 1, i + 1))
  }, [])
  const goBack = useCallback(() => {
    dirRef.current = 'back'
    setIndex(i => Math.max(0, i - 1))
  }, [])

  const activateFirstRule = useActivateFirstRule()

  /** Retour ciblé vers un écran du tutoriel (« Voir comment faire »). */
  const goStep = useCallback((target: StepId) => {
    const i = STEPS.indexOf(target)
    if (i < 0) return
    setIndex(current => {
      dirRef.current = i < current ? 'back' : 'fwd'
      return i
    })
  }, [])

  const {
    signInWithApple,
    signInWithGoogle,
    pending: authPending,
  } = useSocialSignIn()

  const handleAppleSignIn = useCallback(async () => {
    const result = await signInWithApple()
    if (result.ok) {
      goNext()
    } else if (!result.canceled) {
      showErrorToast(result.error)
    }
  }, [signInWithApple, goNext])

  const handleGoogleSignIn = useCallback(async () => {
    const result = await signInWithGoogle()
    if (result.ok) {
      goNext()
    } else if (!result.canceled) {
      showErrorToast(result.error)
    }
  }, [signInWithGoogle, goNext])

  // DEV uniquement : saut direct à une étape (QA visuelle scriptée via
  // `relock://dev/onboarding/<step>`) sans rejouer tout le parcours.
  useEffect(() => {
    if (!__DEV__) return
    const sub = DeviceEventEmitter.addListener(
      DEV_EVENT_ONBOARDING_JUMP,
      ({ step: target }: { step: string }) => {
        const i = STEPS.indexOf(target as StepId)
        if (i >= 0) {
          dirRef.current = 'fwd'
          setIndex(i)
        }
      },
    )
    return () => sub.remove()
  }, [])

  const finish = useCallback(() => {
    // Stack.Protected (app/_layout.tsx) redirects to the app on its own
    // once onboardingDone flips — matches the previous getPostOnboardingRoute().
    completeOnboarding()
  }, [])

  const skipOnboardingDev = useCallback(() => {
    if (__DEV__) finish()
  }, [finish])

  /**
   * Demander les notifications après la création et l'armement des règles.
   * Un échec conserve la sortie existante vers l'app, sans demander une
   * permission pour une activation qui n'a pas abouti.
   */
  const activateAndContinue = useCallback(async () => {
    if (rulePresetIds.length === 0 || activationStarted.current) return
    activationStarted.current = true
    setActivating(true)
    try {
      await activateFirstRule({
        presetIds: rulePresetIds,
        count: appCount,
        strict: hardMode,
      })
      haptic.success()
      goStep('notifs')
    } catch (e) {
      showErrorToast(e)
      finish()
    } finally {
      setActivating(false)
    }
  }, [rulePresetIds, activateFirstRule, appCount, hardMode, finish, goStep])

  const toggleApp = (a: string) => {
    setApps(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a],
    )
  }

  const toggleRulePreset = useCallback((template: RuleTemplate) => {
    setRulePresetIds(prev =>
      prev.includes(template.presetId)
        ? prev.filter(id => id !== template.presetId)
        : [...prev, template.presetId],
    )
  }, [])

  const toggleFeeling = useCallback((id: string) => {
    setFeelings(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id],
    )
  }, [])

  const scene = (() => {
    switch (step) {
      case 'ignition':
        return <SceneIgnition onDone={goNext} />
      case 'welcome':
        return (
          <SceneWelcome
            onNext={goNext}
            onSkipDev={__DEV__ ? skipOnboardingDev : undefined}
          />
        )
      case 'recognition':
        return <SceneRecognition onNext={goNext} />
      case 'name':
        return <SceneName value={name} onChange={setName} onNext={goNext} />
      case 'trigger':
        return (
          <QuestionScene
            title={`Qu'est-ce qui t'amène${name.trim() ? `, ${name.trim()}` : ''} ?`}
            sub="Sois honnête. C'est entre toi et toi."
            onNext={trigger ? goNext : undefined}
          >
            {TRIGGERS.map((t, i) => (
              <ChoiceCard
                key={t.id}
                index={i}
                emoji={t.emoji}
                label={t.label}
                selected={trigger === t.id}
                onPress={() => setTrigger(t.id)}
              />
            ))}
          </QuestionScene>
        )
      case 'apps':
        return (
          <QuestionScene
            title="Quelles apps te retiennent le plus ?"
            sub="Sélectionnes-en autant que tu veux."
            onNext={apps.length > 0 ? goNext : undefined}
            extra={
              apps.length > 0 ? (
                <StudyLine text="Le scroll du soir est le plus dur à lâcher. Tu n'es pas seul." />
              ) : null
            }
          >
            {APPS.map((a, i) => (
              <ChoiceCard
                key={a}
                index={i}
                label={a}
                selected={apps.includes(a)}
                onPress={() => toggleApp(a)}
              />
            ))}
          </QuestionScene>
        )
      case 'moment':
        return (
          <QuestionScene
            title="Quand est-ce que tu décroches ?"
            sub="Ton plan protégera d'abord ce moment."
            onNext={moment ? goNext : undefined}
          >
            {MOMENTS.map((m, i) => (
              <ChoiceCard
                key={m.id}
                index={i}
                emoji={m.emoji}
                label={m.label}
                selected={moment === m.id}
                onPress={() => setMoment(m.id)}
              />
            ))}
          </QuestionScene>
        )
      case 'feelings':
        return (
          <QuestionScene
            title="Et après avoir scrollé, tu ressens quoi ?"
            sub="Sélectionne tout ce qui te parle."
            fill
            onNext={feelings.length > 0 ? goNext : undefined}
            extra={
              feelings.length > 0 ? (
                <StudyLine text="Ce n'est pas un défaut de volonté. C'est le design de ces apps." />
              ) : null
            }
          >
            <ChoiceGrid
              items={FEELINGS}
              selected={feelings}
              onToggle={toggleFeeling}
            />
          </QuestionScene>
        )
      case 'screenTime':
        return (
          <QuestionScene
            title="Combien de temps par jour, à peu près ?"
            sub="Une estimation honnête suffit."
            onNext={screenTime ? goNext : undefined}
          >
            {SCREEN_TIME.map((s, i) => (
              <ChoiceCard
                key={s.id}
                index={i}
                label={s.label}
                selected={screenTime === s.id}
                onPress={() => {
                  setScreenTime(s.id)
                  setHours(s.hours)
                }}
              />
            ))}
          </QuestionScene>
        )
      case 'plan':
        return (
          <ScenePersonalizedPlan
            plan={personalizedPlan}
            onNext={() => {
              setRulePresetIds(personalizedPlan.rules.map(rule => rule.id))
              goNext()
            }}
          />
        )
      case 'beat':
        return <SceneBeat onNext={goNext} />
      case 'mirror':
        return <SceneMirror hours={hours} onNext={goNext} />
      case 'goodNews':
        return <SceneGoodNews hours={hours} onNext={goNext} />
      case 'reversal':
        return <SceneReversal onNext={goNext} />
      case 'loading':
        return <ScenePlanPreparation onDone={goNext} />
      case 'ritual':
        return <SceneRitual onDone={goNext} />
      case 'permission':
        return <ScenePermission onNext={goNext} />
      case 'notifs':
        return <SceneNotifs onNext={() => goStep('victory')} />
      case 'victory':
        return <SceneVictory onDone={finish} />
      case 'auth':
        return (
          <SceneAuth
            onApple={handleAppleSignIn}
            onGoogle={handleGoogleSignIn}
            busy={authPending}
          />
        )
      case 'paywall':
        return <ScenePaywall onNext={goNext} />
      case 'tutoGround':
        return <SceneGroundRules onNext={goNext} />
      case 'tutoLock':
        return <SceneLockDemo onNext={goNext} />
      case 'tutoHard':
        return (
          <SceneHardMode
            value={hardMode}
            onChange={setHardMode}
            onNext={goNext}
          />
        )
      case 'tutoApps':
        return (
          <ScenePickApps
            count={appCount}
            onCount={setAppCount}
            onNext={goNext}
          />
        )
      case 'tutoRules':
        return (
          <SceneRules
            name={name.trim()}
            recommendedIds={personalizedPlan.rules.map(rule => rule.id)}
            selectedIds={rulePresetIds}
            onToggle={toggleRulePreset}
            busy={activating}
            onActivate={activateAndContinue}
          />
        )
    }
  })()

  const inDiagnostic = DIAGNOSTIC.includes(step)
  const canBack = BACKABLE.includes(step)
  const isIgnition = step === 'ignition'
  // `auth` peint son propre fond jusque sous la status bar (voir SceneAuth) :
  // avec le paddingTop du conteneur, le dégradé s'arrêtait sous l'encoche et
  // laissait une bande noire à coins carrés en haut de l'écran.
  const ownsSafeArea = isIgnition || step === 'paywall' || step === 'auth'

  return (
    <View className="flex-1" style={{ backgroundColor: OB.bg }}>
      {!ownsSafeArea && step !== 'tutoGround' ? (
        // Rendu hors du conteneur à `paddingTop` ci-dessous : positionné en
        // absolute, ce halo était sinon ancré au bord du padding (donc
        // sous la status bar) au lieu du haut réel de l'écran — bordure
        // nette visible entre le noir uni de la status bar et le violet du
        // dégradé juste en dessous. Ici il couvre tout l'écran, dégradé
        // continu depuis le tout premier pixel.
        <HaloBackdrop />
      ) : null}
      <View style={{ flex: 1, paddingTop: ownsSafeArea ? 0 : insets.top + 6 }}>
        {inDiagnostic ? (
          <View className="flex-row items-center gap-3.5 px-5 pb-1.5">
            {canBack ? (
              <BackBtn onPress={goBack} />
            ) : (
              <View className="w-[38px]" />
            )}
            <OBProgress
              step={DIAGNOSTIC.indexOf(step) + 1}
              total={DIAGNOSTIC.length}
            />
            <View className="w-[38px]" />
          </View>
        ) : null}
        <Animated.View
          key={step}
          entering={dirRef.current === 'fwd' ? enterFwd : enterBack}
          exiting={dirRef.current === 'fwd' ? exitFwd : exitBack}
          className="flex-1"
          style={{
            paddingBottom: ownsSafeArea && !isIgnition ? 0 : insets.bottom + 6,
          }}
        >
          {scene}
        </Animated.View>
      </View>
    </View>
  )
}

/** Gabarit des écrans de question : titre géant, justification, cartes. */
function QuestionScene({
  title,
  sub,
  children,
  extra,
  fill = false,
  onNext,
}: {
  title: string
  sub: string
  children: React.ReactNode
  extra?: React.ReactNode
  /** Les réponses prennent toute la hauteur libre (grille défilante). */
  fill?: boolean
  onNext?: () => void
}) {
  return (
    <View className="flex-1 px-5">
      <View className="flex-1 pt-3">
        <Reveal index={0}>
          <Text style={styles.qTitle}>{title}</Text>
        </Reveal>
        <Reveal index={1}>
          <Text style={styles.qSub}>{sub}</Text>
        </Reveal>
        {fill ? (
          <>
            <View className="flex-1">{children}</View>
            {extra ? <View className="mt-1.5">{extra}</View> : null}
          </>
        ) : (
          // Liste courte : elle ne remplit jamais la hauteur, et tout le
          // reste s'entassait sous le dernier choix. Les deux cales
          // répartissent ce creux 1/4 au-dessus, 3/4 en dessous — assez
          // pour que le bloc ne colle plus au sous-titre, pas assez pour
          // le décrocher. Elles s'écrasent à zéro quand la place manque.
          <>
            <View style={styles.answersLead} />
            <View>
              {children}
              {extra ? <View className="mt-1.5">{extra}</View> : null}
            </View>
            <View style={styles.answersTrail} />
          </>
        )}
      </View>
      <View className="pb-2.5">
        <Pill
          label="Continuer"
          onPress={onNext ?? (() => {})}
          disabled={!onNext}
        />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  qTitle: {
    ...fonts.bold,
    fontSize: 30,
    lineHeight: 37,
    letterSpacing: -0.7,
    color: OB.ink,
  },
  qSub: {
    ...fonts.regular,
    fontSize: 15.5,
    lineHeight: 22,
    color: OB.ink55,
    marginTop: 8,
    marginBottom: 18,
  },
  answersLead: { flex: 1 },
  answersTrail: { flex: 3 },
})
