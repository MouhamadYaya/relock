import React from 'react'
import { DeviceEventEmitter } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { NEW_RULE_PRESET_IDS as IDS } from '@/features/blocking/presets'
import OnboardingFlow from '@/features/onboarding/OnboardingFlow'
import {
  clearOnboardingCheckpoint,
  readOnboardingCheckpoint,
  saveOnboardingCheckpoint,
} from '@/features/onboarding/services/onboarding-checkpoint'
import { useActivateFirstRule } from '@/features/onboarding/useActivateFirstRule'
import { completeSetup, completeSurvey } from '@/session/bootstrap'
import { useSocialSignIn } from '@/session/useSocialSignIn'
import { useAppGateStore } from '@/shared/stores/app-gate.store'
import { showErrorToast } from '@/shared/utils/toast'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('@/session/bootstrap', () => ({
  applyEntitlement: jest.fn(),
  completeSetup: jest.fn(),
  // `true` = la navigation vers /paywall a été prise en charge : le parcours
  // s'arrête là. Voir `completeSurvey` dans `src/session/bootstrap.ts`.
  completeSurvey: jest.fn(() => true),
}))
jest.mock('@/session/dev-test-bridge', () => ({
  DEV_EVENT_ONBOARDING_JUMP: 'test-onboarding-jump',
}))
jest.mock('@/session/useSocialSignIn', () => ({
  useSocialSignIn: jest.fn(),
}))
jest.mock('@/shared/native/useTrackingPrompt', () => ({
  useTrackingPrompt: jest.fn(),
}))
jest.mock('@/features/onboarding/useActivateFirstRule', () => ({
  useActivateFirstRule: jest.fn(),
}))
jest.mock('@/shared/utils/toast', () => ({ showErrorToast: jest.fn() }))
jest.mock('@/features/onboarding/bits', () => ({
  BackBtn: 'BackBtn',
  ChoiceCard: 'ChoiceCard',
  ChoiceGrid: 'ChoiceGrid',
  HaloBackdrop: 'HaloBackdrop',
  OBProgress: 'OBProgress',
  Pill: 'Pill',
  StudyLine: 'StudyLine',
}))
jest.mock('@/features/onboarding/motion', () => ({ Reveal: 'Reveal' }))
jest.mock('@/features/onboarding/scenes-intro', () => ({
  SceneIgnition: 'SceneIgnition',
  SceneName: 'SceneName',
  SceneWelcome: 'SceneWelcome',
}))
jest.mock('@/features/onboarding/scenes-verdict', () => ({
  SceneBeat: 'SceneBeat',
  SceneGoodNews: 'SceneGoodNews',
  SceneMirror: 'SceneMirror',
  SceneReversal: 'SceneReversal',
}))
jest.mock('@/features/onboarding/components/SceneRitual', () => ({
  SceneRitual: 'SceneRitual',
}))
jest.mock('@/features/onboarding/scenes-tutorial', () => ({
  DEFAULT_RULE_PRESET_IDS: [],
  SceneRules: 'SceneRules',
  SceneGroundRules: 'SceneGroundRules',
  SceneLockDemo: 'SceneLockDemo',
  SceneHardMode: 'SceneHardMode',
  ScenePickApps: 'ScenePickApps',
}))
jest.mock('@/features/onboarding/scenes-power', () => ({
  ScenePermission: 'ScenePermission',
  SceneNotifs: 'SceneNotifs',
}))
jest.mock('@/features/onboarding/services/revenuecat', () => ({
  setOnboardingAttributes: jest.fn(async () => undefined),
}))
jest.mock('@/features/onboarding/services/onboarding-answers.service', () => ({
  saveOnboardingAnswers: jest.fn(async () => undefined),
}))
jest.mock('@/features/onboarding/scenes-auth', () => ({
  SceneAuth: 'SceneAuth',
}))
jest.mock('@/features/onboarding/components/SceneRecognition', () => ({}))
jest.mock('@/features/onboarding/components/SceneVictory', () => ({
  SceneVictory: 'SceneVictory',
}))
jest.mock('@/features/onboarding/components/ScenePersonalizedPlan', () => ({
  ScenePersonalizedPlan: 'ScenePersonalizedPlan',
}))
jest.mock('@/features/onboarding/components/ScenePlanPreparation', () => ({
  ScenePlanPreparation: 'ScenePlanPreparation',
}))

