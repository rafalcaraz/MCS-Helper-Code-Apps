import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom'
import {
  Body1,
  Button,
  Caption1,
  Dropdown,
  Option,
  Spinner,
  Subtitle1,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  Title2,
  ToggleButton,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { ChevronRight20Regular, Open16Regular } from '@fluentui/react-icons'
import {
  useTestCaseDefinitions,
  useTestRunsWithDetails,
  useTestSetDetails,
  useSystemUsers,
} from '../api/queries'
import { AutoDiagnoseBanner } from '../components/AutoDiagnoseBanner'
import { CapabilityCoverageCard } from '../components/CapabilityCoverageCard'
import { CaseHeatmap } from '../components/CaseHeatmap'
import { CaseLeaderboards } from '../components/CaseLeaderboards'
import { MetricLeaderboardsSection } from '../components/MetricLeaderboards'
import { CenteredSpinner } from '../components/CenteredSpinner'
import { CompositeBadge } from '../components/CompositeBadge'
import { CoverageDriftBanner } from '../components/CoverageDriftBanner'
import { DefsCoverageNote } from '../components/DefsCoverageNote'
import { ErrorMessage } from '../components/ErrorMessage'
import { ExpandableChartCard } from '../components/ExpandableChartCard'
import { FailureClustersCard } from '../components/FailureClustersCard'
import { CopyIdButton } from '../components/CopyIdButton'
import { MetricChipStack } from '../components/MetricChipStack'
import { MetricTrendChart } from '../components/MetricTrendChart'
import { NumericScoreDriftBanner } from '../components/NumericScoreDriftBanner'
import { NumericScoreTrendChart } from '../components/NumericScoreTrendChart'
import { OpenInCpsLink } from '../components/OpenInCpsLink'
import { OwnerDisplay } from '../components/OwnerDisplay'
import { PartialResultsBanner } from '../components/PartialResultsBanner'
import { RawJson } from '../components/RawJson'
import { RetentionBanner } from '../components/RetentionBanner'
import { RunDiffCard } from '../components/RunDiffCard'
import { RunDurationTrendChart } from '../components/RunDurationTrendChart'
import { SinceLastVisitInbox } from '../components/SinceLastVisitInbox'
import { TopErrorReasonsCard } from '../components/TopErrorReasonsCard'
import { TopFailingToolsCard } from '../components/TopFailingToolsCard'
import { useLastViewedRun } from '../hooks/useLastViewedRun'
import { useAgentDisplayName } from '../hooks/useAgentDisplayName'
import { useAgentSnapshots } from '../hooks/useAgentSnapshots'
import { snapshotsToChartMarkers } from '../lib/snapshotChartMarkers'
import {
  compareRunsByStartTimeDesc,
  formatDateTime,
  formatDuration,
  getTestSetName,
} from '../lib/eval'
import { getCpsTestSetUrl } from '../lib/cpsLinks'
import {
  collectMetricTypes,
  metricHasNumericScore,
  type CompositeMode,
} from '../lib/metrics'

type RangeOptionId = 'all' | '90d' | '30d' | '7d' | '24h' | '6h'
const RANGE_OPTIONS: ReadonlyArray<{
  id: RangeOptionId
  label: string
  hours: number | null
}> = [
  { id: 'all', label: 'All time', hours: null },
  { id: '90d', label: 'Last 90 days', hours: 90 * 24 },
  { id: '30d', label: 'Last 30 days', hours: 30 * 24 },
  { id: '7d', label: 'Last 7 days', hours: 7 * 24 },
  { id: '24h', label: 'Last 24 hours', hours: 24 },
  { id: '6h', label: 'Last 6 hours', hours: 6 },
]

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
    justifyContent: 'space-between',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
    rowGap: tokens.spacingVerticalS,
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  chartGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  rangeBar: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: tokens.spacingHorizontalS,
    rowGap: tokens.spacingVerticalXS,
    paddingInline: tokens.spacingHorizontalXS,
  },
  rangeLabel: {
    color: tokens.colorNeutralForeground3,
    marginInlineEnd: tokens.spacingHorizontalXS,
  },
  rangeMeta: {
    color: tokens.colorNeutralForeground3,
    marginInlineStart: tokens.spacingHorizontalS,
  },
  titleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    columnGap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
    rowGap: tokens.spacingVerticalS,
  },
  meta: {
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
  },
})

