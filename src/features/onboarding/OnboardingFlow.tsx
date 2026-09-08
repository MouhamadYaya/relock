import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DeviceEventEmitter,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { RuleTemplateCard as RuleTemplate } from '@/features/blocking/rule-templates'
import { riskHourFromMoments } from '@/features/notifications/engine/risk-hour'
import { noteRiskHour } from '@/features/notifications/engine/signals'
import { ScenePersonalizedPlan } from '@/features/onboarding/components/ScenePersonalizedPlan'
import { ScenePlanPreparation } from '@/features/onboarding/components/ScenePlanPreparation'
import { SceneRecognition } from '@/features/onboarding/components/SceneRecognition'
import { SceneRitual } from '@/features/onboarding/components/SceneRitual'
import { SceneVictory } from '@/features/onboarding/components/SceneVictory'
import { SCREEN_TIME_ESTIMATES } from '@/features/onboarding/services/annualProjection'
import { saveOnboardingAnswers } from '@/features/onboarding/services/onboarding-answers.service'
import {
  type OnboardingCheckpoint,
  readOnboardingCheckpoint,
  saveOnboardingCheckpoint,
} from '@/features/onboarding/services/onboarding-checkpoint'
import { buildPersonalizedPlan } from '@/features/onboarding/services/personalizedPlan'
import { recoveryGoal } from '@/features/onboarding/services/recoveryGoal'
import { setOnboardingAttributes } from '@/features/onboarding/services/revenuecat'
import { translate } from '@/i18n/translate'
import { useT } from '@/i18n/useT'
import { completeSetup, completeSurvey } from '@/session/bootstrap'
import { DEV_EVENT_ONBOARDING_JUMP } from '@/session/dev-test-bridge'
import { useSocialSignIn } from '@/session/useSocialSignIn'
import { useAppGateStore } from '@/shared/stores/app-gate.store'
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
import { SceneNotifs, ScenePermission } from './scenes-power'
import {
  DEFAULT_RULE_PRESET_IDS,
  SceneGroundRules,
  SceneHardMode,
  SceneLockDemo,
  ScenePickApps,
  ScenePickerDemo,
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
 * Arc : miroir → diagnostic → verdict → plan → rituel ┊ offre ┊ compte
 * → tutoriel → accès Temps d'écran → apps → règles → notifications.
 *
 * ┊ L'OFFRE N'EST PLUS UNE ÉTAPE D'ICI. C'est une route à part
 * (`app/paywall.tsx`), montée par `app/_layout.tsx` tant que l'abonnement
 * manque. Le rituel referme donc le récit (`completeSurvey`) et le parcours
 * ne reprend qu'au compte, une fois l'abonnement en poche. Raison : un
 * abonnement est un ÉTAT qu'on revérifie à chaque démarrage — pas une case
 * franchie une fois, qu'une fermeture d'app ou une expiration rendrait fausse.
 *
 * Textes français locaux : exception i18n assumée de cet espace narratif
 * (comme sa palette).
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
  | 'stolen'
  | 'attempts'
  | 'screenTime'
  | 'aspiration'
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
  | 'tutoGround'
  | 'tutoLock'
  | 'tutoHard'
  | 'tutoPicker'
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
  'stolen',
  'attempts',
  'screenTime',
  'aspiration',
  'beat',
  'mirror',
  'goodNews',
  'reversal',
  'loading',
  'plan',
  'ritual',
  'auth',
  'tutoGround',
  'tutoLock',
  'tutoHard',
  'permission',
  'tutoPicker',
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
  'stolen',
  'attempts',
  'screenTime',
  'aspiration',
]

/** Étapes où revenir en arrière a du sens. */
const BACKABLE: StepId[] = [
  'trigger',
  'apps',
  'moment',
  'feelings',
  'stolen',
  'attempts',
  'screenTime',
  'aspiration',
]

/** Première étape d'APRÈS l'offre : le parcours d'activation du produit. */
const SETUP_START: StepId = 'auth'

