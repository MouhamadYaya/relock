/** Profil utilisateur — Supabase (table `profiles`). */

import { translate } from '@/i18n/translate'
import { supabase } from '@/shared/services/supabase/client'
import type { Profile } from '@/shared/services/supabase/database.types'
import { normalizeError } from '@/shared/utils/normalize-error'

export interface ProfileInfo {
  name: string | null
  email: string | null
  /**
   * Chemin ImageKit (`avatars/<uid>/photo.jpg`) OU URL absolue d'un
   * fournisseur d'identité. `buildAvatarUrl` accepte les deux : il transforme
   * le premier et laisse le second intact.
   */
  avatar: string | null
  /** `YYYY-MM-DD`, ou `null` si la personne ne l'a pas renseignée. */
  birthDate: string | null
  /** Date de création du compte (ISO), pour le « membre depuis ». */
  createdAt: string | null
}

/**
 * Code PostgreSQL d'une colonne inconnue.
 *
 * `birth_date` a été ajoutée après le premier déploiement : une base qui n'a
 * pas encore reçu la migration ferait échouer TOUT le profil (nom, photo,
 * e-mail) pour une seule colonne facultative. On retente donc sans elle
 * plutôt que de laisser l'écran vide.
 */
const UNDEFINED_COLUMN = '42703'

function isMissingColumn(error: { code?: string } | null): boolean {
  return error?.code === UNDEFINED_COLUMN
}

/**
 * Le serveur exige une authentification récente avant de supprimer le compte.
 * L'appelant doit faire reconnecter la personne, pas réessayer.
 */
export const REAUTH_REQUIRED = 'reauthentication_required'

/**
 * Le code machine renvoyé dans le corps d'une Edge Function.
 *
 * `functions.invoke` ne remonte qu'un `FunctionsHttpError` générique : le
 * statut et la raison vivent dans la `Response` attachée, qu'il faut lire
 * soi-même. Sans ça, « reconnecte-toi » serait indiscernable de « le serveur
 * est en panne ».
 */
async function edgeErrorCode(error: unknown): Promise<string | null> {
  const context = (error as { context?: unknown } | null)?.context
  if (!(context instanceof Response)) return null
  try {
    const body: unknown = await context.clone().json()
    const code = (body as { error?: unknown } | null)?.error
    return typeof code === 'string' ? code : null
  } catch {
    return null
  }
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

type ProfileRow = Pick<
  Profile,
  'display_name' | 'avatar_url' | 'birth_date' | 'created_at'
>

export const ProfileService = {
  async get(): Promise<ProfileInfo> {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    const email = userData.user?.email ?? null
    // Photo fournie par Google/Apple à la connexion : sert de valeur par
    // défaut tant que l'utilisateur n'a pas choisi la sienne.
    const providerAvatar =
      typeof userData.user?.user_metadata?.avatar_url === 'string'
        ? userData.user.user_metadata.avatar_url
        : null
    const empty: ProfileInfo = {
      name: null,
      email,
      avatar: providerAvatar,
      birthDate: null,
      createdAt: userData.user?.created_at ?? null,
    }
    if (!uid) return empty

    let { data, error } = await supabase
      .from('profiles')
      .select('display_name, avatar_url, birth_date, created_at')
      .eq('id', uid)
      .maybeSingle()

    if (isMissingColumn(error)) {
      ;({ data, error } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, created_at')
        .eq('id', uid)
        .maybeSingle())
    }
    if (error) throw normalizeError(error)

    const row = data as Partial<ProfileRow> | null
    return {
      name: row?.display_name ?? null,
      email,
      avatar: row?.avatar_url ?? providerAvatar,
      birthDate: row?.birth_date ?? null,
      createdAt: row?.created_at ?? empty.createdAt,
    }
  },

  async updateName(name: string): Promise<void> {
    const uid = await currentUserId()
    if (!uid) throw normalizeError(new Error(translate('errors.not_signed_in')))
    const value = name.trim()
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: value.length > 0 ? value : null })
      .eq('id', uid)
    if (error) throw normalizeError(error)
  },

  /** `YYYY-MM-DD`, ou `null` pour effacer la date. */
  async updateBirthDate(birthDate: string | null): Promise<void> {
    const uid = await currentUserId()
    if (!uid) throw normalizeError(new Error(translate('errors.not_signed_in')))
    const { error } = await supabase
      .from('profiles')
      .update({ birth_date: birthDate })
      .eq('id', uid)
    if (isMissingColumn(error)) {
      throw normalizeError(
        new Error(translate('errors.birth_date_unavailable')),
      )
    }
    if (error) throw normalizeError(error)
  },

  /** Persiste le chemin ImageKit renvoyé par l'upload. */
  async updateAvatar(filePath: string): Promise<void> {
    const uid = await currentUserId()
    if (!uid) throw normalizeError(new Error(translate('errors.not_signed_in')))
    const { error } = await supabase
      .from('profiles')
      .update({ avatar_url: filePath })
      .eq('id', uid)
    if (error) throw normalizeError(error)
  },

  /**
   * Suppression définitive du compte (Edge Function `delete-account`).
   *
   * Le client ne peut PAS supprimer une ligne d'`auth.users` : cela demande
   * la clé de service, qui ne doit jamais entrer dans le binaire. La fonction
   * fait le travail et les `on delete cascade` du schéma emportent règles,
   * événements, statistiques et réponses d'onboarding.
   */
  async deleteAccount(): Promise<void> {
    const { error } = await supabase.functions.invoke('delete-account', {
      method: 'POST',
    })
    if (!error) return

    // Une session ancienne ne suffit pas pour une action irréversible : le
    // serveur réclame une reconnexion. Ce cas a son propre code, parce que
    // l'écran doit rouvrir la porte « compte », pas afficher « réessaie ».
    if ((await edgeErrorCode(error)) === REAUTH_REQUIRED) {
      throw normalizeError({
        code: REAUTH_REQUIRED,
        message: translate('errors.reauth_required'),
        status: 403,
        raw: error,
      })
    }
    throw normalizeError(error)
  },
}
