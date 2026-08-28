import { useCallback } from 'react'
import {
  useAppleSignInMutation,
  useGoogleSignInMutation,
} from '@/features/auth/hooks/useSocialSignInMutation'
import { isAuthCanceled } from '@/features/auth/services/auth/auth.service'
import {
  type NormalizedError,
  normalizeError,
} from '@/shared/utils/normalize-error'

type SignInResult =
  | { ok: true }
  | { ok: false; canceled: boolean; error: NormalizedError }

/**
 * Session-layer wrapper around the auth feature's Apple/Google mutations.
 * Lets other features (onboarding, settings…) trigger sign-in without
 * importing `@/features/auth` directly — features must not import sibling
 * features (see .claude/rules/features.md); `src/session/` is infra, not a
 * feature, so it may depend on `features/auth` the way it already does for
 * `performLogout`.
 */
export function useSocialSignIn() {
  const apple = useAppleSignInMutation()
  const google = useGoogleSignInMutation()

  const signInWithApple = useCallback(async (): Promise<SignInResult> => {
    try {
      await apple.mutateAsync()
      return { ok: true }
    } catch (e) {
      const error = normalizeError(e)
      return { ok: false, canceled: isAuthCanceled(error), error }
    }
  }, [apple])

  const signInWithGoogle = useCallback(async (): Promise<SignInResult> => {
    try {
      await google.mutateAsync()
      return { ok: true }
    } catch (e) {
      const error = normalizeError(e)
      return { ok: false, canceled: isAuthCanceled(error), error }
    }
  }, [google])

  return {
    signInWithApple,
    signInWithGoogle,
    pending: apple.isPending || google.isPending,
  }
}