/**
 * Où reprendre à l'ouverture de l'app.
 *
 * On revient à l'étape mémorisée, avec une règle qui prime sur elle : un
 * ABONNÉ ne repasse jamais par le récit. Il a payé — lui rejouer le
 * diagnostic et le plan serait une punition. Il reprend au parcours
 * d'activation, le seul endroit où une position a encore du sens (l'offre,
 * elle, n'est plus une étape mais un état, cf. l'en-tête).
 *
 * Une étape inconnue (parcours remanié depuis la sauvegarde) fait repartir
 * du début, seul état sûr.
 *
 * Et la règle qui prime sur toutes les autres : SANS ABONNEMENT, on ne
 * reprend jamais au-delà du récit. Le parcours d'activation — à commencer par
 * l'écran de compte — se joue après l'offre, jamais avant. `app/_layout.tsx`
 * l'assure déjà en montant le paywall à la place de ce parcours ; on ne s'en
 * remet pas à lui seul. Une sauvegarde héritée d'une version antérieure, un
 * ordre d'étapes remanié, une porte élargie un jour de refonte : il ne doit
 * pas exister de chemin, même indirect, où la connexion arrive avant le
 * paiement. Une reprise trop avancée revient donc au rituel, qui reconduit
 * proprement au paywall.
 */
function resumeIndex(
  checkpoint: OnboardingCheckpoint | null,
  { entitled, surveyDone }: { entitled: boolean; surveyDone: boolean },
): number {
  const saved = checkpoint ? STEPS.indexOf(checkpoint.step as StepId) : -1
  const start = saved > 0 ? saved : 0
  const setupStart = STEPS.indexOf(SETUP_START)
  if (!entitled) return Math.min(start, setupStart - 1)
  if (!surveyDone) return start
  return Math.max(start, setupStart)
}

/**
 * TOUTES les questions du diagnostic sont à choix multiple, sans plafond :
 * personne n'a une seule raison de vouloir décrocher, ni un seul moment de
 * faiblesse. Le plancher, lui, reste à une réponse — ces réponses NOURRISSENT
 * le plan, passer sans rien cocher le viderait de sa substance.
 *
 * Seule exception, `screenTime` : elle demande une estimation de durée, et
 * cocher « moins de 2 h » ET « plus de 8 h » ne veut rien dire. C'est aussi
 * la seule réponse qui se convertit en nombre (`hours`).
 */
const TRIGGERS = [
  { id: 'time', emoji: '⏳' },
  { id: 'bed', emoji: '🌙' },
  { id: 'focus', emoji: '🎯' },
  { id: 'control', emoji: '🔒' },
  { id: 'sleep', emoji: '😴' },
  { id: 'habit', emoji: '🔁' },
  { id: 'mood', emoji: '🌧️' },
  { id: 'presence', emoji: '🤍' },
  { id: 'goals', emoji: '🎓' },
]

/**
 * Les apps qui retiennent, en cartes larges — le même gabarit que les autres
 * questions à phrases. La grille demandait un pictogramme par case, et un
 * emoji n'est PAS l'icône d'une app : « 📸 » ne se lit pas Instagram, « ✖️ »
 * ne se lit pas X. Le nom seul, en pleine largeur, dit exactement ce qu'il
 * désigne sans promettre une iconographie qu'on n'a pas le droit d'embarquer.
 *
 * Les libellés SONT les identifiants : ils ressortent tels quels dans le
 * récapitulatif du plan (« tu scrolles sur TikTok et Instagram »), donc
 * uniquement des noms qui se glissent dans cette phrase — pas de catégorie
 * (« jeux mobiles ») qui la rendrait bancale.
 */
const APPS: readonly string[] = [
  'TikTok',
  'Instagram',
  'YouTube',
  'Snapchat',
  'X',
  'Reddit',
  'Facebook',
  'WhatsApp',
  'Threads',
  'Netflix',
  'Twitch',
  'Pinterest',
  'LinkedIn',
  'Discord',
  'Telegram',
]

