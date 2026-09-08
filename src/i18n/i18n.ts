import i18n from 'i18next'
import resourcesToBackend from 'i18next-resources-to-backend'
import { initReactI18next } from 'react-i18next'
import { I18nManager, NativeModules } from 'react-native'
import { constants } from '@/config/constants'
import { kvStorage } from '@/shared/services/storage/mmkv'

export enum LanguageKey {
  french = 'fr',
  english = 'en',
  spanish = 'es',
}

/**
 * Les trois langues livrées, dans l'ordre d'affichage du sélecteur.
 *
 * Toute langue absente d'ici est traitée comme inconnue : la détection
 * automatique retombe alors sur l'anglais, jamais sur le français — un
 * hispanophone ou un japonais lit l'anglais bien plus souvent que le français.
 */
export type SupportedLanguage = 'fr' | 'en' | 'es'

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = [
  LanguageKey.french,
  LanguageKey.english,
  LanguageKey.spanish,
]

/**
 * Les catalogues, chargés À LA DEMANDE.
 *
 * Les trois étaient importés en tête de fichier, donc évalués au démarrage :
 * l'app construisait en mémoire les ~2 500 clés des TROIS langues pour n'en
 * afficher qu'une, et les gardait là pour toute la vie du processus. Un
 * `require` dans une closure n'est évalué qu'à l'appel (Metro ne touche au
 * module que quand la fonction est exécutée) : la langue non affichée ne coûte
 * plus rien, ni au démarrage ni en mémoire.
 *
 * Le chargement reste SYNCHRONE de bout en bout — c'est la condition à ne pas
 * perdre. `i18next-resources-to-backend` appelle son rappel immédiatement
 * quand la fonction rend une valeur plutôt qu'une promesse, et
 * `initImmediate: false` empêche i18next de différer la résolution. Sans ces
 * deux points, le premier rendu afficherait les clés brutes
 * (« home.time_regained ») le temps d'un tour de boucle.
 */
const CATALOGS: Record<SupportedLanguage, () => unknown> = {
  [LanguageKey.french]: () => require('./locales/fr.json'),
  [LanguageKey.english]: () => require('./locales/en.json'),
  [LanguageKey.spanish]: () => require('./locales/es.json'),
}

/** Charge un catalogue, sans jamais toucher aux deux autres. */
function loadCatalog(language: string): unknown {
  const load = CATALOGS[language as SupportedLanguage]
  if (!load) return null
  const module = load() as { default?: unknown }
  // Selon l'interopérabilité ESM, un module JSON peut arriver enveloppé.
  return module?.default ?? module
}

const fallbackLng: SupportedLanguage = LanguageKey.english

