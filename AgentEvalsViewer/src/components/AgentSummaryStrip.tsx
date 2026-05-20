import { useMemo } from 'react'
import {
  Badge,
  Caption1,
  Skeleton,
  SkeletonItem,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  useTestCaseDefinitions,
  useTestRuns,
  useTestSets,
} from '../api/queries'
import { compareRunsByStartTimeDesc, countResults, formatPassRate } from '../lib/eval'
import { computeRunCadence, formatCadenceDuration } from '../lib/cadence'

const useStyles = makeStyles({
  row: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    rowGap: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalXS,
  },
  subtle: {
    color: tokens.colorNeutralForeground3,
  },
  loading: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalXS,
    width: '420px',
    maxWidth: '100%',
  },
  errorChip: {
    color: tokens.colorPaletteRedForeground1,
  },
  separator: {
    color: tokens.colorNeutralForeground4,
  },
})

export interface AgentSummaryStripProps {
  agentId: string
}

const SEVEN_DAYS_MS = 7 * 86_400_000

function relativeTime(tsIso: string | undefined, now: number): string | null {
  if (!tsIso) return null
  const t = new Date(tsIso).getTime()
  if (!Number.isFinite(t)) return null
  const diffMs = now - t
  if (diffMs < 0) return 'in the future'
  const min = Math.round(diffMs / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const d = Math.round(hr / 24)
  if (d < 14) return `${d} day${d === 1 ? '' : 's'} ago`
  const w = Math.round(d / 7)
  return `${w} wk${w === 1 ? '' : 's'} ago`
}

function stateColor(
  state: string | undefined,
): 'success' | 'danger' | 'warning' | 'informative' | 'subtle' {
  if (!state) return 'subtle'
  const s = state.toLowerCase()
  if (s.includes('complete') || s.includes('succeed')) return 'success'
  if (s.includes('fail') || s.includes('error')) return 'danger'
  if (s.includes('cancel')) return 'warning'
  if (s.includes('progress') || s.includes('running') || s.includes('queue'))
    return 'informative'
  return 'subtle'
}

function passRateColor(
  rate: number | null,
): 'success' | 'warning' | 'danger' | 'subtle' {
  if (rate === null) return 'subtle'
  if (rate >= 0.9) return 'success'
  if (rate >= 0.7) return 'warning'
  return 'danger'
}

/**
 * Per-row "at a glance" metrics for an agent on the top-level Agents page.
 *
 * Deliberately uses ONLY cheap calls — no per-run detail fan-out — so this
 * scales to many tracked agents without blowing up the agents list:
 *   - useTestSets       → set count
 *   - useTestRuns       → run count, latest run state + age, last-7-days count
 *   - useTestCaseDefs   → cases by kind (single-turn vs multi-turn)
 *
 * Renders nothing until something interesting is known. Each individual query
 * has independent loading state; this strip resolves piece-by-piece.
 */
export function AgentSummaryStrip({ agentId }: AgentSummaryStripProps) {
  const styles = useStyles()
  const setsQuery = useTestSets(agentId)
  const runsQuery = useTestRuns(agentId)
  const defsQuery = useTestCaseDefinitions(agentId)
  // Date.now() must live outside render purity rules. useMemo with empty
  // deps freezes once per mount — good enough for "X hr ago" copy.
  // eslint-disable-next-line react-hooks/purity
  const now = useMemo(() => Date.now(), [])

  const setCount = setsQuery.data?.length ?? null
  const runs = useMemo(() => runsQuery.data ?? [], [runsQuery.data])

  const latestRun = useMemo(() => {
    if (runs.length === 0) return null
    return [...runs].sort(compareRunsByStartTimeDesc)[0]
  }, [runs])

  const runsLast7Days = useMemo(() => {
    if (!runs.length) return 0
    const cutoff = now - SEVEN_DAYS_MS
    return runs.filter((r) => {
      if (!r.startTime) return false
      const t = new Date(r.startTime).getTime()
      return Number.isFinite(t) && t >= cutoff
    }).length
  }, [runs, now])

  // Cadence is computed across ALL the agent's runs lumped together, not
  // per test set, because this strip is the agent-list summary — one
  // single signal per agent. A maker who has one stale test set among
  // ten on-cadence ones probably still wants to know.
  const cadence = useMemo(
    () => computeRunCadence(runs, { now }),
    [runs, now],
  )

  const caseKindCounts = useMemo(() => {
    if (!defsQuery.data) return null
    let single = 0
    let multi = 0
    for (const def of defsQuery.data.values()) {
      if (def.kind === 'MultiTurnEvaluationCase') multi += 1
      else single += 1
    }
    return { single, multi, total: single + multi }
  }, [defsQuery.data])

  // While ANY query is still in initial load, show a placeholder strip so the
  // row doesn't reflow when data arrives.
  const isInitialLoading =
    (setsQuery.isLoading && !setsQuery.data) ||
    (runsQuery.isLoading && !runsQuery.data)
  if (isInitialLoading) {
    return (
      <div className={styles.loading} aria-label="Loading agent summary">
        <Skeleton>
          <SkeletonItem size={16} style={{ width: '360px' }} />
        </Skeleton>
      </div>
    )
  }

  // Hard errors (e.g. agent ID is wrong, or the maker doesn't have access).
  if (setsQuery.error || runsQuery.error) {
    return (
      <div className={styles.row}>
        <Caption1 className={styles.errorChip}>
          ⚠ Couldn't load · check the agent ID + your access in this environment
        </Caption1>
      </div>
    )
  }

  // No data scenarios — keep them succinct so they don't dominate the row.
  if (setCount === 0) {
    return (
      <div className={styles.row}>
        <Caption1 className={styles.subtle}>
          No test sets configured · Open to set one up in Copilot Studio
        </Caption1>
      </div>
    )
  }
  if (setCount === null) {
    // shouldn't happen post-load, but be defensive
    return null
  }

  const parts: React.ReactNode[] = []

  // Latest run badge — pass-rate-led (the "Completed" state is demoted into
  // the tooltip because it answered the wrong question — a "Completed" run can
  // still have 0% pass rate, which surprised users on the dashboard).
  if (latestRun) {
    const age = relativeTime(latestRun.startTime, now)
    const counts = countResults(latestRun.testCasesResults)
    const hasPassRate = counts.passRate !== null && counts.total > 0
    const stateLower = (latestRun.state ?? '').toLowerCase()
    const isInFlight =
      stateLower.includes('progress') ||
      stateLower.includes('running') ||
      stateLower.includes('queue')
    const isFailed = stateLower.includes('fail') || stateLower.includes('error')

    let badgeLabel: string
    let badgeColor: 'success' | 'warning' | 'danger' | 'informative' | 'subtle'
    if (isInFlight) {
      badgeLabel = age ? `Running · ${age}` : 'Running'
      badgeColor = 'informative'
    } else if (isFailed && !hasPassRate) {
      badgeLabel = age ? `Errored · ${age}` : 'Errored'
      badgeColor = 'danger'
    } else if (hasPassRate) {
      const pct = formatPassRate(counts.passRate)
      badgeLabel = age
        ? `${pct} · ${age} (${counts.pass}/${counts.total})`
        : `${pct} (${counts.pass}/${counts.total})`
      badgeColor = passRateColor(counts.passRate)
    } else {
      // Fallback: keep the state-led label only when we can't compute a rate.
      badgeLabel =
        latestRun.state && age
          ? `${latestRun.state} · ${age}`
          : (latestRun.state ?? age ?? 'Latest run')
      badgeColor = stateColor(latestRun.state)
    }

    const tooltipLines = [
      latestRun.state
        ? `Run state: ${latestRun.state}`
        : 'Run state: unknown',
      hasPassRate
        ? `Pass rate: ${counts.pass}/${counts.total} (${formatPassRate(counts.passRate)})`
        : 'Pass rate: n/a',
      latestRun.startTime ? `Started: ${latestRun.startTime}` : null,
    ]
      .filter(Boolean)
      .join('\n')

    parts.push(
      <Tooltip key="latest-run" content={tooltipLines} relationship="label">
        <Badge appearance="filled" color={badgeColor}>
          {badgeLabel}
        </Badge>
      </Tooltip>,
    )
  }

  // Test set count
  parts.push(
    <span key="sets">
      {setCount} test set{setCount === 1 ? '' : 's'}
    </span>,
  )

  // Case kind breakdown (only when defs resolved AND there are cases)
  if (caseKindCounts && caseKindCounts.total > 0) {
    parts.push(
      <span key="sep-cases" className={styles.separator}>
        ·
      </span>,
      <span
        key="cases"
        title="Test cases by kind from the bot-component definitions"
      >
        {caseKindCounts.total} case{caseKindCounts.total === 1 ? '' : 's'}{' '}
        ({caseKindCounts.single} single-turn
        {caseKindCounts.multi > 0
          ? ` · ${caseKindCounts.multi} multi-turn`
          : ''}
        )
      </span>,
    )
  } else if (defsQuery.isLoading) {
    parts.push(
      <span key="sep-cases" className={styles.separator}>
        ·
      </span>,
      <span key="cases-loading" className={styles.subtle}>
        loading case kinds…
      </span>,
    )
  }

  // Run counts
  if (runs.length > 0) {
    parts.push(
      <span key="sep-runs" className={styles.separator}>
        ·
      </span>,
      <span key="runs">
        {runs.length} run{runs.length === 1 ? '' : 's'}
        {runsLast7Days > 0 ? ` (${runsLast7Days} in last 7d)` : ''}
      </span>,
    )
  } else {
    parts.push(
      <span key="sep-runs" className={styles.separator}>
        ·
      </span>,
      <span key="no-runs" className={styles.subtle}>
        no runs yet
      </span>,
    )
  }

  if (cadence?.isStale) {
    const lastRun = formatCadenceDuration(cadence.ageMs)
    const typical = formatCadenceDuration(cadence.medianGapMs)
    parts.push(
      <span key="sep-cadence" className={styles.separator}>
        ·
      </span>,
      <Tooltip
        key="cadence"
        content={
          `Last scheduled run fired ${lastRun} ago — typically every ${typical} ` +
          `(median of last ${cadence.sampleSize} scheduled gaps). ` +
          `Check your Power Automate flow's run history.`
        }
        relationship="label"
      >
        <Badge appearance="filled" color="warning">
          Schedule stale · {lastRun} ago
        </Badge>
      </Tooltip>,
    )
  }

  return <div className={styles.row}>{parts}</div>
}
