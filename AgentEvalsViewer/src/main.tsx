import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { PowerProvider } from './components/PowerProvider'
import { ThemeProvider } from './components/ThemeProvider'
import { classifyApiError } from './lib/apiErrors'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Don't retry deterministic server bugs — they won't fix
        // themselves on retry and just multiply latency. The classifier
        // tags AutoMapper 500s, 401, 403, and 404 as terminal.
        const kind = classifyApiError(error).kind
        if (
          kind === 'automapper' ||
          kind === 'unauthorized' ||
          kind === 'forbidden' ||
          kind === 'not-found'
        )
          return false
        return failureCount < 1
      },
    },
  },
})

/*
 * `ThemeProvider` wraps `FluentProvider` internally, so it owns both the
 * user's persisted mode preference (light / dark / high-contrast / system)
 * and the active Fluent theme tokens. Everything else just consumes
 * `useThemeMode()` from `lib/themeContext` when it needs to render UI.
 */
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <PowerProvider>
        <QueryClientProvider client={queryClient}>
          <HashRouter>
            <App />
          </HashRouter>
        </QueryClientProvider>
      </PowerProvider>
    </ThemeProvider>
  </StrictMode>,
)
