/**
 * CENTRAL ROUTES ENUM
 * ------------------------------------------------------------
 * Naming rules:
 * - ROOT_* → top navigation containers (never shown directly)
 * - HOME_* → routes inside the authenticated app flow
 * - AUTH_* → authentication screens
 * - ONBOARDING_* → onboarding flow
 * - TAB_* → bottom tabs
 * - SETTINGS_* → settings screens
 */

export const ROUTES = {
  //
  // ROOT CONTAINERS (never visible screens)
  //
  ROOT_ONBOARDING: 'ROOT_ONBOARDING',
  ROOT_AUTH: 'ROOT_AUTH',
  ROOT_APP: 'ROOT_APP',

  //
  // ONBOARDING FLOW
  //
  ONBOARDING_MAIN: 'ONBOARDING_MAIN',

  //
  // AUTH FLOW
  //
  AUTH_LOGIN: 'AUTH_LOGIN',

  //
  // HOME → TABS (only two, + central FAB in the bar)
  //
  TAB_HOME: 'TAB_HOME',
  TAB_ACTIVITY: 'TAB_ACTIVITY',

  //
  // PUSHED SCREENS (over tabs)
  //
  ADD_BLOCK: 'ADD_BLOCK',
  BLOCK_DETAIL: 'BLOCK_DETAIL',
  SETTINGS: 'SETTINGS',
  HOME_STORY: 'HOME_STORY',

  //
  // FULLSCREEN FLOWS
  //
  PAUSE_RITUAL: 'PAUSE_RITUAL',

  //
  // GLOBAL MODALS (bottom sheets, accessible from any screen)
  //
  MODAL_THEME_PICKER: 'MODAL_THEME_PICKER',
  MODAL_LANGUAGE_PICKER: 'MODAL_LANGUAGE_PICKER',
} as const

// Derived type for autocompletion everywhere:
export type RouteName = (typeof ROUTES)[keyof typeof ROUTES]
