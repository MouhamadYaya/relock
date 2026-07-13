import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ProfileService } from '@/features/user/services/profile/profile.service'
import { Freshness } from '@/shared/services/api/query/policy/freshness'
import { normalizeError } from '@/shared/utils/normalize-error'

const KEY = ['profile', 'me'] as const

/** Prénom + e-mail de l'utilisateur (Supabase). */
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
  return { name, email, displayName, isLoading: query.isLoading }
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
