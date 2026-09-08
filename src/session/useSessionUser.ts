import { useSyncExternalStore } from 'react'
import {
  getSessionUserId,
  publishSessionUserId,
  subscribeSessionUserId,
} from '@/session/session-user-id'
import { setSentryUser } from '@/shared/services/monitoring/sentry'
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
 *
 * L'ÉTAT lui-même vit dans `session-user-id.ts`, qui ne fait rien au
 * chargement : un service peut y lire l'identité sans démarrer l'écoute
 * ci-dessous. Ce fichier en est le seul rédacteur.
 */
function publish(next: string | null) {
  if (!publishSessionUserId(next)) return
  // Sentry suit la MÊME source de vérité que les requêtes. C'est ce qui
  // permet de dire « ce crash touche 3 comptes » plutôt que « 3 fois ». Seul
  // l'UUID part — jamais l'e-mail (cf. `scrubEvent`). `null` à la
  // déconnexion, sans quoi le crash suivant serait attribué au compte
  // précédent.
  setSentryUser(next)
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
    if (getSessionUserId() === undefined) publish(data.session?.user.id ?? null)
  })
  .catch(() => publish(null))

export {
  getSessionUserId,
  resolveSessionUserId,
} from '@/session/session-user-id'

/** Id de l'utilisateur connecté ; re-rend au changement de session. */
export function useSessionUserId(): string | null | undefined {
  return useSyncExternalStore(
    subscribeSessionUserId,
    getSessionUserId,
    getSessionUserId,
  )
}
