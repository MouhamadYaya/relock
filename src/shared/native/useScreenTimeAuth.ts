import { useFocusEffect } from '@react-navigation/native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState } from 'react-native'
import { ScreenTime } from '@/shared/native/screen-time'

export type ScreenTimeAuthorizationState =
  | 'checking'
  | 'approved'
  | 'denied'
  | 'unavailable'
  | 'error'

/**
 * Autorisation Temps d'écran, TOUJOURS à jour.
 *
 * Elle est accordée AILLEURS que dans notre UI (dialogue système, Réglages
 * iOS) et peut donc changer alors qu'un écran est déjà monté. Or les onglets
 * restent montés en arrière-plan : un `useEffect` de montage ne se rejoue
 * jamais, et l'écran continuait d'afficher « Autorise le Temps d'écran »
 * alors que l'autorisation venait d'être accordée.
 *
 * On revérifie donc aux deux seuls moments où la valeur peut avoir changé
 * sans qu'on le sache : quand l'écran (re)devient visible, et au retour de
 * l'app au premier plan. Inutile de sonder en boucle — c'est un événement
 * rare, pas une donnée qui dérive.
 */
export function useScreenTimeAuthorization() {
  const [status, setStatus] = useState<ScreenTimeAuthorizationState>(() =>
    ScreenTime.isAvailable ? 'checking' : 'unavailable',
  )
  const requestGeneration = useRef(0)

  const check = useCallback(async (): Promise<ScreenTimeAuthorizationState> => {
    const generation = ++requestGeneration.current
    if (!ScreenTime.isAvailable) {
      if (generation === requestGeneration.current) setStatus('unavailable')
      return 'unavailable'
    }

    let nextStatus: ScreenTimeAuthorizationState
    try {
      const nativeStatus = await ScreenTime.authorizationStatus()
      nextStatus = nativeStatus === 'approved' ? 'approved' : 'denied'
    } catch {
      nextStatus = 'error'
    }

    if (generation === requestGeneration.current) setStatus(nextStatus)
    return nextStatus
  }, [])

  useFocusEffect(
    useCallback(() => {
      check()
    }, [check]),
  )

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') check()
    })
    return () => {
      requestGeneration.current += 1
      sub.remove()
    }
  }, [check])

  return {
    status,
    authorized: status === 'approved',
    refresh: check,
  }
}

/** Compatibilité pour les écrans qui n'ont besoin que du booléen. */
export function useScreenTimeAuthorized(): boolean {
  return useScreenTimeAuthorization().authorized
}
