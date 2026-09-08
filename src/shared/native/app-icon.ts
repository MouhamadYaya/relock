/**
 * Pont JS vers les icônes alternatives d'iOS (module natif `RelockAppIcon`).
 *
 * La vérité vit dans le SYSTÈME, pas dans MMKV : l'icône survit à une
 * réinstallation du binaire de dev, et iOS peut la remettre à zéro tout seul
 * (restauration de sauvegarde, changement de binaire sans le jeu d'icônes).
 * `current()` est donc la seule source fiable, et la préférence locale n'en
 * est qu'un reflet destiné à dessiner l'écran sans attendre le natif.
 *
 * Hors iOS, ou sur un binaire antérieur à ce module (dev-client non
 * reconstruit), tout se dégrade en silence : `isAvailable` est faux, la pose
 * échoue proprement, et les Réglages peuvent le dire à l'utilisateur au lieu
 * de faire semblant.
 */
import { NativeModules, Platform } from 'react-native'
import {
  APP_LOGO_ICON_NAME,
  type AppLogo,
  appLogoFromIconName,
  DEFAULT_APP_LOGO,
} from '@/shared/constants/app-logo'

interface AppIconNative {
  isSupported(): Promise<boolean>
  current(): Promise<string | null>
  setIcon(name: string | null): Promise<string | null>
}

const native = NativeModules.RelockAppIcon as Partial<AppIconNative> | undefined

/** Le module est-il embarqué dans CE binaire ? */
export const isAppIconAvailable =
  Platform.OS === 'ios' && typeof native?.setIcon === 'function'

export const AppIcon = {
  isAvailable: isAppIconAvailable,

  /**
   * L'appareil accepte-t-il de changer d'icône ? Distinct de
   * `isAvailable` : le module peut être là et le système refuser (certaines
   * configurations gérées par un MDM).
   */
  isSupported: (): Promise<boolean> =>
    isAppIconAvailable ? native!.isSupported!() : Promise.resolve(false),

  /** La variante réellement posée sur l'écran d'accueil, vue du système. */
  current: async (): Promise<AppLogo> => {
    if (!isAppIconAvailable) return DEFAULT_APP_LOGO
    try {
      return appLogoFromIconName(await native!.current!())
    } catch {
      return DEFAULT_APP_LOGO
    }
  },

  /**
   * Pose l'icône. Rend `true` si le système l'a acceptée.
   *
   * Ne jamais présumer du succès : un nom absent du binaire, un refus du
   * système ou une build sans le module échouent tous ici, et l'appelant doit
   * pouvoir garder l'ancien choix affiché plutôt que de mentir.
   */
  set: async (logo: AppLogo): Promise<boolean> => {
    if (!isAppIconAvailable) return false
    try {
      await native!.setIcon!(APP_LOGO_ICON_NAME[logo])
      return true
    } catch {
      return false
    }
  },
}