const MOMENTS = [
  { id: 'bed', emoji: '🌙' },
  { id: 'wake', emoji: '☀️' },
  { id: 'work', emoji: '💻' },
  { id: 'break', emoji: '☕' },
  { id: 'transport', emoji: '🚇' },
  { id: 'meals', emoji: '🍽️' },
  { id: 'weekend', emoji: '🛋️' },
  { id: 'always', emoji: '🌀' },
]

/**
 * L'aveu émotionnel : ce que le scroll laisse derrière lui. Choix multiple
 * — personne ne ressent une seule de ces choses à la fois.
 */
const FEELING_EMOJI: readonly [string, string][] = [
  ['guilt', '😔'],
  ['empty', '😶'],
  ['anxious', '😰'],
  ['wasted', '⏳'],
  ['drained', '🪫'],
  ['overwhelmed', '😵‍💫'],
  ['foggy', '🌫️'],
  ['regret', '😓'],
  ['unproductive', '😞'],
  ['disconnected', '🫥'],
  ['angry', '😡'],
  ['hopeless', '🤕'],
  ['ashamed', '🫣'],
  ['lonely', '🥲'],
  ['restless', '😬'],
  ['numb', '🫠'],
]

/**
 * Bascule une réponse. AUCUN plafond : refuser le quatrième tap donnait un
 * écran qui ne répond plus, et il n'appartient pas au questionnaire de
 * décider combien de choses le scroll a coûté à quelqu'un.
 *
 * Le plan reste lisible sans ce plafond parce qu'il cite lui-même au plus
 * deux réponses en prose (`MAX_QUOTED` dans `personalizedPlan.ts`) : la
 * limite est du côté de la PHRASE, pas du côté de la personne qui répond.
 */
function togglePick(list: string[], id: string) {
  return list.includes(id) ? list.filter(x => x !== id) : [...list, id]
}

/**
 * La question qui fait le plus mal : ce que le scroll a pris, pas ce qu'il
 * fait ressentir. Les libellés sont à la première personne — c'est un aveu
 * que l'utilisateur signe, pas un constat qu'on lui impose.
 */
const STOLEN = [
  { id: 'nights', emoji: '🌙' },
  { id: 'people', emoji: '💬' },
  { id: 'becoming', emoji: '🌱' },
  { id: 'focus', emoji: '🧠' },
  { id: 'presence', emoji: '🤍' },
  { id: 'energy', emoji: '🔋' },
  { id: 'mornings', emoji: '☀️' },
  { id: 'sport', emoji: '🏃' },
  { id: 'projects', emoji: '🎸' },
  { id: 'calm', emoji: '🧘' },
  { id: 'pride', emoji: '🪞' },
]

/** « Jamais vraiment essayé » : la seule réponse qui exclut les autres. */
const ATTEMPT_NEVER = 'never'

/**
 * L'impuissance. Cet écran fait dire à l'utilisateur, avec ses mots, pourquoi
 * la volonté seule ne suffit pas — et c'est ce qui justifie la friction du
 * produit bien mieux qu'un argumentaire.
 */
const ATTEMPTS = [
  { id: 'deleted', emoji: '🗑️' },
  { id: 'limit', emoji: '⏱️' },
  { id: 'willpower', emoji: '💪' },
  { id: 'distance', emoji: '📵' },
  { id: 'hidden', emoji: '🙈' },
  { id: 'grayscale', emoji: '🌑' },
  { id: 'notifications', emoji: '🔕' },
  { id: 'blocker', emoji: '🧱' },
  { id: 'detox', emoji: '🏝️' },
  { id: 'logout', emoji: '🚪' },
  { id: ATTEMPT_NEVER, emoji: '🤍' },
]

/**
 * La bascule vers le désir, et la dernière question du diagnostic : le
 * verdict qui suit (« Une nouvelle difficile. Et une bonne. ») frappe d'autant
 * plus fort que la personne vient de nommer ce qu'elle voudrait récupérer.
 * C'est aussi cette réponse qui remplit le « pour toi » du plan.
 */
