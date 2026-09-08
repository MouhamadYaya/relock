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
 * RÉVOCATION DU JETON APPLE (Guideline 5.1.1(v))
 * Effacer la ligne d'`auth.users` ne suffit pas pour un compte créé avec Sign
 * in with Apple : sans révocation, l'app reste listée dans « Connexion avec
 * Apple » des réglages iOS d'une personne qui n'a plus de compte chez nous.
 * Apple audite ce point. On révoque donc AVANT de supprimer — l'ordre n'est
 * pas indifférent, le `on delete cascade` emporterait le jeton avec le compte
 * et il n'y aurait plus rien à révoquer.
 *
 * La révocation est faite au mieux : son échec ne bloque PAS la suppression.
 * C'est un arbitrage assumé entre deux obligations. Le droit à l'effacement
 * (RGPD art. 17) est celui de la personne ; la révocation est une hygiène que
 * nous devons à Apple. Faire échouer une suppression parce qu'Apple répond mal
 * reviendrait à retenir en otage la donnée de quelqu'un pour un problème qui ne
 * le regarde pas. L'échec part donc dans les journaux, et la suppression suit.
 *
 * Un compte sans jeton stocké est un cas NORMAL, pas une anomalie : connexion
 * par Google, ou compte créé avant la mise en place d'`apple-link`.
 *
 * CE QUE CET ARBITRAGE COÛTAIT, ET CE QUI LE PAIE MAINTENANT
 * Ne jamais échouer, c'est ne jamais se faire entendre. Une clé `.p8` tournée
 * sans être repoussée et la révocation cessait de marcher sans que rien ne le
 * dise : le seul témoin était un `console.error` écrit au moment d'une
 * suppression — là où personne ne regarde, sur un compte qui n'existe plus, et
 * dans des journaux qui expirent. `npm run check:apple` sait dire si la
 * configuration est bonne AUJOURD'HUI ; il ne saura jamais dire ce qui s'est
 * passé pendant les six semaines où elle ne l'était pas.
 *
 * Chaque tentative incrémente donc un compteur en base
 * (`public.apple_revocation_audit`, via `record_apple_revocation`) : un
 * agrégat par jour et par issue, SANS identifiant — ces lignes survivent au
 * compte qu'elles décrivent, y poser un `user_id` reviendrait à garder une
 * trace de quelqu'un qui vient d'exercer son droit à l'effacement. Le
 * compteur ne répond qu'à une question, mais on ne pouvait pas y répondre du
 * tout : « combien de comptes sont partis sans révocation ? »
 *
 * L'écriture du compteur ne peut pas non plus faire échouer la suppression —
 * ce serait reproduire le défaut qu'elle sert à corriger, un cran plus loin.
 *
 * CE QU'ELLE NE FAIT PAS
 * L'abonnement RevenueCat et les fichiers ImageKit ne sont pas touchés : le
 * premier appartient au compte Apple/Google (Apple interdit de l'annuler à
 * notre initiative), le second se purge par une tâche de ménage côté média.
 * L'app prévient l'utilisateur de la première limite avant de confirmer.
 *
 * DÉPLOIEMENT
 *   supabase functions deploy delete-account
 * (`SUPABASE_SERVICE_ROLE_KEY` et `SUPABASE_URL` sont injectés d'office ; les
 * secrets `APPLE_*` sont ceux d'`apple-link`, voir `_shared/apple.ts`.)
 *
 * Le compteur suppose `public.apple_revocation_audit` et la fonction
 * `record_apple_revocation` — voir `supabase/schema.sql`, et
 * `supabase/apple-revocation-audit-2026-09-08.sql` pour les appliquer sur une
 * base déjà en ligne.
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { readAppleConfig, revokeRefreshToken } from '../_shared/apple.ts'

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

/**
 * L'issue d'une tentative de révocation.
 *
 * La liste est FERMÉE, et la contrainte `apple_revocation_audit_outcome_known`
 * en base l'est aussi : ajouter une issue ici sans l'ajouter là-bas fait
 * échouer l'écriture du compteur — bruyamment côté journaux, sans conséquence
 * sur la suppression.
 *
 * `revoked` et `no_token` sont les deux fins NORMALES. Tout le reste est une
 * app qui reste listée dans « Connexion avec Apple » de quelqu'un qui n'a plus
 * de compte chez nous.
 */
type RevocationOutcome =
  | 'revoked'
  | 'no_token'
  | 'missing_secrets'
  | 'apple_refused'
  | 'read_failed'
  | 'error'

interface RevocationResult {
  outcome: RevocationOutcome
  /**
   * Message technique, destiné au compteur. JAMAIS d'identifiant : la ligne
   * qui le porte survit au compte supprimé (voir l'en-tête). Les identifiants
   * restent dans les journaux, qui eux meurent tout seuls.
   */
  detail?: string
}

/**
 * Révoque le Sign in with Apple de `userId`, si on a de quoi le faire.
 *
 * Ne lève jamais : chaque sortie est un renoncement journalisé ET compté.
 * L'appelant poursuit la suppression dans tous les cas.
 */
async function revokeAppleToken(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<RevocationResult> {
  const { data, error } = await admin
    .from('apple_refresh_tokens')
    .select('refresh_token')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    console.error('delete-account: lecture du jeton Apple échouée', error)
    return { outcome: 'read_failed', detail: error.message }
  }

  const refreshToken = (data as { refresh_token?: unknown } | null)
    ?.refresh_token
  if (typeof refreshToken !== 'string' || !refreshToken) {
    // Cas normal : connexion Google, ou compte antérieur à `apple-link`.
    return { outcome: 'no_token' }
  }

  const config = readAppleConfig()
  if (!config) {
    // Grave, et silencieux pour l'utilisateur : on supprime quand même, mais
    // l'app restera listée côté Apple. Le compteur est là pour qu'on finisse
    // par s'en apercevoir.
    console.error(
      'delete-account: secrets APPLE_* manquants — jeton NON révoqué',
      userId,
    )
    return {
      outcome: 'missing_secrets',
      detail: 'readAppleConfig() a rendu null',
    }
  }

  try {
    const revoked = await revokeRefreshToken(config, refreshToken)
    if (!revoked) {
      console.error('delete-account: Apple a refusé la révocation', userId)
      return {
        outcome: 'apple_refused',
        detail: 'appleid.apple.com/auth/revoke a répondu non',
      }
    }
    return { outcome: 'revoked' }
  } catch (e) {
    console.error('delete-account: révocation Apple en erreur', e)
    return {
      outcome: 'error',
      detail: e instanceof Error ? e.message : String(e),
    }
  }
}

/**
 * Incrémente le compteur du jour pour cette issue.
 *
 * Ne lève JAMAIS, et c'est la règle qui compte : faire échouer une suppression
 * de compte parce qu'un compteur d'observabilité n'a pas pu s'écrire serait
 * exactement le défaut que ce compteur sert à corriger, déplacé d'un cran.
 *
 * Un échec ici (table pas encore appliquée, RPC non déployée) ne laisse donc
 * qu'une ligne de journal — mais elle, on la voit tout de suite, parce qu'elle
 * apparaît à la PREMIÈRE suppression et pas seulement le jour où Apple change
 * d'avis.
 */
async function recordRevocation(
  admin: ReturnType<typeof createClient>,
  result: RevocationResult,
): Promise<void> {
  try {
    const { error } = await admin.rpc('record_apple_revocation', {
      p_outcome: result.outcome,
      p_detail: result.detail ?? null,
    })
    if (error) {
      console.error('delete-account: compteur de révocation non écrit', error)
    }
  } catch (e) {
    console.error('delete-account: compteur de révocation en erreur', e)
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

  // Révocation Apple AVANT la suppression : le `on delete cascade` emporterait
  // sinon le jeton avec le compte. Au mieux, et sans jamais bloquer — voir
  // l'en-tête pour l'arbitrage.
  //
  // Le compteur s'écrit dans la foulée, avant `deleteUser` : si la suppression
  // échoue derrière, la tentative de révocation a bien eu lieu et doit être
  // comptée pour ce qu'elle est.
  await recordRevocation(admin, await revokeAppleToken(admin, userId))

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
  if (deleteError) {
    return json({ error: deleteError.message }, 500)
  }

  return json({ deleted: true })
})
