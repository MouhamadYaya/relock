import { useFocusEffect } from '@react-navigation/native'
import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { ScreenTime } from '@/shared/native/screen-time'

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
export function useScreenTimeAuthorized(): boolean {
  // Optimiste au départ : on n'affiche pas « non autorisé » le temps de la
  // première vérification, sinon l'écran clignote à chaque ouverture.
  const [authorized, setAuthorized] = useState(true)

  const check = useCallback(() => {
    if (!ScreenTime.isAvailable) return
    ScreenTime.authorizationStatus()
      .then(s => setAuthorized(s === 'approved'))
      .catch(() => undefined)
  }, [])

  useFocusEffect(check)

  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') check()
    })
    return () => sub.remove()
  }, [check])

  return authorized
}
