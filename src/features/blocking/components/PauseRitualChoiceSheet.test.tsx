import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { PauseRitualChoiceSheet } from '@/features/blocking/components/PauseRitualChoiceSheet'

jest.mock('@/i18n/useT', () => ({
  useT: () => (key: string, values?: { ritual?: string }) =>
    values?.ritual ? `${key}:${values.ritual}` : key,
}))

jest.mock('@/shared/components/ui/IconSvg', () => ({ IconSvg: () => null }))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

describe('PauseRitualChoiceSheet', () => {
  let renderer: ReactTestRenderer | undefined

  beforeEach(() => jest.useFakeTimers())

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
    jest.useRealTimers()
  })

  const render = (onPick = jest.fn(), onClose = jest.fn()) => {
    act(() => {
      renderer = create(
        <PauseRitualChoiceSheet
          current="breathing"
          picked="breathing"
          onPick={onPick}
          onClose={onClose}
        />,
      )
    })
    return { onPick, onClose }
  }

  const tap = (ritual: string) =>
    act(() => {
      renderer?.root
        .findByProps({ testID: `pause-ritual-option-${ritual}` })
        .props.onPress()
    })
  const confirmation = () =>
    renderer?.root.findAllByProps({ testID: 'pause-ritual-confirmation' })[0]

  /**
   * Rien ne change derrière la feuille — la pause en cours va à son terme.
   * La confirmation est donc le SEUL retour possible : sans elle, le choix
   * aurait l'air de n'avoir servi à rien.
   */
  it('confirme explicitement le nouvel écran, en le nommant', () => {
    const { onPick } = render()

    expect(confirmation()).toBeUndefined()
    tap('math')

    expect(onPick).toHaveBeenCalledWith('math')
    expect(confirmation()).toBeTruthy()
    // La confirmation NOMME l'écran retenu : « défini » tout court laisserait
    // un doute sur lequel des trois vient d'être choisi.
    expect(
      renderer?.root.findByProps({
        testID: 'pause-ritual-confirmation-label',
      }).props.children,
    ).toBe('blocking.pause_ritual.confirmed:blocking.pause_ritual.math.title')
  })

  it('laisse le temps de lire la confirmation avant de se refermer', () => {
    const { onClose } = render()

    tap('transcribe')
    expect(onClose).not.toHaveBeenCalled()

    act(() => jest.advanceTimersByTime(1_600))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('referme sans rien annoncer quand on retouche l’écran déjà retenu', () => {
    const { onPick, onClose } = render()

    tap('breathing')

    expect(onPick).toHaveBeenCalledWith('breathing')
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(confirmation()).toBeUndefined()
  })

  it('déplace la sélection sur la vignette choisie, sans attendre la fermeture', () => {
    render()

    const selected = () =>
      ['breathing', 'math', 'transcribe'].filter(
        ritual =>
          renderer?.root.findByProps({
            testID: `pause-ritual-option-${ritual}`,
          }).props.accessibilityState.selected,
      )

    expect(selected()).toEqual(['breathing'])
    tap('math')
    expect(selected()).toEqual(['math'])
  })
})
