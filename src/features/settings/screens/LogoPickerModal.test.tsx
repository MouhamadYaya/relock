import { router } from 'expo-router'
import React from 'react'
import { act, create, type ReactTestRenderer } from 'react-test-renderer'
import { constants } from '@/config/constants'
import LogoPickerModal from '@/features/settings/screens/LogoPickerModal'
import { AppIcon } from '@/shared/native/app-icon'
import { getAppLogo } from '@/shared/services/storage/app-preferences'
import { kvStorage } from '@/shared/services/storage/mmkv'
import { usePreferences } from '@/shared/stores/preferences.store'
import { showErrorToast } from '@/shared/utils/toast'

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn(), back: jest.fn() },
}))

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}))

jest.mock('@/i18n/useT', () => ({ useT: () => (key: string) => key }))

jest.mock('@/shared/components/ui/IconSvg', () => {
  const { View } = require('react-native')
  return { IconSvg: () => <View /> }
})

jest.mock('@/shared/utils/toast', () => ({
  showToast: jest.fn(),
  showErrorToast: jest.fn(),
}))

jest.mock('@/shared/native/app-icon', () => ({
  isAppIconAvailable: true,
  AppIcon: { isAvailable: true, set: jest.fn(), current: jest.fn() },
}))

const setIcon = AppIcon.set as jest.Mock

/** La ligne portant ce libellé (les clés i18n brutes, `useT` étant neutralisé). */
function rowFor(tree: ReactTestRenderer, label: string) {
  return tree.root.find(
    node =>
      node.props?.accessibilityLabel === label &&
      typeof node.props?.onPress === 'function',
  )
}

let mounted: ReactTestRenderer | null = null

function render(): ReactTestRenderer {
  act(() => {
    mounted = create(<LogoPickerModal />)
  })
  return mounted as unknown as ReactTestRenderer
}

/** Un appui, en laissant la promesse de pose se résoudre. */
async function press(tree: ReactTestRenderer, label: string) {
  await act(async () => {
    rowFor(tree, label).props.onPress()
  })
}

describe('LogoPickerModal', () => {
  afterEach(() => {
    act(() => mounted?.unmount())
    mounted = null
  })

  beforeEach(() => {
    jest.clearAllMocks()
    setIcon.mockResolvedValue(true)
    kvStorage.delete(constants.PREF_APP_LOGO)
    act(() => usePreferences.setState({ appLogo: 'classic' }))
  })

  it('propose les trois icônes et coche celle qui est posée', () => {
    act(() => usePreferences.setState({ appLogo: 'orb' }))
    const tree = render()

    expect(
      rowFor(tree, 'settings.logo.classic').props.accessibilityState.selected,
    ).toBe(false)
    expect(
      rowFor(tree, 'settings.logo.orb').props.accessibilityState.selected,
    ).toBe(true)
    expect(rowFor(tree, 'settings.logo.phases')).toBeTruthy()
  })

  it('demande l’icône à iOS, puis retient le choix et referme', async () => {
    const tree = render()

    await press(tree, 'settings.logo.phases')

    expect(setIcon).toHaveBeenCalledWith('phases')
    expect(getAppLogo()).toBe('phases')
    expect(usePreferences.getState().appLogo).toBe('phases')
    expect(router.back).toHaveBeenCalledTimes(1)
  })

  it('ne retient RIEN quand iOS refuse', async () => {
    // Le défaut à ne jamais laisser passer : afficher un choix que le système
    // n'a pas pris. La feuille reste ouverte, la coche ne bouge pas.
    setIcon.mockResolvedValue(false)
    const tree = render()

    await press(tree, 'settings.logo.orb')

    expect(getAppLogo()).toBe('classic')
    expect(usePreferences.getState().appLogo).toBe('classic')
    expect(showErrorToast).toHaveBeenCalledWith('settings.logo.error')
    expect(router.back).not.toHaveBeenCalled()
  })

  it('ne rejoue pas l’alerte système pour l’icône déjà posée', async () => {
    // iOS affiche « Vous avez changé l'icône » à chaque pose effective :
    // rechoisir la sienne ne doit rien demander au système du tout.
    const tree = render()

    await press(tree, 'settings.logo.classic')

    expect(setIcon).not.toHaveBeenCalled()
    expect(router.back).toHaveBeenCalledTimes(1)
  })

  it('referme le voile sans rien changer', () => {
    const tree = render()

    act(() => rowFor(tree, 'common.close').props.onPress())

    expect(setIcon).not.toHaveBeenCalled()
    expect(usePreferences.getState().appLogo).toBe('classic')
    expect(router.back).toHaveBeenCalledTimes(1)
  })
})
