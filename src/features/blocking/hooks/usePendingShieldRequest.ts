import { router } from 'expo-router'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { claimExternalEntry } from '@/navigation/persistence/navigation-persistence'
import type { PendingShieldRequest } from '@/shared/native/screen-time'
import { ScreenTime } from '@/shared/native/screen-time'
import { setShieldRequest } from '@/shared/stores/shield-request.store'

/**
 * Le mur système a reçu « Ouvrir Relock » : on récupère la demande déposée par
 * l'extension et on emmène l'utilisateur directement sur l'onglet Blocages.
 * Le contexte n'ouvre volontairement aucun rituel de déblocage automatique.
 *
 * ⚠️ Deux pièges, tous deux vécus :
 *
 *  1. **Aucun deep link.** `.openParentalControlsApp` se contente d'activer
 *     Relock : `Linking.getInitialURL()` reste `null`. La restauration du
 *     dernier onglet croyait donc être seule à décider et écrasait notre
 *     destination. On revendique l'entrée AVANT tout, de façon synchrone
 *     (`claimExternalEntry`), et la restauration attend notre réponse.
 *  2. **La lecture est destructive.** `consumePendingShieldRequest` vide la
 *     demande côté natif. Si on la consommait pendant que l'app est en
 *     arrière-plan — ou avant que le routeur puisse l'honorer — elle serait
 *     perdue sans recours. On ne consomme donc qu'une fois l'app active.
 */
export function usePendingShieldRequest(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !ScreenTime.isAvailable) return
    let disposed = false
    let consuming = false

    const goTo = (request: PendingShieldRequest) => {
      // Publier AVANT de naviguer : `app/index.tsx` consulte le même état pour
      // choisir sa redirection, donc quel que soit celui qui s'exécute en
      // premier, les deux visent l'onglet Blocages.
      setShieldRequest(request)
      // Deux niveaux doivent être traités séparément : la Stack peut encore
      // porter une demi-feuille, puis les Native Tabs doivent sélectionner
      // Blocages. Laisser une frame entre les deux évite que React Navigation
      // calcule le remplacement depuis la pile qui vient d'être dépilée.
      router.dismissAll()
      requestAnimationFrame(() => router.replace('/blocks'))
    }

    const consume = async (): Promise<boolean> => {
      if (disposed || consuming) return false
      consuming = true
      try {
        const request = await ScreenTime.consumePendingShieldRequest()
        if (disposed || !request) return false
        goTo(request)
        return true
      } catch {
        // Une activation ordinaire n'a généralement aucune demande. Une
        // erreur native transitoire ne doit jamais empêcher l'app de démarrer.
        return false
      } finally {
        consuming = false
      }
    }

    // Revendication SYNCHRONE : la restauration du dernier onglet attend cette
    // promesse avant de décider. La consommation, elle, reste asynchrone.
    const initial = consume()
    claimExternalEntry(initial)
    initial.catch(() => undefined)

    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') consume().catch(() => undefined)
    })
    return () => {
      disposed = true
      subscription.remove()
    }
  }, [enabled])
}
