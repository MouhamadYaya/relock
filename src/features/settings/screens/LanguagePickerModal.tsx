import { router } from 'expo-router'
import React, { useCallback } from 'react'
import { View } from 'react-native'
import { SettingsRow } from '@/features/settings/components/SettingsRow'
import { SettingsSection } from '@/features/settings/components/SettingsSection'
import { SettingsSheet } from '@/features/settings/components/SettingsSheet'
import i18n from '@/i18n/i18n'
import { useT } from '@/i18n/useT'

/**
 * Les langues, écrites DANS leur propre langue.
 *
 * Un nom de langue est un endonyme : « Deutsch » se dit Deutsch en français
 * comme en russe. Le traduire (« Allemand », « Немецкий ») oblige quelqu'un
 * qui a mis l'app dans une langue qu'il ne lit pas à deviner laquelle est la
 * sienne — exactement la situation où l'on ouvre ce sélecteur. Les codes à
 * deux lettres affichés seuls avaient le même défaut, en pire.
 *
 * Le français ouvre la liste : c'est la langue par défaut de l'app
 * (`i18n.ts`), et il en était absent — quiconque passait à l'anglais ne
 * pouvait plus revenir sans réinstaller.
 */
const LANGUAGES = [
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'English' },
  { code: 'de', name: 'Deutsch' },
  { code: 'ru', name: 'Русский' },
] as const

export default function LanguagePickerModal() {
  const t = useT()
  const current = i18n.language

  const close = useCallback(() => router.back(), [])

  const select = useCallback((code: string) => {
    i18n.changeLanguage(code)
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
              selected={current === language.code}
              onPress={() => select(language.code)}
            />
          ))}
        </SettingsSection>
      </View>
    </SettingsSheet>
  )
}
