import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { TranscribePauseModal } from '@/features/blocking/components/TranscribePauseModal'

jest.mock('@/i18n/useT', () => ({
  // Les phrases du répertoire sont rendues telles quelles : le test tape la
  // clé, exactement comme l'utilisateur taperait la phrase.
  useT: () => (key: string) => key,
}))

jest.mock('@/shared/components/ui/IconSvg', () => ({ IconSvg: () => null }))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock('@/shared/native/BlockedAppIcons', () => ({
  BlockedAppIcons: () => null,
  isBlockedAppIconsAvailable: false,
}))

describe('TranscribePauseModal', () => {
  let renderer: ReactTestRenderer | undefined

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
  })

  const render = (onContinue = jest.fn()) => {
    act(() => {
      renderer = create(
        <TranscribePauseModal
          visible
          ritual="transcribe"
          tokenKey="app-a"
          onCancel={jest.fn()}
          onContinue={onContinue}
        />,
      )
    })
    return onContinue
  }

  const byId = (id: string) => renderer?.root.findByProps({ testID: id })
  const target = () => byId('transcribe-input')?.props.accessibilityHint
  const typeText = (value: string) =>
    act(() => byId('transcribe-input')?.props.onChangeText(value))

  it('n’ouvre la porte qu’une fois la phrase entièrement recopiée', () => {
    const onContinue = render()

    expect(byId('transcribe-continue')?.props.disabled).toBe(true)

    const phrase = target() as string
    typeText(phrase.slice(0, phrase.length - 1))
    expect(byId('transcribe-continue')?.props.disabled).toBe(true)

    typeText(phrase)
    expect(byId('transcribe-continue')?.props.disabled).toBe(false)

    act(() => byId('transcribe-continue')?.props.onPress())
    expect(onContinue).toHaveBeenCalledTimes(1)
  })

  it('refuse une saisie qui diverge, même de la bonne longueur', () => {
    render()
    const phrase = target() as string

    typeText(`${'z'.repeat(phrase.length - 1)}.`)
    expect(byId('transcribe-continue')?.props.disabled).toBe(true)
  })

  it('n’éclaire le modèle que jusqu’au premier écart', () => {
    render()
    const phrase = target() as string

    typeText(phrase.slice(0, 4))
    const [done, todo] = byId('transcribe-model')?.props.children as [
      { props: { children: string } },
      { props: { children: string } },
    ]
    expect(done.props.children).toBe(phrase.slice(0, 4))
    expect(todo.props.children).toBe(phrase.slice(4))

    // Un écart en position 2 replie l'éclairage, il ne le laisse pas courir.
    typeText(`${phrase.slice(0, 2)}§§§`)
    const [afterDrift] = byId('transcribe-model')?.props.children as [
      { props: { children: string } },
    ]
    expect(afterDrift.props.children).toBe(phrase.slice(0, 2))
  })

  it('coupe le collage et les aides du clavier', () => {
    render()
    const input = byId('transcribe-input')

    // Sans cela, le rituel se franchit en deux secondes par copier-coller.
    expect(input?.props.contextMenuHidden).toBe(true)
    expect(input?.props.autoCorrect).toBe(false)
    expect(input?.props.autoCapitalize).toBe('none')
  })
})