export function TestSetDetailPage() {
  const styles = useStyles()
  const navigate = useNavigate()
  const { agentId, testSetId } = useParams<{
    agentId: string
    testSetId: string
  }>()
  const { name: agentDisplayName, resolved: agentNameResolved } =
    useAgentDisplayName(agentId)
  const [compositeMode, setCompositeMode] =
    useState<CompositeMode>('strict')
  const [showHeatmap, setShowHeatmap] = useState(false)
  const [rangeId, setRangeId] = useState<RangeOptionId>('all')
  const [showPriorRunDetails, setShowPriorRunDetails] = useState(false)
  const [ownerFilter, setOwnerFilter] = useState<string | null>(null)

  const setQuery = useTestSetDetails(agentId, testSetId)
  const runsQuery = useTestRunsWithDetails(agentId, testSetId)
  const defsQuery = useTestCaseDefinitions(agentId)
  const definitions = defsQuery.data
  const { markerRunId, lastEntry, markAsViewed, clear: clearMarker } = useLastViewedRun(
    agentId,
    testSetId,
  )

  const setRuns = useMemo(() => {
    return (runsQuery.data ?? [])
      .filter((r) => r.testSetId === testSetId)
      .sort(compareRunsByStartTimeDesc)
  }, [runsQuery.data, testSetId])

  const { snapshots } = useAgentSnapshots(agentId ?? '')
  const snapshotMarkers = useMemo(
    () => snapshotsToChartMarkers(snapshots),
    [snapshots],
  )

  const ownerIds = useMemo(
    () =>
      Array.from(
        new Set(
          setRuns
            .map((r) => r.ownerId)
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      ),
    [setRuns],
  )
  const ownersQuery = useSystemUsers(ownerIds)
  const ownerOptions = useMemo(() => {
    const opts = ownerIds.map((id) => {
      const user = ownersQuery.data?.get(id)
      const label =
        user?.fullname?.trim() ||
        user?.internalemailaddress?.trim() ||
        `user ${id.slice(0, 8)}…`
      return { id, label }
    })
    opts.sort((a, b) => a.label.localeCompare(b.label))
    return opts
  }, [ownerIds, ownersQuery.data])

  // Treat a stale ownerFilter (whose user is no longer in setRuns) as cleared
  // without a useEffect+setState — avoids a render+effect cascade.
  const effectiveOwnerFilter =
    ownerFilter && ownerIds.includes(ownerFilter) ? ownerFilter : null

  const historyRuns = useMemo(() => {
    if (!effectiveOwnerFilter) return setRuns
    return setRuns.filter((r) => r.ownerId === effectiveOwnerFilter)
  }, [setRuns, effectiveOwnerFilter])

  const selectedOwnerLabel = useMemo(() => {
    if (!effectiveOwnerFilter) return null
    return (
      ownerOptions.find((o) => o.id === effectiveOwnerFilter)?.label ??
      effectiveOwnerFilter
    )
  }, [effectiveOwnerFilter, ownerOptions])

  // Auto-advance the marker after the maker has had a chance to read the
  // inbox (delay so they actually see it before the marker moves to "now").
  // Skip when there's nothing new to show, and skip on first visit so the
  // first-visit message appears at least once.
  useEffect(() => {
    if (setRuns.length === 0) return
    const latest = setRuns[0]
    const latestId = latest?.id
    if (!latestId) return
    if (markerRunId === latestId) return
    // Capture the resolved agent name (tracked nickname or discovered bot
    // display name) for the "you saw X" inbox marker. Skip when we still
    // only have a GUID-prefix fallback so the marker doesn't lock that
    // in — RecentlyViewedCard will resolve it later anyway.
    const agentName = agentNameResolved ? agentDisplayName : undefined
    const testSetName = setQuery.data ? getTestSetName(setQuery.data) : undefined
    const runName = latest?.name ?? undefined
    const timer = window.setTimeout(() => {
      markAsViewed(latestId, { runName, agentName, testSetName })
    }, 4000)
    return () => window.clearTimeout(timer)
  }, [
    setRuns,
    markerRunId,
    markAsViewed,
    agentDisplayName,
    agentNameResolved,
    setQuery.data,
  ])

  const rangeHours =
    RANGE_OPTIONS.find((o) => o.id === rangeId)?.hours ?? null

  const chartRuns = useMemo(() => {
    if (rangeHours === null) return setRuns
    // Date.now() is intentionally read here — the filter window is
    // relative to wall-clock time. Re-running on each render is cheap.
    // eslint-disable-next-line react-hooks/purity
    const cutoff = Date.now() - rangeHours * 3_600_000
    return setRuns.filter((r) => {
      const ts = r.startTime ? new Date(r.startTime).getTime() : NaN
      return Number.isFinite(ts) && ts >= cutoff
    })
  }, [setRuns, rangeHours])

  const observedMetrics = useMemo(
    () => collectMetricTypes(setRuns),
    [setRuns],
  )

  const hasNumericScoreMetric = useMemo(
    () => observedMetrics.some(metricHasNumericScore),
    [observedMetrics],
  )
  const hasCapabilityUseMetric = useMemo(
    () => observedMetrics.includes('CapabilityUse'),
    [observedMetrics],
  )

  // The CPS deep link needs envId, which we pull off the most recent run
  // (it's the same envId for every run on the same agent).
  const envId = setRuns[0]?.environmentId
  const cpsTestSetUrl = getCpsTestSetUrl(envId, agentId, testSetId)

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
        <ChevronRight20Regular />
        <span>{getTestSetName(setQuery.data)}</span>
      </div>
      <div className={styles.titleRow}>
        <div>
          <Title2>{getTestSetName(setQuery.data)}</Title2>
          <div style={{ display: 'flex', alignItems: 'center', columnGap: 4 }}>
            <Caption1 className={styles.meta}>{testSetId}</Caption1>
            <CopyIdButton value={testSetId} noun="test set ID" iconOnly />
          </div>
        </div>
        <OpenInCpsLink
          url={cpsTestSetUrl}
          label="Open test set in Copilot Studio"
          tooltip="Opens the test set in Copilot Studio (new tab)"
          appearance="outline"
        />
      </div>

      <RetentionBanner />

      {setQuery.error ? (
        <ErrorMessage
          title="Couldn't load test set details"
          error={setQuery.error}
        />
      ) : null}
      {runsQuery.error ? (
        <ErrorMessage
          title="Couldn't load test runs"
          error={runsQuery.error}
        />
      ) : null}
      {runsQuery.detailsErrors.length > 0 ? (
        <PartialResultsBanner
          failures={runsQuery.detailsErrors}
          totalRuns={runsQuery.detailsTotal}
        />
      ) : null}

      {runsQuery.isLoadingList ? (
        <CenteredSpinner label="Loading runs…" />
      ) : setRuns.length === 0 ? (
        <div className={styles.card}>
          <Subtitle1>No runs yet for this test set</Subtitle1>
          <Body1 as="p">
            When you run this test set in Copilot Studio (or via Power
            Automate), the results will show up here.
          </Body1>
        </div>
      ) : (
        <>
          <CoverageDriftBanner
            runs={setRuns}
            agentId={agentId}
            testSetId={testSetId}
            definitions={definitions}
          />

          <NumericScoreDriftBanner
            runs={setRuns}
            agentId={agentId}
            testSetId={testSetId}
            definitions={definitions}
          />

          <div className={styles.card}>
            <SinceLastVisitInbox
              runs={setRuns}
              agentId={agentId}
              testSetId={testSetId}
              markerRunId={markerRunId}
              lastEntry={lastEntry}
              onClearMarker={clearMarker}
              definitions={definitions}
            />
          </div>

          <div className={styles.card}>
            <AutoDiagnoseBanner runs={setRuns} />
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Subtitle1>Latest vs prior run</Subtitle1>
              <Button
                size="small"
                appearance="subtle"
                onClick={() => setShowPriorRunDetails((v) => !v)}
              >
                {showPriorRunDetails ? 'Hide details' : 'Show details'}
              </Button>
            </div>
            {showPriorRunDetails ? (
              <RunDiffCard
                current={setRuns[0]}
                previous={setRuns[1]}
                agentId={agentId}
                testSetId={testSetId}
              />
            ) : (
              <Caption1>
                Single-step diff between the most recent two runs. Useful when
                runs are far apart and the "since you last looked" view above
                isn't granular enough.
              </Caption1>
            )}
          </div>

          <div className={styles.rangeBar}>
            <Caption1 className={styles.rangeLabel}>Time range:</Caption1>
            {RANGE_OPTIONS.map((opt) => (
              <ToggleButton
                key={opt.id}
                size="small"
                checked={rangeId === opt.id}
                onClick={() => setRangeId(opt.id)}
              >
                {opt.label}
              </ToggleButton>
            ))}
            <Caption1 className={styles.rangeMeta}>
              {chartRuns.length === setRuns.length
                ? `${setRuns.length} run${setRuns.length === 1 ? '' : 's'}`
                : `${chartRuns.length} of ${setRuns.length} runs`}
            </Caption1>
          </div>

          <div className={styles.chartGrid}>
            <ExpandableChartCard
              title="Per-metric pass rate over time"
              subtitle="Pass rate per metric type · errors excluded from denominator"
              headerRight={
                runsQuery.isLoadingDetails ? (
                  <Caption1>
                    <Spinner size="extra-tiny" />
                    {` ${runsQuery.detailsLoaded}/${runsQuery.detailsTotal} runs loaded`}
                  </Caption1>
                ) : null
              }
            >
              <MetricTrendChart
                runs={chartRuns}
                snapshotMarkers={snapshotMarkers}
                agentId={agentId}
              />
            </ExpandableChartCard>
            {hasNumericScoreMetric ? (
              <ExpandableChartCard
                title="Numeric score trend"
                subtitle={
                  <>
                    0–1 score from <code>data.score</code> on Compare meaning
                    and Text similarity — captures gradual drift the binary
                    view hides.
                  </>
                }
              >
                <NumericScoreTrendChart runs={chartRuns} />
              </ExpandableChartCard>
            ) : null}
            <ExpandableChartCard
              title="Run duration over time"
              subtitle="End-to-end run latency (endTime − startTime). Gradual creep often signals knowledge-source bloat or backing-service slowdown."
            >
              <RunDurationTrendChart runs={chartRuns} />
            </ExpandableChartCard>
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Subtitle1>Question leaderboards</Subtitle1>
              <Caption1>
                Where to look first. Click any case to see its full history.
              </Caption1>
            </div>
            <DefsCoverageNote
              runs={setRuns}
              definitions={definitions}
              isLoading={defsQuery.isLoading}
              error={defsQuery.error as Error | null}
            />
            <CaseLeaderboards
              runs={setRuns}
              agentId={agentId}
              testSetId={testSetId}
              definitions={definitions}
            />
          </div>

          <div className={styles.card}>
            <MetricLeaderboardsSection
              runs={setRuns}
              agentId={agentId}
              testSetId={testSetId}
              definitions={definitions}
            />
          </div>

          <div className={styles.twoCol}>
            {hasCapabilityUseMetric ? (
              <div className={styles.card}>
                <TopFailingToolsCard runs={setRuns} />
              </div>
            ) : null}
            <div className={styles.card}>
              <TopErrorReasonsCard runs={setRuns} />
            </div>
            {hasCapabilityUseMetric ? (
              <div className={styles.card}>
                <CapabilityCoverageCard runs={setRuns} />
              </div>
            ) : null}
          </div>

          <div className={styles.card}>
            <FailureClustersCard
              runs={setRuns}
              agentId={agentId}
              testSetId={testSetId}
              definitions={definitions}
            />
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Subtitle1>Test-case heatmap</Subtitle1>
              <Switch
                checked={showHeatmap}
                onChange={(_, d) => setShowHeatmap(d.checked)}
                label={showHeatmap ? 'Showing' : 'Hidden'}
              />
            </div>
            {showHeatmap ? (
              <>
                <Caption1>
                  Each <strong>row</strong> is one test case (a question) ·{' '}
                  each <strong>column</strong> is one run, oldest&nbsp;→&nbsp;newest ·{' '}
                  color = result. The pill (e.g. <code>5/8</code>) is overall
                  pass count for the row.
                </Caption1>
                <Caption1>
                  <strong>Patterns to spot:</strong> a horizontal red streak =
                  always-broken question · a vertical red streak = a whole run
                  regressed · alternating red/green = flaky. 💡 Click any cell
                  or case label to open that question's full history.
                </Caption1>
                <CaseHeatmap
                  runs={setRuns}
                  agentId={agentId}
                  testSetId={testSetId}
                  definitions={definitions}
                />
              </>
            ) : (
              <Caption1>
                Hidden by default — best for spotting visual patterns when
                you have many runs. Toggle on to view.
              </Caption1>
            )}
          </div>

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <Subtitle1>
                Run history ({historyRuns.length}
                {effectiveOwnerFilter ? ` of ${setRuns.length}` : ''})
              </Subtitle1>
              {ownerOptions.length > 1 ? (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: tokens.spacingHorizontalS,
                  }}
                >
                  <Caption1>Filter by owner</Caption1>
                  <Dropdown
                    size="small"
                    placeholder="All owners"
                    value={selectedOwnerLabel ?? 'All owners'}
                    selectedOptions={
                      effectiveOwnerFilter
                        ? [effectiveOwnerFilter]
                        : ['__all__']
                    }
                    onOptionSelect={(_e, data) => {
                      const next = data.optionValue
                      if (!next || next === '__all__') setOwnerFilter(null)
                      else setOwnerFilter(next)
                    }}
                  >
                    <Option value="__all__" text="All owners">
                      All owners ({ownerIds.length})
                    </Option>
                    {ownerOptions.map((o) => (
                      <Option key={o.id} value={o.id} text={o.label}>
                        {o.label}
                      </Option>
                    ))}
                  </Dropdown>
                </div>
              ) : null}
            </div>
            <Table aria-label="Run history" size="medium">
              <TableHeader>
                <TableRow>
                  <TableHeaderCell>Started</TableHeaderCell>
                  <TableHeaderCell>State</TableHeaderCell>
                  <TableHeaderCell>Composite</TableHeaderCell>
                  <TableHeaderCell>Per-metric</TableHeaderCell>
                  <TableHeaderCell>Duration</TableHeaderCell>
                  <TableHeaderCell>Owner</TableHeaderCell>
                  <TableHeaderCell />
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyRuns.map((run) => {
                  return (
                    <TableRow key={run.id}>
                      <TableCell>{formatDateTime(run.startTime)}</TableCell>
                      <TableCell>{run.state ?? '—'}</TableCell>
                      <TableCell>
                        <CompositeBadge
                          testSetId={testSetId}
                          results={run.testCasesResults}
                          observedMetrics={observedMetrics}
                          mode={compositeMode}
                          onModeChange={setCompositeMode}
                        />
                      </TableCell>
                      <TableCell>
                        <MetricChipStack run={run} />
                      </TableCell>
                      <TableCell>
                        {formatDuration(run.startTime, run.endTime)}
                      </TableCell>
                      <TableCell>
                        <OwnerDisplay
                          ownerId={run.ownerId}
                          users={ownersQuery.data}
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="small"
                          appearance="subtle"
                          icon={<Open16Regular />}
                          onClick={() =>
                            navigate(
                              `/agents/${agentId}/runs/${encodeURIComponent(
                                run.id ?? '',
                              )}`,
                            )
                          }
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>

          <RawJson
            title="Raw test set details (for debugging)"
            data={setQuery.data}
          />
          <RawJson
            title={`Raw runs response (${setRuns.length} for this test set, for debugging)`}
            data={setRuns}
          />
        </>
      )}
    </div>
  )
}
