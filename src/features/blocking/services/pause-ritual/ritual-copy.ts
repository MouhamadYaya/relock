import type { PauseRitual } from '@/shared/services/storage/app-preferences'

/**
 * Le nom et la promesse de chaque rituel, par CLÉ i18n.
 *
 * Ce tableau vit dans les services, et non dans l'un des écrans qui
 * l'affichent : il est lu par la feuille de choix d'une pause, par l'écran
 * des Réglages ET par la ligne des Réglages qui montre le rituel courant.
 * L'exporter depuis un composant obligerait chacun de ces appelants à charger
 * une UI dont il n'a que faire.
 *
 * `as const` n'est pas cosmétique : les clés de traduction sont typées
 * littéralement (`src/i18n/i18n-types.d.ts`), et une annotation
 * `Record<…, string>` les élargirait en `string` — `t()` refuserait alors
 * chaque appel. Une clé mal orthographiée devient ainsi une erreur de
 * compilation, jamais une chaîne brute affichée à l'écran.
 */
export const RITUAL_COPY = {
  breathing: {
    title: 'blocking.pause_ritual.breathing.title',
    description: 'blocking.pause_ritual.breathing.description',
  },
  math: {
    title: 'blocking.pause_ritual.math.title',
    description: 'blocking.pause_ritual.math.description',
  },
  transcribe: {
    title: 'blocking.pause_ritual.transcribe.title',
    description: 'blocking.pause_ritual.transcribe.description',
  },
} as const satisfies Record<PauseRitual, { title: string; description: string }>
