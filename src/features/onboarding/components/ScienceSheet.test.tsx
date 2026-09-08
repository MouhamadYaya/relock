import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { ScienceSheet } from '@/features/onboarding/components/ScienceSheet'

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))
// Les vignettes sont du SVG pur : rien à simuler, elles rendent telles quelles
// sous Jest. Ce sont leurs LIBELLÉS qui portent le contrat testé ici.

/**
 * « Soutenu par la science » est une AFFIRMATION affichée sur le premier écran
 * d'un produit jamais publié. Elle n'est tenable que parce qu'elle ouvre sur
 * une explication qui, elle, ne prête aucun chiffre à Relock.
 *
 * Ces tests tiennent ce contrat-là — pas la mise en page. Si un jour la
 * feuille se met à citer un pourcentage ou une université, c'est ici que ça
 * doit casser, comme dans `unverified-claims.test.ts` pour le reste du
 * parcours.
 */
describe('ScienceSheet', () => {
  let renderer: ReactTestRenderer | undefined

  afterEach(() => act(() => renderer?.unmount()))

  const render = (visible: boolean, onClose = jest.fn()) => {
    act(() => {
      renderer = create(<ScienceSheet visible={visible} onClose={onClose} />)
    })
    return onClose
  }

  const texts = () =>
    renderer!.root
      .findAll(n => String(n.type) === 'Text')
      .flatMap(n =>
        Array.isArray(n.props.children) ? n.props.children : [n.props.children],
      )
      .filter((c): c is string => typeof c === 'string')

  it('explique les trois mécanismes quand elle est ouverte', () => {
    render(true)
    const body = texts().join(' ')
    // Les trois leviers annoncés : le délai, la boucle d'habitude, le coût de
    // l'interruption. Ce sont eux qui portent l'affirmation du badge.
    expect(body).toContain('Un délai suffit')
    expect(body).toContain('La boucle se casse')
    expect(body).toContain("Le vrai coût d'une coupure")
  })

  it('dit que rien de tout ça n’a été mesuré sur Relock', () => {
    render(true)
    expect(texts().join(' ')).toContain("Relock n'a pas encore été mesuré")
  })

  it('ne prête aucun chiffre ni aucune institution à ces travaux', () => {
    render(true)
    const body = texts().join(' ')
    // Un pourcentage ou un « X fois plus » inventé, c'est une métadonnée
    // trompeuse (App Store 2.3.1) ; un nom d'université, une affiliation
    // imaginaire. Les mécanismes se décrivent qualitativement, ou pas du tout.
    expect(body).not.toMatch(/\d+\s*%/)
    expect(body).not.toMatch(
      /Oxford|Harvard|Cambridge|Stanford|MIT|université de/i,
    )
  })

  it('tient en une phrase par mécanisme', () => {
    render(true)
    // Le garde-fou de la BRIÈVETÉ. Ce n'est pas un article : la feuille est la
    // caution du badge, lue en dix secondes. Ce sont les vignettes qui
    // expliquent — un paragraphe qui regonfle veut dire qu'on est en train de
    // réécrire ce que le dessin dit déjà.
    expect(texts()).toContain(
      'La main part seule. Une pause avant le contenu en arrête beaucoup.',
    )
    const longest = Math.max(...texts().map(line => line.length))
    expect(longest).toBeLessThan(180)
  })

  it('se referme aussi bien par le fond que par le bouton', () => {
    const onClose = render(true)
    act(() =>
      renderer!.root
        .findByProps({ testID: 'science-backdrop' })
        .props.onPress(),
    )
    expect(onClose).toHaveBeenCalledTimes(1)

    const button = renderer!.root
      .findAll(n => typeof n.props.onPress === 'function')
      .find(n => n.props.accessibilityRole === 'button' && !n.props.testID)
    act(() => button!.props.onPress())
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('n’existe pas tant qu’on ne l’a pas demandée', () => {
    // `Modal` invisible ne rend rien du tout : ni le fond, ni le texte. Le
    // premier écran ne porte donc AUCUN de ces paragraphes tant que personne
    // n'a touché le badge — c'est bien une porte, pas un bloc caché.
    render(false)
    expect(texts()).toHaveLength(0)
    expect(
      renderer!.root.findAllByProps({ testID: 'science-backdrop' }),
    ).toHaveLength(0)
  })
})
