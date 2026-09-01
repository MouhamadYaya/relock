import React from 'react'
import { StyleSheet } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import {
  HOLD_MS,
  rumbleTimings,
  waveTimings,
} from '@/features/blocking/components/HoldToConfirmButton'
import { HoldToDeleteSheet } from '@/features/blocking/components/HoldToDeleteSheet'
import { relockMaterial } from '@/shared/theme'
import { haptics } from '@/shared/utils/platform/haptics'

jest.mock('@/i18n/useT', () => ({
  useT: () => (key: string) => key,
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

describe('waveTimings', () => {
  it('emits waves faster and faster, the last one closing the hold', () => {
    const timings = waveTimings()
    expect(timings).toHaveLength(7)
    expect(timings[timings.length - 1]).toBe(HOLD_MS)

    const gaps = timings.map((at, index) =>
      index === 0 ? at : at - timings[index - 1],
    )
    for (let index = 1; index < gaps.length; index += 1) {
      expect(gaps[index]).toBeLessThan(gaps[index - 1])
    }
  })
})

describe('rumbleTimings', () => {
  it('hammers harder and harder until the very end of the hold', () => {
    const timings = rumbleTimings()
    // Un martèlement, pas sept tics : le doigt doit sentir un terrassement.
    expect(timings.length).toBeGreaterThan(20)
    expect(timings[timings.length - 1]).toBe(HOLD_MS)

    const gaps = timings.map((at, index) =>
      index === 0 ? at : at - timings[index - 1],
    )
    // Le premier écart est large, le dernier avant la fin est bien plus serré.
    expect(gaps[1]).toBeLessThan(gaps[0])
    expect(gaps[gaps.length - 2]).toBeLessThan(gaps[0] / 2)
  })
})

describe('HoldToDeleteSheet', () => {
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

  /** Le nœud qui porte réellement le geste (et pas son enveloppe composite). */
  const holdButton = () =>
    renderer?.root
      .findAllByProps({ testID: 'hold-to-delete' })
      .find(node => typeof node.props.onPressIn === 'function')

  const label = () =>
    renderer?.root
      .findAllByProps({ testID: 'hold-to-delete' })
      .find(node => typeof node.props.onPressIn === 'function')
      ?.findByType('Text' as never).props.children

  const render = (onConfirm: jest.Mock) => {
    act(() => {
      renderer = create(
        <HoldToDeleteSheet
          visible
          onCancel={jest.fn()}
          onConfirm={onConfirm}
        />,
      )
    })
  }

  it('deletes only once the whole hold has been held', () => {
    const onConfirm = jest.fn()
    render(onConfirm)

    expect(label()).toBe('blocking.delete_sheet.hold')

    act(() => holdButton()?.props.onPressIn())
    // Le texte change dès l'appui : on sait qu'il faut TENIR.
    expect(label()).toBe('blocking.delete_sheet.holding')

    act(() => {
      jest.advanceTimersByTime(HOLD_MS - 50)
    })
    expect(onConfirm).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(50)
    })
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('keeps the destructive button stronger than the dark red sheet', () => {
    render(jest.fn())

    const buttonStyle = StyleSheet.flatten(holdButton()?.props.style)
    const sheetStyle = StyleSheet.flatten(
      renderer?.root.findByProps({ testID: 'hold-delete-sheet' }).props.style,
    )

    expect(buttonStyle.backgroundColor).toBe(
      relockMaterial.colors.blockingDangerSurface,
    )
    expect(sheetStyle.backgroundColor).toBe(
      relockMaterial.colors.blockingDangerCanvas,
    )
    expect(
      renderer?.root.findAllByProps({
        stopColor: relockMaterial.colors.blockingDangerDeep,
      }),
    ).not.toHaveLength(0)
  })

  it('cancels the deletion when the finger leaves early', () => {
    const onConfirm = jest.fn()
    render(onConfirm)

    act(() => holdButton()?.props.onPressIn())
    act(() => {
      jest.advanceTimersByTime(HOLD_MS / 2)
    })
    act(() => holdButton()?.props.onPressOut())

    expect(label()).toBe('blocking.delete_sheet.hold')

    act(() => {
      jest.advanceTimersByTime(HOLD_MS)
    })
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('shakes the device harder and harder while the finger holds', () => {
    render(jest.fn())

    act(() => holdButton()?.props.onPressIn())
    act(() => {
      jest.advanceTimersByTime(HOLD_MS * 0.5)
    })
    const halfway = (haptics.impactHeavy as jest.Mock).mock.calls.length
    // Rien de sec tant qu'on n'est pas dans la dernière ligne droite.
    expect(haptics.impactRigid).not.toHaveBeenCalled()

    act(() => {
      jest.advanceTimersByTime(HOLD_MS * 0.5)
    })
    const total = (haptics.impactHeavy as jest.Mock).mock.calls.length
    // La seconde moitié frappe plus souvent que la première.
    expect(total - halfway).toBeGreaterThan(halfway)
    expect(haptics.impactRigid).toHaveBeenCalled()
  })
})
