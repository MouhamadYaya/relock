/** Profil utilisateur — Supabase (table `profiles`). */

import { supabase } from '@/shared/services/supabase/client'
import type { Profile } from '@/shared/services/supabase/database.types'
import { normalizeError } from '@/shared/utils/normalize-error'

export interface ProfileInfo {
  name: string | null
  email: string | null
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser()
  return data.user?.id ?? null
}

export const ProfileService = {
  async get(): Promise<ProfileInfo> {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    const email = userData.user?.email ?? null
    if (!uid) return { name: null, email }
    const { data, error } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', uid)
      .maybeSingle()
    if (error) throw normalizeError(error)
    const name = (data as Pick<Profile, 'display_name'> | null)?.display_name
    return { name: name ?? null, email }
  },

  async updateName(name: string): Promise<void> {
    const uid = await currentUserId()
    if (!uid) throw normalizeError(new Error('Non connecté'))
    const value = name.trim()
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: value.length > 0 ? value : null })
      .eq('id', uid)
    if (error) throw normalizeError(error)
  },
}
