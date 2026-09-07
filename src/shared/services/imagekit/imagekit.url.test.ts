import { PixelRatio } from 'react-native'
import {
  buildAvatarUrl,
  buildImageKitUrl,
  buildTransformString,
  isImageKitConfigured,
} from './imagekit.url'

const ENDPOINT = 'https://ik.imagekit.io/qge8uzppl'

// Objet muté par les tests : `env` est lu à chaque appel, pas au chargement.
const mockEnv = {
  IMAGEKIT_URL_ENDPOINT: ENDPOINT,
  IMAGEKIT_PUBLIC_KEY: 'public_test',
}
// Getter : la factory est hissée au-dessus de `mockEnv`, une capture directe
// figerait `undefined`. Le getter, lui, est évalué à chaque accès.
jest.mock('@/config/env', () => ({
  get env() {
    return mockEnv
  },
}))

beforeEach(() => {
  mockEnv.IMAGEKIT_URL_ENDPOINT = ENDPOINT
  jest.spyOn(PixelRatio, 'get').mockReturnValue(3)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe('buildImageKitUrl', () => {
  it('préfixe un chemin de médiathèque par l’endpoint', () => {
    expect(buildImageKitUrl('avatars/u_42.jpg')).toBe(
      `${ENDPOINT}/avatars/u_42.jpg`,
    )
  })

  it('tolère un chemin commençant par un slash', () => {
    expect(buildImageKitUrl('/avatars/u_42.jpg')).toBe(
      `${ENDPOINT}/avatars/u_42.jpg`,
    )
  })

  it('convertit les points en pixels via la densité écran', () => {
    // 48 pt sur un écran @3x → on demande 144 px de large.
    expect(buildImageKitUrl('a.jpg', { width: 48, dpr: 3 })).toContain('w-144')
    expect(buildImageKitUrl('a.jpg', { width: 48, dpr: 1 })).toContain('w-48')
  })

  it('utilise la densité de l’appareil par défaut', () => {
    expect(buildImageKitUrl('a.jpg', { width: 50 })).toContain('w-150')
  })

  it('plafonne la densité pour ne pas servir une image démesurée', () => {
    expect(buildImageKitUrl('a.jpg', { width: 100, dpr: 8 })).toContain('w-300')
  })

  it('n’ajoute ni qualité ni format sans transformation demandée', () => {
    expect(buildImageKitUrl('a.jpg')).not.toContain('?tr=')
  })

  it('repart du chemin nu pour ne pas empiler deux transformations', () => {
    const once = buildImageKitUrl('a.jpg', { width: 100, dpr: 1 })
    const twice = buildImageKitUrl(once, { width: 50, dpr: 1 })
    expect(twice).toBe(`${ENDPOINT}/a.jpg?tr=w-50,q-80,f-auto`)
    expect(twice.match(/\?tr=/g)).toHaveLength(1)
  })

  it('laisse intacte une URL hébergée hors du compte ImageKit', () => {
    const google = 'https://lh3.googleusercontent.com/a/photo.jpg'
    expect(buildImageKitUrl(google, { width: 48 })).toBe(google)
  })

  it('renvoie l’entrée telle quelle quand ImageKit n’est pas configuré', () => {
    mockEnv.IMAGEKIT_URL_ENDPOINT = ''
    expect(buildImageKitUrl('avatars/u_42.jpg', { width: 48 })).toBe(
      'avatars/u_42.jpg',
    )
    expect(isImageKitConfigured()).toBe(false)
  })

  it('gère une source vide sans produire d’URL bancale', () => {
    expect(buildImageKitUrl('   ')).toBe('')
  })
})

describe('buildTransformString', () => {
  it('distingue les modes de redimensionnement (cm-) des recadrages (c-)', () => {
    expect(buildTransformString({ crop: 'maintain_ratio' })).toContain(
      'cm-maintain_ratio',
    )
    expect(buildTransformString({ crop: 'force' })).toContain('c-force')
  })

  it('applique la qualité par défaut et le format automatique', () => {
    expect(buildTransformString({ width: 10, dpr: 1 })).toBe('w-10,q-80,f-auto')
  })

  it('respecte une qualité explicite', () => {
    expect(buildTransformString({ width: 10, dpr: 1, quality: 60 })).toContain(
      'q-60',
    )
  })

  it('sérialise le rayon `max` pour un rendu circulaire', () => {
    expect(buildTransformString({ radius: 'max' })).toContain('r-max')
  })
})

describe('buildAvatarUrl', () => {
  it('produit un carré recadré sur le visage', () => {
    const url = buildAvatarUrl('avatars/u_42.jpg', 40)
    expect(url).toBe(
      `${ENDPOINT}/avatars/u_42.jpg?tr=w-120,h-120,c-force,fo-face,q-80,f-auto`,
    )
  })
})
