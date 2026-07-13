/**
 * Service Règles de blocage — Supabase (table `block_rules`).
 * La RLS restreint automatiquement aux règles de l'utilisateur connecté.
 */

import type { BlockRuleView, CreateRuleInput } from '@/features/blocking/types'
import type { AppId } from '@/shared/components/ui/AppLogo'
import { supabase } from '@/shared/services/supabase/client'
import type { BlockRule } from '@/shared/services/supabase/database.types'
import { normalizeError } from '@/shared/utils/normalize-error'

function toView(row: BlockRule): BlockRuleView {
  const sel = row.app_selection as { apps?: string[]; count?: number }
  return {
    id: row.id,
    type: row.type,
    appIds: (sel?.apps ?? []) as AppId[],
    isActive: row.is_active,
    count: typeof sel?.count === 'number' ? sel.count : undefined,
    config: (row.config ?? {}) as Record<string, unknown>,
  }
}

export const BlockRulesService = {
  async list(): Promise<BlockRuleView[]> {
    const { data, error } = await supabase
      .from('block_rules')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw normalizeError(error)
    return (data ?? []).map(toView)
  },

  async create(input: CreateRuleInput): Promise<BlockRuleView> {
    const { data: userData, error: userErr } = await supabase.auth.getUser()
    if (userErr) throw normalizeError(userErr)
    const userId = userData.user?.id
    if (!userId) throw normalizeError(new Error('Non connecté'))

    const { data, error } = await supabase
      .from('block_rules')
      .insert({
        user_id: userId,
        type: input.type,
        app_selection:
          typeof input.count === 'number'
            ? { apps: input.appIds, count: input.count }
            : { apps: input.appIds },
        config: input.config ?? {},
        is_active: true,
      })
      .select('*')
      .single()
    if (error) throw normalizeError(error)
    return toView(data)
  },

  async setActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('block_rules')
      .update({ is_active: isActive })
      .eq('id', id)
    if (error) throw normalizeError(error)
  },
}
