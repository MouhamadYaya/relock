/**
 * Branche le reconciler de notifications sur l'état de l'app : recalcule à
 * chaque changement d'état pertinent ET à chaque retour au premier plan
 * (l'utilisateur a pu armer/finir un blocage entre-temps).
 */
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { NotificationService } from './notification.service'

export function useNotificationReconciler(
  streak: number,
  protectedToday: boolean,
): void {
  useEffect(() => {
    const state = { streak, protectedToday }
    NotificationService.reconcile(state).catch(() => {})

    const sub = AppState.addEventListener('change', s => {
      if (s === 'active') NotificationService.reconcile(state).catch(() => {})
    })
    return () => sub.remove()
  }, [streak, protectedToday])
}
