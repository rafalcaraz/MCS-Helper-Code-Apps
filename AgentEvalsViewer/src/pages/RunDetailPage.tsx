import { useMemo, useState } from 'react'
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom'
import {
  Body1,
  Button,
  Caption1,
  Link,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  Subtitle1,
  Subtitle2,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Title2,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { ChevronRight20Regular, History20Regular } from '@fluentui/react-icons'
import { useTestCaseDefinitions, useTestRunDetails, useSystemUsers } from '../api/queries'
import { AiResultReasonsList } from '../components/AiResultReasonsList'
import { CenteredSpinner } from '../components/CenteredSpinner'
import { CompositeBadge } from '../components/CompositeBadge'
import { CopyIdButton } from '../components/CopyIdButton'
import { ErrorMessage } from '../components/ErrorMessage'
import { MetricChip } from '../components/MetricChip'
import { MetricScoreBars } from '../components/MetricScoreBars'
import { OpenInCpsLink } from '../components/OpenInCpsLink'
import { OwnerDisplayBlock } from '../components/OwnerDisplay'
import { RawJson } from '../components/RawJson'
import { RegressionTriagePanel } from '../components/RegressionTriagePanel'
import { TopFailingToolsCard } from '../components/TopFailingToolsCard'
import { useAgentDisplayName } from '../hooks/useAgentDisplayName'
import {
  formatDateTime,
  formatDuration,
} from '../lib/eval'
import { getCpsRunUrl } from '../lib/cpsLinks'
import {
  collectMetricTypes,
  deriveCaseLabelFromMetrics,
  resolveCaseLabel,
  formatScore,
  parseMetricScore,
  type CompositeMode,
} from '../lib/metrics'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalL,
  },
  crumbs: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  crumbLink: {
    color: tokens.colorBrandForegroundLink,
    textDecoration: 'none',
    ':hover': { textDecoration: 'underline' },
  },
  meta: {
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
  },
  summary: {
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingHorizontalXL,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  metric: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
  },
  metricValue: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
  },
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingHorizontalXL,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
  },
  caseId: {
    fontFamily: tokens.fontFamilyMonospace,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  metricsCell: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
  },
  caseRow: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
  },
  titleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    columnGap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
    rowGap: tokens.spacingVerticalS,
  },
})

function metricChipDetail(
  metric: { result?: { status?: string; data?: Record<string, unknown> } },
): string {
  // Show numeric score for score-bearing metrics, otherwise just the status
  const score = parseMetricScore(metric)
  if (score !== null) return formatScore(score)
  return metric.result?.status ?? '—'
}

function metricTooltip(
  metric: {
    result?: {
      status?: string
      errorReason?: string
      aiResultReason?: string
      data?: Record<string, unknown>
    }
  },
): string | undefined {
  const parts: string[] = []
  if (metric.result?.errorReason) parts.push(`Error: ${metric.result.errorReason}`)
  if (metric.result?.aiResultReason) parts.push(metric.result.aiResultReason)
  return parts.length > 0 ? parts.join(' — ') : undefined
}