const ASPIRATION_EMOJI: readonly [string, string][] = [
  ['sleep', '😴'],
  ['move', '🏃'],
  ['read', '📚'],
  ['people', '💬'],
  ['project', '🎯'],
  ['hobby', '🎸'],
  ['breathe', '🧘'],
  ['cook', '🍳'],
  ['work', '💼'],
  ['morning', '☀️'],
  ['study', '🎓'],
  ['present', '🧠'],
  ['family', '👨‍👩‍👧'],
  ['nature', '🌿'],
  ['learn', '🧩'],
  ['create', '🎨'],
  ['music', '🎹'],
  ['silence', '🌙'],
]

/**
 * Les grilles reçoivent leurs libellés TRADUITS, reconstruits à chaque rendu.
 * Un tableau `const` figeait le français à l'import du module.
 */
const gridChoices = (
  section: string,
  pairs: readonly [string, string][],
): GridChoice[] =>
  pairs.map(([id, emoji]) => ({
    id,
    emoji,
    label: translate(`onboarding_survey.${section}.${id}`),
  }))

/**
 * Estimation du temps de scroll quotidien. `hours` est la valeur retenue
 * pour la suite du récit (la projection du miroir la multiplie par 365) :
 * on prend le milieu de chaque tranche, une borne honnête plutôt que
 * flatteuse aux extrémités.
 */
const SCREEN_TIME = SCREEN_TIME_ESTIMATES

