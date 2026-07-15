// src/navigation/root/root-navigator.tsx

import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { createStaticNavigation } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import React from 'react'
import ActivityScreen from '@/features/activity/screens/ActivityScreen'
import AuthScreen from '@/features/auth/screens/AuthScreen'
import AddScreen from '@/features/blocking/screens/AddScreen'
import BlockDetailScreen from '@/features/blocking/screens/BlockDetailScreen'
import PauseRitualScreen from '@/features/blocking/screens/PauseRitualScreen'
import HomeScreen from '@/features/home/screens/HomeScreen'
import StoryScreen from '@/features/home/screens/StoryScreen'
import OnboardingFlow from '@/features/onboarding/OnboardingFlow'
import LanguagePickerModal from '@/features/settings/screens/LanguagePickerModal'
import SettingsScreen from '@/features/settings/screens/SettingsScreen'
import ThemePickerModal from '@/features/settings/screens/ThemePickerModal'
import type {
  HomeTabParamList,
  RootStackParamList,
} from '@/navigation/root-param-list'
import { ROUTES } from '@/navigation/routes'
import { AnimatedTabBar } from '@/navigation/tabs/AnimatedTabBar'
import { getInitialRoute } from '@/session/bootstrap'

const HALF_SHEET_OPTIONS = {
  presentation: 'transparentModal',
  animation: 'none',
  gestureEnabled: false,
} as const

export const HomeTabs = createBottomTabNavigator<HomeTabParamList>({
  screenOptions: { headerShown: false },
  tabBar: props => <AnimatedTabBar {...props} />,
  screens: {
    [ROUTES.TAB_HOME]: HomeScreen,
    [ROUTES.TAB_ACTIVITY]: ActivityScreen,
  },
})

export const RootStack = createNativeStackNavigator<RootStackParamList>({
  initialRouteName: getInitialRoute(),
  screenOptions: { headerShown: false },
  screens: {
    [ROUTES.ROOT_ONBOARDING]: OnboardingFlow,
    [ROUTES.ROOT_AUTH]: AuthScreen,
    [ROUTES.ROOT_APP]: HomeTabs,
    [ROUTES.ADD_BLOCK]: {
      screen: AddScreen,
      options: HALF_SHEET_OPTIONS,
    },
    [ROUTES.BLOCK_DETAIL]: {
      screen: BlockDetailScreen,
      options: HALF_SHEET_OPTIONS,
    },
    [ROUTES.SETTINGS]: SettingsScreen,
    [ROUTES.HOME_STORY]: StoryScreen,
    [ROUTES.PAUSE_RITUAL]: {
      screen: PauseRitualScreen,
      options: { presentation: 'fullScreenModal', gestureEnabled: false },
    },
    [ROUTES.MODAL_THEME_PICKER]: {
      screen: ThemePickerModal,
      options: HALF_SHEET_OPTIONS,
    },
    [ROUTES.MODAL_LANGUAGE_PICKER]: {
      screen: LanguagePickerModal,
      options: HALF_SHEET_OPTIONS,
    },
  },
})

export const RootNavigation = createStaticNavigation(RootStack)