export function RunDetailPage() {
  const styles = useStyles()
  const navigate = useNavigate()
  const { agentId, runId } = useParams<{
    agentId: string
    runId: string
  }>()
  const { name: agentDisplayName } = useAgentDisplayName(agentId)
  const [compositeMode, setCompositeMode] =
    useState<CompositeMode>('strict')

  const runQuery = useTestRunDetails(agentId, runId)
  const defsQuery = useTestCaseDefinitions(agentId)
  // Compute owner IDs inline — single-element array, cheap; useMemo dep
  // inference was flagging a deeper read on runQuery.data than we used.
  const ownerIds: string[] = runQuery.data?.ownerId
    ? [runQuery.data.ownerId]
    : []
  const usersQuery = useSystemUsers(ownerIds)

  const observedMetrics = useMemo(() => {
    if (!runQuery.data) return []
    return collectMetricTypes([runQuery.data])
  }, [runQuery.data])

  if (runQuery.isLoading) {
    return <CenteredSpinner label="Loading run…" />
  }
  if (runQuery.error) {
    return (
      <ErrorMessage title="Couldn't load run" error={runQuery.error} />
    )
  }
  const run = runQuery.data
  if (!run) return null

  const cases = run.testCasesResults ?? []
  const isMetricsOnly = cases.length === 0 && (run.totalTestCases ?? 0) > 0

  const hasCapabilityUse = cases.some((c) =>
    (c.metricsResults ?? []).some((m) => m.type === 'CapabilityUse'),
  )

  const cpsRunUrl = getCpsRunUrl(
    run.environmentId,
    agentId,
    run.id,
    run.testSetId,
  )

  const goToCaseHistory = (caseId: string | undefined) => {
    if (!agentId || !run.testSetId || !caseId) return
    navigate(
      `/agents/${agentId}/testsets/${encodeURIComponent(
        run.testSetId,
      )}/cases/${encodeURIComponent(caseId)}`,
    )
  }

  return (
    <div className={styles.root}>
      <div className={styles.crumbs}>
        <RouterLink to="/agents" className={styles.crumbLink}>
          Agents
        </RouterLink>
        <ChevronRight20Regular />
        <RouterLink
          to={`/agents/${agentId}`}
          className={styles.crumbLink}
        >
          {agentDisplayName || agentId}
        </RouterLink>
        {run.testSetId ? (
          <>
            <ChevronRight20Regular />
            <RouterLink
              to={`/agents/${agentId}/testsets/${encodeURIComponent(run.testSetId)}`}
              className={styles.crumbLink}
            >
              Test set
            </RouterLink>
          </>
        ) : null}
        <ChevronRight20Regular />
        <span>Run</span>
      </div>

      <div className={styles.titleRow}>
        <div>
          <Title2>{run.name ?? 'Test run'}</Title2>
          <div style={{ display: 'flex', alignItems: 'center', columnGap: 4 }}>
            <Caption1 className={styles.meta}>{run.id}</Caption1>
            <CopyIdButton value={run.id} noun="run ID" iconOnly />
          </div>
        </div>
        <OpenInCpsLink
          url={cpsRunUrl}
          label="Open run in Copilot Studio"
          tooltip="Opens the run details page in Copilot Studio (new tab)"
          appearance="outline"
        />
      </div>

      <div className={styles.summary}>
        <div className={styles.metric}>
          <Caption1>Run state</Caption1>
          <span className={styles.metricValue}>{run.state ?? '—'}</span>
        </div>
        <div className={styles.metric}>
          <Caption1>Started</Caption1>
          <span>{formatDateTime(run.startTime)}</span>
        </div>
        <div className={styles.metric}>
          <Caption1>Duration</Caption1>
          <span>{formatDuration(run.startTime, run.endTime)}</span>
        </div>
        <div className={styles.metric}>
          <Caption1>Cases</Caption1>
          <span>{run.totalTestCases ?? cases.length} total</span>
        </div>
        <div className={styles.metric}>
          <Caption1>Composite</Caption1>
          <CompositeBadge
            testSetId={run.testSetId}
            results={cases}
            observedMetrics={observedMetrics}
            mode={compositeMode}
            onModeChange={setCompositeMode}
          />
        </div>
        {run.ownerId ? (
          <div className={styles.metric}>
            <Caption1>Tested by</Caption1>
            <OwnerDisplayBlock
              ownerId={run.ownerId}
              users={usersQuery.data}
            />
          </div>
        ) : null}
      </div>

      {agentId ? (
        <RegressionTriagePanel agentId={agentId} run={run} />
      ) : null}

      {isMetricsOnly ? (
        <MessageBar intent="info">
          <MessageBarBody>
            <MessageBarTitle>Metric-only view</MessageBarTitle> Only the
            maker who initiated this run can see the per-case agent
            responses and reasoning. You're seeing the run's metrics but
            no case-level details.{' '}
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
      ) : null}

      {cases.length > 0 ? (
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <Subtitle1>Metric scores</Subtitle1>
            <Caption1>
              Pass rate per metric type · errors excluded from denominator
            </Caption1>
          </div>
          <MetricScoreBars run={run} />
        </div>
      ) : null}

      {hasCapabilityUse ? (
        <div className={styles.card}>
          <TopFailingToolsCard runs={[run]} />
        </div>
      ) : null}

      <div className={styles.card}>
        <AiResultReasonsList run={run} />
      </div>

      {cases.length > 0 ? (
        <div className={styles.card}>
          <Subtitle1>Test cases ({cases.length})</Subtitle1>
          <Caption1>
            💡 Click <em>View history</em> on any case to see how that
            specific question has performed across every run.
          </Caption1>
          <Table aria-label="Test case results" size="small">
            <TableHeader>
              <TableRow>
                <TableHeaderCell style={{ width: '260px' }}>
                  Test case
                </TableHeaderCell>
                <TableHeaderCell>Per-metric results</TableHeaderCell>
                <TableHeaderCell style={{ width: '140px' }} />
              </TableRow>
            </TableHeader>
            <TableBody>
              {cases.map((c) => {
                const inferred = deriveCaseLabelFromMetrics(
                  c.metricsResults ?? [],
                )
                const resolved = c.testCaseId
                  ? resolveCaseLabel(c.testCaseId, {
                      inferredLabel: inferred,
                      definitions: defsQuery.data,
                    })
                  : null
                return (
                <TableRow key={c.testCaseId}>
                  <TableCell>
                    <div className={styles.caseRow}>
                      <Subtitle2>
                        {resolved?.label ??
                          (c.testCaseId
                            ? `case ${c.testCaseId.slice(0, 8)}…`
                            : '—')}
                      </Subtitle2>
                      <span className={styles.caseId}>
                        {c.testCaseId}
                      </span>
                      {c.state ? (
                        <Caption1>execution: {c.state}</Caption1>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={styles.metricsCell}>
                      {(c.metricsResults ?? []).map((m, idx) => (
                        <MetricChip
                          key={`${c.testCaseId}-${m.type}-${idx}`}
                          type={m.type ?? 'Unknown'}
                          status={m.result?.status}
                          detail={metricChipDetail(m)}
                          tooltip={metricTooltip(m)}
                        />
                      ))}
                      {(c.metricsResults ?? []).length === 0 ? (
                        <Caption1>No metrics</Caption1>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell>
                    {c.testCaseId && run.testSetId ? (
                      <Button
                        size="small"
                        appearance="subtle"
                        icon={<History20Regular />}
                        onClick={() => goToCaseHistory(c.testCaseId)}
                      >
                        View history
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : !isMetricsOnly ? (
        <Body1 as="p">No test cases in this run yet.</Body1>
      ) : null}

      <RawJson title="Raw run response (for debugging)" data={run} />
    </div>
  )
}
