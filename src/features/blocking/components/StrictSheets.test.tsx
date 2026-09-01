import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { HOLD_MS } from '@/features/blocking/components/HoldToConfirmButton'
import { StrictBlockSheet } from '@/features/blocking/components/StrictBlockSheet'
import { StrictCommitmentSheet } from '@/features/blocking/components/StrictCommitmentSheet'
import { haptics } from '@/shared/utils/platform/haptics'

jest.mock('@/i18n/useT', () => ({
  useT: () => (key: string, values?: Record<string, string>) =>
    values ? `${key}:${Object.values(values).join(',')}` : key,
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

const pressable = (renderer: ReactTestRenderer | undefined, testID: string) =>
  renderer?.root
    .findAllByProps({ testID })
    .find(node => typeof node.props.onPress === 'function')

const holdable = (renderer: ReactTestRenderer | undefined, testID: string) =>
  renderer?.root
    .findAllByProps({ testID })
    .find(node => typeof node.props.onPressIn === 'function')

describe('StrictBlockSheet', () => {
  let renderer: ReactTestRenderer | undefined

  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-08-31T21:00:00'))
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  const texts = () =>
    renderer?.root
      .findAllByType('Text' as never)
      .map(node => String(node.props.children)) ?? []

  it('answers with the deadline instead of an unlock path', () => {
    act(() => {
      renderer = create(
        <StrictBlockSheet
          visible
          scope="app"
          ruleTitle="Débranche"
          endsAt={new Date('2026-08-31T22:30:00')}
          onClose={jest.fn()}
        />,
      )
    })

    const joined = texts().join('|')
    expect(joined).toContain('blocking.strict_lock.body_app')
    expect(joined).toContain('blocking.strict_lock.until:22 h 30')
    expect(joined).toContain('blocking.strict_lock.remaining:1 h 30')
    // Aucune sortie : la seule action est d'accuser réception.
    expect(joined).not.toContain('unlock')
  })

  it('falls back to a wording that needs no clock when the end is unknown', () => {
    act(() => {
      renderer = create(
        <StrictBlockSheet
          visible
          scope="rule"
          endsAt={null}
          onClose={jest.fn()}
        />,
      )
    })

    expect(texts().join('|')).toContain('blocking.strict_lock.no_end')
  })

  it('closes on acknowledgement', () => {
    const onClose = jest.fn()
    act(() => {
      renderer = create(
        <StrictBlockSheet visible scope="rule" onClose={onClose} />,
      )
    })

    act(() => pressable(renderer, 'strict-lock-ack')?.props.onPress())
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('StrictCommitmentSheet', () => {
  let renderer: ReactTestRenderer | undefined

  beforeEach(() => {
    jest.useFakeTimers()
    jest.spyOn(haptics, 'impactHeavy').mockImplementation(() => {})
    jest.spyOn(haptics, 'impactRigid').mockImplementation(() => {})
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
    jest.restoreAllMocks()
    jest.useRealTimers()
  })

  const render = () => {
    const onCommit = jest.fn()
    const onCancel = jest.fn()
    act(() => {
      renderer = create(
        <StrictCommitmentSheet
          visible
          endsAtLabel="22h30"
          onCancel={onCancel}
          onCommit={onCommit}
        />,
      )
    })
    return { onCommit, onCancel }
  }

  it('spells out the deadline and the irreversibility before committing', () => {
    const { onCommit, onCancel } = render()

    const joined =
      renderer?.root
        .findAllByType('Text' as never)
        .map(node => String(node.props.children))
        .join('|') ?? ''
    expect(joined).toContain('blocking.strict_commit.body:22h30')
    expect(joined).toContain('blocking.strict_commit.irreversible')

    // S'engager se TIENT : un tap ne suffit pas pour un geste sans retour.
    act(() => holdable(renderer, 'strict-commit-confirm')?.props.onPressIn())
    act(() => {
      jest.advanceTimersByTime(HOLD_MS - 50)
    })
    expect(onCommit).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(50)
    })
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('commits nothing when the finger leaves the button early', () => {
    const { onCommit } = render()

    act(() => holdable(renderer, 'strict-commit-confirm')?.props.onPressIn())
    act(() => {
      jest.advanceTimersByTime(HOLD_MS / 2)
    })
    act(() => holdable(renderer, 'strict-commit-confirm')?.props.onPressOut())
    act(() => {
      jest.advanceTimersByTime(HOLD_MS)
    })

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('cancels without committing', () => {
    const { onCommit, onCancel } = render()

    act(() => pressable(renderer, 'strict-commit-cancel')?.props.onPress())
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onCommit).not.toHaveBeenCalled()
  })
})
