import { useSyncExternalStore, useCallback } from 'react'
import {
  Button,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Link,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  Dismiss12Regular,
  Info12Regular,
} from '@fluentui/react-icons'

const STORAGE_KEY = 'agent-evals.retention-banner.dismissed'

const dismissListeners = new Set<() => void>()

function readDismissed(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function setDismissed(v: boolean): void {
  if (typeof window === 'undefined') return
  try {
    if (v) window.localStorage.setItem(STORAGE_KEY, '1')
    else window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    /* swallow */
  }
  dismissListeners.forEach((l) => l())
}

function subscribe(cb: () => void): () => void {
  dismissListeners.add(cb)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) cb()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
  }
  return () => {
    dismissListeners.delete(cb)
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage)
    }
  }
}

const useStyles = makeStyles({
  compactChip: {
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    backgroundColor: tokens.colorNeutralBackground1,
    width: 'fit-content',
  },
  inlineLink: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  bannerHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: tokens.spacingHorizontalS,
  },
})

export interface RetentionBannerProps {
  /** Force compact rendering even on first visit. */
  forceCompact?: boolean
}

export function RetentionBanner({ forceCompact = false }: RetentionBannerProps = {}) {
  const styles = useStyles()
  const dismissed = useSyncExternalStore(
    subscribe,
    useCallback(() => readDismissed(), []),
    () => false,
  )

  if (forceCompact || dismissed) {
    return (
      <Tooltip
        content="Copilot Studio retains evaluation results for 89 days. Export to CSV to keep them longer."
        relationship="label"
      >
        <span className={styles.compactChip}>
          <Info12Regular />
          89-day retention
        </span>
      </Tooltip>
    )
  }

  return (
    <MessageBar intent="info">
      <MessageBarBody>
        <div className={styles.bannerHeader}>
          <MessageBarTitle>Showing data from the last 89 days</MessageBarTitle>
          <Button
            appearance="subtle"
            size="small"
            icon={<Dismiss12Regular />}
            aria-label="Collapse retention notice"
            onClick={() => setDismissed(true)}
          />
        </div>
        {' '}Copilot Studio retains evaluation results for 89 days. To
        keep results longer, export to CSV from the agent's Evaluation
        page.{' '}
        <Link
          href="https://learn.microsoft.com/en-us/microsoft-copilot-studio/analytics-agent-evaluation-results"
          target="_blank"
          rel="noreferrer noopener"
        >
          Learn more
        </Link>
        .
      </MessageBarBody>
    </MessageBar>
  )
}
