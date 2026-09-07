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
  ScenePickerDemo: 'ScenePickerDemo',
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

  const cont = () =>
    act(() => renderer.root.findByProps({ label: 'Continuer' }).props.onPress())
  const pick = (label: string) =>
    act(() => renderer.root.findByProps({ label }).props.onPress())

  it('ferme le diagnostic sur l’objectif, juste avant le verdict', () => {
    jump('screenTime')
    pick('4 à 6 heures')
    cont()
    // La dernière question du diagnostic annonce le temps calculé depuis SES
    // réponses — pas un chiffre générique.
    expect(
      renderer.root.findByProps({
        title: 'Si tu récupérais 2 h 30 par jour, tu en ferais quoi ?',
      }),
    ).toBeDefined()
    // Et on ne passe pas sans avoir nommé au moins une chose à récupérer.
    cont()
    expect(
      renderer.root.findAll(node => (node.type as unknown) === 'SceneBeat'),
    ).toHaveLength(0)
    act(() => host('ChoiceGrid').props.onToggle('sleep'))
    cont()
    expect(host('SceneBeat')).toBeDefined()
  })

  const selected = (label: string) =>
    renderer.root.findByProps({ label }).props.selected

  it('exige au moins une réponse sur les écrans d’aveu, et n’en plafonne aucune', () => {
    jump('stolen')
    // Sans réponse, le bouton est là mais inerte : ces aveux nourrissent le
    // plan, passer sans rien cocher le viderait de sa substance.
    cont()
    expect(
      renderer.root.findByProps({
        title: "Qu'est-ce que le scroll t'a déjà volé ?",
      }),
    ).toBeDefined()
    const losses = [
      'Des nuits que je ne récupérerai jamais',
      'Ma capacité à me concentrer',
      "L'énergie que je n'ai plus pour le reste",
      "Des moments avec les gens que j'aime",
      'Le calme dans ma tête',
    ]
    for (const label of losses) pick(label)
    // Aucun tap n'est refusé : il n'appartient pas au questionnaire de décider
    // combien de choses le scroll a coûté à quelqu'un.
    for (const label of losses) expect(selected(label)).toBe(true)
    // Et décocher reste possible, sans rien libérer pour autant.
    pick('Ma capacité à me concentrer')
    expect(selected('Ma capacité à me concentrer')).toBe(false)
    // Il en reste quatre : le plancher est tenu, on avance.
    cont()
    expect(
      renderer.root.findByProps({ title: "Tu as déjà essayé d'arrêter ?" }),
    ).toBeDefined()
  })

  it('laisse cocher plusieurs motivations et plusieurs moments', () => {
    jump('trigger')
    // Sans réponse, on ne passe pas.
    cont()
    expect(selected('Je scrolle au lit')).toBe(false)
    pick('Je scrolle au lit')
    pick('Je veux reprendre le contrôle')
    // La deuxième n'efface plus la première — c'était le comportement à un
    // seul choix, et il n'y a aucune raison de n'avoir qu'une motivation.
    expect(selected('Je scrolle au lit')).toBe(true)
    expect(selected('Je veux reprendre le contrôle')).toBe(true)
    jump('moment')
    pick('Le soir, au lit')
    pick('Dans les transports')
    expect(selected('Le soir, au lit')).toBe(true)
    expect(selected('Dans les transports')).toBe(true)
    jump('plan')
    const plan = host('ScenePersonalizedPlan').props.plan
    expect(plan.recap).toContain(
      'surtout le soir, au lit et dans les transports',
    )
    expect(plan.intention).toBe('Ton objectif : retrouver tes nuits.')
  })

  it('garde une réponse unique sur l’estimation de temps d’écran', () => {
    jump('screenTime')
    pick('4 à 6 heures')
    pick('Plus de 8 heures')
    // Deux tranches cochées ne désignent aucune durée : c'est la seule
    // question du diagnostic qui se convertit en un nombre d'heures.
    expect(selected('4 à 6 heures')).toBe(false)
    expect(selected('Plus de 8 heures')).toBe(true)
  })

  it('traite « jamais vraiment essayé » comme l’absence des autres réponses', () => {
    jump('attempts')
    pick("J'ai supprimé l'app… puis réinstallé")
    pick("J'ai caché les apps dans un dossier")
    pick('Jamais vraiment essayé')
    // Sélectionner l'absence efface le reste : « tu as déjà essayé, mais… »
    // deviendrait faux sinon.
    for (const label of [
      "J'ai supprimé l'app… puis réinstallé",
      "J'ai caché les apps dans un dossier",
    ])
      expect(renderer.root.findByProps({ label }).props.selected).toBe(false)
    // Et l'inverse est vrai aussi.
    pick("J'ai tenu à la volonté. Ça n'a pas duré")
    expect(
      renderer.root.findByProps({ label: 'Jamais vraiment essayé' }).props
        .selected,
    ).toBe(false)
  })

  it('porte les trois nouvelles réponses jusqu’au plan', () => {
    jump('stolen')
    pick('Des nuits que je ne récupérerai jamais')
    cont()
    pick("J'ai mis une limite… puis « encore 15 min »")
    cont()
    pick('4 à 6 heures')
    cont()
    act(() => host('ChoiceGrid').props.onToggle('sleep'))
    cont()
    jump('plan')
    const plan = host('ScenePersonalizedPlan').props.plan
    expect(plan.loss).toBe("Et ça t'a déjà pris des nuits.")
    expect(plan.defense).toContain("une limite d'écran se repousse d'un tap")
    expect(plan.aspirationSummary).toBe('dormir')
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
    // La démonstration du sélecteur est un passage obligé, jamais un renvoi
    // optionnel : elle s'intercale AVANT l'écran de sélection.
    act(() => host('ScenePickerDemo').props.onNext())
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
    trigger: ['bed'],
    apps: ['TikTok'],
    moment: ['wake'],
    feelings: ['guilt'],
    stolen: ['nights'],
    attempts: ['limit'],
    aspirations: ['sleep'],
    screenTime: '4-6',
    hours: 5,
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

  /**
   * La garantie commerciale du produit, vue depuis l'intérieur du parcours :
   * l'écran de compte — et tout ce qui le suit — appartient à l'APRÈS-offre.
   * `app/_layout.tsx` monte déjà le paywall à la place de ce parcours quand
   * l'abonnement manque ; ce test verrouille la même règle une seconde fois,
   * ici, pour qu'aucune sauvegarde héritée ni aucun remaniement des étapes ne
   * puisse un jour faire apparaître la connexion avant le paiement.
   */
  it('ne montre JAMAIS l’écran de compte sans abonnement', () => {
    useAppGateStore.setState({ surveyDone: true, entitled: false })
    saveOnboardingCheckpoint({ step: 'auth', answers })
    render()
    expect(
      renderer.root.findAll(node => (node.type as unknown) === 'SceneAuth'),
    ).toHaveLength(0)
    // Il repart du rituel, qui reconduit au paywall — pas dans un écran mort.
    expect(host('SceneRitual')).toBeDefined()
  })

  it('ne laisse pas non plus reprendre le tutoriel d’après-offre sans abonnement', () => {
    useAppGateStore.setState({ surveyDone: true, entitled: false })
    saveOnboardingCheckpoint({ step: 'tutoApps', answers })
    render()
    expect(
      renderer.root.findAll(node => (node.type as unknown) === 'ScenePickApps'),
    ).toHaveLength(0)
    expect(host('SceneRitual')).toBeDefined()
  })

  it('reprend une sauvegarde écrite AVANT le passage au choix multiple', () => {
    // `trigger` et `moment` y valaient une chaîne. Sans la conversion du
    // schéma, tout onboarding en cours repartirait de zéro à la mise à jour.
    saveOnboardingCheckpoint({
      step: 'moment',
      answers: {
        ...answers,
        trigger: 'bed',
        moment: 'wake',
      } as unknown as typeof answers,
    })
    render()
    expect(
      renderer.root.findByProps({ label: 'Dès le réveil' }).props.selected,
    ).toBe(true)
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
