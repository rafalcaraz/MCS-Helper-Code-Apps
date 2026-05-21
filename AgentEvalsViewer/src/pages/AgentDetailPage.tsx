import { useMemo, useState } from 'react'
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom'
import {
  Badge,
  Body1,
  Caption1,
  Card,
  CardHeader,
  Subtitle1,
  Title2,
  makeStyles,
  shorthands,
  tokens,
} from '@fluentui/react-components'
import { ChevronRight20Regular } from '@fluentui/react-icons'
import { useTestRunsWithDetails, useTestSets, useSystemUsers } from '../api/queries'
import { AgentLandingKpiStrip } from '../components/AgentLandingKpiStrip'
import { AgentTrendChart } from '../components/AgentTrendChart'
import { CenteredSpinner } from '../components/CenteredSpinner'
import { ErrorMessage } from '../components/ErrorMessage'
import { MetricChipStack } from '../components/MetricChipStack'
import { PartialResultsBanner } from '../components/PartialResultsBanner'
import { PassRateSparkline } from '../components/PassRateTrendChart'
import { RetentionBanner } from '../components/RetentionBanner'
import { useAgentSnapshots } from '../hooks/useAgentSnapshots'
import { snapshotsToChartMarkers } from '../lib/snapshotChartMarkers'
import { CopyIdButton } from '../components/CopyIdButton'
import { SnapshotStalenessBanner } from '../components/SnapshotStalenessBanner'
import { StalenessChip } from '../components/StalenessChip'
import {
  StaleTestSetsBanner,
  type StaleTestSetEntry,
} from '../components/StaleTestSetsBanner'
import { computeRunCadence, type RunCadence } from '../lib/cadence'
import {
  compareRunsByStartTimeDesc,
  formatDateTime,
  getTestSetName,
} from '../lib/eval'
import {
  computeAgentLandingInsight,
  summarizeAgentActivity,
  summarizeAgentHealth,
  type AgentLandingCardInsight,
} from '../lib/metrics'
import { useAllLastViewedRuns, getMarkerRunIdFor } from '../hooks/useLastViewedRun'
import { useAgentDisplayName } from '../hooks/useAgentDisplayName'
import type { TestRun, TestSet } from '../generated/models/MicrosoftCopilotStudioModel'

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
  agentMeta: {
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalS,
  },
  snapshotLink: {
    color: tokens.colorBrandForegroundLink,
    textDecorationLine: 'none',
    fontSize: tokens.fontSizeBase300,
    ...shorthands.padding(tokens.spacingVerticalS, tokens.spacingHorizontalM),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border('1px', 'solid', tokens.colorBrandStroke2),
    backgroundColor: tokens.colorBrandBackground2,
    ':hover': {
      backgroundColor: tokens.colorBrandBackground2Hover,
      textDecorationLine: 'none',
    },
  },
  empty: {
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingHorizontalXL,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
  },
  list: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  card: {
    cursor: 'pointer',
    position: 'relative',
    ...shorthands.padding(tokens.spacingHorizontalL),
    transitionProperty: 'box-shadow, transform',
    transitionDuration: '120ms',
    ':hover': {
      boxShadow: tokens.shadow16,
    },
  },
  cardChevron: {
    position: 'absolute',
    top: tokens.spacingVerticalM,
    right: tokens.spacingHorizontalM,
    color: tokens.colorNeutralForeground3,
    pointerEvents: 'none',
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
  },
  cardTitle: {
    fontWeight: tokens.fontWeightSemibold,
  },
  cardSubtitle: {
    color: tokens.colorNeutralForeground3,
  },
  insightRow: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    rowGap: tokens.spacingVerticalXXS,
  },
  insightDetail: {
    color: tokens.colorNeutralForeground3,
  },
  sparkRow: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
  },
  sparkCaption: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  sparkEmpty: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    fontStyle: 'italic',
  },
  bannerRow: {
    display: 'flex',
    justifyContent: 'flex-end',
  },
  trendCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
  },
  trendHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalXS,
  },
})

function severityToBadgeColor(
  s: AgentLandingCardInsight['severity'],
): 'success' | 'warning' | 'danger' | 'informative' | 'subtle' {
  switch (s) {
    case 'success':
      return 'success'
    case 'warning':
      return 'warning'
    case 'danger':
      return 'danger'
    case 'info':
      return 'informative'
    case 'subtle':
    default:
      return 'subtle'
  }
}

