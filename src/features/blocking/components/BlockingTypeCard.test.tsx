import React from 'react'
import { StyleSheet, View } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import type { RuleTypeGlyphKind } from '@/features/blocking/components/BlockingGlyphs'
import { BlockingTypeCard } from '@/features/blocking/components/BlockingTypeCard'
import { relockMaterial } from '@/shared/theme'
import { spacing } from '@/shared/theme/tokens/spacing'

jest.mock('@/features/blocking/components/BlockingGlyphs', () => {
  const { View } = require('react-native')
  return {
    RuleTypeGlyph: ({ kind }: { kind: string }) => (
      <View testID={`rule-type-glyph-${kind}`} />
    ),
  }
})

jest.mock('@/shared/components/ui/IconSvg', () => {
  const { View } = require('react-native')
  return { IconSvg: () => <View testID="type-card-chevron" /> }
})

describe('BlockingTypeCard material', () => {
  let renderer: ReactTestRenderer | undefined

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
  })

  it('gives all three rule types the same deep, clipped premium surface', () => {
    const kinds: RuleTypeGlyphKind[] = ['session', 'schedule', 'limit']

    act(() => {
      renderer = create(
        <View>
          {kinds.map(kind => (
            <BlockingTypeCard
              key={kind}
              kind={kind}
              title={kind}
              description="description"
              onPress={jest.fn()}
            />
          ))}
        </View>,
      )
    })

    for (const kind of kinds) {
      const card = renderer?.root.findByProps({
        testID: `blocking-type-card-${kind}`,
      })
      const style = StyleSheet.flatten(card?.props.style)
      expect(style.minHeight).toBe(
        relockMaterial.layout.blockingTypeCardMinHeight,
      )
      expect(style.overflow).toBe('hidden')
      expect(style.backgroundColor).toBe(relockMaterial.colors.blockingSurface)
      expect(
        card?.findByProps({ testID: 'blocking-card-surface' }),
      ).toBeTruthy()
      expect(
        card?.findByProps({ testID: 'blocking-type-icon-stage' }),
      ).toBeTruthy()
      expect(
        renderer?.root.findByProps({ testID: `rule-type-glyph-${kind}` }),
      ).toBeTruthy()
    }
  })

  it('keeps the icon stage larger than the glyph for visible depth', () => {
    act(() => {
      renderer = create(
        <BlockingTypeCard
          kind="session"
          title="Session"
          description="p. ex. 30 min"
          onPress={jest.fn()}
        />,
      )
    })

    const stage = renderer?.root.findByProps({
      testID: 'blocking-type-icon-stage',
    })
    const style = StyleSheet.flatten(stage?.props.style)
    expect(style.width).toBe(spacing.xxxxl)
    expect(style.width).toBeGreaterThan(
      relockMaterial.layout.blockingTypeGlyphSize,
    )
  })
})