describe('personalized plan flow', () => {
  let renderer: ReactTestRenderer
  const activate = jest.fn()
  const signIn = jest.fn()
  const jump = (step: string) =>
    act(() => {
      DeviceEventEmitter.emit('test-onboarding-jump', { step })
    })
  const host = (name: string) =>
    renderer.root.find(node => (node.type as unknown) === name)
  beforeEach(() => {
    jest.clearAllMocks()
    clearOnboardingCheckpoint()
    useAppGateStore.setState({
      surveyDone: false,
      entitled: false,
      setupDone: false,
    })
    jest.mocked(completeSurvey).mockReturnValue(true)
    activate.mockReset().mockResolvedValue(undefined)
    signIn.mockReset().mockResolvedValue({ ok: true })
    jest.mocked(useActivateFirstRule).mockReturnValue(activate)
    jest.mocked(useSocialSignIn).mockReturnValue({
      signInWithApple: signIn,
      signInWithGoogle: signIn,
      pending: false,
    })
    act(() => {
      renderer = create(<OnboardingFlow />)
    })
  })
  afterEach(() => {
    act(() => renderer.unmount())
  })

  it('places the plan after analysis, and carries the same proposals into the editable rule selection', () => {
    jump('name')
    act(() => host('SceneName').props.onChange('Léa'))
    jump('moment')
    act(() =>
      renderer.root.findByProps({ label: 'Dès le réveil' }).props.onPress(),
    )
    jump('apps')
    act(() => renderer.root.findByProps({ label: 'TikTok' }).props.onPress())
    jump('loading')
    act(() => host('ScenePlanPreparation').props.onDone())
    const plan = host('ScenePersonalizedPlan').props.plan
    expect(plan.recap).toBe('Léa, tu scrolles sur TikTok dès le réveil.')
    expect(plan.rules.map((rule: { id: string }) => rule.id)).toEqual([
      IDS.morning,
    ])
    act(() => host('ScenePersonalizedPlan').props.onNext())
    expect(host('SceneRitual')).toBeDefined()
    jump('tutoRules')
    expect(host('SceneRules').props.selectedIds).toEqual([IDS.morning])
    expect(host('SceneRules').props.recommendedIds).toEqual([IDS.morning])
    act(() => host('SceneRules').props.onToggle({ presetId: IDS.morning }))
    expect(host('SceneRules').props.selectedIds).toEqual([])
  })

  it('starts the emotional sequence directly after the daily usage question', () => {
    jump('screenTime')
    act(() =>
      renderer.root.findByProps({ label: '4 à 6 heures' }).props.onPress(),
    )
    act(() => renderer.root.findByProps({ label: 'Continuer' }).props.onPress())
    expect(host('SceneBeat')).toBeDefined()
  })

  it('arrête le parcours au rituel : l’offre est une route, pas une étape', () => {
    jump('ritual')
    act(() => host('SceneRitual').props.onDone())
    expect(completeSurvey).toHaveBeenCalledTimes(1)
    // `completeSurvey` a remplacé la route par le paywall : le parcours ne
    // doit surtout pas avancer tout seul derrière lui.
    expect(host('SceneRitual')).toBeDefined()
  })

  it('enchaîne sur le compte quand il n’y a rien à vendre à cet utilisateur', () => {
    jest.mocked(completeSurvey).mockReturnValueOnce(false)
    jump('ritual')
    act(() => host('SceneRitual').props.onDone())
    expect(host('SceneAuth')).toBeDefined()
  })

  it('requires an account even when the offer is declined', async () => {
    jump('auth')
    await act(async () => host('SceneAuth').props.onApple())
    act(() => host('SceneGroundRules').props.onNext())
    act(() => host('SceneLockDemo').props.onNext())
    act(() => host('SceneHardMode').props.onNext())
    act(() => host('ScenePermission').props.onNext())
    act(() => host('ScenePickApps').props.onNext())
    expect(host('SceneRules')).toBeDefined()
    expect(completeSetup).not.toHaveBeenCalled()
  })

  it('waits for activation before notifications and prevents duplicate activation', async () => {
    let resolveActivation!: () => void
    activate.mockReturnValue(
      new Promise<void>(resolve => {
        resolveActivation = resolve
      }),
    )
    jump('plan')
    act(() => host('ScenePersonalizedPlan').props.onNext())
    jump('tutoRules')
    const onActivate = host('SceneRules').props.onActivate
    let pending!: Promise<void>
    act(() => {
      pending = onActivate()
      onActivate()
    })
    expect(activate).toHaveBeenCalledTimes(1)
    expect(host('SceneRules').props.busy).toBe(true)
    expect(completeSetup).not.toHaveBeenCalled()
    await act(async () => {
      resolveActivation()
      await pending
    })
    expect(host('SceneNotifs')).toBeDefined()
    expect(completeSetup).not.toHaveBeenCalled()
    act(() => host('SceneNotifs').props.onNext())
    expect(host('SceneVictory')).toBeDefined()
    expect(completeSetup).not.toHaveBeenCalled()
    act(() => host('SceneVictory').props.onDone())
    expect(completeSetup).toHaveBeenCalledTimes(1)
    expect(activate).toHaveBeenCalledTimes(1)
  })

  it('rend un échec d’activation réessayable avant de laisser entrer', async () => {
    const error = new Error('Activation impossible')
    activate.mockRejectedValue(error)
    jump('plan')
    act(() => host('ScenePersonalizedPlan').props.onNext())
    jump('tutoRules')

    await act(async () => host('SceneRules').props.onActivate())
    expect(showErrorToast).toHaveBeenCalledWith(error)
    // Le premier échec ne fait PAS entrer dans l'app : abonné, dans l'app,
    // et zéro blocage armé était le pire état possible du produit.
    expect(completeSetup).not.toHaveBeenCalled()
    expect(host('SceneRules')).toBeDefined()

    // …et il reste réessayable : sans le reset du garde, le bouton ne
    // répondait plus jamais après un premier échec.
    await act(async () => host('SceneRules').props.onActivate())
    expect(activate).toHaveBeenCalledTimes(2)
    // Deuxième échec : il a payé, on ne le retient pas en otage.
    expect(completeSetup).toHaveBeenCalledTimes(1)
    expect(
      renderer.root.findAll(node => (node.type as unknown) === 'SceneNotifs'),
    ).toHaveLength(0)
    expect(
      renderer.root.findAll(node => (node.type as unknown) === 'SceneVictory'),
    ).toHaveLength(0)
  })

  it.each([
    true,
    false,
  ])('allows another sign-in attempt after a cancellation/error (canceled: %s)', async canceled => {
    const error = new Error('Connexion impossible')
    signIn.mockResolvedValueOnce({ ok: false, canceled, error })
    jump('auth')
    await act(async () => host('SceneAuth').props.onApple())
    expect(host('SceneAuth').props.onSkip).toBeUndefined()
    expect(showErrorToast).toHaveBeenCalledTimes(canceled ? 0 : 1)
    expect(completeSetup).not.toHaveBeenCalled()
    await act(async () => host('SceneAuth').props.onGoogle())
    expect(host('SceneGroundRules')).toBeDefined()
  })
})

