import { ScreenTime } from '@/shared/native/screen-time'

/**
 * Ce qu'on peut faire, ici et maintenant, de l'autorisation Temps d'écran.
 *
 * `blocked` n'est PAS « refusé une fois » : c'est « il n'y a plus de fenêtre à
 * ouvrir ». Voir `requireScreenTime` pour pourquoi la nuance décide de tout.
 */
export type ScreenTimeGate = 'approved' | 'unavailable' | 'blocked'

/**
 * Demande l'autorisation Temps d'écran — mais SEULEMENT quand il reste
 * quelque chose à demander.
 *
 * LE PROBLÈME QU'ELLE RÈGLE
 * `AuthorizationCenter.requestAuthorization(for: .individual)` ne présente sa
 * fenêtre qu'une fois. Une fois le statut passé à `.denied`, iOS ne la
 * repropose plus jamais : l'appel se contente de rejeter. Or l'app rappelait
 * `requestAuthorization()` à chaque tentative — sur l'Accueil, dans les
 * Réglages, à chaque création de règle. Il ne se passait rien de visible, et
 * le message qui suivait (« ouvre les Réglages ») envoyait vers la fiche
 * Réglages de Relock, où il n'y a AUCUN interrupteur Temps d'écran pour une
 * autorisation refusée. Trois portes, toutes fermées, aucune ne le disant :
 * c'est le cul-de-sac.
 *
 * CE QU'ELLE FAIT À LA PLACE
 * Elle lit le statut d'abord. `notDetermined` est le seul cas où une fenêtre
 * existe encore, donc le seul où l'on demande. `denied` renvoie `blocked`
 * sans rien tenter — l'appelant a alors une information vraie et une seule
 * chose à faire : ouvrir l'écran de récupération (`/screen-time-help`), qui
 * dit ce qui s'est passé et par où l'on revient.
 *
 * `unavailable` (simulateur, Android, iOS < 16) reste distinct de `blocked` :
 * il n'y a rien à récupérer, et l'app y a son comportement de démonstration.
 */
export async function requireScreenTime(): Promise<ScreenTimeGate> {
  if (!ScreenTime.isAvailable) return 'unavailable'

  let status: Awaited<ReturnType<typeof ScreenTime.authorizationStatus>>
  try {
    status = await ScreenTime.authorizationStatus()
  } catch {
    // Le statut est illisible : on ne peut ni promettre que ça marche, ni
    // affirmer que c'est refusé. `blocked` est le seul des deux qui mène
    // quelque part — l'écran de récupération commence par redemander.
    return 'blocked'
  }

  if (status === 'approved') return 'approved'
  if (status === 'unsupported') return 'unavailable'
  // `denied` : la fenêtre système n'existe plus. Ne pas la demander.
  if (status === 'denied') return 'blocked'

  try {
    return (await ScreenTime.requestAuthorization()) === 'approved'
      ? 'approved'
      : 'blocked'
  } catch {
    return 'blocked'
  }
}
