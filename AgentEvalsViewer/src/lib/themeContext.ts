import { createContext, useContext } from 'react'
import type { Theme } from '@fluentui/react-components'

/**
 * Visual mode the user selected. `'system'` follows the OS-level
 * `prefers-color-scheme` and `prefers-contrast` media queries; the other
 * three are explicit overrides that win over the OS preference.
 */
export type ThemeMode = 'light' | 'dark' | 'highContrast' | 'system'

/** What we actually feed to Fluent — `'system'` is resolved away. */
export type ResolvedTheme = 'light' | 'dark' | 'highContrast'

export interface ThemeContextValue {
  /** Raw mode chosen by the user (what the toggle UI should reflect). */
  mode: ThemeMode
  /** Effective theme key after resolving `'system'`. */
  resolved: ResolvedTheme
  /** Active Fluent theme object — pass straight into `FluentProvider`. */
  theme: Theme
  /** Whether dark UI tokens are in play (covers dark + high contrast). */
  isDark: boolean
  setMode: (mode: ThemeMode) => void
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(
  undefined,
)

export function useThemeMode(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error('useThemeMode must be used inside a <ThemeProvider>')
  }
  return ctx
}
