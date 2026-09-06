import React from 'react'
import { DeviceEventEmitter } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { NEW_RULE_PRESET_IDS as IDS } from '@/features/blocking/presets'
import OnboardingFlow from '@/features/onboarding/OnboardingFlow'
import { useActivateFirstRule } from '@/features/onboarding/useActivateFirstRule'
import { completeOnboarding } from '@/session/bootstrap'
import { useSocialSignIn } from '@/session/useSocialSignIn'
import { showErrorToast } from '@/shared/utils/toast'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('@/session/bootstrap', () => ({ completeOnboarding: jest.fn() }))
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
  ScenePaywall: 'ScenePaywall',
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

  it('places the offer after the ritual, then requires an account even when the offer is declined', async () => {
    jump('ritual')
    act(() => host('SceneRitual').props.onDone())
    act(() => host('ScenePaywall').props.onNext())
    await act(async () => host('SceneAuth').props.onApple())
    act(() => host('SceneGroundRules').props.onNext())
    act(() => host('SceneLockDemo').props.onNext())
    act(() => host('SceneHardMode').props.onNext())
    act(() => host('ScenePermission').props.onNext())
    act(() => host('ScenePickApps').props.onNext())
    expect(host('SceneRules')).toBeDefined()
    expect(completeOnboarding).not.toHaveBeenCalled()
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
    expect(completeOnboarding).not.toHaveBeenCalled()
    await act(async () => {
      resolveActivation()
      await pending
    })
    expect(host('SceneNotifs')).toBeDefined()
    expect(completeOnboarding).not.toHaveBeenCalled()
    act(() => host('SceneNotifs').props.onNext())
    expect(host('SceneVictory')).toBeDefined()
    expect(completeOnboarding).not.toHaveBeenCalled()
    act(() => host('SceneVictory').props.onDone())
    expect(completeOnboarding).toHaveBeenCalledTimes(1)
    expect(activate).toHaveBeenCalledTimes(1)
  })

  it('keeps the existing exit on activation failure without asking for notifications', async () => {
    const error = new Error('Activation impossible')
    activate.mockRejectedValue(error)
    jump('plan')
    act(() => host('ScenePersonalizedPlan').props.onNext())
    jump('tutoRules')
    await act(async () => host('SceneRules').props.onActivate())
    expect(showErrorToast).toHaveBeenCalledWith(error)
    expect(completeOnboarding).toHaveBeenCalledTimes(1)
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
    expect(completeOnboarding).not.toHaveBeenCalled()
    await act(async () => host('SceneAuth').props.onGoogle())
    expect(host('SceneGroundRules')).toBeDefined()
  })
})
