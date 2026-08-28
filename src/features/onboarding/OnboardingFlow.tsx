import React, { useCallback, useEffect, useRef, useState } from 'react'
import { DeviceEventEmitter, StyleSheet, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { completeOnboarding } from '@/session/bootstrap'
import { DEV_EVENT_ONBOARDING_JUMP } from '@/session/dev-test-bridge'
import { useSocialSignIn } from '@/session/useSocialSignIn'
import { fonts } from '@/shared/theme/tokens/fonts'
import { showErrorToast } from '@/shared/utils/toast'
import {
  BackBtn,
  ChoiceCard,
  HaloBackdrop,
  OBProgress,
  Pill,
  StudyLine,
} from './bits'
import { enterBack, enterFwd, exitBack, exitFwd, Reveal } from './motion'
import { SceneAuth } from './scenes-auth'
import {
  SceneDemo,
  SceneHours,
  SceneIgnition,
  SceneName,
  SceneProof,
  SceneWelcome,
} from './scenes-intro'
import {
  SceneArtifact,
  SceneNotifs,
  ScenePaywall,
  ScenePermission,
} from './scenes-power'
import {
  SceneBeat,
  SceneLoading,
  SceneMirror,
  ScenePlan,
  SceneReversal,
  SceneRitual,
  SceneSuccess,
} from './scenes-verdict'
import { OB } from './tokens'

/**
 * Onboarding « Reprends tes nuits » — la refonte validée écran par écran.
 *
 * Arc en 6 actes (~21 écrans) : allumage → miroir (aveux) → verdict
 * (slot-machine) → plan (chargement théâtral + rituel du verrou) →
 * pouvoir (permissions, Temps d'écran en blocage DUR) → alliance
 * (paywall factice + artefact).
 *
 * Une seule route ; les étapes vivent ici. Textes français locaux :
 * exception i18n assumée de cet espace narratif (comme sa palette).
 */

type StepId =
  | 'ignition'
  | 'welcome'
  | 'demo'
  | 'name'
  | 'trigger'
  | 'apps'
  | 'moment'
  | 'hours'
  | 'proof'
  | 'beat'
  | 'mirror'
  | 'reversal'
  | 'plan'
  | 'loading'
  | 'success'
  | 'ritual'
  | 'permission'
  | 'notifs'
  | 'auth'
  | 'paywall'
  | 'artifact'

const STEPS: StepId[] = [
  'ignition',
  'welcome',
  'demo',
  'name',
  'trigger',
  'apps',
  'moment',
  'hours',
  'proof',
  'beat',
  'mirror',
  'reversal',
  'plan',
  'loading',
  'success',
  'ritual',
  'permission',
  'notifs',
  'auth',
  'paywall',
  'artifact',
]

/** Le chapitre diagnostic : seul endroit avec barre de progression. */
const DIAGNOSTIC: StepId[] = ['name', 'trigger', 'apps', 'moment', 'hours']

/** Étapes où revenir en arrière a du sens. */
const BACKABLE: StepId[] = ['trigger', 'apps', 'moment', 'hours']

const TRIGGERS = [
  { id: 'time', emoji: '⏳', label: 'Je perds trop de temps' },
  { id: 'bed', emoji: '🌙', label: 'Je scrolle au lit' },
  { id: 'focus', emoji: '🎯', label: "Je n'arrive plus à me concentrer" },
  { id: 'control', emoji: '🔒', label: 'Je veux reprendre le contrôle' },
]

const APPS = ['TikTok', 'Instagram', 'YouTube', 'Snapchat', 'X', 'Reddit']

const MOMENTS = [
  {
    id: 'bed',
    emoji: '🌙',
    label: 'Le soir, au lit',
    phrase: 'surtout le soir au lit',
  },
  {
    id: 'wake',
    emoji: '☀️',
    label: 'Dès le réveil',
    phrase: 'surtout au réveil',
  },
  {
    id: 'work',
    emoji: '💻',
    label: 'Pendant le travail ou les cours',
    phrase: 'surtout pendant tes journées',
  },
  {
    id: 'always',
    emoji: '🌀',
    label: 'Un peu tout le temps',
    phrase: 'à tout moment de la journée',
  },
]

export default function OnboardingFlow() {
  const insets = useSafeAreaInsets()
  const [index, setIndex] = useState(0)
  const dirRef = useRef<'fwd' | 'back'>('fwd')

  // Réponses (elles nourrissent la projection et le plan).
  const [name, setName] = useState('')
  const [trigger, setTrigger] = useState<string | null>(null)
  const [apps, setApps] = useState<string[]>([])
  const [moment, setMoment] = useState<string | null>(null)
  const [hours, setHours] = useState(4)

  const step = STEPS[index]
  const days = Math.max(1, Math.round((hours * 365) / 24))
  const momentInfo = MOMENTS.find(m => m.id === moment) ?? MOMENTS[3]

  const goNext = useCallback(() => {
    dirRef.current = 'fwd'
    setIndex(i => Math.min(STEPS.length - 1, i + 1))
  }, [])
  const goBack = useCallback(() => {
    dirRef.current = 'back'
    setIndex(i => Math.max(0, i - 1))
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

  const toggleApp = (a: string) => {
    setApps(prev =>
      prev.includes(a) ? prev.filter(x => x !== a) : [...prev, a],
    )
  }

  const scene = (() => {
    switch (step) {
      case 'ignition':
        return <SceneIgnition onDone={goNext} />
      case 'welcome':
        return <SceneWelcome onNext={goNext} />
      case 'demo':
        return <SceneDemo onNext={goNext} />
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
      case 'hours':
        return <SceneHours hours={hours} setHours={setHours} onNext={goNext} />
      case 'proof':
        return <SceneProof onNext={goNext} />
      case 'beat':
        return <SceneBeat onNext={goNext} />
      case 'mirror':
        return <SceneMirror hours={hours} onNext={goNext} />
      case 'reversal':
        return <SceneReversal onNext={goNext} />
      case 'plan':
        return (
          <ScenePlan
            apps={apps}
            momentPhrase={momentInfo.phrase}
            hours={hours}
            onNext={goNext}
          />
        )
      case 'loading':
        return <SceneLoading onDone={goNext} />
      case 'success':
        return (
          <SceneSuccess
            name={name.trim()}
            apps={apps}
            momentLabel={momentInfo.label}
            days={days}
            onNext={goNext}
          />
        )
      case 'ritual':
        return <SceneRitual onDone={goNext} />
      case 'permission':
        return <ScenePermission onNext={goNext} />
      case 'notifs':
        return <SceneNotifs onNext={goNext} />
      case 'auth':
        return (
          <SceneAuth
            onApple={handleAppleSignIn}
            onGoogle={handleGoogleSignIn}
            busy={authPending}
          />
        )
      case 'paywall':
        return <ScenePaywall onDone={goNext} onSkip={goNext} />
      case 'artifact':
        return <SceneArtifact onEnter={finish} />
    }
  })()

  const inDiagnostic = DIAGNOSTIC.includes(step)
  const canBack = BACKABLE.includes(step)
  const isIgnition = step === 'ignition'

  return (
    <View
      className="flex-1"
      style={{
        backgroundColor: OB.bg,
        paddingTop: isIgnition ? 0 : insets.top + 6,
      }}
    >
      {!isIgnition && step !== 'artifact' && step !== 'auth' ? (
        <HaloBackdrop />
      ) : null}
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
        style={{ paddingBottom: insets.bottom + 6 }}
      >
        {scene}
      </Animated.View>
    </View>
  )
}

/** Gabarit des écrans de question : titre géant, justification, cartes. */
function QuestionScene({
  title,
  sub,
  children,
  extra,
  onNext,
}: {
  title: string
  sub: string
  children: React.ReactNode
  extra?: React.ReactNode
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
        <View>{children}</View>
        {extra ? <View className="mt-1.5">{extra}</View> : null}
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
    marginBottom: 22,
  },
})
