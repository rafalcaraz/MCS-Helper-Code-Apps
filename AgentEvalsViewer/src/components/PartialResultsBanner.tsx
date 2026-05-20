import { useEffect, useMemo, useState } from 'react'
import {
  Button,
  Caption1,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  ChevronDown16Regular,
  ChevronRight16Regular,
  Copy16Regular,
} from '@fluentui/react-icons'
import { classifyApiError, type ApiErrorKind } from '../lib/apiErrors'
import type { RunDetailFailure } from '../api/queries'

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
  details: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalXS,
    paddingTop: tokens.spacingVerticalXS,
    borderTop: `1px solid ${tokens.colorNeutralStroke3}`,
  },
  failureRow: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '2px',
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    background: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  failureTitle: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
  },
  failureMeta: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
  },
  failureReason: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  runList: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '4px',
    marginTop: tokens.spacingVerticalXS,
  },
  runRow: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '2px',
    padding: `4px ${tokens.spacingHorizontalS}`,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusMedium,
    background: tokens.colorNeutralBackground1,
  },
  runHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.spacingHorizontalXS,
  },
  runName: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
  },
  rawBox: {
    margin: 0,
    padding: tokens.spacingVerticalXS,
    background: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground2,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    maxHeight: '180px',
    overflowY: 'auto',
    marginTop: '4px',
  },
})

export interface PartialResultsBannerProps {
  failures: ReadonlyArray<RunDetailFailure>
  /** Optional total for the "N of M" label (defaults to failures.length). */
  totalRuns?: number
}

const FRIENDLY_KIND: Record<ApiErrorKind, string> = {
  automapper: 'Server-side mapping bug (known PPAPI issue)',
  'bad-gateway': 'Connector gateway error',
  unauthorized: 'Sign-in required',
  forbidden: 'No access',
  'not-found': 'Run not found',
  network: 'Network error',
  unknown: 'Server error',
}

/**
 * Non-blocking warning rendered when SOME runs failed to load but the
 * list itself succeeded. Lets makers see the runs that did load while
 * still being aware that a subset is missing — and why.
 *
 * Groups failures by error kind so 5 runs that hit the same PPAPI
 * AutoMapper bug collapse into a single tidy row.
 */
export function PartialResultsBanner({
  failures,
  totalRuns,
}: PartialResultsBannerProps) {
  const styles = useStyles()
  const [expanded, setExpanded] = useState(false)
  const [expandedRuns, setExpandedRuns] = useState<ReadonlySet<string>>(
    new Set(),
  )

  const grouped = useMemo(() => {
    const map = new Map<ApiErrorKind, RunDetailFailure[]>()
    for (const f of failures) {
      const kind = classifyApiError(f.error).kind
      const list = map.get(kind) ?? []
      list.push(f)
      map.set(kind, list)
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length)
  }, [failures])

  // Mirror failures to the devtools console so they're easy to copy-paste
  // into a support ticket. One log line per unique run — guarded so the
  // same run isn't logged on every render.
  useEffect(() => {
    for (const f of failures) {
      const cls = classifyApiError(f.error)
      console.warn(
        `[AgentEvalsViewer] run detail fetch failed (${cls.kind})`,
        {
          runName: f.runName,
          runId: f.runId,
          testSetId: f.testSetId,
          classifiedAs: cls.title,
          serverMessage: cls.innerMessage,
        },
      )
    }
  }, [failures])

  if (failures.length === 0) return null

  const label =
    totalRuns && totalRuns > failures.length
      ? `${failures.length} of ${totalRuns} runs couldn't be loaded`
      : `${failures.length} run${failures.length === 1 ? '' : 's'} couldn't be loaded`

  const everythingFailed =
    typeof totalRuns === 'number' && failures.length === totalRuns

  const toggleRun = (runId: string) => {
    setExpandedRuns((prev) => {
      const next = new Set(prev)
      if (next.has(runId)) next.delete(runId)
      else next.add(runId)
      return next
    })
  }

  const rawOf = (f: RunDetailFailure): string => {
    if (f.error instanceof Error) return f.error.message
    if (typeof f.error === 'string') return f.error
    try {
      return JSON.stringify(f.error, null, 2)
    } catch {
      return String(f.error)
    }
  }

  const copyToClipboard = (text: string) => {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text)
    }
  }

  return (
    <MessageBar intent={everythingFailed ? 'error' : 'warning'}>
      <MessageBarBody className={styles.body}>
        <MessageBarTitle>{label}</MessageBarTitle>
        <Caption1>
          {everythingFailed
            ? 'None of the runs in this view loaded. The remaining UI may be empty.'
            : 'The runs below are missing from charts, leaderboards and the heatmap. The other runs loaded fine.'}
        </Caption1>
        {expanded ? (
          <div className={styles.details}>
            {grouped.map(([kind, list]) => {
              const sample = list[0]
              const classified = classifyApiError(sample.error)
              return (
                <div key={kind} className={styles.failureRow}>
                  <div className={styles.failureTitle}>
                    {FRIENDLY_KIND[kind] ?? classified.title} · {list.length}{' '}
                    run{list.length === 1 ? '' : 's'}
                  </div>
                  <div className={styles.failureReason}>
                    {classified.message}
                  </div>
                  {classified.hint ? (
                    <div className={styles.hint}>{classified.hint}</div>
                  ) : null}
                  <Caption1 className={styles.hint}>
                    Each run is classified by pattern-matching the server's
                    inner error message — expand any run below to verify
                    exactly what PPAPI returned for that run.
                  </Caption1>
                  <div className={styles.runList}>
                    {list.map((f) => {
                      const open = expandedRuns.has(f.runId)
                      const raw = rawOf(f)
                      return (
                        <div key={f.runId} className={styles.runRow}>
                          <div className={styles.runHeader}>
                            <Button
                              size="small"
                              appearance="transparent"
                              icon={
                                open ? (
                                  <ChevronDown16Regular />
                                ) : (
                                  <ChevronRight16Regular />
                                )
                              }
                              onClick={() => toggleRun(f.runId)}
                            >
                              <span className={styles.runName}>
                                {f.runName ?? f.runId.slice(0, 8)}
                              </span>
                            </Button>
                            {open ? (
                              <Button
                                size="small"
                                appearance="transparent"
                                icon={<Copy16Regular />}
                                onClick={() => copyToClipboard(raw)}
                              >
                                Copy raw
                              </Button>
                            ) : null}
                          </div>
                          {open ? (
                            <pre className={styles.rawBox}>{raw}</pre>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ) : null}
      </MessageBarBody>
      <MessageBarActions>
        <Button
          size="small"
          appearance="transparent"
          icon={
            expanded ? <ChevronDown16Regular /> : <ChevronRight16Regular />
          }
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Hide details' : 'Show details'}
        </Button>
      </MessageBarActions>
    </MessageBar>
  )
}
