import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { SceneName, SceneWelcome } from '@/features/onboarding/scenes-intro'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))
jest.mock('react-native-gesture-handler', () => ({}))
jest.mock('@/features/onboarding/motion', () => ({ Reveal: 'Reveal' }))
jest.mock('@/features/onboarding/bits', () => ({
  Pill: 'Pill',
  GhostLink: 'GhostLink',
}))

describe('Welcome development shortcut', () => {
  let renderer: ReactTestRenderer | undefined
  const runtime = globalThis as typeof globalThis & { __DEV__: boolean }
  const originalDev = __DEV__

  afterEach(() => {
    act(() => renderer?.unmount())
    runtime.__DEV__ = originalDev
  })

  it('skips the whole onboarding without advancing the normal journey', () => {
    runtime.__DEV__ = true
    const onNext = jest.fn()
    const onSkipDev = jest.fn()
    act(() => {
      renderer = create(<SceneWelcome onNext={onNext} onSkipDev={onSkipDev} />)
    })
    act(() => {
      renderer!.root.findByProps({ label: 'Passer (dev)' }).props.onPress()
    })
    expect(onSkipDev).toHaveBeenCalledTimes(1)
    expect(onNext).not.toHaveBeenCalled()
  })

  it('jumps to the paywall chapter without advancing the normal journey', () => {
    runtime.__DEV__ = true
    const onNext = jest.fn()
    const onPaywallDev = jest.fn()
    act(() => {
      renderer = create(
        <SceneWelcome onNext={onNext} onPaywallDev={onPaywallDev} />,
      )
    })
    act(() => {
      renderer!.root.findByProps({ label: 'Paywall (dev)' }).props.onPress()
    })
    expect(onPaywallDev).toHaveBeenCalledTimes(1)
    expect(onNext).not.toHaveBeenCalled()
  })

  it('never shows the shortcut in production, even with a callback', () => {
    runtime.__DEV__ = false
    act(() => {
      renderer = create(
        <SceneWelcome
          onNext={jest.fn()}
          onSkipDev={jest.fn()}
          onPaywallDev={jest.fn()}
        />,
      )
    })
    expect(
      renderer!.root.findAllByProps({ label: 'Passer (dev)' }),
    ).toHaveLength(0)
    expect(
      renderer!.root.findAllByProps({ label: 'Paywall (dev)' }),
    ).toHaveLength(0)
    expect(renderer!.root.findAllByProps({ label: 'Commencer' })).toHaveLength(
      1,
    )
  })
})

describe('Name step', () => {
  let renderer: ReactTestRenderer | undefined

  afterEach(() => act(() => renderer?.unmount()))

  const render = (value: string, onNext = jest.fn()) => {
    act(() => {
      renderer = create(
        <SceneName value={value} onChange={jest.fn()} onNext={onNext} />,
      )
    })
    return onNext
  }

  it('keeps the CTA disabled until a name is typed', () => {
    render('   ')
    expect(
      renderer!.root.findByProps({ label: 'Continuer' }).props.disabled,
    ).toBe(true)
  })

  it('enables the CTA once a name is typed', () => {
    render('Léa')
    expect(
      renderer!.root.findByProps({ label: 'Continuer' }).props.disabled,
    ).toBe(false)
  })

  it('offers no way to skip the name', () => {
    render('')
    expect(renderer!.root.findAllByProps({ label: 'Passer' })).toHaveLength(0)
  })

  it('ignores the keyboard submit while the field is empty', () => {
    const onNext = render('')
    act(() =>
      renderer!.root
        .findByProps({ placeholder: 'Ton prénom' })
        .props.onSubmitEditing(),
    )
    expect(onNext).not.toHaveBeenCalled()
  })
})