describe("reprise de l'onboarding après fermeture de l'app", () => {
  let renderer: ReactTestRenderer
  const host = (name: string) =>
    renderer.root.find(node => (node.type as unknown) === name)
  const render = () =>
    act(() => {
      renderer = create(<OnboardingFlow />)
    })
  const answers = {
    name: 'Léa',
    trigger: 'bed',
    apps: ['TikTok'],
    moment: 'wake',
    feelings: ['guilt'],
    screenTime: '4-6',
    hours: 5,
    hardMode: false,
    appCount: 3,
    rulePresetIds: [IDS.morning],
  }

  beforeEach(() => {
    jest.clearAllMocks()
    clearOnboardingCheckpoint()
    useAppGateStore.setState({
      surveyDone: false,
      entitled: false,
      setupDone: false,
    })
    jest.mocked(useActivateFirstRule).mockReturnValue(jest.fn())
    jest.mocked(useSocialSignIn).mockReturnValue({
      signInWithApple: jest.fn(),
      signInWithGoogle: jest.fn(),
      pending: false,
    })
  })
  afterEach(() => {
    act(() => renderer.unmount())
    clearOnboardingCheckpoint()
  })

  it('reprend à sa question quand le questionnaire est resté en plan', () => {
    saveOnboardingCheckpoint({ step: 'moment', answers })
    render()
    expect(renderer.root.findByProps({ label: 'Dès le réveil' })).toBeDefined()
  })

  it('ne rejoue JAMAIS le récit à un abonné, même sans sauvegarde', () => {
    // Il a payé : lui refaire le diagnostic et le plan serait une punition.
    // Il reprend au parcours d'activation, seul endroit où une position a
    // encore du sens — l'offre, elle, est un état, pas une étape.
    useAppGateStore.setState({ surveyDone: true, entitled: true })
    saveOnboardingCheckpoint({ step: 'plan', answers })
    render()
    expect(host('SceneAuth')).toBeDefined()
  })

  it("reprend exactement à l'étape mémorisée du parcours d'activation", () => {
    useAppGateStore.setState({ surveyDone: true, entitled: true })
    saveOnboardingCheckpoint({ step: 'tutoApps', answers })
    render()
    const scene = host('ScenePickApps')
    expect(scene).toBeDefined()
    // Les réponses aussi sont restaurées, pas seulement la position.
    expect(scene.props.count).toBe(3)
  })

  it('repart du début sans sauvegarde, ou après une refonte des étapes', () => {
    render()
    expect(host('SceneIgnition')).toBeDefined()
    act(() => renderer.unmount())
    saveOnboardingCheckpoint({ step: 'étape-supprimée', answers })
    render()
    expect(host('SceneIgnition')).toBeDefined()
  })

  it('enregistre chaque étape atteinte, avec les réponses du moment', () => {
    render()
    // Rien à reprendre tant qu'on n'a pas dépassé l'écran d'allumage.
    expect(readOnboardingCheckpoint()).toBeNull()
    act(() => host('SceneIgnition').props.onDone())
    expect(readOnboardingCheckpoint()?.step).toBe('welcome')
    act(() => {
      DeviceEventEmitter.emit('test-onboarding-jump', { step: 'name' })
    })
    act(() => host('SceneName').props.onChange('Léa'))
    act(() => {
      DeviceEventEmitter.emit('test-onboarding-jump', { step: 'ritual' })
    })
    const checkpoint = readOnboardingCheckpoint()
    expect(checkpoint?.step).toBe('ritual')
    expect(checkpoint?.answers.name).toBe('Léa')
  })
})
