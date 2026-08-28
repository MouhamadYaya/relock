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
import { performLogout } from '@/session/logout'
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
  return { code: AUTH_CANCELED_CODE, message: 'Connexion annulée', raw: null }
}

function persist(session: {
  access_token: string
  refresh_token: string
}): void {
  kvStorage.setString(constants.AUTH_TOKEN, session.access_token)
  kvStorage.setString(constants.REFRESH_TOKEN, session.refresh_token)
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

export const AuthService = {
  async signInWithApple(): Promise<AuthSession> {
    const available = await AppleAuthentication.isAvailableAsync()
    if (!available) {
      throw normalizeError(
        new Error("Sign in with Apple n'est pas disponible sur cet appareil"),
      )
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
    kvStorage.delete(constants.AUTH_TOKEN)
    kvStorage.delete(constants.REFRESH_TOKEN)
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
