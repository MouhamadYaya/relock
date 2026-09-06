import React from 'react'
import { useReducedMotion } from 'react-native-reanimated'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { SceneVictory } from '@/features/onboarding/components/SceneVictory'

jest.mock('@/features/onboarding/bits', () => ({ Moon: 'Moon', Pill: 'Pill' }))
jest.mock('@/features/onboarding/motion', () => ({ Reveal: 'Reveal' }))
jest.mock('@/shared/components/ui/IconSvg', () => ({ IconSvg: 'IconSvg' }))

describe('onboarding victory', () => {
  let renderer: ReactTestRenderer
  afterEach(() => {
    act(() => renderer.unmount())
  })

  it.each([
    false,
    true,
  ])('confirms configuration and exits only on a tap (reduced motion: %s)', reduceMotion => {
    jest.mocked(useReducedMotion).mockReturnValue(reduceMotion)
    const onDone = jest.fn()
    act(() => {
      renderer = create(<SceneVictory onDone={onDone} />)
    })
    expect(
      renderer.root.findAllByProps({ children: 'Tes règles sont configurées' })
        .length,
    ).toBeGreaterThan(0)
    expect(
      renderer.root.findAllByProps({
        children: 'Le blocage suivra les réglages que tu as choisis.',
      }).length,
    ).toBeGreaterThan(0)
    expect(
      renderer.root.findAll(node => (node.type as unknown) === 'Reveal').length,
    ).toBe(reduceMotion ? 0 : 3)
    expect(onDone).not.toHaveBeenCalled()
    const button = renderer.root.findByProps({ label: 'Ouvrir Relock' })
    act(() => {
      button.props.onPress()
      button.props.onPress()
    })
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
