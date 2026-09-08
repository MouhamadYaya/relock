import i18n from '@/i18n/i18n'

/**
 * La locale à passer aux contrôles natifs (`DateTimePicker`, roues UIKit).
 *
 * Ces contrôles écrivent EUX-MÊMES leurs libellés — « heures », « AM/PM », les
 * noms de mois — et les prennent de leur locale, jamais de nos fichiers de
 * langue. Sans elle, ils restent dans la langue du TÉLÉPHONE : la roue de
 * durée affichait « 1 heure » sous un libellé « Limit / day » anglais.
 */
export function nativeLocale(): string {
  return i18n.language.split('-')[0]
}
