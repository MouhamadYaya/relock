import type { EntitlementCheck } from '@/features/onboarding/services/revenuecat'
import {
  linkRevenueCatUser,
  unlinkRevenueCatUser,
} from '@/features/onboarding/services/revenuecat'
import {
  applyEntitlement,
  beginBillingIdentitySwitch,
  endBillingIdentitySwitch,
} from '@/session/bootstrap'
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
 * Cette étape ne peut qu'OUVRIR la porte, jamais la refermer.
 *
 * Ce n'est pas une prudence de principe, c'est un bug qui a coûté un client
 * payant (2026-09-07) : il a payé, avancé vers la connexion, et s'est
 * retrouvé au paywall — il a dû restaurer son achat à la main. La bascule
 * d'identité RevenueCat (`Purchases.logIn`) quitte l'identifiant anonyme qui
 * portait l'achat pour le compte, et pousse au passage un `CustomerInfo` qui
 * ne connaît pas encore l'abonnement. `watchEntitlement` l'entendait et
 * refermait la porte.
 *
 * D'où les deux garde-fous : la fenêtre `beginBillingIdentitySwitch` fait
 * taire toute fermeture pendant la bascule, et seul un `active` avéré, une
 * fois la bascule finie, agit. Un `inactive` ne referme rien : ici, il peut
 * vouloir dire « le reçu n'est pas encore reporté ». C'est le prochain
 * démarrage à froid — identité posée depuis longtemps — qui tranche, comme
 * pour la déconnexion ci-dessous.
 */
export async function attachBillingIdentity(): Promise<void> {
  let linked: EntitlementCheck = 'unknown'
  beginBillingIdentitySwitch()
  try {
    const { data } = await supabase.auth.getUser()
    const userId = data.user?.id
    if (userId) linked = await linkRevenueCatUser(userId)
  } catch {
    // Confort : jamais un blocage de la connexion.
  } finally {
    endBillingIdentitySwitch()
  }
  if (linked === 'active') applyEntitlement(true)
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
 *
 * La fenêtre de bascule est ce qui rend cette intention vraie : sans elle,
 * `Purchases.logOut` poussait le `CustomerInfo` de l'identifiant anonyme tout
 * neuf — aucun abonnement, par construction — et `watchEntitlement`
 * refermait la porte que cette fonction se garde justement de toucher.
 */
export async function detachBillingIdentity(): Promise<void> {
  beginBillingIdentitySwitch()
  try {
    await unlinkRevenueCatUser()
  } catch {
    // idem
  } finally {
    endBillingIdentitySwitch()
  }
}
