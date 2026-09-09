import React from 'react'
import { View } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { PressableScale } from '@/shared/components/ui/PressableScale'
import { haptics } from '@/shared/utils/platform/haptics'

describe('PressableScale', () => {
  let renderer: ReactTestRenderer | undefined

  beforeEach(() => {
    jest.spyOn(haptics, 'tap').mockImplementation(() => {})
    jest.spyOn(haptics, 'press').mockImplementation(() => {})
    jest.spyOn(haptics, 'graze').mockImplementation(() => {})
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
    jest.restoreAllMocks()
  })

  const render = (props: Record<string, unknown>) => {
    act(() => {
      renderer = create(
        <PressableScale testID="surface" {...props}>
          <View />
        </PressableScale>,
      )
    })
    return renderer?.root
      .findAllByProps({ testID: 'surface' })
      .find(node => typeof node.props.onPressIn === 'function')
  }

  it('répond dès le TOUCHER, pas au relâchement', () => {
    // Un bouton qui ouvre un écran lourd rend la main plusieurs dizaines de
    // millisecondes plus tard : sans retour au `onPressIn`, rien ne confirme
    // l'appui et on le rejoue.
    const surface = render({ onPress: jest.fn() })
    act(() => surface?.props.onPressIn({}))
    expect(haptics.tap).toHaveBeenCalledTimes(1)
  })

  it('émet le toucher franc par défaut, pas le tic le plus faible', () => {
    // Le défaut porte le grain de toute l'app : presque chaque surface
    // pressable de Relock passe par ici.
    render({ onPress: jest.fn() })?.props.onPressIn({})
    expect(haptics.tap).toHaveBeenCalled()
    expect(haptics.graze).not.toHaveBeenCalled()
  })

  it('laisse la surface nommer son propre sens', () => {
    const surface = render({ onPress: jest.fn(), haptic: 'press' })
    act(() => surface?.props.onPressIn({}))
    expect(haptics.press).toHaveBeenCalledTimes(1)
    expect(haptics.tap).not.toHaveBeenCalled()
  })

  it('reste muet sur une surface sans action', () => {
    // Une carte décorative ne doit rien promettre au doigt.
    const surface = render({})
    act(() => surface?.props.onPressIn({}))
    expect(haptics.tap).not.toHaveBeenCalled()
  })

  it('reste muet quand la surface est désactivée', () => {
    const surface = render({ onPress: jest.fn(), disabled: true })
    act(() => surface?.props.onPressIn({}))
    expect(haptics.tap).not.toHaveBeenCalled()
  })

  it('se tait quand la surface gère elle-même son retour', () => {
    // Les maintiens et les molettes émettent leur propre rythme : deux
    // signaux superposés ne s'entendent que comme une bouillie.
    const surface = render({ onPress: jest.fn(), haptic: 'none' })
    act(() => surface?.props.onPressIn({}))
    expect(haptics.tap).not.toHaveBeenCalled()
    expect(haptics.press).not.toHaveBeenCalled()
  })
})
