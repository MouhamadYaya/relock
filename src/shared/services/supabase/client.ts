// Client Supabase (auth + Postgres). Session auth persistée sur MMKV.
// Les identifiants viennent de .env (SUPABASE_URL / SUPABASE_ANON_KEY),
// jamais commités. Ne jamais utiliser la service_role key ici.
import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/config/env'
import { kvStorage } from '@/shared/services/storage/mmkv'
import type { Database } from './database.types'

// Adaptateur de stockage pour la session Supabase (sur MMKV).
const mmkvAuthStorage = {
  getItem: (key: string) => kvStorage.getString(key),
  setItem: (key: string, value: string) => kvStorage.setString(key, value),
  removeItem: (key: string) => kvStorage.delete(key),
}

/** True quand les identifiants Supabase sont configurés dans .env. */
export const isSupabaseConfigured =
  env.SUPABASE_URL.length > 0 && env.SUPABASE_ANON_KEY.length > 0

export const supabase = createClient<Database>(
  env.SUPABASE_URL || 'http://localhost',
  env.SUPABASE_ANON_KEY || 'public-anon-key-placeholder',
  {
    auth: {
      storage: mmkvAuthStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Pas de redirection OAuth par URL sur mobile.
      detectSessionInUrl: false,
    },
  },
)
