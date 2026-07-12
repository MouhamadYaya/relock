/**
 * Service d'authentification — Supabase (email + mot de passe).
 * Path: `src/features/auth/services/auth/`
 */

import { constants } from '@/config/constants'
import type { AuthSession } from '@/features/auth/types'
import { performLogout } from '@/session/logout'
import { kvStorage } from '@/shared/services/storage/mmkv'
import { supabase } from '@/shared/services/supabase/client'
import { normalizeError } from '@/shared/utils/normalize-error'
import { type LoginRequest, zLoginRequest } from './auth.schemas'

function persist(session: {
  access_token: string
  refresh_token: string
}): void {
  kvStorage.setString(constants.AUTH_TOKEN, session.access_token)
  kvStorage.setString(constants.REFRESH_TOKEN, session.refresh_token)
}

export const AuthService = {
  async login(payload: LoginRequest): Promise<AuthSession> {
    const ok = zLoginRequest.safeParse(payload)
    if (!ok.success) {
      const message =
        ok.error.issues.map(i => i.message).join('; ') ||
        'Identifiants invalides'
      throw normalizeError(new Error(message))
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: ok.data.email,
      password: ok.data.password,
    })
    if (error) throw normalizeError(error)
    if (!data.session || !data.user) {
      throw normalizeError(new Error('Session introuvable'))
    }

    persist(data.session)
    return {
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      userId: data.user.id,
      email: data.user.email ?? ok.data.email,
    }
  },

  /**
   * Inscription. Si la confirmation e-mail est activée côté Supabase, la
   * session n'est pas renvoyée : l'utilisateur doit confirmer son e-mail.
   */
  async signUp(payload: LoginRequest): Promise<{ needsEmailConfirm: boolean }> {
    const ok = zLoginRequest.safeParse(payload)
    if (!ok.success) {
      const message =
        ok.error.issues.map(i => i.message).join('; ') ||
        'Identifiants invalides'
      throw normalizeError(new Error(message))
    }

    const { data, error } = await supabase.auth.signUp({
      email: ok.data.email,
      password: ok.data.password,
    })
    if (error) throw normalizeError(error)

    if (data.session) {
      persist(data.session)
      return { needsEmailConfirm: false }
    }
    return { needsEmailConfirm: true }
  },

  async logout() {
    await supabase.auth.signOut()
    kvStorage.delete(constants.AUTH_TOKEN)
    kvStorage.delete(constants.REFRESH_TOKEN)
    await performLogout()
  },
}
