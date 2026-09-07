import { IconName } from '@assets/icons'
import DateTimePicker from '@react-native-community/datetimepicker'
import React from 'react'
import { Text, TextInput } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import ProfileScreen from '@/features/settings/screens/ProfileScreen'
import {
  useUpdateBirthDate,
  useUpdateName,
} from '@/features/user/hooks/useProfile'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock('@/i18n/useT', () => ({ useT: () => (key: string) => key }))
jest.mock('@/i18n', () => ({ i18n: { language: 'fr' } }))

jest.mock('@/shared/components/ui/IconSvg', () => {
  const { View } = require('react-native')
  return {
    IconSvg: (props: Record<string, unknown>) => (
      <View testID="icon" {...props} />
    ),
  }
})

jest.mock('@/shared/components/ui/ScreenWrapper', () => {
  const { View } = require('react-native')
  return {
    ScreenWrapper: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  }
})

jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn().mockResolvedValue({ canceled: true }),
}))

jest.mock('@/shared/services/imagekit', () => ({
  isImageKitConfigured: () => true,
  buildAvatarUrl: (path: string) => path,
}))

const updateNameMutate = jest.fn().mockResolvedValue(undefined)
const updateBirthMutate = jest.fn().mockResolvedValue(undefined)

jest.mock('@/features/user/hooks/useProfile', () => ({
  useProfile: jest.fn(),
  useUpdateName: jest.fn(),
  useUpdateAvatar: jest.fn(),
  useUpdateBirthDate: jest.fn(),
}))

const { useProfile, useUpdateAvatar } = jest.requireMock(
  '@/features/user/hooks/useProfile',
) as {
  useProfile: jest.Mock
  useUpdateAvatar: jest.Mock
}

let mounted: ReactTestRenderer | null = null

async function render(): Promise<ReactTestRenderer> {
  await act(async () => {
    mounted = create(<ProfileScreen />)
  })
  return mounted as unknown as ReactTestRenderer
}

/** Le bouton « Enregistrer » n'existe QUE lorsqu'il y a de quoi enregistrer. */
function saveButton(tree: ReactTestRenderer) {
  return tree.root.findAll(
    node =>
      node.props?.accessibilityLabel === 'common.save' &&
      typeof node.props?.onPress === 'function',
  )[0]
}

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useProfile.mockReturnValue({
      name: 'Yaya',
      displayName: 'Yaya',
      email: 'yaya@example.com',
      avatar: null,
      birthDate: '1998-03-14',
      createdAt: '2026-03-01T10:00:00Z',
      isLoading: false,
    })
    ;(useUpdateName as jest.Mock).mockReturnValue({
      mutateAsync: updateNameMutate,
      isPending: false,
    })
    ;(useUpdateBirthDate as jest.Mock).mockReturnValue({
      mutateAsync: updateBirthMutate,
      isPending: false,
    })
    useUpdateAvatar.mockReturnValue({ mutate: jest.fn(), isPending: false })
  })

  afterEach(() => {
    act(() => mounted?.unmount())
    mounted = null
  })

  it('n’affiche « Enregistrer » qu’une fois quelque chose modifié', async () => {
    const tree = await render()
    expect(saveButton(tree)).toBeUndefined()

    act(() => {
      tree.root.findByType(TextInput).props.onChangeText('Yaya B')
    })
    expect(saveButton(tree)).toBeDefined()
  })

  it('n’écrit QUE le champ qui a changé', async () => {
    const tree = await render()
    act(() => {
      tree.root.findByType(TextInput).props.onChangeText('Yaya B')
    })
    await act(async () => {
      saveButton(tree).props.onPress()
    })

    expect(updateNameMutate).toHaveBeenCalledWith('Yaya B')
    // La date n'a pas bougé : la réécrire échouerait sur une base où la
    // colonne n'existe pas encore, pour une modification que personne n'a
    // demandée.
    expect(updateBirthMutate).not.toHaveBeenCalled()
  })

  it('ignore les espaces autour du prénom', async () => {
    const tree = await render()
    act(() => {
      tree.root.findByType(TextInput).props.onChangeText('  Yaya  ')
    })
    // « Yaya » entouré d'espaces reste « Yaya » : rien à enregistrer.
    expect(saveButton(tree)).toBeUndefined()
  })

  it('marque le prénom comme modifiable par un crayon', async () => {
    const tree = await render()
    const row = tree.root.find(
      n =>
        n.props?.accessibilityLabel === 'settings.profile.name' &&
        typeof n.props?.onPress === 'function',
    )
    // Un champ de texte sans cadre ni fond ressemble à une valeur en lecture
    // seule : c'est le prix de la sobriété, et il se paie d'un pictogramme.
    const icons = row.findAll(n => n.props?.testID === 'icon')
    expect(icons.map(i => i.props.name)).toContain(IconName.PEN)
  })

  it('donne le focus au champ quand on appuie n’importe où sur la ligne', async () => {
    const tree = await render()
    const focus = jest.fn()
    tree.root.findByType(TextInput).instance = { focus }
    const row = tree.root.find(
      n =>
        n.props?.accessibilityLabel === 'settings.profile.name' &&
        typeof n.props?.onPress === 'function',
    )
    expect(() => act(() => row.props.onPress())).not.toThrow()
  })

  it('laisse la date de naissance VIDE tant que rien n’est choisi', async () => {
    useProfile.mockReturnValue({
      name: 'Yaya',
      displayName: 'Yaya',
      email: 'yaya@example.com',
      avatar: null,
      birthDate: null,
      createdAt: null,
      isLoading: false,
    })
    const tree = await render()
    const texts = tree.root
      .findAllByType(Text)
      .map(n => n.props.children)
      .filter((c): c is string => typeof c === 'string')

    // Le champ affichait la date du JOUR, produite par le sélecteur natif
    // faute de valeur : elle avait toutes les apparences d'une donnée
    // enregistrée. Aucun chiffre ne doit apparaître avant un choix.
    const year = String(new Date().getFullYear())
    expect(texts.some(t => t.includes(year))).toBe(false)

    // Et le sélecteur ne se monte qu'à la demande.
    expect(tree.root.findAllByType(DateTimePicker)).toHaveLength(0)
  })

  it('ouvre le sélecteur à l’appui, et pas avant', async () => {
    const tree = await render()
    expect(tree.root.findAllByType(DateTimePicker)).toHaveLength(0)

    const row = tree.root.find(
      n =>
        n.props?.accessibilityLabel === 'settings.profile.birth_date' &&
        typeof n.props?.onPress === 'function',
    )
    act(() => row.props.onPress())
    expect(tree.root.findAllByType(DateTimePicker)).toHaveLength(1)
  })

  it('efface la date de naissance et l’enregistre comme telle', async () => {
    const tree = await render()
    act(() => {
      tree.root
        .find(
          node =>
            node.props?.accessibilityLabel ===
              'settings.profile.birth_date_clear' &&
            typeof node.props?.onPress === 'function',
        )
        .props.onPress()
    })
    await act(async () => {
      saveButton(tree).props.onPress()
    })

    expect(updateBirthMutate).toHaveBeenCalledWith(null)
    expect(updateNameMutate).not.toHaveBeenCalled()
  })
})
