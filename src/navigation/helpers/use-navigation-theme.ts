import { DarkTheme, DefaultTheme, type Theme } from '@react-navigation/native'
import { useMemo } from 'react'
import { useColorScheme } from 'react-native'
import { darkTheme, useTheme } from '@/shared/theme'

interface NavigationThemeOptions {
  forceDark?: boolean
}

/**
 * React Navigation theme derived from the app's theme tokens.
 *
 * `forceDark` keeps a native navigation subtree dark independently of the
 * selected app theme. The iOS 26 Liquid Glass trait is additionally pinned by
 * `UIUserInterfaceStyle` in the native app configuration.
 */
export function useNavigationTheme({
  forceDark = false,
}: NavigationThemeOptions = {}): Theme {
  const { theme, mode } = useTheme()
  const systemScheme = useColorScheme()
  const isDark =
    forceDark ||
    mode === 'dark' ||
    (mode === 'system' && systemScheme === 'dark')
  const resolvedTheme = forceDark ? darkTheme : theme

  return useMemo(
    () => ({
      ...(isDark ? DarkTheme : DefaultTheme),
      dark: isDark,
      colors: {
        ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
        primary: resolvedTheme.colors.primary,
        background: resolvedTheme.colors.background,
        card: resolvedTheme.colors.surface,
        text: resolvedTheme.colors.textPrimary,
        border: resolvedTheme.colors.border,
        notification: resolvedTheme.colors.danger,
      },
    }),
    [isDark, resolvedTheme],
  )
}
