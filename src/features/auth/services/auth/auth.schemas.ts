/**
 * FILE: auth.schemas.ts
 * LAYER: app/services/auth
 * ---------------------------------------------------------------------
 * PURPOSE:
 *   Zod schemas for validating Supabase Auth responses before they enter
 *   the app (Sign in with Apple / Google — no password flow here).
 *
 * RESPONSIBILITIES:
 *   - Validate the `{ session, user }` result of `signInWithIdToken`.
 *   - Validate the generic session-check response (`useAuthSessionQuery`).
 *
 * DATA-FLOW:
 *   AuthService.signInWithApple() / signInWithGoogle()
 *      → supabase.auth.signInWithIdToken(...)
 *      → zSupabaseAuthResult.parse(data)
 *      → AuthMapper.toAuthSession(...)
 * ---------------------------------------------------------------------
 */
import { z } from 'zod'

export const zSupabaseAuthResult = z.object({
  session: z.object({
    access_token: z.string(),
    refresh_token: z.string(),
  }),
  user: z.object({
    id: z.string(),
    // Google always returns an email; Apple only on the very first sign-in
    // (Supabase persists it server-side after that, but we stay defensive).
    email: z.string().email().optional().nullable(),
  }),
})

export type SupabaseAuthResult = z.infer<typeof zSupabaseAuthResult>

export const zSessionResponse = z.object({
  userId: z.string().or(z.number()),
  email: z.string().email().optional(),
})

export type SessionResponse = z.infer<typeof zSessionResponse>
