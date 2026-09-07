/**
 * Les préférences d'app, côté réactif.
 *
 * L'état durable vit dans MMKV (`shared/services/storage/app-preferences.ts`) ;
 * ce store n'en porte que le reflet, pour que les interrupteurs des Réglages
 * se redessinent. Chaque action écrit d'abord la trace durable, puis bascule
 * l'état — dans cet ordre, un crash entre les deux ne peut que perdre le
 * rendu, jamais le choix.
 */
import { create } from 'zustand'
import {
  type AppPreferences,
  getPauseRitual,
  getPreferences,
  type PauseRitual,
  setPauseRitual,
  setPreference,
} from '@/shared/services/storage/app-preferences'

type PreferencesStore = AppPreferences & {
  /** Le rituel exigé avant un déblocage — pas un booléen, d'où sa propre action. */
  pauseRitual: PauseRitual
  setPreference: (key: keyof AppPreferences, value: boolean) => void
  setPauseRitual: (ritual: PauseRitual) => void
}

export const usePreferences = create<PreferencesStore>(set => ({
  ...getPreferences(),
  pauseRitual: getPauseRitual(),
  setPreference: (key, value) => {
    setPreference(key, value)
    set({ [key]: value } as Pick<AppPreferences, typeof key>)
  },
  setPauseRitual: ritual => {
    setPauseRitual(ritual)
    set({ pauseRitual: ritual })
  },
}))
