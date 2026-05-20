import { useState } from 'react'
import {
  Button,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { classifyApiError } from '../lib/apiErrors'

const useStyles = makeStyles({
  body: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
  },
  hint: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
  },
  raw: {
    margin: 0,
    padding: tokens.spacingVerticalXS,
    background: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground2,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '240px',
    overflowY: 'auto',
  },
})

export interface ErrorMessageProps {
  title?: string
  error: unknown
}

export function ErrorMessage({ title, error }: ErrorMessageProps) {
  const styles = useStyles()
  const [showRaw, setShowRaw] = useState(false)
  const classified = classifyApiError(error)
  const resolvedTitle = title ?? classified.title
  const rawText =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : (() => {
            try {
              return JSON.stringify(error, null, 2)
            } catch {
              return String(error)
            }
          })()

  return (
    <MessageBar intent="error">
      <MessageBarBody className={styles.body}>
        <MessageBarTitle>{resolvedTitle}</MessageBarTitle>
        <div>{classified.message}</div>
        {classified.hint ? (
          <div className={styles.hint}>{classified.hint}</div>
        ) : null}
        {showRaw ? <pre className={styles.raw}>{rawText}</pre> : null}
      </MessageBarBody>
      <MessageBarActions>
        <Button
          size="small"
          appearance="transparent"
          onClick={() => setShowRaw((v) => !v)}
        >
          {showRaw ? 'Hide details' : 'Show details'}
        </Button>
      </MessageBarActions>
    </MessageBar>
  )
}
