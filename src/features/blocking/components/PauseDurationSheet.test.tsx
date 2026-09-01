import React from 'react'
import { StyleSheet } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import {
  PauseDurationSheet,
  pauseUntil,
} from '@/features/blocking/components/PauseDurationSheet'
import { relockMaterial } from '@/shared/theme'

jest.mock('@/i18n/useT', () => ({
  useT: () => (key: string) => key,
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock('@/shared/components/ui/IconSvg', () => ({
  IconSvg: () => null,
}))

describe('pauseUntil', () => {
  const now = new Date('2026-08-31T20:07:00')

  it('turns each choice into a resume deadline', () => {
    expect(pauseUntil('min15', now)?.toISOString()).toBe(
      new Date(now.getTime() + 15 * 60_000).toISOString(),
    )
    expect(pauseUntil('hour1', now)?.toISOString()).toBe(
      new Date(now.getTime() + 3_600_000).toISOString(),
    )
    expect(pauseUntil('day1', now)?.toISOString()).toBe(
      new Date(now.getTime() + 86_400_000).toISOString(),
    )
  })

  it('sends « pour aujourd’hui » to the next midnight, not to +24 h', () => {
    const until = pauseUntil('today', now)
    expect(until?.getDate()).toBe(1)
    expect(until?.getHours()).toBe(0)
    expect(until?.getMinutes()).toBe(0)
  })

  it('leaves an indefinite pause without a deadline', () => {
    expect(pauseUntil('indefinite', now)).toBeNull()
  })
})

describe('PauseDurationSheet', () => {
  let renderer: ReactTestRenderer | undefined

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
    // La feuille recentre sa molette via requestAnimationFrame : sans purge,
    // le rappel se réveille après le démontage de l'environnement Jest.
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('confirms with the deadline of the selected duration', () => {
    const onConfirm = jest.fn()
    act(() => {
      renderer = create(
        <PauseDurationSheet
          visible
          onBack={jest.fn()}
          onConfirm={onConfirm}
          onDelete={jest.fn()}
        />,
      )
    })

    // La feuille s'ouvre sur le choix le moins destructeur.
    act(() =>
      renderer?.root
        .findByProps({ testID: 'pause-duration-confirm' })
        .props.onPress(),
    )

    expect(onConfirm).toHaveBeenCalledTimes(1)
    const [until, choice] = onConfirm.mock.calls[0]
    expect(choice).toBe('min15')
    expect(until).toBeInstanceOf(Date)
  })

  it('routes the red action to the deletion sheet instead of pausing', () => {
    const onDelete = jest.fn()
    const onConfirm = jest.fn()
    act(() => {
      renderer = create(
        <PauseDurationSheet
          visible
          onBack={jest.fn()}
          onConfirm={onConfirm}
          onDelete={onDelete}
        />,
      )
    })

    act(() =>
      renderer?.root
        .findByProps({ testID: 'pause-duration-delete' })
        .props.onPress(),
    )

    expect(onDelete).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('keeps the picker accent local instead of flooding the whole sheet', () => {
    act(() => {
      renderer = create(
        <PauseDurationSheet
          visible
          onBack={jest.fn()}
          onConfirm={jest.fn()}
          onDelete={jest.fn()}
        />,
      )
    })

    expect(
      renderer?.root.findByProps({ testID: 'blocking-sheet-surface' }),
    ).toBeTruthy()
    const selection = renderer?.root.findByProps({
      testID: 'pause-picker-selection',
    })
    expect(StyleSheet.flatten(selection?.props.style).backgroundColor).toBe(
      relockMaterial.colors.blockingAccentTint,
    )
  })
})
