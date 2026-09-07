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
 * AUTHENTIFICATION RÉCENTE EXIGÉE
 * Une session Supabase se renouvelle indéfiniment. Sans contrôle, un téléphone
 * laissé déverrouillé — ou un jeton dérobé — suffit à effacer définitivement un
 * compte et tout ce qui en dépend. On exige donc une authentification RÉCENTE,
 * lue dans la revendication `amr` du jeton : contrairement à `iat`, elle ne
 * bouge PAS au rafraîchissement, et c'est le seul horodatage qui atteste que
 * la personne a réellement reprouvé son identité.
 *
 * Un jeton sans `amr` est refusé plutôt qu'accepté par défaut. Ce n'est pas un
 * blocage définitif : la réponse demande une reconnexion, et le jeton émis
 * ensuite porte la revendication.
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

/**
 * Ancienneté maximale de la dernière authentification réelle. Assez large pour
 * couvrir « je me connecte, je lis l'écran, je réfléchis, je confirme », assez
 * courte pour qu'une session oubliée depuis hier ne suffise pas.
 */
const REAUTH_MAX_AGE_SECONDS = 15 * 60

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Charge utile d'un JWT, sans vérification de signature. */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    // base64url → base64, puis remise du bourrage retiré à l'encodage.
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const payload: unknown = JSON.parse(atob(padded))
    return payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/**
 * Instant (epoch, secondes) de la dernière authentification RÉELLE, lu dans
 * `amr` — la liste des méthodes employées, chacune horodatée. On prend la plus
 * récente : se reconnecter par un autre moyen compte comme une reconnexion.
 *
 * `null` quand la revendication est absente ou illisible : impossible d'en
 * conclure quoi que ce soit, donc l'appelant refuse.
 */
function lastAuthenticationAt(token: string): number | null {
  const payload = decodeJwtPayload(token)
  const amr = payload?.amr
  if (!Array.isArray(amr)) return null

  const timestamps = amr
    .map(method =>
      method && typeof method === 'object'
        ? (method as { timestamp?: unknown }).timestamp
        : null,
    )
    .filter((value): value is number => typeof value === 'number')

  return timestamps.length > 0 ? Math.max(...timestamps) : null
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

  // Le jeton vient d'être VALIDÉ par `getUser()` (vérification côté serveur
  // d'auth) : ses revendications sont donc dignes de confiance, et les lire
  // sans revérifier la signature ne crée pas de faille.
  const authenticatedAt = lastAuthenticationAt(
    authorization.slice('Bearer '.length),
  )
  const nowSeconds = Math.floor(Date.now() / 1000)
  if (
    authenticatedAt === null ||
    nowSeconds - authenticatedAt > REAUTH_MAX_AGE_SECONDS
  ) {
    return json(
      {
        error: 'reauthentication_required',
        maxAgeSeconds: REAUTH_MAX_AGE_SECONDS,
      },
      403,
    )
  }

  const admin = createClient(url, serviceRoleKey)
  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) {
    return json({ error: deleteError.message }, 500)
  }

  return json({ deleted: true })
})
