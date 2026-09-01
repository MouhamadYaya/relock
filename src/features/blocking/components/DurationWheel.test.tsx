import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import {
  BLOCK_DURATION_OPTIONS,
  DAILY_LIMIT_OPTIONS,
  DurationWheel,
  durationForOffset,
  nearestDurationOption,
} from '@/features/blocking/components/DurationWheel'

describe('duration options', () => {
  it('offers blocks as short as five minutes', () => {
    // Le plancher de 30 min venait d'un picker qui ne rendait jamais sa
    // valeur : le produit, lui, doit savoir bloquer cinq minutes.
    expect(BLOCK_DURATION_OPTIONS[0]).toBe(5)
    expect(BLOCK_DURATION_OPTIONS).toContain(15)
    expect(DAILY_LIMIT_OPTIONS[0]).toBe(5)
  })

  it('keeps the options sorted so the wheel reads bottom-up', () => {
    const sorted = [...BLOCK_DURATION_OPTIONS].sort((a, b) => a - b)
    expect(BLOCK_DURATION_OPTIONS).toEqual(sorted)
  })
})

describe('durationForOffset', () => {
  const ROW = 48

  it('maps a scroll offset to the row under the selection capsule', () => {
    expect(durationForOffset(0, BLOCK_DURATION_OPTIONS)).toBe(5)
    expect(durationForOffset(ROW, BLOCK_DURATION_OPTIONS)).toBe(10)
    expect(durationForOffset(ROW * 5, BLOCK_DURATION_OPTIONS)).toBe(30)
  })

  it('never falls off either end of the wheel', () => {
    expect(durationForOffset(-500, BLOCK_DURATION_OPTIONS)).toBe(5)
    expect(durationForOffset(99_999, BLOCK_DURATION_OPTIONS)).toBe(
      BLOCK_DURATION_OPTIONS[BLOCK_DURATION_OPTIONS.length - 1],
    )
  })
})

describe('nearestDurationOption', () => {
  it('snaps a stored free-form duration onto the closest step', () => {
    // Les règles créées avant la molette portent n'importe quelle valeur.
    expect(nearestDurationOption(40, BLOCK_DURATION_OPTIONS)).toBe(45)
    expect(nearestDurationOption(37, BLOCK_DURATION_OPTIONS)).toBe(30)
    expect(nearestDurationOption(31, BLOCK_DURATION_OPTIONS)).toBe(30)
    expect(nearestDurationOption(5, BLOCK_DURATION_OPTIONS)).toBe(5)
  })
})

describe('DurationWheel', () => {
  let renderer: ReactTestRenderer | undefined

  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  it('reports the duration the user actually picks', () => {
    const onChange = jest.fn()
    act(() => {
      renderer = create(
        <DurationWheel
          minutes={30}
          options={BLOCK_DURATION_OPTIONS}
          onChange={onChange}
          accessibilityLabel="Durée"
        />,
      )
    })

    const row = renderer?.root
      .findAllByProps({ accessibilityLabel: '5 min' })
      .find(node => typeof node.props.onPress === 'function')

    act(() => row?.props.onPress())
    expect(onChange).toHaveBeenCalledWith(5)
  })
})
