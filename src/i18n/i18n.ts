import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { I18nManager, NativeModules } from 'react-native'
import de from './locales/de.json'
// ---- IMPORT JSON ----
import en from './locales/en.json'
import fr from './locales/fr.json'
import ru from './locales/ru.json'

export enum LanguageKey {
  french = 'fr',
  english = 'en',
  russian = 'ru',
  germany = 'de',
}

export const resources = {
  [LanguageKey.french]: {
    translation: fr,
  },
  [LanguageKey.english]: {
    translation: en, // nested json
  },
  [LanguageKey.russian]: {
    translation: ru,
  },
  [LanguageKey.germany]: {
    translation: de,
  },
}

// Optional: use device locale
const deviceSettings = NativeModules?.SettingsManager?.settings
const currentLocale =
  deviceSettings?.AppleLocale ||
  deviceSettings?.AppleLanguages?.[0] ||
  NativeModules?.I18nManager?.localeIdentifier

if (currentLocale) {
  I18nManager.allowRTL(true)
}

const defaultLng = LanguageKey.french
const fallbackLng = LanguageKey.english

// Do not set keySeparator: false so nested paths work (e.g. onboarding.welcome)
i18n.use(initReactI18next).init({
  compatibilityJSON: 'v4',
  lng: defaultLng, // Relock par défaut en français ; fallback anglais
  fallbackLng,
  resources,
  defaultNS: 'translation',
  interpolation: {
    escapeValue: false,
  },
  // keySeparator defaults to '.', which we need
})

export { currentLocale, fallbackLng, i18n }
export default i18n
