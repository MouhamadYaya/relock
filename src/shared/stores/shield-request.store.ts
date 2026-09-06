import { create } from 'zustand'
import type { PendingShieldRequest } from '@/shared/native/screen-time'

type ShieldRequestStore = {
  /** Demande déposée par le mur système, en attente de traitement. */
  request: PendingShieldRequest | null
  setRequest: (request: PendingShieldRequest | null) => void
}

/**
 * La demande « Ouvrir Relock » venue du mur système, le temps de l'honorer.
 *
 * ⚠️ Pourquoi un store plutôt que des paramètres d'URL : quand iOS ouvre
 * Relock depuis le mur, l'app démarre à froid sur « / ». `app/index.tsx` y
 * rend un `<Redirect>` vers l'accueil, et `useRestoreLastPath` vise le dernier
 * onglet — deux navigations qui partaient en concurrence avec la nôtre et la
 * gagnaient une fois sur deux. L'utilisateur atterrissait alors sur le menu de
 * Relock au lieu de l'onglet Blocages, et comme la demande est lue de façon
 * DESTRUCTIVE côté natif, elle était perdue sans recours.
 *
 * En la publiant ici, la destination n'est plus une course : chaque décideur
 * de navigation consulte le même état et vise le même écran, quel que soit
 * l'ordre dans lequel il s'exécute. L'écran Blocages efface ensuite ce
 * marqueur sans lancer automatiquement la respiration ni le choix de durée.
 */
export const useShieldRequestStore = create<ShieldRequestStore>(set => ({
  request: null,
  setRequest: request => set({ request }),
}))

/** Lecture hors composant (redirections, effets). */
export function getShieldRequest(): PendingShieldRequest | null {
  return useShieldRequestStore.getState().request
}

export function setShieldRequest(request: PendingShieldRequest | null): void {
  useShieldRequestStore.getState().setRequest(request)
}
