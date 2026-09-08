/**
 * Edge Function `apple-config-check` — les secrets Apple sont-ils JUSTES ?
 *
 * POURQUOI ELLE EXISTE
 * `delete-account` ne bloque jamais une suppression parce qu'Apple a mal
 * répondu : une suppression de compte est une obligation légale (5.1.1(v)),
 * elle passe avant la révocation. Le prix de ce choix, c'est qu'une clé `.p8`
 * mal poussée ne se manifeste nulle part — Apple continue de lister Relock
 * dans les réglages de gens qui ont supprimé leur compte, et personne ne le
 * sait. Cette fonction est le seul endroit d'où l'on peut le constater AVANT
 * qu'un vrai compte en fasse les frais.
 *
 * CE QU'ELLE NE FAIT PAS
 * Elle ne révoque rien, ne lit aucune donnée utilisateur, ne renvoie aucun
 * secret : seulement un booléen et une cause. Le jeton présenté à Apple est
 * une chaîne fixe et fausse ; révoquer un jeton inexistant est sans effet.
 *
 * QUI PEUT L'APPELER
 * Le service role uniquement. Ce n'est pas un secret d'État — mais un
 * diagnostic ouvert dirait au monde entier quand la configuration d'une app
 * est cassée, et c'est précisément le moment où elle est intéressante à
 * attaquer.
 *
 * USAGE
 *   curl -X POST "$SUPABASE_URL/functions/v1/apple-config-check" \
 *        -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
 *
 * DÉPLOIEMENT
 *   supabase functions deploy apple-config-check
 */

import { verifyAppleConfig } from '../_shared/apple.ts'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/**
 * Comparaison à temps constant.
 *
 * Un `===` sur un secret fuit sa longueur et son préfixe par le temps de
 * réponse. Le coût ici est nul, l'habitude vaut d'être prise.
 */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Le porteur est-il le service role ?
 *
 * DEUX FORMES À COUVRIR, et c'est la raison d'être de cette fonction.
 * Supabase a introduit un nouveau format de clés (`sb_secret_…`) à côté des
 * clés « legacy », qui sont des JWT portant `role: "service_role"`. Selon
 * l'âge du projet et la date de rotation, la clé que l'humain copie dans le
 * dashboard et celle qu'on retrouve dans `SUPABASE_SERVICE_ROLE_KEY` au
 * runtime ne sont pas forcément la même chaîne — comparer les deux
 * littéralement refusait un appelant parfaitement légitime.
 *
 * On accepte donc les deux preuves : l'égalité avec le secret injecté, OU une
 * revendication `role: service_role` dans un JWT. La seconde est sûre ici
 * parce que la plateforme a DÉJÀ vérifié la signature du jeton avant de nous
 * passer la requête — un jeton forgé n'arrive jamais jusqu'à ce code.
 */
function isServiceRole(token: string): boolean {
  const injected = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (injected && sameSecret(token, injected)) return true

  const parts = token.split('.')
  if (parts.length !== 3) return false
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const claims = JSON.parse(atob(padded)) as { role?: unknown }
    return claims?.role === 'service_role'
  } catch {
    return false
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'method_not_allowed' }, 405)
  }

  const authorization = req.headers.get('Authorization') ?? ''
  if (!authorization.startsWith('Bearer ')) {
    return json({ error: 'unauthorized' }, 401)
  }

  if (!isServiceRole(authorization.slice('Bearer '.length))) {
    return json({ error: 'forbidden' }, 403)
  }

  const result = await verifyAppleConfig()
  return json(result, result.ok ? 200 : 503)
})
