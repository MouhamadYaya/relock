/**
 * Edge Function `apple-link` — enregistre de quoi révoquer un Sign in with Apple.
 *
 * POURQUOI ELLE EXISTE
 * Apple exige que la suppression d'un compte révoque le jeton (5.1.1(v)), et
 * on ne révoque qu'un jeton qu'on possède. Or Apple ne délivre de refresh
 * token qu'en échange du `authorizationCode`, lequel n'est renvoyé QU'À LA
 * CONNEXION, une seule fois, et périme en cinq minutes. Il faut donc l'échanger
 * à chaud — c'est tout ce que fait cette fonction.
 *
 * L'échange demande la clé `.p8`, qui donne le droit de parler au nom de l'app
 * chez Apple. Elle ne peut pas vivre dans le binaire : un `.ipa` se décompresse
 * en quelques secondes. D'où une fonction serveur, et un seul verbe offert à
 * l'app : « retiens ce code pour MON compte ».
 *
 * CE QU'ELLE NE FAIT PAS
 * Elle n'authentifie personne : la session Supabase est déjà ouverte quand
 * l'app l'appelle. Elle ne fait que rattacher un jeton Apple au compte courant,
 * établi par le JWT — jamais par un identifiant passé en paramètre.
 *
 * POURQUOI ELLE NE RENVOIE JAMAIS D'ERREUR BLOQUANTE
 * L'app l'appelle en arrière-plan juste après la connexion et ignore le
 * résultat : un code périmé ou une panne Apple ne doit pas faire échouer une
 * connexion réussie. Le code d'état sert au diagnostic (journaux), pas à
 * piloter l'app.
 *
 * DÉPLOIEMENT
 *   supabase secrets set APPLE_TEAM_ID=… APPLE_KEY_ID=… \
 *     APPLE_CLIENT_ID=com.yaya.relock APPLE_PRIVATE_KEY="$(cat AuthKey_XXX.p8)"
 *   supabase functions deploy apple-link
 * (le schéma doit contenir `public.apple_refresh_tokens`.)
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { exchangeAuthorizationCode, readAppleConfig } from '../_shared/apple.ts'

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
    console.error('apple-link: SUPABASE_URL / SERVICE_ROLE_KEY manquants')
    return json({ error: 'misconfigured' }, 500)
  }

  const config = readAppleConfig()
  if (!config) {
    // Volontairement muet côté client : rien à corriger de son côté.
    console.error('apple-link: secrets APPLE_* manquants')
    return json({ error: 'not_configured' }, 500)
  }

  let authorizationCode: string
  try {
    const body = (await req.json()) as { authorizationCode?: unknown }
    if (typeof body.authorizationCode !== 'string' || !body.authorizationCode) {
      return json({ error: 'missing_authorization_code' }, 400)
    }
    authorizationCode = body.authorizationCode
  } catch {
    return json({ error: 'invalid_body' }, 400)
  }

  // Deux clients, deux rôles : celui de l'appelant sert UNIQUEMENT à établir
  // qui il est ; celui de service écrit la ligne. Les mélanger, ce serait
  // laisser l'appelant choisir à quel compte rattacher un jeton Apple.
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authorization } },
  })
  const { data, error } = await caller.auth.getUser()
  const userId = data?.user?.id
  if (error || !userId) {
    return json({ error: 'unauthorized' }, 401)
  }

  const refreshToken = await exchangeAuthorizationCode(
    config,
    authorizationCode,
  )
  if (!refreshToken) {
    // Cause déjà journalisée par `exchangeAuthorizationCode`. Le cas le plus
    // courant est bénin : code déjà consommé (double appel) ou périmé.
    return json({ linked: false }, 200)
  }

  const admin = createClient(url, serviceRoleKey)
  const { error: upsertError } = await admin
    .from('apple_refresh_tokens')
    // `upsert` et non `insert` : on se reconnecte plusieurs fois, et c'est le
    // DERNIER jeton qui doit être révocable. Garder le premier reviendrait à
    // révoquer une autorisation qu'Apple a peut-être déjà remplacée.
    .upsert(
      {
        user_id: userId,
        refresh_token: refreshToken,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    )

  if (upsertError) {
    console.error('apple-link: écriture du jeton échouée', upsertError)
    return json({ linked: false }, 500)
  }

  return json({ linked: true })
})
