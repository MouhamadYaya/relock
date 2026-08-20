import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import {
  hasPendingFreshInstall,
  wipeCloudData,
} from '@/features/blocking/services/reset.service'
import { showErrorToast } from '@/shared/utils/toast'

/**
 * Réinstaller Relock rend l'app NEUVE : aucun blocage, aucune série, aucun
 * historique. Sans question — un retour ne se négocie pas, et proposer
 * « reprendre mes données ? » laissait croire qu'un blocage strict pouvait
 * survivre à une désinstallation. Il ne le peut pas, et le dire clairement
 * vaut mieux que l'entretenir.
 *
 * ⚠️ Conséquence assumée : installer Relock sur un SECOND iPhone efface les
 * blocages du premier. Le drapeau vit dans le sandbox de l'app (effacé par
 * iOS à la désinstallation), pas dans le compte — il n'existe aucun moyen de
 * distinguer « je réinstalle » de « j'installe ailleurs ».
 */
export function useFreshInstallReset() {
  const qc = useQueryClient()
  const done = useRef(false)

  useEffect(() => {
    if (done.current || !hasPendingFreshInstall()) return
    done.current = true
    wipeCloudData()
      .then(ok => {
        // Échec partiel : le drapeau reste posé, on réessaiera au prochain
        // lancement. Surtout pas de faux « c'est propre ».
        if (!ok) {
          showErrorToast(new Error("La remise à zéro n'a pas pu aboutir."))
          return
        }
        return qc.invalidateQueries()
      })
      .catch(e => showErrorToast(e))
  }, [qc])
}
