import { useSyncExternalStore } from 'react'
import { supabase } from '@/shared/services/supabase/client'

/**
 * Identité de la session Supabase, observable par les hooks de données.
 *
 * ⚠️ Sans ce garde, les écrans se remplissent de FAUX ZÉROS. Toutes les tables
 * sont protégées par RLS (`auth.uid() = user_id`) : interrogées SANS session,
 * elles ne renvoient pas une erreur mais un résultat VIDE et parfaitement
 * valide. React Query le met alors en cache — et le persiste sur MMKV. Au
 * démarrage, les requêtes partaient avant que la session soit restaurée /
 * ouverte : l'Accueil affichait « 0 min », « aucun blocage », et gardait ces
 * zéros jusqu'à un refetch. C'est la cause du « parfois ça apparaît, parfois
 * non ». Les requêtes attendent donc un `userId` non nul (`enabled`).
 *
 * `undefined` = session encore inconnue (démarrage) ; `null` = déconnecté.
 */
let currentUserId: string | null | undefined
const listeners = new Set<() => void>()

function publish(next: string | null) {
  if (next === currentUserId) return
  currentUserId = next
  for (const l of listeners) l()
}

// `onAuthStateChange` couvre INITIAL_SESSION (session restaurée du stockage),
// SIGNED_IN, TOKEN_REFRESHED et SIGNED_OUT — ne pas n'écouter que SIGNED_IN,
// sinon une session déjà en stockage ne débloque jamais les requêtes.
supabase.auth.onAuthStateChange((_event, session) => {
  publish(session?.user.id ?? null)
})

// Filet : si l'abonnement se pose après la restauration initiale, l'événement
// est déjà passé — on lit l'état courant une fois.
void supabase.auth
  .getSession()
  .then(({ data }) => {
    if (currentUserId === undefined) publish(data.session?.user.id ?? null)
  })
  .catch(() => publish(null))

/** Id de l'utilisateur connecté, hors composant. */
export function getSessionUserId(): string | null | undefined {
  return currentUserId
}

/** Id de l'utilisateur connecté ; re-rend au changement de session. */
export function useSessionUserId(): string | null | undefined {
  return useSyncExternalStore(
    onChange => {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },
    () => currentUserId,
    () => currentUserId,
  )
}
