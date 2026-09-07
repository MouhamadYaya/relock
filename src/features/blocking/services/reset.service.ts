/**
 * Remise à zéro à la (ré)installation.
 *
 * 1. Au lancement : purge le blocage résiduel au niveau système (le bouclier
 *    et la surveillance DeviceActivity survivent à la suppression de l'app).
 * 2. Une fois connecté : l'historique du compte est effacé. Une réinstallation
 *    rend l'app neuve — c'est la contrepartie du mode strict : rien ne
 *    survit à une désinstallation, ni les blocages, ni la série.
 */

import { constants } from '@/config/constants'
import { emergencyUnlock } from '@/features/blocking/services/emergency-unlock'
import type { BlockRuleView } from '@/features/blocking/types'
import { getSessionQueryClient } from '@/session/session-bridge'
import { ScreenTime } from '@/shared/native/screen-time'
import { offlineQueue } from '@/shared/services/api/offline/offline-queue'
import { cacheEngine } from '@/shared/services/storage/cache-engine'
import { kvStorage } from '@/shared/services/storage/mmkv'
import { supabase } from '@/shared/services/supabase/client'

const PENDING = 'reset.pendingCloudWipe'

/** À appeler au démarrage de l'app. */
export async function runInstallReset(): Promise<void> {
  try {
    const fresh = await ScreenTime.resetIfFreshInstall()
    // Le drapeau natif vit dans UserDefaults.standard, remis à zéro par iOS à
    // chaque désinstallation COMPLÈTE — y compris celles que Xcode/`expo run:ios`
    // déclenche pour un simple rebuild dev (changement de signature/entitlements
    // des 5 extensions). En __DEV__, ce n'est donc pas un signal fiable de
    // « vraie » réinstallation : on laisse la purge native (résidus système)
    // s'exécuter, mais on n'efface JAMAIS le cloud sur cette seule détection —
    // sinon chaque rebuild de test supprime les règles du compte.
    if (fresh && !__DEV__) kvStorage.setString(PENDING, '1')
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

/**
 * Remise à zéro DEMANDÉE par l'utilisateur, depuis les Réglages.
 *
 * À ne pas confondre avec `runInstallReset`, qui répare l'état après une
 * réinstallation. Ici c'est un choix : « je repars de zéro ».
 *
 * CE QUI DISPARAÎT
 * Les règles, les événements, les statistiques quotidiennes, la série, le
 * score — côté serveur ET dans le journal natif de l'App Group, sans quoi la
 * prochaine synchronisation reconstruirait des statistiques à partir de
 * vieux événements et l'historique « effacé » réapparaîtrait.
 *
 * CE QUI RESTE, VOLONTAIREMENT
 * La session (on ne déconnecte pas quelqu'un qui a demandé un ménage),
 * l'abonnement (il appartient au compte App Store), et les préférences
 * personnelles — thème, langue, notifications. Effacer la langue de
 * quelqu'un parce qu'il a voulu remettre ses compteurs à zéro serait une
 * surprise, pas un service. L'écran de confirmation dit exactement cela.
 *
 * Rend `false` si la purge côté serveur a échoué : l'iPhone est alors déjà
 * libéré, mais le compte n'est pas à jour, et l'écran doit le dire plutôt que
 * d'annoncer un succès.
 */
export async function resetAllData(rules: BlockRuleView[]): Promise<boolean> {
  // 1. Libérer l'iPhone d'abord. Si la suite échoue, on ne laisse personne
  //    enfermé derrière un bouclier dont les règles viennent d'être effacées.
  await emergencyUnlock(rules)

  // 2. Le compte : règles, événements, statistiques, + journal natif.
  const wiped = await wipeCloudData()

  // 3. Les caches locaux, qui rejoueraient sinon l'ancien monde au prochain
  //    démarrage : instantané React Query persisté, file hors ligne, cache
  //    mémoire. La session Supabase vit AUSSI dans MMKV : on efface donc des
  //    clés nommées, jamais tout le magasin.
  kvStorage.delete(constants.RQ_CACHE)
  offlineQueue.clear()
  cacheEngine.clear()
  const client = getSessionQueryClient()
  if (client) {
    await client.cancelQueries().catch(() => undefined)
    client.clear()
  }

  return wiped
}
