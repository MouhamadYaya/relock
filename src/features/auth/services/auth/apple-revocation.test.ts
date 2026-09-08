/**
 * Sign in with Apple doit laisser de quoi RÉVOQUER le jeton à la suppression.
 *
 * POURQUOI CE FICHIER EXISTE
 * Guideline 5.1.1(v) : supprimer un compte créé avec Sign in with Apple oblige
 * à révoquer le jeton auprès d'Apple, faute de quoi l'app reste listée dans
 * « Connexion avec Apple » des réglages iOS d'une personne qui n'a plus de
 * compte chez nous. Apple AUDITE ce point.
 *
 * Toute la chaîne repose sur un maillon fragile : le `authorizationCode`
 * n'est renvoyé QU'À LA CONNEXION, une seule fois, et périme en cinq minutes.
 * S'il n'est pas transmis à `apple-link` à cet instant précis, il n'y aura
 * jamais rien à révoquer — et RIEN ne le signalerait : la connexion réussit,
 * l'app fonctionne, et le manque n'apparaît qu'au moment d'une suppression de
 * compte, là où personne ne regarde. C'est exactement le genre de régression
 * qu'une refonte de l'écran de connexion emporte sans bruit.
 *
 * D'où ces tests, et d'où leur emplacement à part : ils ne portent pas sur le
 * rendu ni sur le parcours, mais sur un engagement réglementaire tenu par une
 * seule ligne d'appel.
 */

import * as AppleAuthentication from 'expo-apple-authentication'
import { AuthService } from '@/features/auth/services/auth/auth.service'
import { captureError } from '@/shared/services/monitoring/sentry'
import { supabase } from '@/shared/services/supabase/client'

jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn().mockResolvedValue(true),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
}))

// Le paquet Google est publié en ESM et n'est pas transformé par Jest ; il
// n'a par ailleurs rien à faire dans un test du parcours Apple.
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: {
    configure: jest.fn(),
    signIn: jest.fn(),
    signOut: jest.fn(),
    hasPlayServices: jest.fn(),
    hasPreviousSignIn: jest.fn(() => false),
  },
  isCancelledResponse: jest.fn(() => false),
  isSuccessResponse: jest.fn(() => true),
}))

jest.mock('@/shared/services/storage/credentials', () => ({
  setAuthToken: jest.fn(),
  setRefreshToken: jest.fn(),
  clearCredentials: jest.fn(),
}))

jest.mock('@/session/logout', () => ({ performLogout: jest.fn() }))

jest.mock('@/shared/services/monitoring/sentry', () => ({
  captureError: jest.fn(),
}))

jest.mock('@/shared/services/supabase/client', () => ({
  supabase: {
    auth: { signInWithIdToken: jest.fn(), signOut: jest.fn() },
    functions: { invoke: jest.fn() },
  },
}))

const signInAsync = AppleAuthentication.signInAsync as jest.Mock
const signInWithIdToken = supabase.auth
  .signInWithIdToken as unknown as jest.Mock
const invoke = supabase.functions.invoke as unknown as jest.Mock

/** Une session Supabase valide, réduite à ce que `zSupabaseAuthResult` exige. */
const SESSION = {
  session: { access_token: 'access', refresh_token: 'refresh' },
  user: { id: 'user-1', email: 'alex@example.com' },
}

beforeEach(() => {
  jest.clearAllMocks()
  signInWithIdToken.mockResolvedValue({ data: SESSION, error: null })
  invoke.mockResolvedValue({ data: { linked: true }, error: null })
})

describe('révocation Apple — liaison à la connexion', () => {
  it('transmet le code d’autorisation à apple-link', async () => {
    signInAsync.mockResolvedValue({
      identityToken: 'id-token',
      authorizationCode: 'auth-code-123',
    })

    await AuthService.signInWithApple()

    expect(invoke).toHaveBeenCalledWith('apple-link', {
      method: 'POST',
      body: { authorizationCode: 'auth-code-123' },
    })
  })

  it('n’appelle pas apple-link sans code d’autorisation', async () => {
    // Apple peut ne pas en renvoyer ; inutile d'aller déranger le serveur pour
    // un échange qui échouerait de toute façon.
    signInAsync.mockResolvedValue({
      identityToken: 'id-token',
      authorizationCode: null,
    })

    await AuthService.signInWithApple()

    expect(invoke).not.toHaveBeenCalled()
  })

  it('renvoie la session même si apple-link échoue', async () => {
    // L'arbitrage central : une écriture de coulisse ne fait pas échouer une
    // connexion réussie. Si ce test tombe, c'est que quelqu'un a mis un `await`
    // ou un `throw` sur le chemin — et une panne Apple bloquerait la connexion.
    signInAsync.mockResolvedValue({
      identityToken: 'id-token',
      authorizationCode: 'auth-code-123',
    })
    invoke.mockResolvedValue({ data: null, error: new Error('apple down') })

    const session = await AuthService.signInWithApple()

    expect(session).toBeTruthy()
  })

  it('journalise l’échec plutôt que de l’avaler', async () => {
    // Sans cette trace, un échange cassé (clé .p8 mal poussée, par exemple)
    // resterait invisible jusqu'à la première suppression de compte.
    signInAsync.mockResolvedValue({
      identityToken: 'id-token',
      authorizationCode: 'auth-code-123',
    })
    invoke.mockResolvedValue({ data: null, error: new Error('apple down') })

    await AuthService.signInWithApple()
    // La liaison est volontairement non attendue : on laisse la micro-tâche
    // se résoudre avant d'observer.
    await Promise.resolve()
    await Promise.resolve()

    expect(captureError).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tags: expect.objectContaining({ op: 'apple-link' }),
      }),
    )
  })
})
