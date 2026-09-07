import { IconName } from '@assets/icons'
import { router } from 'expo-router'
import React, { useCallback } from 'react'
import { View } from 'react-native'
import { SettingsRow } from '@/features/settings/components/SettingsRow'
import { SettingsSection } from '@/features/settings/components/SettingsSection'
import { SettingsSheet } from '@/features/settings/components/SettingsSheet'
import { useT } from '@/i18n/useT'
import type { ThemeMode } from '@/shared/theme/ThemeContext'
import { useTheme } from '@/shared/theme/useTheme'

/** Même patron que le sélecteur de langue : une carte, des lignes, une coche. */
const OPTIONS: {
  mode: ThemeMode
  labelKey:
    | 'settings.theme_light'
    | 'settings.theme_dark'
    | 'settings.theme_system'
  icon: IconName
}[] = [
  { mode: 'light', labelKey: 'settings.theme_light', icon: IconName.SUN },
  { mode: 'dark', labelKey: 'settings.theme_dark', icon: IconName.MOON },
  {
    mode: 'system',
    labelKey: 'settings.theme_system',
    icon: IconName.SETTINGS,
  },
]

export default function ThemePickerModal() {
  const t = useT()
  const { mode, setTheme } = useTheme()

  const close = useCallback(() => router.back(), [])

  const select = useCallback(
    (next: ThemeMode) => {
      setTheme(next)
      router.back()
    },
    [setTheme],
  )

  return (
    <SettingsSheet
      title={t('settings.theme')}
      closeLabel={t('common.close')}
      onClose={close}
    >
      <View>
        <SettingsSection>
          {OPTIONS.map(option => (
            <SettingsRow
              key={option.mode}
              icon={option.icon}
              label={t(option.labelKey)}
              selected={mode === option.mode}
              onPress={() => select(option.mode)}
            />
          ))}
        </SettingsSection>
      </View>
    </SettingsSheet>
  )
}
