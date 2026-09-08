import { router } from 'expo-router'
import React, { useCallback } from 'react'
import { View } from 'react-native'
import { SettingsRow } from '@/features/settings/components/SettingsRow'
import { SettingsSection } from '@/features/settings/components/SettingsSection'
import { SettingsSheet } from '@/features/settings/components/SettingsSheet'
import i18n, { type SupportedLanguage, setAppLanguage } from '@/i18n/i18n'
import { useT } from '@/i18n/useT'

/**
 * Les langues, écrites DANS leur propre langue.
 *
 * Un nom de langue est un endonyme : « Español » se dit Español en français
 * comme en anglais. Le traduire (« Espagnol », « Spanish ») oblige quelqu'un
 * qui a mis l'app dans une langue qu'il ne lit pas à deviner laquelle est la
 * sienne — exactement la situation où l'on ouvre ce sélecteur. Les codes à
 * deux lettres affichés seuls avaient le même défaut, en pire.
 *
 * Le français ouvre la liste : c'est la langue historique de l'app, et il en
 * était absent — quiconque passait à l'anglais ne pouvait plus revenir sans
 * réinstaller.
 */
const LANGUAGES: { code: SupportedLanguage; name: string }[] = [
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Español' },
]

export default function LanguagePickerModal() {
  const t = useT()
  const current = i18n.language

  const close = useCallback(() => router.back(), [])

  const select = useCallback((code: SupportedLanguage) => {
    // `setAppLanguage` retient le choix : sans lui, l'app repartirait dans la
    // langue du téléphone au prochain démarrage.
    void setAppLanguage(code)
    router.back()
  }, [])

  return (
    <SettingsSheet
      title={t('settings.language.label')}
      closeLabel={t('common.close')}
      onClose={close}
    >
      <View>
        <SettingsSection>
          {LANGUAGES.map(language => (
            <SettingsRow
              key={language.code}
              label={language.name}
              value={language.code.toUpperCase()}
              selected={current.split('-')[0] === language.code}
              onPress={() => select(language.code)}
            />
          ))}
        </SettingsSection>
      </View>
    </SettingsSheet>
  )
}
