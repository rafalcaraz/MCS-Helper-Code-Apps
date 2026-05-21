import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  FluentProvider,
  webDarkTheme,
  webLightTheme,
} from '@fluentui/react-components'
import {
  ThemeContext,
  type ThemeContextValue,
  type ThemeMode,
} from '../lib/themeContext'

const STORAGE_KEY = 'aev:themeMode'

function pickInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  // Honor a previously persisted choice first.
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw === 'light' || raw === 'dark') return raw
  } catch {
    // localStorage may be blocked (private mode, sandboxed iframe).
  }
  // First-time visitor: seed from the OS preference so dark-mode users
  // don't get blinded on landing. They can still flip it from the header.
  if (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  ) {
    return 'dark'
  }
  return 'light'
}

export interface ThemeProviderProps {
  children: ReactNode
}

/**
 * App-wide theme provider. Owns the user's choice between light and dark
 * Fluent themes, persists it in `localStorage`, and feeds the resolved
 * theme straight into `FluentProvider`. Also keeps `<html data-theme="…"
 * style="color-scheme: …">` in sync so native form controls, scrollbars,
 * and the pre-mount background match.
 *
 * The first visit seeds from the OS-level `prefers-color-scheme` so dark
 * users land in dark. After that the persisted choice always wins — we
 * don't override what they explicitly picked, even if the OS swaps.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => pickInitialMode())

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Best-effort persistence — runtime still works without it.
    }
  }, [])

  const toggle = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark')
  }, [mode, setMode])

  const theme = mode === 'dark' ? webDarkTheme : webLightTheme
  const isDark = mode === 'dark'

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.style.colorScheme = mode
    root.dataset.theme = mode
  }, [mode])

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, theme, isDark, setMode, toggle }),
    [mode, theme, isDark, setMode, toggle],
  )

  return (
    <ThemeContext.Provider value={value}>
      <FluentProvider theme={theme}>{children}</FluentProvider>
    </ThemeContext.Provider>
  )
}
