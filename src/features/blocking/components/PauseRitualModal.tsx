import React, { useEffect, useState } from 'react'
import type { PauseRitual } from '@/shared/services/storage/app-preferences'
import { usePreferences } from '@/shared/stores/preferences.store'
import { BreathingPauseModal } from './BreathingPauseModal'
import { MathPauseModal } from './MathPauseModal'
import { TranscribePauseModal } from './TranscribePauseModal'

/**
 * La pause exigée avant un déblocage — quel que soit le rituel choisi.
 *
 * C'est le SEUL point d'entrée des écrans de pause. Les trois rituels
 * partagent le même contrat (`visible`, l'app concernée, annuler, continuer),
 * donc les écrans appelants n'ont jamais à savoir lequel est actif : ils
 * posent une pause, et la préférence décide de sa forme.
 *
 * Le rituel affiché est FIGÉ à l'ouverture, dans `shown`. Le lire directement
 * depuis la préférence remplacerait l'écran sous les doigts au moment même où
 * l'utilisateur en choisit un autre — trois calculs déjà résolus
 * disparaîtraient au profit de six secondes de respiration, ce qui donne une
 * sortie de secours à un dispositif dont c'est précisément l'inverse du but.
 * Le nouveau choix prend donc la main à la pause SUIVANTE.
 */
export function PauseRitualModal({
  visible,
  tokenKey,
  allApps = false,
  onCancel,
  onContinue,
}: {
  visible: boolean
  tokenKey?: string
  allApps?: boolean
  onCancel: () => void
  onContinue: () => void
}) {
  const preferred = usePreferences(state => state.pauseRitual)
  const setPauseRitual = usePreferences(state => state.setPauseRitual)
  const [shown, setShown] = useState<PauseRitual>(preferred)

  // On ne relit la préférence qu'au moment où la pause s'ouvre. Fermée, la
  // pause n'affiche rien : l'écran suivant repart donc du choix à jour.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `preferred` est volontairement lu À L'OUVERTURE seulement — le relire en continu remplacerait l'écran sous les doigts.
  useEffect(() => {
    if (visible) setShown(preferred)
  }, [visible])

  const shared = {
    visible,
    ritual: shown,
    tokenKey,
    allApps,
    onCancel,
    onContinue,
    pickedRitual: preferred,
    onPickRitual: setPauseRitual,
  }

  if (shown === 'math') return <MathPauseModal {...shared} />
  if (shown === 'transcribe') return <TranscribePauseModal {...shared} />
  return <BreathingPauseModal {...shared} />
}
