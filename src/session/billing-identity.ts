import {
  linkRevenueCatUser,
  unlinkRevenueCatUser,
} from '@/features/onboarding/services/revenuecat'
import { syncEntitlement } from '@/session/bootstrap'
import { supabase } from '@/shared/services/supabase/client'

/**
 * Rattache les achats au compte Supabase, dès qu'il en existe un.
 *
 * Sans ça, un achat fait AVANT la création du compte — ce qui est le cas
 * normal ici, le paywall précédant la connexion — reste attaché à un
 * identifiant anonyme propre à cette installation. Réinstaller ou changer
 * d'appareil obligerait alors à passer par « Restaurer », qui ne rend un
 * abonnement que sur le MÊME compte Apple. Une fois rattaché, l'abonnement
 * suit le compte : autre téléphone, autre Apple ID, Android.
 *
 * Le `syncEntitlement` qui suit n'est pas décoratif : si le compte porte déjà
 * un abonnement pris ailleurs, c'est lui qui ouvre la porte immédiatement.
 */
export async function attachBillingIdentity(): Promise<void> {
  try {
    const { data } = await supabase.auth.getUser()
    const userId = data.user?.id
    if (!userId) return
    await linkRevenueCatUser(userId)
    await syncEntitlement()
  } catch {
    // Confort : jamais un blocage de la connexion.
  }
}

/**
 * Déconnexion : on repasse sur un identifiant anonyme.
 *
 * On ne rafraîchit VOLONTAIREMENT pas l'abonnement dans la foulée.
 * `performLogout` est aussi appelé par le garde 401 et par un échec de
 * rafraîchissement de jeton : forcer la vérification ici ferait basculer un
 * client payant devant un mur de prix au moindre hoquet réseau, en pleine
 * session. Le prochain démarrage à froid tranchera, et « J'ai déjà un
 * compte » reste disponible sur le paywall.
 */
export async function detachBillingIdentity(): Promise<void> {
  try {
    await unlinkRevenueCatUser()
  } catch {
    // idem
  }
}
