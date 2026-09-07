import React from 'react'
import { TextInput } from 'react-native'
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
  return { IconSvg: () => <View /> }
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
