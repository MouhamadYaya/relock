import { IconName } from '@assets/icons'
import React from 'react'
import { StyleSheet, Text } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { SettingsRow } from '@/features/settings/components/SettingsRow'
import { SettingsSection } from '@/features/settings/components/SettingsSection'
import { settingsTheme } from '@/shared/theme'

jest.mock('@/shared/components/ui/IconSvg', () => {
  const { View } = require('react-native')
  return { IconSvg: () => <View testID="icon" /> }
})

const { colors, spacing } = settingsTheme

function render(node: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer
  act(() => {
    tree = create(node)
  })
  return tree
}

/**
 * Les filets de séparation, reconnus à leur couleur dédiée.
 *
 * On ne retient que les nœuds HÔTES (`type` est alors une chaîne) : chaque
 * `View` apparaît deux fois dans l'arbre de test, une fois comme composant et
 * une fois comme élément natif, ce qui doublerait le compte.
 */
function dividers(tree: ReactTestRenderer) {
  return tree.root.findAll(
    n =>
      typeof n.type === 'string' &&
      StyleSheet.flatten(n.props?.style)?.backgroundColor === colors.divider,
  )
}

const row = (label: string) => (
  <SettingsRow
    key={label}
    icon={IconName.MOON}
    label={label}
    onPress={() => {}}
  />
)

describe('SettingsSection', () => {
  it('pose un filet ENTRE les lignes, jamais après la dernière', () => {
    for (const count of [1, 2, 5]) {
      const labels = Array.from({ length: count }, (_, i) => `Ligne ${i}`)
      const tree = render(
        <SettingsSection title="Compte">{labels.map(row)}</SettingsSection>,
      )
      // n lignes ⇒ n−1 filets. C'est structurel : le filet n'est dessiné
      // qu'AVANT chaque ligne à partir de la seconde, il ne PEUT pas suivre
      // la dernière.
      expect(dividers(tree)).toHaveLength(count - 1)
    }
  })

  it('retire les filets des DEUX côtés, sur la colonne de texte', () => {
    const tree = render(
      <SettingsSection>{[row('A'), row('B')]}</SettingsSection>,
    )
    const style = StyleSheet.flatten(dividers(tree)[0].props.style)
    // Début exactement au x des titres : padding de ligne + gouttière + écart.
    expect(style.marginLeft).toBe(
      spacing.rowH + spacing.iconGutter + spacing.iconGap,
    )
    // Fin avant la marge intérieure droite : un filet qui touche le bord de
    // la carte se lit comme une coupure, pas comme une liste.
    expect(style.marginRight).toBe(spacing.rowH)
  })

  it('ignore les lignes conditionnelles absentes sans laisser de filet', () => {
    const showOptional = false
    const tree = render(
      <SettingsSection>
        {row('A')}
        {showOptional ? row('B') : null}
        {row('C')}
      </SettingsSection>,
    )
    // Deux lignes réelles ⇒ un seul filet, pas deux.
    expect(dividers(tree)).toHaveLength(1)
  })

  it('ne s’affiche pas du tout quand elle n’a aucune entrée', () => {
    const tree = render(
      <SettingsSection title="Vide">
        {[null, false, undefined]}
      </SettingsSection>,
    )
    // Pas de titre orphelin au-dessus d'une carte vide.
    expect(tree.toJSON()).toBeNull()
  })

  it('affiche le titre en clair et la note sous la carte', () => {
    const tree = render(
      <SettingsSection title="Compte" caption="Une précision utile">
        {row('A')}
      </SettingsSection>,
    )
    const texts = tree.root
      .findAllByType(Text)
      .map(n => n.props.children)
      .filter(c => typeof c === 'string')

    expect(texts[0]).toBe('Compte')
    expect(texts.at(-1)).toBe('Une précision utile')
  })
})
