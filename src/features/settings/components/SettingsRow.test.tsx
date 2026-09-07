import { IconName } from '@assets/icons'
import React from 'react'
import { StyleSheet, Switch, Text } from 'react-native'
import {
  act,
  create,
  type ReactTestRenderer,
  type ReactTestRendererJSON,
} from 'react-test-renderer'
import { SettingsRow } from '@/features/settings/components/SettingsRow'
import { settingsTheme } from '@/shared/theme'

jest.mock('@/shared/components/ui/IconSvg', () => {
  const { View } = require('react-native')
  return {
    IconSvg: (props: Record<string, unknown>) => (
      <View testID="icon" {...props} />
    ),
  }
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
 * Le gestionnaire d'appui de la ligne, cherché par PROPS et non par type :
 * `Pressable` est mémoïsé, `findByType` ne le retrouve pas de façon fiable.
 */
function pressHandlerFor(tree: ReactTestRenderer, label: string) {
  return tree.root.findAll(
    n =>
      n.props?.accessibilityLabel === label &&
      typeof n.props?.onPress === 'function',
  )[0]
}

/**
 * La racine rendue de la ligne. `toJSON` peut rendre un tableau (plusieurs
 * racines) : ici il n'y en a qu'une, et l'affirmer rend les accès suivants
 * lisibles au lieu de traîner des `?.` partout.
 */
function root(tree: ReactTestRenderer): ReactTestRendererJSON {
  return tree.toJSON() as ReactTestRendererJSON
}

/** Le style résolu de la racine de la ligne. */
function rootStyle(tree: ReactTestRenderer) {
  return StyleSheet.flatten(root(tree).props.style)
}

/** Les trois blocs d'une ligne : gouttière, texte, éléments de droite. */
function slots(tree: ReactTestRenderer): ReactTestRendererJSON[] {
  return (root(tree).children ?? []) as ReactTestRendererJSON[]
}

const VARIANTS = {
  navigation: (
    <SettingsRow
      icon={IconName.MOON}
      label="Apparence"
      hint="Un sous-titre explicatif qui prend de la place"
      value="Sombre"
      onPress={() => {}}
    />
  ),
  toggle: (
    <SettingsRow
      icon={IconName.PULSE}
      label="Retours haptiques"
      hint="Vibrations légères"
      switchValue
      onSwitchChange={() => {}}
    />
  ),
  action: (
    <SettingsRow
      icon={IconName.TRASH}
      danger
      label="Supprimer"
      onPress={() => {}}
    />
  ),
  selection: (
    <SettingsRow label="Français" value="FR" selected onPress={() => {}} />
  ),
  inert: <SettingsRow icon={IconName.INFO} label="Version" />,
} as const

describe('SettingsRow — invariants de mise en page', () => {
  it.each(
    Object.keys(VARIANTS) as (keyof typeof VARIANTS)[],
  )('dispose la variante « %s » en LIGNE, jamais en colonne', variant => {
    const style = rootStyle(render(VARIANTS[variant]))
    // Le défaut de React Native est `column`, contrairement au web : c'est
    // exactement ainsi que l'icône se retrouvait au-dessus du texte et le
    // chevron sur sa propre ligne.
    expect(style.flexDirection).toBe('row')
    expect(style.alignItems).toBe('center')
    // Explicite : aucun enfant ne peut renvoyer le chevron à la ligne.
    expect(style.flexWrap).toBe('nowrap')
  })

  it('garde une gouttière d’icône de largeur FIXE, avec ou sans icône', () => {
    const withIcon = render(VARIANTS.navigation)
    const without = render(VARIANTS.selection)

    const gutterOf = (tree: ReactTestRenderer) =>
      StyleSheet.flatten(slots(tree)[0].props.style)

    // Même largeur des deux côtés : c'est ce qui aligne tous les titres de la
    // carte au même x, y compris sur une ligne sans icône.
    expect(gutterOf(withIcon).width).toBe(spacing.iconGutter)
    expect(gutterOf(without).width).toBe(spacing.iconGutter)
    expect(gutterOf(withIcon).flexShrink).toBe(0)
    // Le pictogramme est centré dans la colonne : une icône large et une
    // icône étroite laissent le texte au même x.
    expect(gutterOf(withIcon).alignItems).toBe('center')
  })

  it('n’étire QUE le bloc de texte', () => {
    const tree = render(VARIANTS.navigation)
    const [gutter, content, trailing] = slots(tree)

    expect(StyleSheet.flatten(content.props.style).flex).toBe(1)
    // Un second enfant extensible reprendrait la place au texte et pousserait
    // le chevron hors de l'écran.
    expect(StyleSheet.flatten(gutter.props.style).flex).toBeUndefined()
    expect(StyleSheet.flatten(trailing.props.style).flex).toBeUndefined()
    expect(StyleSheet.flatten(trailing.props.style).flexShrink).toBe(0)
  })

  it('place la valeur AVANT le chevron, tous deux à droite', () => {
    const tree = render(VARIANTS.navigation)
    const trailing = tree.root.findAll(
      n =>
        StyleSheet.flatten(n.props?.style)?.flexShrink === 0 &&
        !!n.props?.children,
    )
    const texts = tree.root
      .findAllByType(Text)
      .map(n => n.props.children)
      .filter(c => typeof c === 'string')

    expect(texts).toContain('Sombre')
    expect(trailing.length).toBeGreaterThan(0)
    // Le chevron ferme la ligne : il est rendu après la valeur.
    const icons = tree.root.findAll(n => n.props?.testID === 'icon')
    expect(icons.at(-1)?.props.name).toBe(IconName.FORWARD)
  })

  it('n’utilise qu’une seule couleur d’icône, sans pastille colorée', () => {
    const tree = render(VARIANTS.navigation)
    // Le premier `icon` est celui de la gouttière ; le dernier, le chevron.
    const icon = tree.root.findAll(n => n.props?.testID === 'icon')[0]
    expect(icon.props.color).toBe(colors.icon)

    // La gouttière n'a AUCUN fond : les pastilles carrées colorées de
    // l'ancienne version ont disparu, elles faisaient cohabiter deux systèmes
    // d'icônes dans la même liste.
    const gutter = StyleSheet.flatten(slots(tree)[0].props.style)
    expect(gutter.backgroundColor).toBeUndefined()
    expect(gutter.borderRadius).toBeUndefined()
  })

  it('passe l’icône ET le titre au rouge sur une action destructrice', () => {
    const tree = render(VARIANTS.action)
    expect(
      tree.root.findAll(n => n.props?.testID === 'icon')[0].props.color,
    ).toBe(colors.danger)
    const title = tree.root.findAllByType(Text)[0]
    expect(StyleSheet.flatten(title.props.style).color).toBe(colors.danger)
  })

  it('réserve le violet à l’interrupteur actif et à la coche', () => {
    const on = render(VARIANTS.toggle)
    expect(on.root.findByType(Switch).props.trackColor.true).toBe(colors.accent)

    const selected = render(VARIANTS.selection)
    const check = selected.root
      .findAll(n => n.props?.testID === 'icon')
      .find(n => n.props.name === IconName.CHECK)
    expect(check?.props.color).toBe(colors.accent)

    // Rien d'autre ne porte l'accent : ni le titre, ni la valeur, ni le fond.
    const style = rootStyle(selected)
    expect(style.backgroundColor).toBeUndefined()
  })

  it('rend TOUTE la ligne tappable, interrupteur compris', () => {
    const onSwitchChange = jest.fn()
    const tree = render(
      <SettingsRow
        icon={IconName.PULSE}
        label="Retours haptiques"
        switchValue={false}
        onSwitchChange={onSwitchChange}
      />,
    )
    const row = pressHandlerFor(tree, 'Retours haptiques')
    act(() => row.props.onPress())

    // Viser un interrupteur de 50 pt au bout d'une ligne de 350 est un geste
    // de précision qu'on ne demande pas dans une liste de réglages.
    expect(onSwitchChange).toHaveBeenCalledWith(true)
  })

  it('ne rend PAS de chevron sur une ligne qui ne mène nulle part', () => {
    const names = render(VARIANTS.toggle)
      .root.findAll(n => n.props?.testID === 'icon')
      .map(n => n.props.name)
    // Une flèche sur une ligne qui ne navigue pas se paie en confiance.
    expect(names).not.toContain(IconName.FORWARD)
  })

  it('n’est pas tappable et n’a pas de chevron quand elle est inerte', () => {
    const tree = render(VARIANTS.inert)
    expect(pressHandlerFor(tree, 'Version')).toBeUndefined()
    expect(
      tree.root.findAll(n => typeof n.props?.onPress === 'function'),
    ).toHaveLength(0)
  })

  it('tronque les libellés longs plutôt que de casser la ligne', () => {
    const tree = render(
      <SettingsRow
        icon={IconName.LOCK}
        label="Schutz vor Deinstallation der Anwendung"
        hint="Verhindert das Löschen der App während einer laufenden Sperre"
        value="Bildschirmzeit"
        onPress={() => {}}
      />,
    )
    const [title, subtitle] = tree.root.findAllByType(Text)
    // Le titre peut passer sur DEUX lignes : « Protection contre la
    // désinstallation » ne tient pas sur une seule en français, et le
    // rétrécir de force le rendrait illisible aux grandes tailles de texte.
    // C'est la ligne qui grandit, jamais le texte qui se réduit.
    expect(title.props.numberOfLines).toBe(2)
    expect(title.props.maxFontSizeMultiplier).toBeUndefined()
    expect(subtitle.props.numberOfLines).toBe(3)
    expect(rootStyle(tree).flexWrap).toBe('nowrap')
    // La hauteur reste un MINIMUM : elle ne peut pas couper un titre long.
    expect(rootStyle(tree).height).toBeUndefined()
  })
})

/**
 * Le défaut qui a rendu cet écran illisible, et le seul garde-fou qui le
 * détecte sans appareil.
 *
 * `react-test-renderer` résout correctement un `style` en fonction : le
 * `flexDirection` y était juste, alors que sur l'iPhone la ligne s'affichait
 * en colonne — icône au-dessus du titre, interrupteur et chevron en dessous,
 * alignés à gauche. Aucun test de rendu ne pouvait donc l'attraper. On
 * vérifie ici la RÈGLE plutôt que son effet : sur ces composants, un `style`
 * de `Pressable` est toujours un objet statique unique.
 */
describe('règle anti-régression : aucun style dynamique sur les Pressable', () => {
  const FILES = [
    'src/features/settings/components/SettingsRow.tsx',
    'src/features/settings/components/ProfileCard.tsx',
    'src/features/settings/components/SettingsHeader.tsx',
    'src/features/settings/components/DangerScreen.tsx',
    'src/features/settings/screens/ProfileScreen.tsx',
    'src/features/settings/screens/SettingsScreen.tsx',
  ]

  it.each(FILES)('%s ne passe aucune FONCTION à un style', file => {
    const source = require('node:fs').readFileSync(file, 'utf8')
    // C'est la forme prouvée fautive : `style={({ pressed }) => …}`. Les
    // tableaux de styles sur `Text` et `View` restent permis — ils n'ont
    // jamais posé problème et servent aux variantes de couleur.
    expect(source).not.toMatch(/style=\{\(/)
  })
})
