import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  FluentProvider,
  type Theme,
  webDarkTheme,
  webLightTheme,
  teamsHighContrastTheme,
} from '@fluentui/react-components'
import {
  ThemeContext,
  type ResolvedTheme,
  type ThemeContextValue,
  type ThemeMode,
} from '../lib/themeContext'

const STORAGE_KEY = 'aev:themeMode'

const THEME_BY_RESOLVED: Record<ResolvedTheme, Theme> = {
  light: webLightTheme,
  dark: webDarkTheme,
  highContrast: teamsHighContrastTheme,
}

function readStoredMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system'
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (
      raw === 'light' ||
      raw === 'dark' ||
      raw === 'highContrast' ||
      raw === 'system'
    ) {
      return raw
    }
  } catch {
    // localStorage may be blocked (private mode, sandboxed iframe) — fall
    // through to the OS-driven default.
  }
  return 'system'
}

function resolveSystem(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) return 'light'
  // Forced high-contrast wins over plain dark — accessibility trumps aesthetics.
  if (window.matchMedia('(prefers-contrast: more)').matches) {
    return 'highContrast'
  }
  if (window.matchMedia('(forced-colors: active)').matches) {
    return 'highContrast'
  }
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark'
  }
  return 'light'
}

export interface ThemeProviderProps {
  children: ReactNode
}

/**
 * App-wide theme provider. Owns the user's preferred mode, persists it in
 * `localStorage`, listens to OS-level `prefers-color-scheme` /
 * `prefers-contrast` so `'system'` stays live, and feeds the resolved
 * Fluent `Theme` straight into `FluentProvider`. Also keeps the
 * `<html data-theme="…" style="color-scheme: …">` attributes in sync so
 * native form controls, scrollbars, and the pre-mount background match.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const [mode, setModeState] = useState<ThemeMode>(() => readStoredMode())
  const [systemResolved, setSystemResolved] = useState<ResolvedTheme>(() =>
    resolveSystem(),
  )

  // Keep `'system'` honest as OS preferences change underneath us.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const queries = [
      window.matchMedia('(prefers-color-scheme: dark)'),
      window.matchMedia('(prefers-contrast: more)'),
      window.matchMedia('(forced-colors: active)'),
    ]
    const recompute = () => setSystemResolved(resolveSystem())
    for (const q of queries) {
      q.addEventListener?.('change', recompute)
    }
    return () => {
      for (const q of queries) {
        q.removeEventListener?.('change', recompute)
      }
    }
  }, [])

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Best-effort persistence — runtime still works without it.
    }
  }, [])

  const resolved: ResolvedTheme = mode === 'system' ? systemResolved : mode
  const theme = THEME_BY_RESOLVED[resolved]
  const isDark = resolved !== 'light'

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    root.style.colorScheme = resolved === 'light' ? 'light' : 'dark'
    root.dataset.theme = resolved
  }, [resolved])

  const value = useMemo<ThemeContextValue>(
    () => ({ mode, resolved, theme, isDark, setMode }),
    [mode, resolved, theme, isDark, setMode],
  )

  return (
    <ThemeContext.Provider value={value}>
      <FluentProvider theme={theme}>{children}</FluentProvider>
    </ThemeContext.Provider>
  )
}
