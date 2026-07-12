/**
 * Param lists mirror the static `screens` map in `root/root-navigator.tsx`.
 * Kept here (not `StaticParamList<typeof RootStack>`) to avoid a circular import:
 * navigator → screens → e.g. StoryScreen → this module.
 */
import { ROUTES } from '@/navigation/routes'

export type StoryScreenParams = {
  id: string
  title: string
  url?: string
  points?: number
  author?: string
  numComments?: number
  time: string
  domain?: string
}

/** Bottom tab navigator screens. */
export type HomeTabParamList = {
  [ROUTES.TAB_HOME]: undefined
  [ROUTES.TAB_ACTIVITY]: undefined
}

export type PauseRitualParams = {
  appName?: string
  seconds?: number
}

/** Root stack: onboarding, auth, main app shell, and global modals. */
export type RootStackParamList = {
  [ROUTES.ROOT_APP]: undefined
  [ROUTES.ROOT_AUTH]: undefined
  [ROUTES.ROOT_ONBOARDING]: undefined
  [ROUTES.ADD_BLOCK]: undefined
  [ROUTES.SETTINGS]: undefined
  [ROUTES.HOME_STORY]: StoryScreenParams
  [ROUTES.PAUSE_RITUAL]: PauseRitualParams | undefined
  [ROUTES.MODAL_THEME_PICKER]: undefined
  [ROUTES.MODAL_LANGUAGE_PICKER]: undefined
}

declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}
