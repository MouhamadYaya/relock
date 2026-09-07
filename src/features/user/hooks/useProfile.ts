import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ProfileService } from '@/features/user/services/profile/profile.service'
import { Freshness } from '@/shared/services/api/query/policy/freshness'
import {
  type ImageKitUploadInput,
  uploadToImageKit,
} from '@/shared/services/imagekit'
import { normalizeError } from '@/shared/utils/normalize-error'

const KEY = ['profile', 'me'] as const

/** Identité de l'utilisateur (Supabase) : nom, e-mail, photo, anniversaire. */
export function useProfile() {
  const query = useQuery({
    queryKey: KEY,
    queryFn: ProfileService.get,
    staleTime: Freshness.nearRealtime.staleTime,
    gcTime: Freshness.nearRealtime.gcTime,
  })
  const email = query.data?.email ?? null
  const name = query.data?.name ?? null
  // Prénom d'affichage : display_name, sinon le début de l'e-mail.
  const displayName = name ?? (email ? email.split('@')[0] : null)
  return {
    name,
    email,
    displayName,
    // Chemin ImageKit ou URL du fournisseur d'identité — à passer tel quel à
    // `buildAvatarUrl`, qui sait distinguer les deux.
    avatar: query.data?.avatar ?? null,
    birthDate: query.data?.birthDate ?? null,
    createdAt: query.data?.createdAt ?? null,
    isLoading: query.isLoading,
  }
}

export function useUpdateName() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (name: string) => {
      try {
        return await ProfileService.updateName(name)
      } catch (e) {
        throw normalizeError(e)
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

/** `YYYY-MM-DD`, ou `null` pour effacer la date. */
export function useUpdateBirthDate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (birthDate: string | null) => {
      try {
        return await ProfileService.updateBirthDate(birthDate)
      } catch (e) {
        throw normalizeError(e)
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

/**
 * Remplace la photo de profil : upload ImageKit puis persistance du chemin.
 *
 * Prend une URI de fichier local, d'où qu'elle vienne (galerie, appareil
 * photo) — le hook ne dépend d'aucun sélecteur d'images en particulier.
 * L'URL affichable est ensuite dérivée par `buildAvatarUrl`, jamais stockée :
 * changer la taille d'affichage ne demande donc aucun ré-upload.
 */
export function useUpdateAvatar() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (file: ImageKitUploadInput) => {
      try {
        const { filePath } = await uploadToImageKit(file)
        await ProfileService.updateAvatar(filePath)
        return filePath
      } catch (e) {
        throw normalizeError(e)
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

/**
 * Suppression définitive du compte. Irréversible et sans file d'attente
 * hors ligne : ce n'est pas une action qu'on rejoue plus tard sans le dire.
 */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: async () => {
      try {
        return await ProfileService.deleteAccount()
      } catch (e) {
        throw normalizeError(e)
      }
    },
  })
}
