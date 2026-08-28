import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs'
import React from 'react'
import { useT } from '@/i18n/useT'

export default function TabLayout() {
  const t = useT()

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="home">
        <Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          drawable="ic_tab_home"
        />
        <Label>{t('navigation.tabs.home')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="blocks">
        <Icon
          sf={{ default: 'hand.raised', selected: 'hand.raised.fill' }}
          drawable="ic_tab_blocks"
        />
        <Label>{t('navigation.tabs.blocks')}</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="activity">
        <Icon
          sf={{ default: 'chart.bar', selected: 'chart.bar.fill' }}
          drawable="ic_tab_activity"
        />
        <Label>{t('navigation.tabs.activity')}</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
