/**
 * Intentions IN-APP en attente.
 *
 * Le moteur ne produit pas que des notifications : il produit des INTENTIONS.
 * Quand l'utilisateur est déjà dans l'app, l'intention doit devenir une
 * bannière ou une carte, pas une bannière système par-dessus l'écran qu'il est
 * en train de regarder.
 *
 * L'état est volontairement éphémère (mémoire, pas MMKV) : une intention non
 * consommée avant la fin de la session n'a plus de raison d'être — le passage
 * suivant du moteur la reproduira si la condition tient toujours.
 */
import { create } from 'zustand'
import type {
  NotifContentSpec,
  NotifFamily,
} from '@/features/notifications/types'

export interface InAppNotice {
  nodeId: string
  family: NotifFamily
  content: NotifContentSpec
  priority: number
  /** Epoch ms. */
  at: number
}

interface IntentsStore {
  notices: InAppNotice[]
  publish: (notices: InAppNotice[]) => void
  dismiss: (nodeId: string) => void
  clear: () => void
}

export const useNotifIntentsStore = create<IntentsStore>((set, get) => ({
  notices: [],
  /**
   * Remplace les intentions d'une même origine sans effacer celles que
   * l'utilisateur n'a pas encore vues : un passage du moteur ne doit pas faire
   * disparaître un avertissement de protection affiché il y a deux secondes.
   */
  publish: notices =>
    set(state => {
      const incoming = new Map(notices.map(notice => [notice.nodeId, notice]))
      const kept = state.notices.filter(notice => !incoming.has(notice.nodeId))
      return {
        notices: [...kept, ...notices].sort((a, b) => b.priority - a.priority),
      }
    }),
  dismiss: nodeId =>
    set(state => ({
      notices: state.notices.filter(notice => notice.nodeId !== nodeId),
    })),
  clear: () => {
    if (get().notices.length > 0) set({ notices: [] })
  },
}))

/** La plus prioritaire — c'est celle qu'un écran affiche. */
export const useTopNotice = (): InAppNotice | null =>
  useNotifIntentsStore(state => state.notices[0] ?? null)

export const publishInAppNotices = (notices: InAppNotice[]): void =>
  useNotifIntentsStore.getState().publish(notices)

export const dismissInAppNotice = (nodeId: string): void =>
  useNotifIntentsStore.getState().dismiss(nodeId)