function isSupported(value: unknown): value is SupportedLanguage {
  return (
    typeof value === 'string' &&
    (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
  )
}

/**
 * Réduit une étiquette BCP-47 (`es-419`, `fr_CA`, `en-GB`) à sa langue.
 *
 * iOS renvoie des étiquettes régionales ; `es-419` (espagnol d'Amérique
 * latine) est la plus courante après `es-ES`, et les comparer telles quelles
 * à `'es'` faisait retomber tout le continent sur l'anglais.
 */
function baseLanguage(tag: string): string {
  return tag.replace('_', '-').split('-')[0]?.toLowerCase() ?? ''
}

/**
 * Langues du système, de la plus préférée à la moins préférée.
 *
 * `react-native-localize` est la source la plus fidèle (elle lit la LISTE
 * ordonnée des préférences iOS/Android, pas seulement la première), mais elle
 * n'existe pas dans l'environnement de test ni tant que les modules natifs ne
 * sont pas liés. Le repli passe par `SettingsManager`, déjà utilisé plus bas
 * pour le RTL, puis par `Intl`.
 */
function deviceLanguages(): string[] {
  const tags: string[] = []

  try {
    const localize = require('react-native-localize') as {
      getLocales?: () => { languageTag: string }[]
    }
    for (const locale of localize.getLocales?.() ?? []) {
      if (locale?.languageTag) tags.push(locale.languageTag)
    }
  } catch {
    // Module natif absent (tests, simulateur mal lié) : on continue.
  }

  const settings = NativeModules?.SettingsManager?.settings
  const appleLanguages = settings?.AppleLanguages
  if (Array.isArray(appleLanguages)) tags.push(...appleLanguages)
  if (settings?.AppleLocale) tags.push(settings.AppleLocale)
  const androidLocale = NativeModules?.I18nManager?.localeIdentifier
  if (androidLocale) tags.push(androidLocale)

  try {
    const intlLocale = Intl.DateTimeFormat().resolvedOptions().locale
    if (intlLocale) tags.push(intlLocale)
  } catch {
    // Intl indisponible sur certains moteurs Hermes anciens.
  }

  return tags.filter(Boolean)
}

/**
 * La langue du système, ramenée aux trois langues livrées.
 *
 * C'est ce qui rend la langue « choisie automatiquement au build » : aucun
 * réglage n'est nécessaire, un iPhone en espagnol ouvre Relock en espagnol.
 */
export function detectDeviceLanguage(): SupportedLanguage {
  for (const tag of deviceLanguages()) {
    const base = baseLanguage(tag)
    if (isSupported(base)) return base
  }
  return fallbackLng
}

/**
 * La langue choisie À LA MAIN dans Réglages, si elle l'a été.
 *
 * Elle prime sur la détection : quelqu'un qui met l'app en français sur un
 * téléphone anglais ne veut pas la retrouver en anglais au prochain
 * démarrage.
 */
function storedLanguage(): SupportedLanguage | null {
  try {
    const stored = kvStorage.getString(constants.PREF_LANGUAGE)
    return isSupported(stored) ? stored : null
  } catch {
    return null
  }
}

export function resolveInitialLanguage(): SupportedLanguage {
  return storedLanguage() ?? detectDeviceLanguage()
}

const currentLocale = deviceLanguages()[0] ?? null

if (currentLocale) {
  I18nManager.allowRTL(true)
}

// Do not set keySeparator: false so nested paths work (e.g. onboarding.welcome)
i18n
  .use(resourcesToBackend((language: string) => loadCatalog(language)))
  .use(initReactI18next)
  .init({
    compatibilityJSON: 'v4',
    lng: resolveInitialLanguage(),
    fallbackLng,
    defaultNS: 'translation',
    ns: ['translation'],
    // ⚠️ Ne pas retirer : c'est ce qui garde l'initialisation et les bascules
    // de langue SYNCHRONES au-dessus d'un backend synchrone (cf. `CATALOGS`).
    initImmediate: false,
    interpolation: {
      escapeValue: false,
    },
    // keySeparator defaults to '.', which we need
  })

/**
 * Dépose la langue courante dans le groupe d'app iOS.
 *
 * Les cinq extensions Family Controls (mur de blocage, rapport d'activité,
 * widgets, célébrations) sont des processus séparés qui ne voient que la
 * langue SYSTÈME : sans ce dépôt, elles restaient en anglais devant une app
 * réglée en espagnol. Côté natif, `RelockLanguage` relit cette clé.
 */
function publishLanguageToExtensions(language: string) {
  const native = NativeModules?.BlocusScreenTime as
    | { setAppLanguage?: (language: string) => Promise<boolean> }
    | undefined
  native?.setAppLanguage?.(language)?.catch?.(() => {
    // Build antérieure au pont, ou Android : les extensions n'existent pas.
  })
}

publishLanguageToExtensions(i18n.language)
i18n.on('languageChanged', publishLanguageToExtensions)

/**
 * Change la langue ET la retient.
 *
 * Passer par `i18n.changeLanguage` seul laissait le choix mourir avec le
 * processus : l'app revenait à la langue du téléphone au redémarrage suivant.
 */
export async function setAppLanguage(language: SupportedLanguage) {
  try {
    kvStorage.setString(constants.PREF_LANGUAGE, language)
  } catch {
    // Le stockage peut être indisponible ; le changement reste valable pour
    // la session en cours.
  }
  await i18n.changeLanguage(language)
}

export { currentLocale, fallbackLng, i18n }
export default i18n