interface CardModel {
  ts: TestSet
  setRuns: TestRun[]
  latest: TestRun | undefined
  insight: AgentLandingCardInsight
  cadence: RunCadence | null
}

export function AgentDetailPage() {
  const styles = useStyles()
  const navigate = useNavigate()
  const { agentId } = useParams<{ agentId: string }>()
  const { name: agentDisplayName, resolved: agentNameResolved } =
    useAgentDisplayName(agentId)

  const testSetsQuery = useTestSets(agentId)
  const runsQuery = useTestRunsWithDetails(agentId)
  const markers = useAllLastViewedRuns()

  // Freeze "now" once per page mount so insights don't drift on every render
  // (also satisfies React 19 useMemo purity rules).
  const [now] = useState(() => Date.now())

  const cards = useMemo<CardModel[]>(() => {
    const sets = testSetsQuery.data ?? []
    const allRuns = runsQuery.data ?? []
    const built = sets.map<CardModel>((ts) => {
      const setRuns = allRuns.filter((r) => r.testSetId === ts.id)
      const latest = [...setRuns].sort(compareRunsByStartTimeDesc)[0]
      const markerRunId = getMarkerRunIdFor(markers, agentId, ts.id)
      const insight = computeAgentLandingInsight(setRuns, markerRunId, { now })
      const cadence = computeRunCadence(setRuns, { now })
      return { ts, setRuns, latest, insight, cadence }
    })
    built.sort((a, b) => {
      const aStale = a.cadence?.isStale ? 1 : 0
      const bStale = b.cadence?.isStale ? 1 : 0
      if (aStale !== bStale) return bStale - aStale
      if (b.insight.priority !== a.insight.priority) {
        return b.insight.priority - a.insight.priority
      }
      if (b.insight.runsSinceMarker !== a.insight.runsSinceMarker) {
        return b.insight.runsSinceMarker - a.insight.runsSinceMarker
      }
      const at = a.latest?.startTime ? new Date(a.latest.startTime).getTime() : 0
      const bt = b.latest?.startTime ? new Date(b.latest.startTime).getTime() : 0
      return bt - at
    })
    return built
  }, [testSetsQuery.data, runsQuery.data, markers, agentId, now])

  const staleEntries = useMemo<StaleTestSetEntry[]>(
    () =>
      cards
        .filter((c): c is CardModel & { cadence: RunCadence } =>
          Boolean(c.cadence?.isStale),
        )
        .map((c) => ({ testSet: c.ts, cadence: c.cadence })),
    [cards],
  )

  const allRuns = useMemo(() => runsQuery.data ?? [], [runsQuery.data])

  const { snapshots } = useAgentSnapshots(agentId ?? '')
  const snapshotMarkers = useMemo(
    () => snapshotsToChartMarkers(snapshots),
    [snapshots],
  )

  const activity = useMemo(
    () => summarizeAgentActivity(allRuns, { now }),
    [allRuns, now],
  )

  const ownersQuery = useSystemUsers(activity.distinctOwnerIds)

  const health = useMemo(
    () =>
      summarizeAgentHealth(
        cards.map(({ insight, latest }) => ({ insight, latest })),
      ),
    [cards],
  )

  const showHealthStrip = cards.length > 0 && health.totalSets > 0
  const showAgentTrend = allRuns.length >= 2

  return (
    <div className={styles.root}>
      <div className={styles.crumbs}>
        <RouterLink to="/agents" className={styles.crumbLink}>
          Agents
        </RouterLink>
        <ChevronRight20Regular />
        <span>{agentDisplayName || agentId}</span>
      </div>
      <div className={styles.titleRow}>
        <div>
          <Title2>{agentNameResolved ? agentDisplayName : 'Agent'}</Title2>
          <div style={{ display: 'flex', alignItems: 'center', columnGap: 4 }}>
            <Caption1 className={styles.agentMeta}>{agentId}</Caption1>
            <CopyIdButton value={agentId} noun="agent ID" iconOnly />
          </div>
        </div>
        <RouterLink
          to={`/agents/${agentId}/snapshot`}
          className={styles.snapshotLink}
        >
          📸 Design snapshot
          {snapshots.length > 0 ? ` (${snapshots.length})` : ''}
        </RouterLink>
      </div>

      <div className={styles.bannerRow}>
        <RetentionBanner />
      </div>

      {snapshots.length > 0 ? (
        <SnapshotStalenessBanner
          agentId={agentId ?? ''}
          snapshots={snapshots}
          runs={allRuns}
        />
      ) : null}

      <StaleTestSetsBanner
        agentId={agentId ?? ''}
        staleEntries={staleEntries}
      />

      {showHealthStrip ? (
        <AgentLandingKpiStrip
          health={health}
          activity={activity}
          owners={ownersQuery.data}
          now={now}
        />
      ) : null}

      {showAgentTrend ? (
        <div className={styles.trendCard}>
          <div className={styles.trendHeader}>
            <Subtitle1>Agent-wide pass-rate trend</Subtitle1>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
              All test sets · last 89 days
            </Caption1>
          </div>
          <AgentTrendChart
            runs={allRuns}
            snapshotMarkers={snapshotMarkers}
            agentId={agentId}
          />
        </div>
      ) : null}

      <Subtitle1>Test sets</Subtitle1>

      {runsQuery.detailsErrors.length > 0 ? (
        <PartialResultsBanner
          failures={runsQuery.detailsErrors}
          totalRuns={runsQuery.detailsTotal}
        />
      ) : null}

      {testSetsQuery.isLoading || runsQuery.isLoadingList ? (
        <CenteredSpinner label="Loading test sets…" />
      ) : testSetsQuery.error ? (
        <ErrorMessage
          title="Couldn't load test sets"
          error={testSetsQuery.error}
        />
      ) : runsQuery.error ? (
        <ErrorMessage
          title="Couldn't load test runs"
          error={runsQuery.error}
        />
      ) : cards.length === 0 ? (
        <div className={styles.empty}>
          <Subtitle1>No test sets yet</Subtitle1>
          <Body1 as="p">
            Create a test set in Copilot Studio's Evaluation page for this
            agent. New test sets and runs will appear here.
          </Body1>
        </div>
      ) : (
        <div className={styles.list}>
          {cards.map(({ ts, setRuns, latest, insight, cadence }) => {
            const subtitle =
              `${ts.totalTestCases ?? '—'} test case${ts.totalTestCases === 1 ? '' : 's'} · ` +
              `${setRuns.length} run${setRuns.length === 1 ? '' : 's'}` +
              (latest
                ? ` · last run ${formatDateTime(latest.startTime)}`
                : '')
            return (
              <Card
                key={ts.id}
                className={styles.card}
                onClick={() =>
                  navigate(
                    `/agents/${agentId}/testsets/${encodeURIComponent(
                      ts.id ?? '',
                    )}`,
                  )
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    navigate(
                      `/agents/${agentId}/testsets/${encodeURIComponent(
                        ts.id ?? '',
                      )}`,
                    )
                  }
                }}
                tabIndex={0}
                role="button"
              >
                <ChevronRight20Regular className={styles.cardChevron} />
                <CardHeader
                  header={
                    <span className={styles.cardTitle}>
                      {getTestSetName(ts)}
                    </span>
                  }
                  description={
                    <Caption1 className={styles.cardSubtitle}>
                      {subtitle}
                    </Caption1>
                  }
                />
                <div className={styles.cardBody}>
                  {latest ? (
                    <MetricChipStack run={latest} />
                  ) : (
                    <Caption1>No runs yet</Caption1>
                  )}
                  {cadence?.isStale ? (
                    <div className={styles.insightRow}>
                      <StalenessChip cadence={cadence} />
                    </div>
                  ) : null}
                  {insight.kind !== 'no-runs' &&
                  insight.kind !== 'first-run' &&
                  insight.kind !== 'mixed' ? (
                    <div className={styles.insightRow}>
                      <Badge
                        appearance="filled"
                        color={severityToBadgeColor(insight.severity)}
                        title={insight.detail}
                      >
                        {insight.label}
                      </Badge>
                      <Caption1 className={styles.insightDetail}>
                        {insight.detail}
                      </Caption1>
                    </div>
                  ) : insight.kind === 'mixed' ? (
                    <Caption1 className={styles.insightDetail}>
                      {insight.detail}
                    </Caption1>
                  ) : null}
                  {setRuns.length >= 2 ? (
                    <div className={styles.sparkRow}>
                      <PassRateSparkline runs={setRuns} />
                      <span className={styles.sparkCaption}>
                        strict pass-rate trend ({setRuns.length} runs)
                      </span>
                    </div>
                  ) : setRuns.length === 1 ? (
                    <span className={styles.sparkEmpty}>
                      Run more evaluations to see a trend.
                    </span>
                  ) : null}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
