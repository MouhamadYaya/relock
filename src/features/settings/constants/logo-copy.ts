import type { AppLogo } from '@/shared/constants/app-logo'

/**
 * Le nom de chaque icône, par CLÉ i18n.
 *
 * Il vit dans la feature Réglages parce que c'est le seul endroit où une
 * icône est NOMMÉE : partout ailleurs elle est simplement dessinée, ou posée
 * par iOS sur l'écran d'accueil. Une marque n'a pas besoin d'un intitulé
 * pour s'afficher, seulement pour se choisir.
 *
 * `as const` n'est pas cosmétique — même raison que `RITUAL_COPY` : les clés
 * de traduction sont typées littéralement (`src/i18n/i18n-types.d.ts`), et
 * une annotation `Record<…, string>` les élargirait en `string`, que `t()`
 * refuserait.
 */
export const LOGO_LABEL_KEY = {
  classic: 'settings.logo.classic',
  orb: 'settings.logo.orb',
  phases: 'settings.logo.phases',
} as const satisfies Record<AppLogo, string>
