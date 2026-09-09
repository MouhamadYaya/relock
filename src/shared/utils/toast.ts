// src/core/ui/toast.ts
import { Alert, Platform, ToastAndroid } from 'react-native'
import {
  type NormalizedError,
  normalizeError,
} from '@/shared/utils/normalize-error'
import { haptics } from '@/shared/utils/platform/haptics'

export function showToast(message: string) {
  if (Platform.OS === 'android') {
    ToastAndroid.show(message, ToastAndroid.SHORT)
  } else {
    Alert.alert('', message)
  }
}

/**
 * Un échec se SENT avant de se lire.
 *
 * Le retour est posé ici, au point de passage unique, et pas dans chacun des
 * appelants : c'est la seule façon qu'aucun chemin d'erreur n'en soit privé, y
 * compris ceux écrits demain. Sur Android le toast s'affiche en bas de l'écran
 * pendant que le regard est ailleurs — la vibration est parfois le seul signal
 * réellement reçu.
 */
export function showErrorToast(error: unknown) {
  const e: NormalizedError = normalizeError(error)
  haptics.error()
  showToast(e.message || 'Something went wrong')
}
