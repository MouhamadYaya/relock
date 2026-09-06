import { useFocusEffect } from '@react-navigation/native'
import { useCallback, useEffect, useState } from 'react'
import { AppState } from 'react-native'
import { toHomeScoreSnapshot } from '@/features/home/services/home-score'
import type { HomeScoreSnapshot } from '@/features/home/types'
import { ScreenTime } from '@/shared/native/screen-time'

/** Rythme de relecture : l'extension réécrit le score à chacun de ses rendus. */
const POLL_INTERVAL_MS = 60_000

/**
 * Lit le score déposé par l'extension `RelockActivityReport` dans le conteneur
 * App Group.
 *
 * Le calcul n'a pas lieu ici et ne peut pas y avoir lieu : les mesures de Temps
 * d'écran ne quittent jamais le bac à sable Apple. L'app ne fait que relire le
 * résultat, que l'extension rafraîchit à chaque rendu de son rapport — d'où la
 * relecture au focus, au retour en avant-plan et sur intervalle.
 */
export function useHomeScore(): HomeScoreSnapshot {
  const [snapshot, setSnapshot] = useState<HomeScoreSnapshot>(() =>
    toHomeScoreSnapshot(null),
  )

  const read = useCallback(() => {
    let active = true
    ScreenTime.homeScore()
      .then(payload => {
        if (active) setSnapshot(toHomeScoreSnapshot(payload))
      })
      // Un score illisible n'est pas une erreur à remonter : on reste sur
      // « calcul en cours » plutôt que d'afficher un chiffre faux.
      .catch(() => {
        if (active) setSnapshot(toHomeScoreSnapshot(null))
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let cancel = read()
    const id = setInterval(() => {
      cancel()
      cancel = read()
    }, POLL_INTERVAL_MS)
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') return
      cancel()
      cancel = read()
    })
    return () => {
      cancel()
      clearInterval(id)
      sub.remove()
    }
  }, [read])

  useFocusEffect(read)

  return snapshot
}
