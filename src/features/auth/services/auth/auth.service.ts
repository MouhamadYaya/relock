/**
 * Service d'authentification — Supabase, via Sign in with Apple / Google
 * (jeton d'identité natif échangé contre une session Supabase).
 * Path: `src/features/auth/services/auth/`
 */

import {
  GoogleSignin,
  isCancelledResponse,
  isSuccessResponse,
} from '@react-native-google-signin/google-signin'
import * as AppleAuthentication from 'expo-apple-authentication'
import { constants } from '@/config/constants'
import { env } from '@/config/env'
import type { AuthSession } from '@/features/auth/types'
import { translate } from '@/i18n/translate'
import { performLogout } from '@/session/logout'
import { captureError } from '@/shared/services/monitoring/sentry'
import {
  clearCredentials,
  setAuthToken,
  setRefreshToken,
} from '@/shared/services/storage/credentials'
import { kvStorage } from '@/shared/services/storage/mmkv'
import { supabase } from '@/shared/services/supabase/client'
import {
  type NormalizedError,
  normalizeError,
} from '@/shared/utils/normalize-error'
import { AuthMapper } from './auth.mappers'
import { zSupabaseAuthResult } from './auth.schemas'

/** Code stable exposé aux appelants : l'utilisateur a fermé la feuille native — pas une erreur à afficher. */
export const AUTH_CANCELED_CODE = 'AUTH_CANCELED'

export function isAuthCanceled(error: NormalizedError): boolean {
  return (
    error.code === AUTH_CANCELED_CODE || error.code === 'ERR_REQUEST_CANCELED'
  )
}

function canceled(): NormalizedError {
  return {
    code: AUTH_CANCELED_CODE,
    message: translate('errors.sign_in_cancelled'),
    raw: null,
  }
}

function persist(session: {
  access_token: string
  refresh_token: string
}): void {
  setAuthToken(session.access_token)
  setRefreshToken(session.refresh_token)
}

let googleConfigured = false

/** Idempotent — sûr à appeler au démarrage ET avant chaque tentative de connexion. */
export function configureGoogleSignIn(): void {
  if (googleConfigured) return
  GoogleSignin.configure({
    webClientId: env.GOOGLE_WEB_CLIENT_ID || undefined,
    iosClientId: env.GOOGLE_IOS_CLIENT_ID || undefined,
  })
  googleConfigured = true
}

/**
 * Transmet au serveur le `authorizationCode` d'Apple, pour qu'il l'échange
 * contre un refresh token révocable.
 *
 * POURQUOI CE DÉTOUR
 * Apple exige que la suppression d'un compte révoque le jeton (Guideline
 * 5.1.1(v)) — sans quoi l'app reste listée dans « Connexion avec Apple » des
 * réglages iOS de quelqu'un qui n'a plus de compte chez nous. Mais on ne
 * révoque qu'un jeton qu'on possède, et Apple ne le délivre qu'en échange de
 * ce code : renvoyé UNE SEULE FOIS, à la connexion, valable cinq minutes.
 * L'échange demande la clé `.p8`, qui ne peut pas vivre dans le binaire — d'où
 * l'Edge Function `apple-link`, à qui l'app ne fait que passer le code.
 *
 * AU MIEUX, ET SANS ATTENDRE : une connexion réussie ne doit pas échouer, ni
 * traîner, parce qu'Apple répond mal à une écriture de coulisse. Le risque de
 * ne pas attendre est borné par une propriété du reste du système : supprimer
 * un compte EXIGE une authentification de moins de quinze minutes (voir
 * l'Edge Function `delete-account`), donc une reconnexion — qui repasse
 * forcément ici avec un code frais. La fenêtre où l'on aurait un compte
 * supprimable sans jeton à révoquer est celle d'un échec de cet appel suivi
 * d'une suppression dans le quart d'heure. C'est pour la voir qu'on
 * journalise.
 */
function linkAppleCredential(authorizationCode: string | null): void {
  if (!authorizationCode) return
  supabase.functions
    .invoke('apple-link', {
      method: 'POST',
      body: { authorizationCode },
    })
    .then(({ error }) => {
      if (error) throw error
    })
    .catch(e => {
      captureError(e, {
        tags: { feature: 'auth', op: 'apple-link' },
        level: 'warning',
      })
    })
}

export const AuthService = {
  async signInWithApple(): Promise<AuthSession> {
    const available = await AppleAuthentication.isAvailableAsync()
    if (!available) {
      throw normalizeError(new Error(translate('errors.apple_unavailable')))
    }

    let credential: AppleAuthentication.AppleAuthenticationCredential
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      })
    } catch (e) {
      const err = normalizeError(e)
      throw isAuthCanceled(err) ? canceled() : err
    }

    if (!credential.identityToken) {
      throw normalizeError(new Error('Jeton Apple manquant'))
    }

    // Pas de `nonce` ici : Supabase l'accepte en optionnel (vérification de
    // rejeu simplement désactivée). En ajouter un demanderait `expo-crypto`
    // pour hacher un nonce brut en SHA-256 avant de l'envoyer à Apple.
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: 'apple',
      token: credential.identityToken,
    })
    if (error) throw normalizeError(error)

    const parsed = zSupabaseAuthResult.parse(data)
    persist(parsed.session)
    // La session doit être ouverte AVANT : `apple-link` s'authentifie avec le
    // jeton Supabase qu'on vient d'obtenir pour savoir à quel compte rattacher
    // le jeton Apple.
    linkAppleCredential(credential.authorizationCode)
    return AuthMapper.toAuthSession(parsed)
  },

  async signInWithGoogle(): Promise<AuthSession> {
    configureGoogleSignIn()
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
      const response = await GoogleSignin.signIn()
      if (isCancelledResponse(response)) {
        throw canceled()
      }
      if (!isSuccessResponse(response) || !response.data.idToken) {
        throw normalizeError(new Error('Jeton Google manquant'))
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: response.data.idToken,
      })
      if (error) throw normalizeError(error)

      const parsed = zSupabaseAuthResult.parse(data)
      persist(parsed.session)
      return AuthMapper.toAuthSession(parsed)
    } catch (e) {
      const err = normalizeError(e)
      throw isAuthCanceled(err) ? canceled() : err
    }
  },

  async logout() {
    await supabase.auth.signOut()
    clearCredentials()
    try {
      configureGoogleSignIn()
      if (GoogleSignin.hasPreviousSignIn()) {
        await GoogleSignin.signOut()
      }
    } catch {
      // best-effort : ne bloque pas le logout si Google Sign-In n'est pas configuré
    }
    await performLogout()
  },
}
