import { flags } from '@/config/constants'
import { env } from '@/config/env'
import { supabase } from '@/shared/services/supabase/client'

/**
 * Dev uniquement (`DEV_SKIP_AUTH`) : garantit une session Supabase au
 * démarrage sans passer par l'écran de connexion. Sans session, les règles
 * RLS (`auth.uid() = user_id`) rendent stats et blocages muets — le bypass
 * de route seul donnerait une app à moitié morte.
 *
 * - Une session existante (ex. vrai compte sur l'iPhone) est TOUJOURS
 *   conservée : on ne se connecte au compte dev que s'il n'y a rien.
 * - Si le compte dev n'existe pas encore, il est créé à la volée
 *   (nécessite « Confirm email » désactivé côté Supabase).
 */
export async function ensureDevSession(): Promise<void> {
  if (!flags.DEV_SKIP_AUTH) return
  try {
    const { data } = await supabase.auth.getSession()
    if (data.session) return

    const email = env.DEV_LOGIN_EMAIL
    const password = env.DEV_LOGIN_PASSWORD
    if (!email || !password) {
      console.warn(
        '[DEV] DEV_SKIP_AUTH actif mais DEV_LOGIN_EMAIL/DEV_LOGIN_PASSWORD absents de .env — données cloud indisponibles.',
      )
      return
    }

    const signIn = await supabase.auth.signInWithPassword({ email, password })
    if (!signIn.error) {
      console.log('[DEV] Session dev connectée:', email)
      return
    }

    // Compte absent → provisionnement à la volée.
    const signUp = await supabase.auth.signUp({ email, password })
    if (signUp.error) {
      console.warn('[DEV] Session dev impossible:', signUp.error.message)
    } else if (!signUp.data.session) {
      console.warn(
        '[DEV] Compte dev créé mais sans session — désactive « Confirm email » dans Supabase Auth.',
      )
    } else {
      console.log('[DEV] Compte dev créé et connecté:', email)
    }
  } catch (e) {
    console.warn('[DEV] ensureDevSession a échoué:', e)
  }
}
