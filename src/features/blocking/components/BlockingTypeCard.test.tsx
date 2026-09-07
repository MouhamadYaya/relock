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
        relockMaterial.layout.blockingTypeRowMinHeight,
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

  it('lays each type out as a full-width row so the copy can be explicit', () => {
    act(() => {
      renderer = create(
        <BlockingTypeCard
          kind="session"
          title="Bloquer maintenant"
          description="Tout de suite, pour la durée que tu choisis"
          onPress={jest.fn()}
        />,
      )
    })

    const card = renderer?.root.findByProps({
      testID: 'blocking-type-card-session',
    })
    const style = StyleSheet.flatten(card?.props.style)
    // Une grille en trois colonnes ne laissait tenir que « p. ex. 30 min » :
    // la rangée est ce qui rend la description lisible.
    expect(style.flexDirection).toBe('row')
    expect(style.alignItems).toBe('center')

    const description = renderer?.root.findByProps({
      children: 'Tout de suite, pour la durée que tu choisis',
    })
    expect(StyleSheet.flatten(description?.props.style).fontSize).toBe(
      relockMaterial.typography.blockingCardBodySize,
    )
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
