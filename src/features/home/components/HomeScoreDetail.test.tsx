import React from 'react'
import { Text } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { HomeScoreDetail } from '@/features/home/components/HomeScoreDetail'

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
          scores={{ global: 38, focus: 68, rest: 7, available: true }}
          onClose={jest.fn()}
        />,
      )
    })
    expect(renderer!.root.findAllByType(Text)).toHaveLength(0)
  })

  it('explains what the score is, how it works and how to improve it', () => {
    act(() => {
      renderer = create(
        <HomeScoreDetail
          visible
          scores={{ global: 38, focus: 68, rest: 7, available: true }}
          onClose={jest.fn()}
        />,
      )
    })
    expect(texts()).toEqual(
      expect.arrayContaining([
        'home.score_what_title',
        'home.score_how_title',
        'home.score_improve_title',
        'home.score_formula',
        'home.score_band_fair',
        38,
      ]),
    )
  })

  it('closes from its own control', () => {
    const onClose = jest.fn()
    act(() => {
      renderer = create(
        <HomeScoreDetail
          visible
          scores={{ global: null, focus: null, rest: null, available: false }}
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
