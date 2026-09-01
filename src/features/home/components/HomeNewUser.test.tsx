import { router } from 'expo-router'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { EmptyProtectionCard } from '@/features/home/components/EmptyProtectionCard'
import { QuickStartRail } from '@/features/home/components/QuickStartRail'

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
}))

jest.mock('@/shared/components/ui/IconSvg', () => ({
  IconSvg: () => null,
}))

const mockPush = router.push as jest.Mock

describe('Home new-user actions', () => {
  let renderer: ReactTestRenderer | undefined

  beforeEach(() => {
    mockPush.mockClear()
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
  })

  it('opens the create-protection flow from the hero action', () => {
    act(() => {
      renderer = create(<EmptyProtectionCard />)
    })

    const action = renderer?.root.findByProps({
      accessibilityLabel: 'Créer une protection',
    })

    act(() => action?.props.onPress())

    expect(mockPush).toHaveBeenCalledWith('/add-block')
  })

  it('keeps all three quick presets and opens the selected recap', () => {
    act(() => {
      renderer = create(<QuickStartRail rules={[]} />)
    })

    const actions = renderer?.root.findAll(
      node => node.props.accessibilityRole === 'button',
    )
    const labels = [
      ...new Set(
        actions?.map(node => node.props.accessibilityLabel as string) ?? [],
      ),
    ]

    expect(labels).toHaveLength(3)
    expect(labels.some(label => label.startsWith('Focus —'))).toBe(true)
    expect(labels.some(label => label.startsWith('Repos —'))).toBe(true)
    expect(labels.some(label => label.startsWith('Réseaux limités —'))).toBe(
      true,
    )

    const focus = actions?.find(
      node =>
        String(node.props.accessibilityLabel).startsWith('Focus —') &&
        typeof node.props.onPress === 'function',
    )
    act(() => focus?.props.onPress())

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/preset-recap',
      params: { presetId: 'focus' },
    })
  })
})
