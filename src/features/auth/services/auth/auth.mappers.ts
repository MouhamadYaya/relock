/**
 * FILE: auth.mappers.ts
 * LAYER: app/services/auth
 * ---------------------------------------------------------------------
 * PURPOSE:
 *   Convert raw validated Supabase auth results into domain-friendly
 *   models, ensuring UI never sees transport-level shapes.
 *
 * DATA-FLOW:
 *   validated DTO (auth.schemas)
 *      → AuthMapper.toAuthSession()
 *         → domain model
 *         → UI / stores / service consumers
 * ---------------------------------------------------------------------
 */

import type { AuthSession } from '@/features/auth/types'
import type { SupabaseAuthResult } from './auth.schemas'

export const AuthMapper = {
  toAuthSession(dto: SupabaseAuthResult): AuthSession {
    return {
      token: dto.session.access_token,
      refreshToken: dto.session.refresh_token,
      userId: dto.user.id,
      email: dto.user.email ?? '',
    }
  },
}
