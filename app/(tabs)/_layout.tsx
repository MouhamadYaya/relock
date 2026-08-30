import { ThemeProvider as NavThemeProvider } from '@react-navigation/native'
import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs'
import React from 'react'
import { useT } from '@/i18n/useT'
import { useNavigationTheme } from '@/navigation/helpers/use-navigation-theme'
import { darkTheme } from '@/shared/theme'

const tabColors = darkTheme.colors

export default function TabLayout() {
  const t = useT()
  const navigationTheme = useNavigationTheme({ forceDark: true })

  return (
    <NavThemeProvider value={navigationTheme}>
      <NativeTabs
        backgroundColor={tabColors.surface}
        blurEffect="systemChromeMaterialDark"
        shadowColor="transparent"
        iconColor={{
          default: tabColors.textPrimary,
          selected: tabColors.textPrimary,
        }}
        labelStyle={{
          default: { color: tabColors.textSecondary },
          selected: { color: tabColors.textPrimary },
        }}
      >
        <NativeTabs.Trigger
          name="home"
          options={{ disableTransparentOnScrollEdge: true }}
        >
          <Icon sf="house.fill" drawable="ic_tab_home" />
          <Label>{t('navigation.tabs.home')}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="blocks"
          options={{ disableTransparentOnScrollEdge: true }}
        >
          <Icon sf="hand.raised.fill" drawable="ic_tab_blocks" />
          <Label>{t('navigation.tabs.blocks')}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger
          name="activity"
          options={{ disableTransparentOnScrollEdge: true }}
        >
          <Icon sf="chart.bar.fill" drawable="ic_tab_activity" />
          <Label>{t('navigation.tabs.activity')}</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </NavThemeProvider>
  )
}
