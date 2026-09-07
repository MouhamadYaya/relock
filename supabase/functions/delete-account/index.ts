/**
 * Edge Function `delete-account` — suppression définitive d'un compte.
 *
 * POURQUOI ELLE EXISTE
 * Supprimer une ligne d'`auth.users` demande la SERVICE ROLE KEY, qui donne
 * les pleins pouvoirs sur la base. Elle ne peut pas vivre dans l'app : un
 * `.ipa` se décompresse en quelques secondes. Elle ne vit donc qu'ici, et
 * l'app n'obtient qu'un seul verbe : « supprime MON compte ».
 *
 * CE QU'ELLE FAIT
 * Vérifie le JWT de l'appelant, puis supprime l'utilisateur correspondant —
 * jamais un id passé en paramètre. Les `on delete cascade` du schéma
 * emportent ensuite profil, règles, événements, statistiques et réponses
 * d'onboarding. Aucune donnée résiduelle côté Supabase.
 *
 * CE QU'ELLE NE FAIT PAS
 * L'abonnement RevenueCat et les fichiers ImageKit ne sont pas touchés : le
 * premier appartient au compte Apple/Google (Apple interdit de l'annuler à
 * notre initiative), le second se purge par une tâche de ménage côté média.
 * L'app prévient l'utilisateur de la première limite avant de confirmer.
 *
 * DÉPLOIEMENT
 *   supabase functions deploy delete-account
 * (`SUPABASE_SERVICE_ROLE_KEY` et `SUPABASE_URL` sont injectés d'office.)
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  const authorization = req.headers.get('Authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) {
    return json({ error: 'unauthorized' }, 401)
  }

  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!url || !serviceRoleKey) {
    return json({ error: 'misconfigured' }, 500)
  }

  // Deux clients, deux rôles : celui de l'appelant sert UNIQUEMENT à établir
  // qui il est ; celui de service exécute la suppression. Les mélanger, c'est
  // laisser l'identité de la victime être choisie par l'appelant.
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authorization } },
  })
  const { data, error } = await caller.auth.getUser()
  const userId = data?.user?.id
  if (error || !userId) {
    return json({ error: 'unauthorized' }, 401)
  }

  const admin = createClient(url, serviceRoleKey)
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) {
    return json({ error: deleteError.message }, 500)
  }

  return json({ deleted: true })
})
