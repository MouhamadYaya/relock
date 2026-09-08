/**
 * FILE: ThemeProvider.tsx
 * LAYER: core/theme
 * ---------------------------------------------------------------------
 * PURPOSE:
 *   Provide global theme context with:
 *     - light/dark modes
 *     - system appearance support
 *     - dynamic toggle
 *     - future persistent storage (MMKV)
 *
 * RESPONSIBILITIES:
 *   - Compute final theme object (light/dark).
 *   - Sync with system theme if enabled.
 *   - Expose mode + setTheme to UI and logic layers.
 *
 * EXTENSION GUIDELINES:
 *   - Persist user-selected theme in MMKV:
 *       kvStorage.setString('themeMode', mode)
 *   - Add high-contrast or custom branding themes.
 *   - Add ThemeTokensProvider wrapper if tokens become dynamic.
 * ---------------------------------------------------------------------
 */

import React, {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { Appearance } from 'react-native'
import { darkTheme } from './dark'

import { lightTheme } from './light'
import { ThemeContext, type ThemeMode } from './ThemeContext'

export function ThemeProvider({ children }: { children: ReactNode }) {
  /**
   * MODE:
   *  - 'light'        → user forced light
   *  - 'dark'         → user forced dark
   *  - 'system'       → follow OS setting
   *
   * Persisting user choice:
   *   kvStorage.getString('themeMode') || 'system'
   */
  const [mode, setMode] = useState<ThemeMode>('dark')

  /**
   * Read initial system theme.
   */
  const systemColorScheme = Appearance.getColorScheme() || 'light'

  /**
   * Listen to system theme changes when mode === 'system'.
   */
  useEffect(() => {
    const sub = Appearance.addChangeListener(_theme => {
      if (mode === 'system') {
        // triggers rerender automatically
        setMode('system')
      }
    })

    return () => sub.remove()
  }, [mode])

  /**
   * Compute active theme.
   */
  const theme = useMemo(() => {
    const usedMode = mode === 'system' ? systemColorScheme : mode
    return usedMode === 'light' ? lightTheme : darkTheme
  }, [mode, systemColorScheme])

  /**
   * Safe setter (future: persist to MMKV).
   */
  const setTheme = useCallback((nextMode: ThemeMode) => {
    setMode(nextMode)
    // kvStorage.setString('themeMode', nextMode);
  }, [])

  /**
   * PERFORMANCE : la valeur du contexte est mémoïsée.
   *
   * Ce fournisseur enveloppe TOUTE l'application. Un objet littéral recréé à
   * chaque rendu change d'identité même quand le thème n'a pas bougé, et
   * React réveille alors tous les `useTheme()` de l'arbre — c'est-à-dire
   * presque tous les composants. Le thème, lui, ne change qu'au changement de
   * mode : la dépendance le dit.
   */
  const value = useMemo(
    () => ({ theme, mode, setTheme }),
    [theme, mode, setTheme],
  )

  return (
    // @ts-ignore
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  )
}
