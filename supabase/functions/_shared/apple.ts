/**
 * Dialogue serveur-à-serveur avec Apple : client secret, échange de code,
 * révocation de jeton. Partagé par `apple-link` et `delete-account`.
 *
 * POURQUOI CE FICHIER EST COMMUN AUX DEUX
 * Les deux fonctions doivent prouver à Apple qu'elles parlent au nom de l'app,
 * et cette preuve est un JWT signé avec la clé `.p8` — donc la même mécanique
 * des deux côtés. La dupliquer, c'était garantir qu'un jour l'une des deux
 * copies dériverait, et que la révocation échouerait silencieusement : elle
 * n'est appelée qu'au moment d'une suppression de compte, là où personne ne
 * regarde. Une seule implémentation, exercée par les deux chemins.
 *
 * SECRETS ATTENDUS (`supabase secrets set …`)
 *   APPLE_TEAM_ID      — 10 caractères, en haut à droite du compte développeur
 *   APPLE_KEY_ID       — identifiant de la clé « Sign in with Apple »
 *   APPLE_CLIENT_ID    — pour une app native, le BUNDLE ID (com.yaya.relock),
 *                        pas un Services ID : c'est l'audience du jeton
 *                        d'identité que l'app a reçu.
 *   APPLE_PRIVATE_KEY  — contenu du fichier AuthKey_XXXXXXXXXX.p8
 */

/** Base de l'API d'autorisation Apple. */
const APPLE_AUTH_ORIGIN = 'https://appleid.apple.com'

/**
 * Durée de vie du client secret. Apple tolère jusqu'à six mois ; on prend cinq
 * minutes parce qu'il est forgé pour UN appel et jeté juste après. Un secret
 * qui ne survit pas à la requête ne fuit pas.
 */
const CLIENT_SECRET_TTL_SECONDS = 300

export interface AppleConfig {
  teamId: string
  keyId: string
  clientId: string
  privateKey: string
}

/**
 * Les quatre secrets, ou `null` si l'un manque.
 *
 * `null` plutôt qu'une exception : l'appelant décide quoi en faire, et les deux
 * appelants ne veulent PAS la même chose — `apple-link` peut renoncer sans
 * conséquence, `delete-account` doit refuser de supprimer (voir là-bas).
 */
export function readAppleConfig(): AppleConfig | null {
  const teamId = Deno.env.get('APPLE_TEAM_ID')
  const keyId = Deno.env.get('APPLE_KEY_ID')
  const clientId = Deno.env.get('APPLE_CLIENT_ID')
  const privateKey = Deno.env.get('APPLE_PRIVATE_KEY')
  if (!teamId || !keyId || !clientId || !privateKey) return null
  return { teamId, keyId, clientId, privateKey }
}

function base64url(input: string): string {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlFromBytes(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return base64url(binary)
}

/**
 * Le corps DER d'un PEM PKCS#8, en octets.
 *
 * Le `replace(/\\n/g, '\n')` n'est pas décoratif : selon la façon dont la clé a
 * été poussée (`supabase secrets set` depuis un shell, un fichier .env, ou
 * l'interface web), les retours à la ligne arrivent tantôt réels, tantôt en
 * `\n` littéraux. Sans cette normalisation, `atob` reçoit des barres obliques
 * inverses et l'import de clé échoue — au moment de la suppression de compte,
 * c'est-à-dire trop tard pour s'en apercevoir.
 */
function pkcs8Bytes(pem: string): Uint8Array {
  const body = pem
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN [A-Z ]*PRIVATE KEY-----/, '')
    .replace(/-----END [A-Z ]*PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * Le « client secret » attendu par Apple : un JWT ES256 signé avec la clé `.p8`.
 *
 * Ce n'est pas une chaîne fixe qu'on stockerait — c'est une signature à durée
 * de vie, reforgée à chaque appel. WebCrypto renvoie la signature ECDSA en
 * `r‖s` brut, qui est exactement le format attendu par JWS ES256 : aucune
 * conversion DER à faire (c'est le piège habituel quand on porte ce code
 * depuis une bibliothèque Node qui, elle, rend du DER).
 */
export async function appleClientSecret(config: AppleConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'ES256', kid: config.keyId, typ: 'JWT' }
  const payload = {
    iss: config.teamId,
    iat: now,
    exp: now + CLIENT_SECRET_TTL_SECONDS,
    aud: APPLE_AUTH_ORIGIN,
    sub: config.clientId,
  }
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(
    JSON.stringify(payload),
  )}`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8Bytes(config.privateKey),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  )
  return `${signingInput}.${base64urlFromBytes(new Uint8Array(signature))}`
}

/**
 * Échange le `authorizationCode` de la connexion contre un refresh token.
 *
 * `null` si Apple refuse — le code est à usage unique et périme en cinq
 * minutes, donc un rejeu ou un aller-retour trop lent tombe ici. C'est un cas
 * ordinaire, pas une panne : l'appelant renonce sans casser la connexion.
 */
export async function exchangeAuthorizationCode(
  config: AppleConfig,
  authorizationCode: string,
): Promise<string | null> {
  const clientSecret = await appleClientSecret(config)
  const response = await fetch(`${APPLE_AUTH_ORIGIN}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: clientSecret,
      code: authorizationCode,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    // Le corps d'erreur d'Apple ne contient pas de secret ; il nomme la cause
    // (`invalid_grant`, `invalid_client`…), seule façon de distinguer « code
    // périmé » d'une clé `.p8` mal poussée.
    console.error(
      'apple: échange du code refusé',
      response.status,
      await response.text().catch(() => ''),
    )
    return null
  }

  const body = (await response.json()) as { refresh_token?: unknown }
  return typeof body.refresh_token === 'string' ? body.refresh_token : null
}

