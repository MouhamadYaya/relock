import React from 'react'
import { AppState, type AppStateStatus } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { SceneRitual } from '@/features/onboarding/components/SceneRitual'
import { haptics } from '@/shared/utils/platform/haptics'

jest.mock('@/features/onboarding/motion', () => ({ Reveal: 'Reveal' }))
jest.mock('@/features/onboarding/bits', () => ({ Pill: 'Pill' }))
jest.mock('@/features/onboarding/Fingerprint', () => ({
  FingerprintMark: 'FingerprintMark',
  FP_ASPECT: 1.28,
}))

/** Doivent rester alignés sur `HOLD_MS` / `DECAY_MS` de la scène. */
const HOLD_MS = 2400
const DECAY_MS = 5600

describe('seal ritual', () => {
  let renderer: ReactTestRenderer
  let leaveForeground: ((state: AppStateStatus) => void) | undefined
  const onDone = jest.fn()

  const mark = () =>
    renderer.root.findAllByProps({
      accessibilityLabel: 'Sceller mon engagement',
    })[0]
  const said = (text: string) =>
    renderer.root.findAllByProps({ children: text }).length > 0
  const cta = () =>
    renderer.root.findAll(node => (node.type as unknown) === 'Pill')
  const hold = () => act(() => mark().props.onPressIn())
  const letGo = () => act(() => mark().props.onPressOut())
  const wait = (ms: number) =>
    act(() => {
      jest.advanceTimersByTime(ms)
    })

  beforeEach(async () => {
    jest.clearAllMocks()
    jest.spyOn(haptics, 'lock').mockImplementation(() => {})
    jest.spyOn(haptics, 'rumble').mockImplementation(() => {})
    jest.useFakeTimers()
    leaveForeground = undefined
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        leaveForeground = listener as (state: AppStateStatus) => void
        return { remove: jest.fn() } as never
      })
    await act(async () => {
      renderer = create(<SceneRitual onDone={onDone} />)
    })
  })
  afterEach(() => {
    act(() => renderer.unmount())
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('seals after a full hold and waits for the CTA before moving on', () => {
    expect(said('Scellons ton engagement.')).toBe(true)
    expect(cta()).toHaveLength(0)

    hold()
    wait(HOLD_MS)

    expect(said('Engagement scellé.')).toBe(true)
    // Le sceau joue le verrou — pas un choc générique : c'est littéralement
    // ce que le geste vient de faire.
    expect(haptics.lock).toHaveBeenCalled()
    // Le CTA existe, mais la scène n'avance pas toute seule.
    expect(onDone).not.toHaveBeenCalled()
    act(() => cta()[0].props.onPress())
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('resumes where the finger left off instead of starting over', () => {
    hold()
    wait(HOLD_MS / 2) // 50 %
    letGo()
    wait(DECAY_MS * 0.1) // il en reste 40 %

    expect(said('Engagement scellé.')).toBe(false)
    expect(said('Ta progression est gardée. Repose ton doigt.')).toBe(true)

    // Reprise : 60 % de maintien suffisent — pas 100 %.
    hold()
    wait(HOLD_MS * 0.62)

    expect(said('Engagement scellé.')).toBe(true)
  })

  it('never seals on its own once the finger is gone', () => {
    hold()
    wait(HOLD_MS * 0.9)
    letGo()
    wait(HOLD_MS * 10)

    expect(said('Engagement scellé.')).toBe(false)
    expect(onDone).not.toHaveBeenCalled()
    // La progression s'est évaporée : on repart de l'invitation initiale.
    expect(said('Pose ton doigt sur l’empreinte et maintiens.')).toBe(true)
  })

  it('drops a hold in progress when the app leaves the foreground', () => {
    hold()
    wait(HOLD_MS * 0.5)
    act(() => leaveForeground?.('background'))
    wait(HOLD_MS)

    expect(said('Engagement scellé.')).toBe(false)
    expect(said('Ta progression est gardée. Repose ton doigt.')).toBe(true)
  })

  it('leaves no timer behind when unmounted mid-hold', () => {
    hold()
    wait(HOLD_MS / 2)
    act(() => renderer.unmount())
    jest.advanceTimersByTime(HOLD_MS * 4)

    expect(haptics.lock).not.toHaveBeenCalled()
    // Remonté pour que le démontage du `afterEach` reste inoffensif.
    act(() => {
      renderer = create(<SceneRitual onDone={onDone} />)
    })
  })
})
