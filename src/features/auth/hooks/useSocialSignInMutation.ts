// src/features/auth/hooks/useSocialSignInMutation.ts

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AUTH_SESSION_TAGS, authKeys } from '@/features/auth/api/keys'
import { AuthService } from '@/features/auth/services/auth/auth.service'
import { invalidateByTags } from '@/shared/services/api/query/helpers/invalidate-by-tags'
import { normalizeError } from '@/shared/utils/normalize-error'

export function useAppleSignInMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      try {
        return await AuthService.signInWithApple()
      } catch (e) {
        throw normalizeError(e)
      }
    },
    onSuccess: async () => {
      await invalidateByTags(qc, AUTH_SESSION_TAGS, [authKeys.tagMap])
    },
  })
}

export function useGoogleSignInMutation() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      try {
        return await AuthService.signInWithGoogle()
      } catch (e) {
        throw normalizeError(e)
      }
    },
    onSuccess: async () => {
      await invalidateByTags(qc, AUTH_SESSION_TAGS, [authKeys.tagMap])
    },
  })
}
