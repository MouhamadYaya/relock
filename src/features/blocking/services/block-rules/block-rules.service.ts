/**
 * Service Règles de blocage — Supabase (table `block_rules`).
 * La RLS restreint automatiquement aux règles de l'utilisateur connecté.
 */

import type { BlockRuleView, CreateRuleInput } from '@/features/blocking/types'
import type { AppId } from '@/shared/components/ui/AppLogo'
import { supabase } from '@/shared/services/supabase/client'
import type {
  BlockRule,
  BlockRuleType,
} from '@/shared/services/supabase/database.types'
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
    createdAt: row.created_at,
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
        ...(input.id ? { id: input.id } : {}),
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

  /**
   * MODIFIER une règle existante (action « Modifier » de la fiche).
   *
   * On réécrit `config` en entier : c'est l'éditeur qui vient de la
   * reconstruire à partir de tous ses champs, un patch partiel laisserait
   * traîner des réglages abandonnés (un `strict` d'un ancien blocage minuté,
   * par exemple). `suspended_until` est la seule exception : il décrit l'état
   * de vie de la règle, pas ses réglages, et survit donc à l'édition.
   */
  async update(
    id: string,
    input: {
      type: BlockRuleType
      count?: number
      config: Record<string, unknown>
    },
  ): Promise<void> {
    // La lecture doit réussir AVANT d'écrire : sur erreur, les valeurs de repli
    // ci-dessous écraseraient la sélection d'apps par une liste vide et
    // perdraient `suspended_until`.
    const { data, error: readError } = await supabase
      .from('block_rules')
      .select('config, app_selection')
      .eq('id', id)
      .maybeSingle()
    if (readError) throw normalizeError(readError)
    const previous = (data?.config as Record<string, unknown>) ?? {}
    const previousSelection = (data?.app_selection ?? {}) as {
      apps?: string[]
      count?: number
    }
    const config: Record<string, unknown> = { ...input.config }
    if (previous.suspended_until != null) {
      config.suspended_until = previous.suspended_until
    }
    const { error } = await supabase
      .from('block_rules')
      .update({
        type: input.type,
        app_selection: {
          apps: previousSelection.apps ?? [],
          count:
            typeof input.count === 'number'
              ? input.count
              : previousSelection.count,
        },
        config,
      })
      .eq('id', id)
    if (error) throw normalizeError(error)
  },

  async setActive(id: string, isActive: boolean): Promise<void> {
    const { error } = await supabase
      .from('block_rules')
      .update({ is_active: isActive })
      .eq('id', id)
    if (error) throw normalizeError(error)
  },

  /**
   * SUSPENDRE une protection (temporaire — la règle est conservée).
   * `until` = échéance de reprise ; `null` = « jusqu'à ce que je reprenne »
   * (le cas « je pars en vacances » : rien à recréer au retour).
   * On patche la config sans écraser le reste (durée de vie, strict, jours…).
   */
  async suspend(id: string, until: Date | null): Promise<void> {
    const { data } = await supabase
      .from('block_rules')
      .select('config')
      .eq('id', id)
      .maybeSingle()
    const config = {
      ...((data?.config as Record<string, unknown>) ?? {}),
      suspended_until: until ? until.toISOString() : null,
    }
    const { error } = await supabase
      .from('block_rules')
      .update({ is_active: false, config })
      .eq('id', id)
    if (error) throw normalizeError(error)
  },

  /** REPRENDRE une protection suspendue : l'échéance n'a plus lieu d'être. */
  async resume(id: string): Promise<void> {
    const { data } = await supabase
      .from('block_rules')
      .select('config')
      .eq('id', id)
      .maybeSingle()
    const config = { ...((data?.config as Record<string, unknown>) ?? {}) }
    delete config.suspended_until
    const { error } = await supabase
      .from('block_rules')
      .update({ is_active: true, config })
      .eq('id', id)
    if (error) throw normalizeError(error)
  },

  /**
   * PROLONGER un « Bloquer maintenant » en cours (action « +15 min »). On
   * patche `duration_min` sans toucher `created_at` : la fin reste
   * `created_at + duration_min`, source unique déjà lue partout ailleurs
   * (carte Accueil, onglet Blocages, fiche détail).
   */
  async extendTimedBlock(id: string, durationMin: number): Promise<void> {
    const { data } = await supabase
      .from('block_rules')
      .select('config')
      .eq('id', id)
      .maybeSingle()
    const config = {
      ...((data?.config as Record<string, unknown>) ?? {}),
      duration_min: durationMin,
    }
    const { error } = await supabase
      .from('block_rules')
      .update({ config })
      .eq('id', id)
    if (error) throw normalizeError(error)
  },

  /** Suppression définitive d'une règle (action « Arrêter le blocage »). */
  async remove(id: string): Promise<void> {
    const { error } = await supabase.from('block_rules').delete().eq('id', id)
    if (error) throw normalizeError(error)
  },
}
