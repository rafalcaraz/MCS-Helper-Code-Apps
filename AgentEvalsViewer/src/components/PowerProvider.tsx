import { useEffect, useState, type ReactNode } from 'react'
import { getContext } from '@microsoft/power-apps/app'
import { Spinner, makeStyles, tokens } from '@fluentui/react-components'

const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  err: {
    color: tokens.colorPaletteRedForeground1,
    fontFamily: tokens.fontFamilyMonospace,
    maxWidth: '720px',
    padding: tokens.spacingHorizontalXL,
    textAlign: 'center',
  },
})

export interface PowerProviderProps {
  children: ReactNode
}

export function PowerProvider({ children }: PowerProviderProps) {
  const styles = useStyles()
  const [status, setStatus] = useState<'pending' | 'ready' | 'error'>(
    'pending',
  )
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      try {
        await getContext()
        if (cancelled) return
        setStatus('ready')
        if (typeof console !== 'undefined') {
          console.log('Power Apps SDK handshake complete')
        }
      } catch (err) {
        if (cancelled) return
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : JSON.stringify(err)
        console.error('Power Apps SDK handshake failed', err)
        setError(msg)
        setStatus('error')
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [])

  if (status === 'pending') {
    return (
      <div className={styles.root}>
        <Spinner size="large" label="Connecting to Power Platform…" />
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className={styles.root}>
        <div className={styles.err}>
          <p>Couldn't connect to the Power Platform host.</p>
          <p>{error}</p>
          <p>
            Open this app from the Power Apps Local Play URL printed by
            <code> npm run dev</code>, not directly from
            <code> http://localhost:5173</code>.
          </p>
        </div>
      </div>
    )
  }
  return <>{children}</>
}
