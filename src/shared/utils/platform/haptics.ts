import { trigger } from 'react-native-haptic-feedback'
import { getPreference } from '@/shared/services/storage/app-preferences'

type HapticKind =
  | 'impactLight'
  | 'impactMedium'
  | 'impactHeavy'
  | 'rigid'
  | 'selection'

const options = {
  enableVibrateFallback: false,
  ignoreAndroidSystemSettings: false,
} as const

/**
 * Les retours FORTS (maintien d'une action irréversible) doivent se sentir
 * même sans moteur haptique : on autorise le repli sur le vibreur, et on
 * ignore le réglage système — c'est un signal de sécurité, pas une coquetterie.
 */
const forceful = {
  enableVibrateFallback: true,
  ignoreAndroidSystemSettings: true,
} as const

function safelyTrigger(type: HapticKind, opts: object = options) {
  // Réglages → « Retours haptiques ». Lu à CHAQUE frappe, jamais mis en
  // cache : la bascule doit se sentir immédiatement, sans redémarrage.
  if (!getPreference('haptics')) return
  try {
    trigger(type, opts)
  } catch {
    // Un retour haptique ne doit jamais interrompre l'interaction principale.
  }
}

export const haptics = {
  impactLight() {
    safelyTrigger('impactLight')
  },
  impactMedium() {
    safelyTrigger('impactMedium', forceful)
  },
  /** Le coup le plus fort disponible — réservé aux maintiens qui engagent. */
  impactHeavy() {
    safelyTrigger('impactHeavy', forceful)
  },
  /** Sec et net : superposé au coup lourd, il durcit la frappe. */
  impactRigid() {
    safelyTrigger('rigid', forceful)
  },
  selectionTick() {
    safelyTrigger('selection')
  },
}
