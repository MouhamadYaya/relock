import { router } from 'expo-router'
import React, { useCallback } from 'react'
import { View } from 'react-native'
import { setAppLanguage } from '@/i18n/i18n'
import { useT } from '@/i18n/useT'
import { Button } from '@/shared/components/ui/Button'
import { ScreenHeader } from '@/shared/components/ui/ScreenHeader'
import { ScreenWrapper } from '@/shared/components/ui/ScreenWrapper'
import { useTheme } from '@/shared/theme/useTheme'

export default function LanguageScreen() {
  const { theme } = useTheme()
  const t = useT()

  const handleBack = useCallback(() => router.back(), [])
  const handleFrench = useCallback(() => setAppLanguage('fr'), [])
  const handleEnglish = useCallback(() => setAppLanguage('en'), [])
  const handleSpanish = useCallback(() => setAppLanguage('es'), [])

  return (
    <ScreenWrapper
      header={
        <ScreenHeader
          title={t('settings.language.label')}
          onBack={handleBack}
        />
      }
    >
      <View style={{ padding: theme.spacing.lg, gap: theme.spacing.sm }}>
        <Button title={t('settings.language.french')} onPress={handleFrench} />
        <Button
          title={t('settings.language.english')}
          onPress={handleEnglish}
        />
        <Button
          title={t('settings.language.spanish')}
          onPress={handleSpanish}
        />
      </View>
    </ScreenWrapper>
  )
}
