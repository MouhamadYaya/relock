import React from 'react'
import { ScrollView, Text } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { SettingsSheet } from '@/features/settings/components/SettingsSheet'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 34, left: 0 }),
}))

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer
  act(() => {
    tree = create(
      <SettingsSheet title="Langue" closeLabel="Fermer" onClose={() => {}}>
        <Text>Français</Text>
      </SettingsSheet>,
    )
  })
  return tree
}

describe('SettingsSheet', () => {
  it('affiche son titre et son contenu', () => {
    const texts = render()
      .root.findAllByType(Text)
      .map(n => n.props.children)
    expect(texts).toContain('Langue')
    expect(texts).toContain('Français')
  })

  it('n’enferme JAMAIS son contenu dans un ScrollView', () => {
    // Un `ScrollView` dans un conteneur qui se dimensionne à son contenu
    // (`justifyContent: 'flex-end'`, sans `flex`) s'effondre à une hauteur
    // nulle : la feuille se monte, le voile couvre l'écran, et il n'y a rien
    // à voir. Les listes de choix sont courtes — une `View` suffit et grandit
    // avec le texte, y compris aux tailles d'accessibilité.
    expect(render().root.findAllByType(ScrollView)).toHaveLength(0)
  })

  it('referme au tap sur le voile', () => {
    const onClose = jest.fn()
    let tree!: ReactTestRenderer
    act(() => {
      tree = create(
        <SettingsSheet title="Langue" closeLabel="Fermer" onClose={onClose}>
          <Text>Français</Text>
        </SettingsSheet>,
      )
    })
    const scrim = tree.root.find(
      n =>
        n.props?.accessibilityLabel === 'Fermer' &&
        typeof n.props?.onPress === 'function',
    )
    act(() => scrim.props.onPress())
    // C'est le geste qu'on tente d'instinct ; le refuser fait chercher une
    // croix qui n'existe pas.
    expect(onClose).toHaveBeenCalled()
  })
})
