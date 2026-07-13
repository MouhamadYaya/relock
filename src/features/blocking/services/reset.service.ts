/**
 * Remise à zéro à la (ré)installation.
 *
 * 1. Au lancement : purge le blocage résiduel au niveau système (le bouclier
 *    et la surveillance DeviceActivity survivent à la suppression de l'app).
 * 2. Une fois connecté : efface règles/événements/stats du compte cloud, pour
 *    qu'une réinstallation reparte réellement de zéro.
 */

import { ScreenTime } from '@/shared/native/screen-time'
import { kvStorage } from '@/shared/services/storage/mmkv'
import { supabase } from '@/shared/services/supabase/client'

const PENDING = 'reset.pendingCloudWipe'

/** À appeler au démarrage de l'app. */
export async function runInstallReset(): Promise<void> {
  try {
    const fresh = await ScreenTime.resetIfFreshInstall()
    if (fresh) kvStorage.setString(PENDING, '1')
  } catch {
    // best effort — ne bloque jamais le démarrage
  }
}

/** À appeler une fois l'utilisateur authentifié. Renvoie true si un wipe a eu lieu. */
export async function wipeCloudIfPending(): Promise<boolean> {
  if (kvStorage.getString(PENDING) !== '1') return false
  const { data } = await supabase.auth.getUser()
  const uid = data.user?.id
  if (!uid) return false
  await supabase.from('block_events').delete().eq('user_id', uid)
  await supabase.from('daily_stats').delete().eq('user_id', uid)
  await supabase.from('block_rules').delete().eq('user_id', uid)
  kvStorage.delete(PENDING)
  return true
}
