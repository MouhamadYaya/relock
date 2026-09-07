import React from 'react'
import { Image, Text } from 'react-native'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { ProfileAvatar } from '@/features/settings/components/ProfileAvatar'

jest.mock('@/shared/components/ui/IconSvg', () => {
  const { View } = require('react-native')
  return { IconSvg: () => <View testID="icon" /> }
})

const mockBuildAvatarUrl = jest.fn<string, [string, number]>()
jest.mock('@/shared/services/imagekit', () => ({
  buildAvatarUrl: (source: string, size: number) =>
    mockBuildAvatarUrl(source, size),
}))

function render(node: React.ReactElement): ReactTestRenderer {
  let tree!: ReactTestRenderer
  act(() => {
    tree = create(node)
  })
  return tree
}

const images = (tree: ReactTestRenderer) => tree.root.findAllByType(Image)
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map(n => String(n.props.children))

beforeEach(() => {
  mockBuildAvatarUrl.mockReset()
})

describe('ProfileAvatar', () => {
  it('affiche la photo quand la résolution donne une URL absolue', () => {
    mockBuildAvatarUrl.mockReturnValue(
      'https://ik.example/avatars/u_1.jpg?tr=w-96',
    )
    const tree = render(
      <ProfileAvatar avatar="avatars/u_1.jpg" displayName="Ada L" size={32} />,
    )

    expect(images(tree)).toHaveLength(1)
    expect(images(tree)[0].props.source.uri).toBe(
      'https://ik.example/avatars/u_1.jpg?tr=w-96',
    )
  })

  /**
   * Régression : sans endpoint ImageKit, `buildAvatarUrl` renvoie le chemin
   * stocké tel quel. Il reste « truthy », donc l'ancienne version le passait à
   * `<Image>` — un URI RELATIF, c'est-à-dire un disque vide, et jamais les
   * initiales pourtant prévues comme repli documenté.
   */
  it('retombe sur les initiales quand ImageKit est désactivé', () => {
    mockBuildAvatarUrl.mockImplementation(source => source)
    const tree = render(
      <ProfileAvatar avatar="avatars/u_1.jpg" displayName="Ada L" size={32} />,
    )

    expect(images(tree)).toHaveLength(0)
    expect(texts(tree)).toContain('AL')
  })

  it('retombe sur les initiales quand la photo distante échoue', () => {
    mockBuildAvatarUrl.mockReturnValue('https://ik.example/avatars/gone.jpg')
    const tree = render(
      <ProfileAvatar avatar="avatars/gone.jpg" displayName="Ada L" size={32} />,
    )
    expect(images(tree)).toHaveLength(1)

    act(() => {
      images(tree)[0].props.onError()
    })

    expect(images(tree)).toHaveLength(0)
    expect(texts(tree)).toContain('AL')
  })

  /**
   * L'échec est mémorisé PAR URL : une photo qu'on vient de choisir doit
   * s'afficher même si la précédente était introuvable.
   */
  it('redonne sa chance à une nouvelle photo après un échec', () => {
    mockBuildAvatarUrl.mockReturnValue('https://ik.example/avatars/gone.jpg')
    const tree = render(
      <ProfileAvatar avatar="avatars/gone.jpg" displayName="Ada L" size={32} />,
    )
    act(() => {
      images(tree)[0].props.onError()
    })
    expect(images(tree)).toHaveLength(0)

    mockBuildAvatarUrl.mockReturnValue('https://ik.example/avatars/fresh.jpg')
    act(() => {
      tree.update(
        <ProfileAvatar
          avatar="avatars/fresh.jpg"
          displayName="Ada L"
          size={32}
        />,
      )
    })

    expect(images(tree)).toHaveLength(1)
    expect(images(tree)[0].props.source.uri).toBe(
      'https://ik.example/avatars/fresh.jpg',
    )
  })

  it('affiche les initiales sans photo du tout', () => {
    const tree = render(
      <ProfileAvatar avatar={null} displayName="Ada Lovelace" size={32} />,
    )

    expect(mockBuildAvatarUrl).not.toHaveBeenCalled()
    expect(images(tree)).toHaveLength(0)
    expect(texts(tree)).toContain('AL')
  })
})
