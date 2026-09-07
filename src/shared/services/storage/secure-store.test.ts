import * as SecureStore from 'expo-secure-store'
import { secureGetItem, secureRemoveItem, secureSetItem } from './secure-store'

const reset = () =>
  (SecureStore as unknown as { __reset: () => void }).__reset()

/** Laisse les suppressions différées (`deleteItemAsync`) se terminer. */
const settle = () => new Promise(resolve => setImmediate(resolve))

beforeEach(reset)

describe('secure-store', () => {
  it('rend `null` pour une clé jamais écrite', () => {
    expect(secureGetItem('absent')).toBeNull()
  })

  it('relit une valeur courte à l’identique', () => {
    secureSetItem('k', 'bonjour')
    expect(secureGetItem('k')).toBe('bonjour')
  })

  it('distingue la chaîne vide de l’absence', () => {
    secureSetItem('k', '')
    expect(secureGetItem('k')).toBe('')
    expect(secureGetItem('jamais-ecrit')).toBeNull()
  })

  // Le cas qui justifie tout le module : le trousseau plafonne une entrée à
  // 2048 octets, or une session Supabase les dépasse.
  it('découpe puis recolle une valeur plus grande que la limite du trousseau', () => {
    const session = JSON.stringify({
      access_token: 'a'.repeat(1200),
      refresh_token: 'r'.repeat(900),
      user: { id: 'u1', email: 'x@y.z' },
    })
    expect(session.length).toBeGreaterThan(2048)

    secureSetItem('sb-auth-token', session)
    expect(secureGetItem('sb-auth-token')).toBe(session)
  })

  it('n’écrit aucune entrée dépassant la limite de 2048 octets', () => {
    secureSetItem('k', 'é'.repeat(5000))

    // On inspecte chaque morceau : c'est la taille en OCTETS qui compte.
    const count = Number(SecureStore.getItem('k'))
    expect(count).toBeGreaterThan(1)
    for (let i = 0; i < count; i++) {
      const chunk = SecureStore.getItem(`k.${i}`) as string
      expect(Buffer.byteLength(chunk, 'utf8')).toBeLessThanOrEqual(2048)
    }
  })

  it('préserve les caractères hors plan de base (emoji) au découpage', () => {
    const value = '🔒'.repeat(2000)
    secureSetItem('k', value)
    expect(secureGetItem('k')).toBe(value)
  })

  // Une valeur plus courte ne doit pas laisser la fin de la précédente derrière
  // elle : la relecture recollerait les deux sans rien signaler.
  it('ne laisse pas de résidu quand la valeur raccourcit', async () => {
    secureSetItem('k', 'x'.repeat(3000))
    secureSetItem('k', 'court')
    await settle()
    expect(secureGetItem('k')).toBe('court')
  })

  it('rend la valeur illisible dès le retour de la suppression', () => {
    secureSetItem('k', 'x'.repeat(3000))
    secureRemoveItem('k')
    // Sans attendre les suppressions différées : c'est tout l'intérêt du
    // marqueur synchrone.
    expect(secureGetItem('k')).toBeNull()
  })

  it('efface bien les morceaux après la suppression', async () => {
    secureSetItem('k', 'x'.repeat(3000))
    secureRemoveItem('k')
    await settle()
    expect(SecureStore.getItem('k')).toBeNull()
    expect(SecureStore.getItem('k.0')).toBeNull()
    expect(secureGetItem('k')).toBeNull()
  })

  it('rend `null` plutôt qu’une valeur tronquée si un morceau manque', async () => {
    secureSetItem('k', 'x'.repeat(3000))
    await SecureStore.deleteItemAsync('k.1')
    expect(secureGetItem('k')).toBeNull()
  })

  it('relit une valeur écrite hors de ce module (format hérité)', () => {
    SecureStore.setItem('k', 'valeur-non-decoupee')
    expect(secureGetItem('k')).toBe('valeur-non-decoupee')
  })

  it('survit à un trousseau indisponible sans propager l’erreur', () => {
    const spy = jest.spyOn(SecureStore, 'getItem').mockImplementation(() => {
      throw new Error('Keychain indisponible')
    })
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {})

    expect(secureGetItem('k')).toBeNull()

    spy.mockRestore()
    quiet.mockRestore()
  })
})
