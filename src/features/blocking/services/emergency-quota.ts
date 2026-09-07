/**
 * Le quota du déblocage d'urgence : une fois par semaine.
 *
 * POURQUOI UN QUOTA
 * La sortie de secours ignore volontairement toutes les protections — c'est
 * ce qui garantit que l'app ne prend jamais le téléphone en otage. Mais une
 * porte qu'on peut pousser dix fois par jour n'est plus une sortie de
 * secours : c'est le bouton « arrêter », et le produit ne protège plus rien.
 * Une fois par semaine, c'est assez rare pour qu'on y réfléchisse, et assez
 * fréquent pour couvrir une vraie urgence.
 *
 * CE QU'ON STOCKE, ET POURQUOI
 * Un horodatage, jamais un compteur. Un compteur devrait être remis à zéro
 * par quelqu'un, à un moment — au démarrage, à minuit, au changement de
 * semaine — et chacun de ces moments est une occasion de le remettre à zéro
 * deux fois, ou jamais. La date du dernier usage, elle, se compare au temps
 * présent : elle ne peut pas dériver.
 */
import { constants } from '@/config/constants'
import { kvStorage } from '@/shared/services/storage/mmkv'

/** Une semaine pleine entre deux sorties de secours. */
export const EMERGENCY_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000

export type EmergencyAvailability =
  | { allowed: true }
  | { allowed: false; nextAt: Date }

/** Date du dernier déblocage d'urgence, ou `null` s'il n'y en a jamais eu. */
export function lastEmergencyUnlockAt(): Date | null {
  const raw = kvStorage.getString(constants.EMERGENCY_UNLOCK_AT)
  if (!raw) return null
  const ms = Number.parseInt(raw, 10)
  return Number.isFinite(ms) ? new Date(ms) : null
}

/**
 * Le droit d'utiliser la sortie de secours maintenant.
 *
 * Un horodatage FUTUR (horloge reculée depuis, changement de fuseau) rouvre
 * la porte au lieu de la verrouiller pour une durée arbitraire : entre punir
 * quelqu'un pour un réglage d'horloge et lui accorder un déblocage de trop,
 * le second est sans conséquence.
 */
export function emergencyAvailability(
  now: Date = new Date(),
): EmergencyAvailability {
  const last = lastEmergencyUnlockAt()
  if (!last) return { allowed: true }
  const elapsed = now.getTime() - last.getTime()
  if (elapsed < 0 || elapsed >= EMERGENCY_COOLDOWN_MS) return { allowed: true }
  return {
    allowed: false,
    nextAt: new Date(last.getTime() + EMERGENCY_COOLDOWN_MS),
  }
}

/** À appeler quand la libération a EU LIEU côté iPhone, jamais avant. */
export function markEmergencyUnlockUsed(now: Date = new Date()): void {
  kvStorage.setString(constants.EMERGENCY_UNLOCK_AT, String(now.getTime()))
}

/**
 * Date lisible dans la langue de l'app. `toLocaleDateString` retombe sur un
 * format ISO quand l'ICU embarqué ne connaît pas la locale — d'où le repli
 * explicite en jour/mois.
 */
export function formatNextEmergency(date: Date, locale: string): string {
  try {
    return date.toLocaleDateString(locale, { day: 'numeric', month: 'long' })
  } catch {
    return `${date.getDate()}/${date.getMonth() + 1}`
  }
}
