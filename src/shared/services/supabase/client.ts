// Client Supabase (auth + Postgres). Session auth persistée dans le TROUSSEAU
// (Keychain iOS / Keystore Android), jamais sur MMKV — voir plus bas.
// Les identifiants viennent de .env (SUPABASE_URL / SUPABASE_ANON_KEY),
// jamais commités. Ne jamais utiliser la service_role key ici.
import 'react-native-url-polyfill/auto'
import { createClient } from '@supabase/supabase-js'
import { env } from '@/config/env'
import { kvStorage } from '@/shared/services/storage/mmkv'
import {
  secureGetItem,
  secureRemoveItem,
  secureSetItem,
} from '@/shared/services/storage/secure-store'
import type { Database } from './database.types'

/**
 * Adaptateur de stockage de la session Supabase.
 *
 * POURQUOI PAS MMKV
 * MMKV est ouvert sans `encryptionKey` : son fichier est lisible tel quel dans
 * le conteneur de l'app. La session contient le REFRESH TOKEN, qui se rejoue
 * indéfiniment (`autoRefreshToken` ci-dessous) et ouvre tout le compte. Il vit
 * donc dans le trousseau matériel — c'est aussi ce qu'impose
 * `.claude/rules/security.md`.
 *
 * MIGRATION DES INSTALLATIONS EXISTANTES
 * Les versions précédentes ont écrit la session sur MMKV. On la relit donc une
 * dernière fois quand le trousseau est vide, on la recopie, PUIS on efface la
 * copie en clair. C'est ce dernier point qui compte : sans lui, le durcissement
 * n'aurait protégé que les nouvelles installations, et le jeton des utilisateurs
 * déjà présents — les seuls à en avoir un — serait resté sur le disque.
 */
const secureAuthStorage = {
  getItem: (key: string) => {
    const stored = secureGetItem(key)
    if (stored !== null) return stored

    const legacy = kvStorage.getString(key)
    if (legacy === null) return null

    // Ne retirer la version en clair QUE si le trousseau a bien accepté la
    // reprise : échouer des deux côtés déconnecterait l'utilisateur.
    if (secureSetItem(key, legacy)) kvStorage.delete(key)
    return legacy
  },
  setItem: (key: string, value: string) => {
    secureSetItem(key, value)
  },
  removeItem: (key: string) => {
    secureRemoveItem(key)
    // Une session héritée peut encore traîner côté MMKV si la reprise ci-dessus
    // n'a jamais eu lieu (compte déconnecté avant la première lecture).
    kvStorage.delete(key)
  },
}

/** True quand les identifiants Supabase sont configurés dans .env. */
export const isSupabaseConfigured =
  env.SUPABASE_URL.length > 0 && env.SUPABASE_ANON_KEY.length > 0

export const supabase = createClient<Database>(
  env.SUPABASE_URL || 'http://localhost',
  env.SUPABASE_ANON_KEY || 'public-anon-key-placeholder',
  {
    auth: {
      storage: secureAuthStorage,
      autoRefreshToken: true,
      persistSession: true,
      // Pas de redirection OAuth par URL sur mobile.
      detectSessionInUrl: false,
    },
  },
)
