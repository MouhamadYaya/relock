import { useEffect } from 'react'
import { InteractionManager } from 'react-native'

/**
 * Préchauffage des écrans lourds.
 *
 * Expo Router charge le module d'une route à la PREMIÈRE navigation
 * (`getRoutesCore` ne garde qu'un `loadRoute()` paresseux). Le tap paie donc,
 * en une fois et sur le thread JS, l'évaluation de tout le graphe d'imports de
 * l'écran — pour les Réglages : le sélecteur d'heure natif, l'export de
 * données, le service de notifications, les achats. Rien ne bouge à l'écran
 * pendant ce temps : c'est exactement la latence qu'on ressentait entre l'appui
 * sur la roue dentée et l'arrivée de l'écran.
 *
 * On paie cette évaluation à l'avance, quand l'Accueil est au repos —
 * `runAfterInteractions` garantit qu'elle n'entre jamais en concurrence avec
 * une animation en cours. Au tap, il ne reste plus que le rendu.
 *
 * Ce n'est PAS un préchargement d'écran (`router.prefetch`) : rien n'est monté,
 * aucun effet ne tourne, aucune requête ne part. On ne fait qu'amener le code
 * dans le registre de modules.
 */
const WARMERS = {
  settings: () => import('@/features/settings/screens/SettingsScreen'),
} as const

export type WarmableRoute = keyof typeof WARMERS

export function useWarmRoute(route: WarmableRoute) {
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      // Un préchauffage raté n'est pas une panne : la route se chargera au tap,
      // comme avant. On avale donc l'erreur plutôt que de la faire remonter.
      WARMERS[route]().catch(() => {})
    })
    return () => task.cancel()
  }, [route])
}
