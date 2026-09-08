/**
 * Les icônes que l'app peut porter sur l'écran d'accueil de l'iPhone.
 *
 * ⚠️ Ce n'est PAS le logotype « Relock ». Le mot garde ses deux places, qui
 * ne se règlent pas : en haut à gauche de l'Accueil (`RelockWordmark` dans
 * `HomeHeader`) et en bas du splash (`BootSplashBrand`, storyboard natif).
 * Ici on ne choisit que la MARQUE, celle qui devient l'icône de l'app.
 *
 * La liste vit dans les constantes partagées, et non dans
 * `shared/services/storage/app-preferences.ts` comme les autres préférences :
 * le composant qui dessine l'aperçu est une primitive de
 * `shared/components/ui/`, à qui il est interdit d'importer la couche
 * services. Un jeu de constantes neutre est le seul terrain que la
 * préférence (qui écrit dans MMKV), le pont natif (qui pose l'icône) et
 * l'image (qui ne fait que dessiner) peuvent partager.
 */
export const APP_LOGOS = ['classic', 'orb', 'phases'] as const

export type AppLogo = (typeof APP_LOGOS)[number]

/** L'icône d'origine — celle du splash et de toutes les builds jusqu'ici. */
export const DEFAULT_APP_LOGO: AppLogo = 'classic'

/**
 * Le nom du jeu d'icônes iOS correspondant, tel qu'il est compilé dans le
 * binaire (`ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES` dans le projet
 * Xcode). `null` désigne l'icône PRINCIPALE : c'est la convention d'Apple
 * pour `setAlternateIconName`, et la seule façon de revenir en arrière.
 *
 * Toute modification ici doit suivre le projet Xcode — un nom qui n'existe
 * pas dans le binaire fait échouer la pose côté système.
 */
export const APP_LOGO_ICON_NAME: Record<AppLogo, string | null> = {
  classic: null,
  orb: 'AppIcon-Orb',
  phases: 'AppIcon-Phases',
}

export function isAppLogo(value: string | null | undefined): value is AppLogo {
  return (APP_LOGOS as readonly string[]).includes(value ?? '')
}

/** La variante que désigne un nom d'icône iOS. L'inverse de la table ci-dessus. */
export function appLogoFromIconName(name: string | null): AppLogo {
  if (!name) return DEFAULT_APP_LOGO
  const found = APP_LOGOS.find(logo => APP_LOGO_ICON_NAME[logo] === name)
  return found ?? DEFAULT_APP_LOGO
}
