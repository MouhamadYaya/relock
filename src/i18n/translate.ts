import i18n from '@/i18n/i18n'

/**
 * `t()` hors de React, avec une clé calculée à l'exécution.
 *
 * Deux besoins que `useT()` ne couvre pas :
 *  • les modules de calcul (`session.ts`, `presets.ts`, `types.ts`, les
 *    services d'onboarding) produisent des libellés sans être des composants ;
 *  • beaucoup de ces clés sont construites (`blocking.presets.${id}.title`),
 *    donc invisibles pour le typage littéral généré dans `i18n-types.d.ts`.
 *
 * L'assouplissement de typage est isolé ICI plutôt que recopié dans chaque
 * fichier — c'est le même parti que `translateNotifKey` pour le catalogue de
 * notifications.
 */
export function translate(
  key: string,
  params?: Record<string, unknown>,
): string {
  return i18n.t(key as never, params as never) as unknown as string
}
