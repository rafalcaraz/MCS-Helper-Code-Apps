import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { FluentProvider, webLightTheme } from '@fluentui/react-components'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import { PowerProvider } from './components/PowerProvider'
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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <FluentProvider theme={webLightTheme}>
      <PowerProvider>
        <QueryClientProvider client={queryClient}>
          <HashRouter>
            <App />
          </HashRouter>
        </QueryClientProvider>
      </PowerProvider>
    </FluentProvider>
  </StrictMode>,
)
