/**
 * Remise à zéro à la (ré)installation.
 *
 * 1. Au lancement : purge le blocage résiduel au niveau système (le bouclier
 *    et la surveillance DeviceActivity survivent à la suppression de l'app).
 * 2. Une fois connecté : l'historique du compte est effacé. Une réinstallation
 *    rend l'app neuve — c'est la contrepartie du mode strict : rien ne
 *    survit à une désinstallation, ni les blocages, ni la série.
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

/** Une (ré)installation fraîche attend-elle encore sa remise à zéro ? */
export function hasPendingFreshInstall(): boolean {
  return kvStorage.getString(PENDING) === '1'
}

/** Repart de zéro : efface règles, stats et événements du compte. */
export async function wipeCloudData(): Promise<boolean> {
  const { data } = await supabase.auth.getUser()
  const uid = data.user?.id
  if (!uid) return false

  // Chaque delete est VÉRIFIÉ : un échec partiel (blip réseau) ne doit ni lever
  // le drapeau ni renvoyer un succès — sinon des stats/blocages fantômes
  // réapparaissent au refetch et l'utilisateur n'est plus jamais re-sollicité.
  const e1 = await supabase.from('block_events').delete().eq('user_id', uid)
  const e2 = await supabase.from('daily_stats').delete().eq('user_id', uid)
  const e3 = await supabase.from('block_rules').delete().eq('user_id', uid)
  if (e1.error || e2.error || e3.error) return false

  // Purge AUSSI le journal d'événements natif (App Group) : il survit à la
  // désinstallation. Sans ça, le prochain syncFromDevice recréerait des lignes
  // `daily_stats` à partir de vieux événements juste après le wipe.
  if (ScreenTime.isAvailable) {
    try {
      const pending = await ScreenTime.pullEvents()
      if (pending.length) await ScreenTime.ackEvents(pending.length)
    } catch {
      // best effort — n'annule pas un wipe cloud réussi
    }
  }

  kvStorage.delete(PENDING)
  return true
}
