import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { UnlockAppsSheet } from '@/features/blocking/components/UnlockAppsSheet'

jest.mock('@/i18n/useT', () => ({
  useT: () => (key: string) => key,
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock('@/shared/components/ui/IconSvg', () => ({
  IconSvg: () => null,
}))

jest.mock('@/shared/native/BlockedAppIcons', () => ({
  BlockedAppIcons: () => null,
  isBlockedAppIconsAvailable: false,
}))

describe('UnlockAppsSheet', () => {
  let renderer: ReactTestRenderer | undefined

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
  })

  const render = (onConfirm: jest.Mock) => {
    act(() => {
      renderer = create(
        <UnlockAppsSheet
          visible
          appKeys={['app-a', 'app-b', 'app-c']}
          onCancel={jest.fn()}
          onConfirm={onConfirm}
        />,
      )
    })
  }

  /**
   * Le nœud RÉELLEMENT pressable : `PressableScale` propage son libellé à
   * plusieurs nœuds de l'arbre, seul celui qui porte un `onPress` est le
   * bouton qu'un doigt touche.
   */
  const pressable = (props: Record<string, unknown>) =>
    renderer?.root
      .findAllByProps(props)
      .find(node => typeof node.props.onPress === 'function')

  // Par testID, pas par libellé : VoiceOver ne doit PAS entendre le jeton
  // opaque, le libellé est donc un repère de position traduit.
  const tile = (key: string) => pressable({ testID: `unlock-app-${key}` })

  const cta = () => pressable({ testID: 'unlock-apps-continue' })

  it('opens nothing until at least one app is checked', () => {
    const onConfirm = jest.fn()
    render(onConfirm)

    expect(cta()?.props.disabled).toBe(true)

    act(() => tile('app-b')?.props.onPress())
    expect(cta()?.props.disabled).toBe(false)

    act(() => cta()?.props.onPress())
    expect(onConfirm).toHaveBeenCalledWith(['app-b'])
  })

  it('checks and unchecks the same app without touching the others', () => {
    const onConfirm = jest.fn()
    render(onConfirm)

    act(() => tile('app-a')?.props.onPress())
    act(() => tile('app-c')?.props.onPress())
    act(() => tile('app-a')?.props.onPress())

    act(() => cta()?.props.onPress())
    expect(onConfirm).toHaveBeenCalledWith(['app-c'])
  })

  it('selects every app at once, then clears them all', () => {
    const onConfirm = jest.fn()
    render(onConfirm)

    const selectAll = () =>
      pressable({ accessibilityLabel: 'blocking.unlock_picker.select_all' })

    act(() => selectAll()?.props.onPress())
    act(() => cta()?.props.onPress())
    expect(onConfirm).toHaveBeenCalledWith(['app-a', 'app-b', 'app-c'])
  })
})
