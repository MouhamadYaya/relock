import React from 'react'
import { Text } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { HomeScoreDetail } from '@/features/home/components/HomeScoreDetail'
import type { HomeScoreSnapshot } from '@/features/home/types'

const snapshot = (
  over: Partial<HomeScoreSnapshot> = {},
): HomeScoreSnapshot => ({
  status: 'ready',
  global: 38,
  focus: 68,
  rest: 7,
  delta: -4,
  weakestAxis: 'rest',
  historyDays: 7,
  confidence: 1,
  components: [
    {
      signal: 'pressure',
      axis: 'focus',
      score: 40,
      weight: 0.55,
      observed: 21,
      reference: 12,
      unit: 'count',
    },
  ],
  trend: [{ date: '2026-01-15', score: 38 }],
  elapsedMinutes: 720,
  protectedMinutes: 0,
  ...over,
})

jest.mock('@/i18n/useT', () => ({
  useT: () => (key: string) => key,
}))
jest.mock('@/shared/components/ui/IconSvg', () => {
  const { View } = require('react-native')
  return { IconSvg: () => <View /> }
})

describe('Home score detail window', () => {
  let renderer: ReactTestRenderer | undefined
  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
  })
  const texts = () =>
    renderer!.root.findAllByType(Text).map(node => node.props.children)

  it('stays closed until the card asks for it', () => {
    act(() => {
      renderer = create(
        <HomeScoreDetail
          visible={false}
          snapshot={snapshot()}
          onClose={jest.fn()}
        />,
      )
    })
    expect(renderer!.root.findAllByType(Text)).toHaveLength(0)
  })

  it('explains what the score is, how it works and how to improve it', () => {
    act(() => {
      renderer = create(
        <HomeScoreDetail visible snapshot={snapshot()} onClose={jest.fn()} />,
      )
    })
    expect(texts()).toEqual(
      expect.arrayContaining([
        'home.score_how_title',
        'home.score_today',
        'home.score_improve_title',
        'home.score_lowers_title',
        'home.score_band_fair',
        38,
      ]),
    )
  })

  it('shows the raw measure behind each score, not a paragraph about it', () => {
    act(() => {
      renderer = create(
        <HomeScoreDetail visible snapshot={snapshot()} onClose={jest.fn()} />,
      )
    })
    const rendered = texts()
    // La mesure recomptable reste — c'est elle qui rend le score vérifiable.
    expect(rendered).toContain('home.score_signal_pressure_measure')
    expect(rendered).toContain('home.score_signal_pressure_label')
    // Les gloses qui noyaient la feuille ont disparu.
    expect(rendered).not.toContain('home.score_signal_pressure_body')
    expect(rendered).not.toContain('home.score_note')
    expect(rendered).not.toContain('home.score_detail_formula')
  })

  it('closes from its own control', () => {
    const onClose = jest.fn()
    act(() => {
      renderer = create(
        <HomeScoreDetail
          visible
          snapshot={snapshot({
            status: 'pending',
            global: null,
            focus: null,
            rest: null,
            delta: null,
            components: [],
            trend: [],
          })}
          onClose={onClose}
        />,
      )
    })
    expect(texts()).toEqual(
      expect.arrayContaining(['home.score_detail_unavailable', '—']),
    )
    act(() =>
      renderer!.root
        .findAllByProps({ accessibilityLabel: 'home.close' })
        .filter(node => typeof node.props.onPress === 'function')[0]
        .props.onPress(),
    )
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
