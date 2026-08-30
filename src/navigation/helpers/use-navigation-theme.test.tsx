import type { Theme } from '@react-navigation/native'
import React from 'react'
import { act, create } from 'react-test-renderer'
import {
  darkTheme,
  lightTheme,
  ThemeContext,
  type ThemeContextValue,
} from '@/shared/theme'
import { useNavigationTheme } from './use-navigation-theme'

let renderedTheme: Theme | undefined

function NavigationThemeHarness({ forceDark }: { forceDark?: boolean }) {
  renderedTheme = useNavigationTheme({ forceDark })
  return null
}

function renderWithLightAppTheme(forceDark = false) {
  const value: ThemeContextValue = {
    theme: lightTheme,
    mode: 'light',
    setTheme: jest.fn(),
  }

  act(() => {
    create(
      <ThemeContext.Provider value={value}>
        <NavigationThemeHarness forceDark={forceDark} />
      </ThemeContext.Provider>,
    )
  })

  return renderedTheme
}

describe('useNavigationTheme', () => {
  beforeEach(() => {
    renderedTheme = undefined
  })

  it('keeps a forced navigation subtree dark when the app theme is light', () => {
    const theme = renderWithLightAppTheme(true)

    expect(theme?.dark).toBe(true)
    expect(theme?.colors.background).toBe(darkTheme.colors.background)
    expect(theme?.colors.card).toBe(darkTheme.colors.surface)
    expect(theme?.colors.text).toBe(darkTheme.colors.textPrimary)
  })

  it('still follows the app theme when forceDark is not requested', () => {
    const theme = renderWithLightAppTheme()

    expect(theme?.dark).toBe(false)
    expect(theme?.colors.background).toBe(lightTheme.colors.background)
    expect(theme?.colors.card).toBe(lightTheme.colors.surface)
  })
})
