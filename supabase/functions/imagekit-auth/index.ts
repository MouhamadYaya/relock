/**
 * Edge Function `imagekit-auth` — délivre une autorisation d'upload ImageKit.
 *
 * POURQUOI ELLE EXISTE
 * L'API d'upload ImageKit exige une signature calculée avec la PRIVATE KEY.
 * Mettre cette clé dans l'app serait la publier : un `.ipa` se décompresse en
 * quelques secondes, et quiconque la récupère peut écrire, écraser et
 * SUPPRIMER n'importe quel média du compte. La clé ne vit donc qu'ici.
 *
 * CE QU'ELLE RENVOIE
 *   { token, expire, signature, publicKey, folder }
 * `signature = HMAC-SHA1(token + expire, PRIVATE_KEY)`, à transmettre tel quel
 * au endpoint d'upload. Le triplet est à usage unique et périme vite.
 *
 * LIMITE ASSUMÉE
 * La signature ImageKit couvre `token + expire`, jamais le nom du fichier :
 * elle autorise « un upload », pas « cet upload-là ». `folder` est donc une
 * convention appliquée par le client, pas une contrainte cryptographique. Le
 * risque résiduel est un utilisateur authentifié qui déposerait un fichier
 * hors de son dossier — désordre de médiathèque, pas fuite de données : la
 * colonne `profiles.avatar_url` reste protégée par RLS. Si ce désordre devient
 * gênant, la parade est de faire transiter le binaire par cette fonction.
 *
 * GARDE-FOU DE DÉBIT
 * Comme la signature ne contraint ni la taille, ni le nom, ni le dossier du
 * fichier, un compte authentifié pourrait demander des autorisations en boucle
 * et remplir la médiathèque — la facture est au stockage, pas à l'utilisateur.
 * Le nombre d'autorisations par personne et par heure est donc borné côté base
 * (`public.claim_upload_grant`), là où le compte est atomique et survit au
 * redémarrage d'une instance.
 *
 * DÉPLOIEMENT
 *   supabase secrets set IMAGEKIT_PRIVATE_KEY=private_xxxxxxxx
 *   supabase functions deploy imagekit-auth
 * (le schéma doit contenir `upload_grants` + `claim_upload_grant`.)
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

/** Fenêtre de validité. Courte : le triplet ne sert qu'à l'upload qui suit. */
const EXPIRY_SECONDS = 600

/**
 * Plafond d'autorisations par personne et par fenêtre.
 *
 * Généreux à dessein : changer d'avatar plusieurs fois de suite est un usage
 * normal, et un recadrage raté se rejoue. Ce qui est visé, c'est la boucle —
 * pas l'hésitation.
 */
const MAX_GRANTS_PER_WINDOW = 20
const RATE_WINDOW_SECONDS = 3600

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** HMAC-SHA1 hexadécimal — l'algorithme imposé par ImageKit. */
async function hmacSha1Hex(key: string, message: string): Promise<string> {
  const encoder = new TextEncoder()
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    encoder.encode(key),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    'HMAC',
    cryptoKey,
    encoder.encode(message),
  )
  return Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}

Deno.serve(async req => {
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  const privateKey = Deno.env.get('IMAGEKIT_PRIVATE_KEY')
  const publicKey = Deno.env.get('IMAGEKIT_PUBLIC_KEY')
  if (!privateKey || !publicKey) {
    // Volontairement muet sur la cause exacte côté client.
    console.error('imagekit-auth: secrets IMAGEKIT_* manquants')
    return json({ error: 'not_configured' }, 500)
  }

  // Identité de l'appelant : seul un utilisateur connecté obtient une signature.
  const authorization = req.headers.get('Authorization') ?? ''
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authorization } } },
  )

  const { data, error } = await supabase.auth.getUser()
  const userId = data?.user?.id
  if (error || !userId) {
    return json({ error: 'unauthorized' }, 401)
  }

  // Garde-fou de débit, AVANT de signer quoi que ce soit. Une erreur de la
  // base fait échouer la demande : en cas de doute, on ne signe pas.
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )
  const { data: allowed, error: quotaError } = await admin.rpc(
    'claim_upload_grant',
    {
      p_user_id: userId,
      p_max_grants: MAX_GRANTS_PER_WINDOW,
      p_window_seconds: RATE_WINDOW_SECONDS,
    },
  )
  if (quotaError) {
    console.error('imagekit-auth: claim_upload_grant a échoué', quotaError)
    return json({ error: 'quota_unavailable' }, 503)
  }
  if (allowed !== true) {
    return json(
      { error: 'rate_limited', retryAfterSeconds: RATE_WINDOW_SECONDS },
      429,
    )
  }

  const token = crypto.randomUUID()
  const expire = Math.floor(Date.now() / 1000) + EXPIRY_SECONDS
  const signature = await hmacSha1Hex(privateKey, `${token}${expire}`)

  return json({
    token,
    expire,
    signature,
    publicKey,
    // Un dossier par utilisateur. Convention appliquée par le client (voir
    // « LIMITE ASSUMÉE » plus haut), pas contrainte cryptographique.
    folder: `avatars/${userId}`,
  })
})
