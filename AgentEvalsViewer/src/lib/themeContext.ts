import { createContext, useContext } from 'react'
import type { Theme } from '@fluentui/react-components'

/** Visual mode the user selected. */
export type ThemeMode = 'light' | 'dark'

export interface ThemeContextValue {
  /** Raw mode chosen by the user (what the toggle UI should reflect). */
  mode: ThemeMode
  /** Active Fluent theme object — pass straight into `FluentProvider`. */
  theme: Theme
  /** Convenience: true when the dark Fluent theme is in play. */
  isDark: boolean
  setMode: (mode: ThemeMode) => void
  /** Flip light <-> dark in one call (handy for icon-button toggles). */
  toggle: () => void
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
