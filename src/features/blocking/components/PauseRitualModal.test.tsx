import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { PauseRitualModal } from '@/features/blocking/components/PauseRitualModal'
import { usePreferences } from '@/shared/stores/preferences.store'

jest.mock('@/i18n/useT', () => ({
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

jest.mock('@/shared/services/storage/mmkv', () => ({
  kvStorage: { getString: () => null, setString: jest.fn() },
}))

describe('PauseRitualModal', () => {
  let renderer: ReactTestRenderer | undefined

  beforeEach(() => {
    act(() => usePreferences.getState().setPauseRitual('breathing'))
  })

  afterEach(() => {
    act(() => renderer?.unmount())
    renderer = undefined
  })

  const render = (visible = true) => {
    act(() => {
      renderer = create(
        <PauseRitualModal
          visible={visible}
          tokenKey="app-a"
          onCancel={jest.fn()}
          onContinue={jest.fn()}
        />,
      )
    })
  }

  const has = (id: string) =>
    (renderer?.root.findAllByProps({ testID: id }).length ?? 0) > 0

  it('affiche le rituel enregistré', () => {
    act(() => usePreferences.getState().setPauseRitual('math'))
    render()
    expect(has('math-continue')).toBe(true)
    expect(has('breathing-continue')).toBe(false)
  })

  it('bascule sur la respiration quand c’est le choix courant', () => {
    render()
    expect(has('breathing-continue')).toBe(true)
  })

  it('affiche la transcription quand c’est le choix courant', () => {
    act(() => usePreferences.getState().setPauseRitual('transcribe'))
    render()
    expect(has('transcribe-continue')).toBe(true)
  })

  /**
   * L'invariant qui tient tout le dispositif : changer de rituel PENDANT une
   * pause ne remplace pas l'écran en cours. Sans cela, trois calculs déjà
   * résolus s'effaceraient au profit de six secondes de respiration — une
   * sortie de secours offerte par la fonction censée en fermer une.
   */
  it('ne remplace pas le rituel affiché quand la préférence change en cours de pause', () => {
    render()
    expect(has('breathing-continue')).toBe(true)

    act(() => usePreferences.getState().setPauseRitual('math'))

    expect(has('breathing-continue')).toBe(true)
    expect(has('math-continue')).toBe(false)
  })

  it('applique le nouveau choix à la pause SUIVANTE', () => {
    render(false)
    act(() => usePreferences.getState().setPauseRitual('math'))

    // La pause se rouvre : c'est là, et seulement là, que le choix prend effet.
    act(() => {
      renderer?.update(
        <PauseRitualModal
          visible
          tokenKey="app-a"
          onCancel={jest.fn()}
          onContinue={jest.fn()}
        />,
      )
    })

    expect(has('math-continue')).toBe(true)
    expect(has('breathing-continue')).toBe(false)
  })
})
