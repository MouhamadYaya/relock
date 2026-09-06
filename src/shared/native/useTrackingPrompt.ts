import { useEffect, useRef } from 'react'
import {
  isTrackingPromptAvailable,
  requestTrackingPermission,
  type TrackingStatus,
} from '@/shared/native/tracking'

/**
 * Demande l'autorisation de suivi (ATT) une seule fois, dès que `enabled`
 * passe à true.
 *
 * Le délai laisse l'écran d'accueil finir son apparition : l'alerte système
 * se pose ALORS par-dessus une page déjà lisible, au lieu de couper
 * l'animation d'entrée. La garde `asked` évite de relancer la demande à
 * chaque re-rendu ; le natif, lui, ne réaffiche rien si le statut est déjà
 * déterminé.
 */
export function useTrackingPrompt(
  enabled: boolean,
  {
    delayMs = 700,
    onResult,
  }: { delayMs?: number; onResult?: (status: TrackingStatus) => void } = {},
) {
  const asked = useRef(false)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  useEffect(() => {
    if (!enabled || asked.current || !isTrackingPromptAvailable) return

    const timer = setTimeout(() => {
      asked.current = true
      requestTrackingPermission().then(status => onResultRef.current?.(status))
    }, delayMs)

    return () => clearTimeout(timer)
  }, [enabled, delayMs])
}
