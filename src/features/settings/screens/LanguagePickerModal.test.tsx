import { IconName } from '@assets/icons'
import { router } from 'expo-router'
import React from 'react'
import { StyleSheet, Text } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import LanguagePickerModal from '@/features/settings/screens/LanguagePickerModal'
import i18n from '@/i18n/i18n'
import { settingsTheme } from '@/shared/theme'

jest.mock('expo-router', () => ({ router: { back: jest.fn() } }))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock('@/shared/components/ui/IconSvg', () => {
  const { View } = require('react-native')
  return {
    IconSvg: (props: Record<string, unknown>) => (
      <View testID="icon" {...props} />
    ),
  }
})

const { colors } = settingsTheme

function render(): ReactTestRenderer {
  let tree!: ReactTestRenderer
  act(() => {
    tree = create(<LanguagePickerModal />)
  })
  return tree
}

/** Les lignes de sélection, dans l'ordre où elles sont rendues. */
function rows(tree: ReactTestRenderer) {
  return tree.root.findAll(
    n =>
      typeof n.props?.accessibilityLabel === 'string' &&
      typeof n.props?.onPress === 'function' &&
      n.props?.accessibilityState !== undefined,
  )
}

describe('LanguagePickerModal', () => {
  beforeEach(async () => {
    jest.clearAllMocks()
    await act(async () => {
      await i18n.changeLanguage('fr')
    })
  })

  it('nomme chaque langue DANS sa propre langue', () => {
    const texts = render()
      .root.findAllByType(Text)
      .map(n => n.props.children)
      .filter(c => typeof c === 'string')

    // Traduire « Deutsch » en « Allemand » oblige quelqu'un qui a mis l'app
    // dans une langue qu'il ne lit pas à deviner laquelle est la sienne —
    // exactement la situation où l'on ouvre ce sélecteur.
    for (const name of ['Français', 'English', 'Deutsch', 'Русский']) {
      expect(texts).toContain(name)
    }
  })

  it('propose le français, la langue par défaut de l’app', () => {
    // Il en était absent : passer à l'anglais était sans retour.
    const labels = rows(render()).map(r => r.props.accessibilityLabel)
    expect(labels[0]).toBe('Français')
    expect(labels).toHaveLength(4)
  })

  it('pose la coche SUR la ligne sélectionnée, à droite', () => {
    const tree = render()
    const selected = rows(tree).filter(
      r => r.props.accessibilityState?.selected === true,
    )

    // Une seule ligne cochée, et c'est la langue courante.
    expect(selected).toHaveLength(1)
    expect(selected[0].props.accessibilityLabel).toBe('Français')

    // La coche est un enfant de CETTE ligne — pas un élément flottant posé
    // sous elle, comme dans la version précédente.
    const check = selected[0]
      .findAll(n => n.props?.testID === 'icon')
      .find(n => n.props.name === IconName.CHECK)
    expect(check).toBeDefined()
    expect(check?.props.color).toBe(colors.accent)
  })

  it('ne coche aucune autre ligne', () => {
    const tree = render()
    const others = rows(tree).filter(
      r => r.props.accessibilityLabel !== 'Français',
    )
    for (const other of others) {
      const check = other
        .findAll(n => n.props?.testID === 'icon')
        .find(n => n.props.name === IconName.CHECK)
      expect(check).toBeUndefined()
    }
  })

  it('change la langue et referme au premier appui', async () => {
    const tree = render()
    const german = rows(tree).find(
      r => r.props.accessibilityLabel === 'Deutsch',
    )

    await act(async () => {
      german?.props.onPress()
    })

    expect(i18n.language).toBe('de')
    expect(router.back).toHaveBeenCalled()
  })

  it('empile les lignes dans UNE carte, sans marges entre elles', () => {
    const tree = render()
    const separators = tree.root.findAll(
      n =>
        typeof n.type === 'string' &&
        StyleSheet.flatten(n.props?.style)?.backgroundColor === colors.divider,
    )
    // Trois filets pour quatre langues : des lignes de liste, et non quatre
    // gros boutons pleine largeur séparés par du vide.
    expect(
      separators.filter(s => StyleSheet.flatten(s.props.style).marginLeft),
    ).toHaveLength(3)
  })
})
