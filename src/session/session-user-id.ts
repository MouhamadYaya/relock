/**
 * L'identifiant de la session, EN MÉMOIRE — sans effet de bord au chargement.
 *
 * POURQUOI CE MODULE EXISTE À PART
 * L'abonnement `onAuthStateChange` vit dans `useSessionUser.ts`, au niveau du
 * module : l'importer démarre l'écoute. C'est voulu pour l'application, mais
 * un service de calcul (les statistiques, par exemple) n'a aucune raison de
 * réveiller la couche d'authentification pour lire un identifiant. Ce fichier
 * ne contient donc que l'état et ses accès ; `useSessionUser.ts` en est le
 * seul rédacteur.
 *
 * ⚠️ Préférer `resolveSessionUserId()` à `supabase.auth.getUser()` sur tout
 * chemin répété. `getUser()` interroge le SERVEUR (`/auth/v1/user`) à chaque
 * appel : sur les chemins joués en boucle (synchro des stats, battement
 * quotidien) c'était deux allers-retours réseau par cycle, pour relire un
 * identifiant déjà connu. La validation serveur du jeton n'y ajoutait rien :
 * ces écritures sont de toute façon arbitrées par RLS (`auth.uid() =
 * user_id`) côté Postgres.
 */
import { supabase } from '@/shared/services/supabase/client'

/** `undefined` = session encore inconnue (démarrage) ; `null` = déconnecté. */
let currentUserId: string | null | undefined
const listeners = new Set<() => void>()

/** Écrit l'identité courante et réveille les abonnés. Rédacteur unique : `useSessionUser.ts`. */
export function publishSessionUserId(next: string | null): boolean {
  if (next === currentUserId) return false
  currentUserId = next
  for (const listener of listeners) listener()
  return true
}

/** Identité courante, sans attente. `undefined` tant qu'elle est inconnue. */
export function getSessionUserId(): string | null | undefined {
  return currentUserId
}

export function subscribeSessionUserId(onChange: () => void): () => void {
  listeners.add(onChange)
  return () => listeners.delete(onChange)
}

/**
 * Identité courante, avec un repli pour les services qui démarrent avant que
 * l'abonnement ait publié la session.
 *
 * Le repli `getSession()` est une lecture LOCALE (stockage, plus un
 * rafraîchissement de jeton si besoin), pas un aller-retour d'identité.
 */
export async function resolveSessionUserId(): Promise<string | null> {
  if (currentUserId !== undefined) return currentUserId
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user.id ?? null
  } catch {
    return null
  }
}
