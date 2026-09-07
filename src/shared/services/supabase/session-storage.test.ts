/**
 * La session Supabase doit vivre dans le trousseau, et la reprise depuis MMKV
 * doit EFFACER la copie en clair — sans ça, le durcissement ne protégerait que
 * les nouvelles installations, alors que ce sont précisément les installations
 * existantes qui portent déjà un refresh token sur le disque.
 *
 * On reconstruit ici l'adaptateur tel qu'il est câblé dans `client.ts` plutôt
 * que d'importer ce module : `createClient` y est appelé au chargement et
 * ouvrirait une vraie connexion Supabase dans le test.
 */
import * as SecureStore from 'expo-secure-store'
import { kvStorage } from '@/shared/services/storage/mmkv'
import {
  secureGetItem,
  secureRemoveItem,
  secureSetItem,
} from '@/shared/services/storage/secure-store'

const AUTH_KEY = 'sb-projet-auth-token'

/** Copie conforme de `secureAuthStorage` (src/shared/services/supabase/client.ts). */
const storage = {
  getItem: (key: string) => {
    const stored = secureGetItem(key)
    if (stored !== null) return stored
    const legacy = kvStorage.getString(key)
    if (legacy === null) return null
    if (secureSetItem(key, legacy)) kvStorage.delete(key)
    return legacy
  },
  setItem: (key: string, value: string) => {
    secureSetItem(key, value)
  },
  removeItem: (key: string) => {
    secureRemoveItem(key)
    kvStorage.delete(key)
  },
}

const session = JSON.stringify({
  access_token: 'a'.repeat(1000),
  refresh_token: 'r'.repeat(800),
  user: { id: 'u1' },
})

beforeEach(() => {
  ;(SecureStore as unknown as { __reset: () => void }).__reset()
  kvStorage.clearAll()
})

describe('stockage de la session Supabase', () => {
  it('écrit dans le trousseau, jamais sur MMKV', () => {
    storage.setItem(AUTH_KEY, session)

    expect(secureGetItem(AUTH_KEY)).toBe(session)
    expect(kvStorage.getString(AUTH_KEY)).toBeNull()
  })

  it('reprend une session héritée de MMKV et efface la copie en clair', () => {
    kvStorage.setString(AUTH_KEY, session)

    expect(storage.getItem(AUTH_KEY)).toBe(session)
    // C'est l'assertion qui compte : plus rien de lisible sur le disque.
    expect(kvStorage.getString(AUTH_KEY)).toBeNull()
    expect(secureGetItem(AUTH_KEY)).toBe(session)
  })

  it('ne relit plus MMKV une fois la reprise faite', () => {
    kvStorage.setString(AUTH_KEY, session)
    storage.getItem(AUTH_KEY)

    // Une session résiduelle réécrite par erreur ne doit pas primer.
    kvStorage.setString(AUTH_KEY, 'session-perimee')
    expect(storage.getItem(AUTH_KEY)).toBe(session)
  })

  it('la déconnexion vide les deux emplacements', () => {
    kvStorage.setString(AUTH_KEY, session)
    storage.setItem(AUTH_KEY, session)

    storage.removeItem(AUTH_KEY)

    expect(storage.getItem(AUTH_KEY)).toBeNull()
    expect(kvStorage.getString(AUTH_KEY)).toBeNull()
  })

  it('garde la session si le trousseau refuse la reprise', () => {
    kvStorage.setString(AUTH_KEY, session)
    const spy = jest.spyOn(SecureStore, 'setItem').mockImplementation(() => {
      throw new Error('Keychain indisponible')
    })
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {})

    // Échouer des deux côtés déconnecterait l'utilisateur : on préfère rendre
    // la valeur héritée et retenter à la prochaine lecture.
    expect(storage.getItem(AUTH_KEY)).toBe(session)
    expect(kvStorage.getString(AUTH_KEY)).toBe(session)

    spy.mockRestore()
    quiet.mockRestore()
  })
})
