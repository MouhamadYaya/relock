import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { Alert } from 'react-native'
import { flags } from '@/config/constants'
import {
  hasPendingFreshInstall,
  keepCloudData,
  wipeCloudData,
} from '@/features/blocking/services/reset.service'
import { showErrorToast } from '@/shared/utils/toast'

/**
 * Après une (ré)installation, propose UNE fois de reprendre l'historique
 * du compte ou de repartir de zéro. Jamais de destruction silencieuse :
 * installer Relock sur un nouvel iPhone ne doit pas effacer le compte.
 */
export function useFreshInstallPrompt() {
  const qc = useQueryClient()
  const asked = useRef(false)

  useEffect(() => {
    if (asked.current || !hasPendingFreshInstall()) return
    asked.current = true
    // Dev sans login : les réinstallations s'enchaînent (simulateur, builds) —
    // on reprend toujours les données sans dialogue bloquant.
    if (flags.DEV_SKIP_AUTH) {
      keepCloudData()
      console.log('[DEV] Réinstallation détectée → reprise des données (auto)')
      return
    }
    Alert.alert(
      'Bon retour 👋',
      'On retrouve ton compte. Tu veux reprendre ta série et tes blocages, ou repartir de zéro ?',
      [
        {
          text: 'Reprendre mes données',
          style: 'default',
          onPress: () => keepCloudData(),
        },
        {
          text: 'Repartir de zéro',
          style: 'destructive',
          onPress: () => {
            wipeCloudData()
              .then(ok => {
                // Échec partiel : on garde le drapeau (re-proposé au prochain
                // lancement) et on prévient — pas de faux « c'est fait ».
                if (!ok) {
                  showErrorToast(
                    new Error("La remise à zéro n'a pas pu aboutir."),
                  )
                  return
                }
                return qc.invalidateQueries()
              })
              .catch(e => showErrorToast(e))
          },
        },
      ],
      { cancelable: false },
    )
  }, [qc])
}