/**
 * Révoque le refresh token auprès d'Apple. `true` si Apple a bien pris acte.
 *
 * Apple répond 200 avec un corps vide en cas de succès.
 */
export async function revokeRefreshToken(
  config: AppleConfig,
  refreshToken: string,
): Promise<boolean> {
  const clientSecret = await appleClientSecret(config)
  const response = await fetch(`${APPLE_AUTH_ORIGIN}/auth/revoke`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: clientSecret,
      token: refreshToken,
      token_type_hint: 'refresh_token',
    }),
  })

  if (!response.ok) {
    console.error(
      'apple: révocation refusée',
      response.status,
      await response.text().catch(() => ''),
    )
    return false
  }
  return true
}

/**
 * Diagnostic des quatre secrets `APPLE_*`, SANS rien révoquer.
 *
 * POURQUOI CETTE FONCTION EXISTE
 * `revokeAppleToken` (dans `delete-account`) ne lève jamais : une suppression
 * de compte est une obligation légale, elle ne doit pas échouer parce qu'Apple
 * répond mal. La conséquence assumée, c'est qu'une clé `.p8` mal poussée ou un
 * Team ID recopié de travers ne se voit NULLE PART — la seule trace est une
 * ligne de journal, écrite au moment d'une suppression, c'est-à-dire là où
 * personne ne regarde et sur un compte qui n'existe plus.
 *
 * COMMENT ELLE TRANCHE
 * On forge un vrai client secret et on le présente à `/auth/revoke` avec un
 * jeton délibérément faux. Apple distingue alors deux refus :
 *
 *   `invalid_client`  → c'est le CLIENT SECRET qu'Apple rejette : Team ID,
 *                       Key ID, Client ID ou clé `.p8` en cause.
 *   autre chose       → le client secret a été ACCEPTÉ ; seul le jeton bidon
 *                       est refusé. C'est exactement ce qu'on veut lire.
 *
 * La révocation d'un jeton inexistant ne fait rien : l'appel est sans effet de
 * bord, il peut tourner en production autant de fois qu'on veut.
 */
export type AppleConfigCheck =
  | { ok: true; detail: string }
  | { ok: false; reason: 'missing_secrets' | 'bad_private_key' | 'rejected_by_apple' | 'unreachable'; detail: string }

export async function verifyAppleConfig(): Promise<AppleConfigCheck> {
  const config = readAppleConfig()
  if (!config) {
    const missing = (
      ['APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_CLIENT_ID', 'APPLE_PRIVATE_KEY'] as const
    ).filter(name => !Deno.env.get(name))
    return {
      ok: false,
      reason: 'missing_secrets',
      detail: `secrets absents : ${missing.join(', ')}`,
    }
  }

  // Première marche : la clé `.p8` s'importe-t-elle et signe-t-elle ? Un
  // échec ici est local (PEM tronqué, retours à la ligne mangés) et n'a pas
  // besoin d'Apple pour être diagnostiqué.
  let clientSecret: string
  try {
    clientSecret = await appleClientSecret(config)
  } catch (e) {
    return {
      ok: false,
      reason: 'bad_private_key',
      detail: `APPLE_PRIVATE_KEY illisible : ${e instanceof Error ? e.message : String(e)}`,
    }
  }

  // Seconde marche : Apple accepte-t-il ce client secret ? Le jeton envoyé est
  // volontairement invalide — on ne teste QUE l'identité de l'appelant.
  let response: Response
  try {
    response = await fetch(`${APPLE_AUTH_ORIGIN}/auth/revoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: clientSecret,
        token: 'relock-config-probe-not-a-real-token',
        token_type_hint: 'refresh_token',
      }),
    })
  } catch (e) {
    return {
      ok: false,
      reason: 'unreachable',
      detail: `appleid.apple.com injoignable : ${e instanceof Error ? e.message : String(e)}`,
    }
  }

  if (response.ok) {
    return { ok: true, detail: 'Apple a accepté le client secret (200).' }
  }

  const body = await response.text().catch(() => '')
  if (body.includes('invalid_client')) {
    return {
      ok: false,
      reason: 'rejected_by_apple',
      detail:
        `Apple rejette le client secret (invalid_client). Vérifier APPLE_TEAM_ID (10 caractères), ` +
        `APPLE_KEY_ID (celui de la clé Sign in with Apple), APPLE_CLIENT_ID (le BUNDLE ID pour une ` +
        `app native, pas un Services ID) et que la clé .p8 est bien celle du Key ID.`,
    }
  }

  // Tout autre refus porte sur le JETON, pas sur nous : c'est le résultat
  // attendu, puisque le jeton envoyé est faux par construction.
  return {
    ok: true,
    detail: `client secret accepté ; Apple refuse le jeton bidon (${response.status} ${body.slice(0, 120)}).`,
  }
}
