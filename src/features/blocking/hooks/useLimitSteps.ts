import { useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { ScreenTime } from '@/shared/native/screen-time'

/**
 * Avancement du quota du jour par règle (id → 0…1), posé par le moniteur aux
 * paliers 25/50/75/100 %.
 *
 * Relu au montage et à chaque retour au premier plan : le quota ne peut avancer
 * que pendant que l'utilisateur est DANS les apps limitées — donc app en
 * arrière-plan. Sonder pendant qu'elle est ouverte ne servirait à rien.
 */
export function useLimitSteps(): Record<string, number> {
  const [steps, setSteps] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!ScreenTime.isAvailable) return
    const read = () => {
      ScreenTime.limitSteps()
        .then(setSteps)
        .catch(() => {})
    }
    read()
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') read()
    })
    return () => sub.remove()
  }, [])

  return steps
}