export default function OnboardingFlow() {
  const t = useT()
  const insets = useSafeAreaInsets()
  // Lu une seule fois au montage : l'onboarding entamé puis abandonné
  // reprend où il s'était arrêté, même des semaines plus tard.
  const [checkpoint] = useState(readOnboardingCheckpoint)
  const saved = checkpoint?.answers
  const entitled = useAppGateStore(s => s.entitled)
  const surveyDone = useAppGateStore(s => s.surveyDone)
  const [index, setIndex] = useState(() =>
    // Lu une fois : la reprise se décide au montage, jamais en cours de route
    // (une bascule d'abonnement pendant le parcours ne doit pas téléporter
    // l'utilisateur — `app/_layout.tsx` s'en charge au niveau de la racine).
    resumeIndex(checkpoint, { entitled, surveyDone }),
  )
  const dirRef = useRef<'fwd' | 'back'>('fwd')

  // Réponses (elles nourrissent la projection et le plan).
  const [name, setName] = useState(saved?.name ?? '')
  const [trigger, setTrigger] = useState<string[]>(saved?.trigger ?? [])
  const [apps, setApps] = useState<string[]>(saved?.apps ?? [])
  const [moment, setMoment] = useState<string[]>(saved?.moment ?? [])
  const [feelings, setFeelings] = useState<string[]>(saved?.feelings ?? [])
  const [stolen, setStolen] = useState<string[]>(saved?.stolen ?? [])
  const [attempts, setAttempts] = useState<string[]>(saved?.attempts ?? [])
  const [aspirations, setAspirations] = useState<string[]>(
    saved?.aspirations ?? [],
  )
  const [screenTime, setScreenTime] = useState<string | null>(
    saved?.screenTime ?? null,
  )
  const [hours, setHours] = useState(saved?.hours ?? 4)
  const personalizedPlan = useMemo(
    () =>
      buildPersonalizedPlan({
        name,
        apps,
        moment,
        trigger,
        feelings,
        stolen,
        attempts,
        aspirations,
        hours,
      }),
    [
      name,
      apps,
      moment,
      trigger,
      feelings,
      stolen,
      attempts,
      aspirations,
      hours,
    ],
  )

  // Tutoriel post-paywall : ces trois réponses produisent la règle réellement
  // armée à la sortie de l'onboarding.
  const [appCount, setAppCount] = useState(saved?.appCount ?? 0)
  const [rulePresetIds, setRulePresetIds] = useState<string[]>(
    saved?.rulePresetIds ?? DEFAULT_RULE_PRESET_IDS,
  )
  const [activating, setActivating] = useState(false)
  const activationStarted = useRef(false)
  const activationFailures = useRef(0)

  const step = STEPS[index]

  /**
   * Sauvegarde continue de l'avancement. `ignition` (index 0) est exclue :
   * elle prolonge le splash et s'enchaîne seule, il n'y a rien à reprendre
   * tant qu'on ne l'a pas dépassée.
   */
  useEffect(() => {
    if (index === 0) return
    saveOnboardingCheckpoint({
      step,
      answers: {
        name,
        trigger,
        apps,
        moment,
        feelings,
        stolen,
        attempts,
        aspirations,
        screenTime,
        hours,
        appCount,
        rulePresetIds,
      },
    })
  }, [
    step,
    index,
    name,
    trigger,
    apps,
    moment,
    feelings,
    stolen,
    attempts,
    aspirations,
    screenTime,
    hours,
    appCount,
    rulePresetIds,
  ])

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

  /**
   * Le compte vient d'exister : c'est le premier instant où les réponses du
   * questionnaire ont un endroit où vivre autre que le MMKV de cet appareil.
   * Écriture en arrière-plan — une ligne non écrite n'arrête pas le parcours.
   */
  const persistAnswers = useCallback(() => {
    // L'heure que l'utilisateur vient de nommer devient SON heure de rappel :
    // c'est la différence entre « pense à armer un blocage » et « ton heure
    // difficile approche ».
    noteRiskHour(riskHourFromMoments(moment))
    void saveOnboardingAnswers({
      name,
      trigger,
      apps,
      moment,
      feelings,
      stolen,
      attempts,
      aspirations,
      screenTime,
      hours,
      appCount,
      rulePresetIds,
    })
  }, [
    name,
    trigger,
    apps,
    moment,
    feelings,
    stolen,
    attempts,
    aspirations,
    screenTime,
    hours,
    appCount,
    rulePresetIds,
  ])

  const handleAppleSignIn = useCallback(async () => {
    const result = await signInWithApple()
    if (result.ok) {
      persistAnswers()
      goNext()
    } else if (!result.canceled) {
      showErrorToast(result.error)
    }
  }, [signInWithApple, goNext, persistAnswers])

  const handleGoogleSignIn = useCallback(async () => {
    const result = await signInWithGoogle()
    if (result.ok) {
      persistAnswers()
      goNext()
    } else if (!result.canceled) {
      showErrorToast(result.error)
    }
  }, [signInWithGoogle, goNext, persistAnswers])

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
    // `completeSetup` écrit la porte, bascule le store et remplace la route
    // lui-même (cf. `src/session/bootstrap.ts` pour le pourquoi du replace).
    completeSetup()
  }, [])

  /**
   * Fin du récit. Le parcours s'arrête ICI tant que l'abonnement manque :
   * `completeSurvey` remplace la route par le paywall, et ces 13 écrans ne
   * se rejoueront jamais. Les réponses partent en attributs RevenueCat au
   * passage — c'est le seul moment où l'on sait qui est cette personne et
   * ce qu'elle vient chercher.
   */
  const finishSurvey = useCallback(() => {
    void setOnboardingAttributes({
      trigger,
      moment,
      hours,
      apps,
      feelings,
      stolen,
      attempts,
      aspirations,
    })
    if (!completeSurvey()) goNext()
  }, [
    trigger,
    moment,
    hours,
    apps,
    feelings,
    stolen,
    attempts,
    aspirations,
    goNext,
  ])

  /**
   * Demander les notifications après la création et l'armement des règles.
   * Un échec ne demande pas de permission pour une activation qui n'a pas
   * abouti — et surtout, il ne fait plus entrer dans l'app en silence.
   *
   * Avant, le moindre échec appelait `finish()` : l'utilisateur se retrouvait
   * ABONNÉ, dans l'app, avec ZÉRO blocage armé — le pire état possible du
   * produit, et invisible pour lui. Désormais le premier échec est
   * réessayable sur place ; le second le laisse entrer quand même, parce
   * qu'il a payé et qu'on ne le retiendra pas en otage d'un armement qui ne
   * veut pas se faire (l'onglet Blocages lui permet de créer sa règle).
   */
  const activateAndContinue = useCallback(async () => {
    if (rulePresetIds.length === 0 || activationStarted.current) return
    activationStarted.current = true
    setActivating(true)
    try {
      await activateFirstRule({
        presetIds: rulePresetIds,
        count: appCount,
      })
      haptic.success()
      goStep('notifs')
    } catch (e) {
      showErrorToast(e)
      activationFailures.current += 1
      // On rouvre la porte au réessai : sans ce reset, `activationStarted`
      // restait armé et le bouton ne répondait plus jamais.
      activationStarted.current = false
      if (activationFailures.current >= 2) finish()
    } finally {
      setActivating(false)
    }
  }, [rulePresetIds, activateFirstRule, appCount, finish, goStep])

  const toggleApp = useCallback((id: string) => {
    setApps(prev => togglePick(prev, id))
  }, [])

  const toggleTrigger = useCallback((id: string) => {
    setTrigger(prev => togglePick(prev, id))
  }, [])

  const toggleMoment = useCallback((id: string) => {
    setMoment(prev => togglePick(prev, id))
  }, [])

  const toggleRulePreset = useCallback((template: RuleTemplate) => {
    setRulePresetIds(prev =>
      prev.includes(template.presetId)
        ? prev.filter(id => id !== template.presetId)
        : [...prev, template.presetId],
    )
  }, [])

  const toggleFeeling = useCallback((id: string) => {
    setFeelings(prev => togglePick(prev, id))
  }, [])

  const toggleStolen = useCallback((id: string) => {
    setStolen(prev => togglePick(prev, id))
  }, [])

  const toggleAspiration = useCallback((id: string) => {
    setAspirations(prev => togglePick(prev, id))
  }, [])

  /**
   * « Jamais vraiment essayé » dit l'ABSENCE des autres réponses : le cumuler
   * avec « j'ai supprimé l'app » serait une contradiction, et la phrase que
   * le plan en tire (« Tu as déjà essayé, mais… ») deviendrait fausse.
   */
  const toggleAttempt = useCallback((id: string) => {
    setAttempts(prev => {
      if (id === ATTEMPT_NEVER) return prev.includes(id) ? [] : [id]
      return togglePick(
        prev.filter(x => x !== ATTEMPT_NEVER),
        id,
      )
    })
  }, [])

  const scene = (() => {
    switch (step) {
      case 'ignition':
        return <SceneIgnition onDone={goNext} />
      case 'welcome':
        return <SceneWelcome onNext={goNext} />
      case 'recognition':
        return <SceneRecognition onNext={goNext} />
      case 'name':
        return <SceneName value={name} onChange={setName} onNext={goNext} />
      case 'trigger':
        return (
          <QuestionScene
            title={
              name.trim()
                ? t('onboarding_survey.trigger.title_named', {
                    name: name.trim(),
                  })
                : t('onboarding_survey.trigger.title')
            }
            sub={t('onboarding_survey.trigger.sub')}
            scroll
            onNext={trigger.length > 0 ? goNext : undefined}
          >
            {TRIGGERS.map((item, i) => (
              <ChoiceCard
                key={item.id}
                index={i}
                emoji={item.emoji}
                label={translate(`onboarding_survey.trigger.${item.id}`)}
                selected={trigger.includes(item.id)}
                onPress={() => toggleTrigger(item.id)}
              />
            ))}
          </QuestionScene>
        )
      case 'apps':
        return (
          <QuestionScene
            title={t('onboarding_survey.apps.title')}
            sub={t('onboarding_survey.apps.sub')}
            scroll
            onNext={apps.length > 0 ? goNext : undefined}
            extra={
              apps.length > 0 ? (
                <StudyLine text={t('onboarding_survey.apps.study')} />
              ) : null
            }
          >
            {APPS.map((app, i) => (
              <ChoiceCard
                key={app}
                index={i}
                label={app}
                selected={apps.includes(app)}
                onPress={() => toggleApp(app)}
              />
            ))}
          </QuestionScene>
        )
      case 'moment':
        return (
          <QuestionScene
            title={t('onboarding_survey.moment.title')}
            sub={t('onboarding_survey.moment.sub')}
            scroll
            onNext={moment.length > 0 ? goNext : undefined}
          >
            {MOMENTS.map((m, i) => (
              <ChoiceCard
                key={m.id}
                index={i}
                emoji={m.emoji}
                label={translate(`onboarding_survey.moment.${m.id}`)}
                selected={moment.includes(m.id)}
                onPress={() => toggleMoment(m.id)}
              />
            ))}
          </QuestionScene>
        )
      case 'feelings':
        return (
          <QuestionScene
            title={t('onboarding_survey.feelings.title')}
            sub={t('onboarding_survey.feelings.sub')}
            fill
            onNext={feelings.length > 0 ? goNext : undefined}
            extra={
              feelings.length > 0 ? (
                <StudyLine text={t('onboarding_survey.feelings.study')} />
              ) : null
            }
          >
            <ChoiceGrid
              items={gridChoices('feelings', FEELING_EMOJI)}
              selected={feelings}
              onToggle={toggleFeeling}
            />
          </QuestionScene>
        )
      case 'stolen':
        return (
          <QuestionScene
            title={t('onboarding_survey.stolen.title')}
            sub={t('onboarding_survey.stolen.sub')}
            scroll
            onNext={stolen.length > 0 ? goNext : undefined}
            extra={
              <PickHint
                picks={stolen}
                text={t('onboarding_survey.stolen.hint')}
              />
            }
          >
            {STOLEN.map((item, i) => (
              <ChoiceCard
                key={item.id}
                index={i}
                emoji={item.emoji}
                label={translate(`onboarding_survey.stolen.${item.id}`)}
                selected={stolen.includes(item.id)}
                onPress={() => toggleStolen(item.id)}
              />
            ))}
          </QuestionScene>
        )
      case 'attempts':
        return (
          <QuestionScene
            title={t('onboarding_survey.attempts.title')}
            sub={t('onboarding_survey.attempts.sub')}
            scroll
            onNext={attempts.length > 0 ? goNext : undefined}
            extra={
              <PickHint
                picks={attempts}
                text={
                  attempts.includes(ATTEMPT_NEVER)
                    ? t('onboarding_survey.attempts.hint_never')
                    : t('onboarding_survey.attempts.hint')
                }
              />
            }
          >
            {ATTEMPTS.map((item, i) => (
              <ChoiceCard
                key={item.id}
                index={i}
                emoji={item.emoji}
                label={translate(`onboarding_survey.attempts.${item.id}`)}
                selected={attempts.includes(item.id)}
                onPress={() => toggleAttempt(item.id)}
              />
            ))}
          </QuestionScene>
        )
      case 'aspiration':
        return (
          <QuestionScene
            // Le temps annoncé sort de SES réponses. Quand le plancher de
            // l'objectif dépasse son usage réel (petit scrolleur), on ne lui
            // promet pas un temps qu'il n'a pas : la question reste ouverte.
            title={
              recoveryGoal(hours).exceedsUsage
                ? t('onboarding_survey.aspiration.title')
                : t('onboarding_survey.aspiration.title_time', {
                    time: recoveryGoal(hours).dailyTime,
                  })
            }
            sub={t('onboarding_survey.aspiration.sub')}
            fill
            onNext={aspirations.length > 0 ? goNext : undefined}
            extra={
              <PickHint
                picks={aspirations}
                text={t('onboarding_survey.aspiration.hint')}
              />
            }
          >
            <ChoiceGrid
              items={gridChoices('aspiration', ASPIRATION_EMOJI)}
              selected={aspirations}
              onToggle={toggleAspiration}
            />
          </QuestionScene>
        )
      case 'screenTime':
        return (
          <QuestionScene
            // Seule question du diagnostic à réponse unique : elle se
            // convertit en un nombre d'heures, et deux tranches cochées ne
            // désignent aucune durée.
            title={t('onboarding_survey.screen_time.title')}
            sub={t('onboarding_survey.screen_time.sub')}
            onNext={screenTime ? goNext : undefined}
          >
            {SCREEN_TIME.map((estimate, i) => (
              <ChoiceCard
                key={estimate.id}
                index={i}
                label={translate(
                  `onboarding_survey.screen_time.${estimate.id}`,
                )}
                selected={screenTime === estimate.id}
                onPress={() => {
                  setScreenTime(estimate.id)
                  setHours(estimate.hours)
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
        return (
          <SceneGoodNews
            hours={hours}
            words={personalizedPlan.aspirationWords}
            onNext={goNext}
          />
        )
      case 'reversal':
        return <SceneReversal onNext={goNext} />
      case 'loading':
        return <ScenePlanPreparation onDone={goNext} />
      case 'ritual':
        return <SceneRitual onDone={finishSurvey} />
      case 'permission':
        return (
          <ScenePermission
            onNext={goNext}
            /*
              Sortie après deux refus. On ne va PAS à l'étape suivante : les
              trois qui suivent (`tutoPicker`, `tutoApps`, `tutoRules`) ouvrent
              la feuille d'Apple et posent la première règle — elles exigent
              l'autorisation qu'on vient de ne pas obtenir, et échoueraient sur
              `errors.screen_time_missing`. On saute donc directement aux
              notifications, puis à la fin du parcours.

              L'app s'ouvre alors sans blocage armé : c'est l'état qu'elle sait
              déjà tenir quand l'autorisation est retirée en cours de route
              (voir `health.screen_time_revoked`), et la permission se
              redemande depuis les Réglages.
            */
            onSkip={() => goStep('notifs')}
          />
        )
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
      case 'tutoGround':
        return <SceneGroundRules onNext={goNext} />
      case 'tutoLock':
        return <SceneLockDemo onNext={goNext} />
      case 'tutoHard':
        return <SceneHardMode onNext={goNext} />
      case 'tutoPicker':
        // La démonstration précède TOUJOURS la feuille d'Apple : elle s'ouvre
        // désormais d'elle-même à l'écran suivant, et personne ne doit y
        // arriver sans avoir vu qu'une catégorie se déplie.
        return <ScenePickerDemo onNext={goNext} cta={t('add_rule.pick_apps')} />
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
            appCount={appCount}
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
  //
  // `welcome` en est là pour une raison de plus : sa pluie de billes DOIT
  // pouvoir tomber depuis le tout premier pixel, sinon les billes
  // apparaissent d'un coup sous l'encoche au lieu d'entrer par le haut.
  const ownsSafeArea = isIgnition || step === 'auth' || step === 'welcome'

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

/**
 * La ligne sous les réponses : l'écho qui dit qu'on a entendu. Rien tant que
 * rien n'est coché — une phrase d'empathie affichée devant une liste vierge
 * ne répond à personne.
 */
function PickHint({ picks, text }: { picks: string[]; text: string }) {
  return picks.length > 0 ? <StudyLine text={text} /> : null
}

/** Gabarit des écrans de question : titre géant, justification, cartes. */
function QuestionScene({
  title,
  sub,
  children,
  extra,
  fill = false,
  scroll = false,
  onNext,
}: {
  title: string
  sub: string
  children: React.ReactNode
  extra?: React.ReactNode
  /** Les réponses prennent toute la hauteur libre (grille défilante). */
  fill?: boolean
  /**
   * Idem, mais c'est le gabarit qui défile. Réservé aux listes de cartes à
   * phrases longues : `fill` suppose un enfant qui gère son propre
   * défilement (`ChoiceGrid`), et une pile de six cartes sur deux lignes
   * serait simplement rognée par le bas.
   */
  scroll?: boolean
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
        {fill || scroll ? (
          <>
            {scroll ? (
              <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollAnswers}
              >
                {children}
              </ScrollView>
            ) : (
              <View className="flex-1">{children}</View>
            )}
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
          label={translate('paywall.continue')}
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
  // Centré tant que la pile tient dans la hauteur, défilant dès qu'elle
  // déborde — le cas des petits écrans avec six cartes sur deux lignes.
  scrollAnswers: { flexGrow: 1, justifyContent: 'center', paddingBottom: 4 },
})
