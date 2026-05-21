import { useMemo } from 'react'
import { useNavigate, useParams, Link as RouterLink } from 'react-router-dom'
import {
  Badge,
  Body1,
  Body2,
  Button,
  Caption1,
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
import { ChevronRight20Regular, Open16Regular } from '@fluentui/react-icons'
import {
  useTestCaseDefinitions,
  useTestRunsWithDetails,
  useTestSetDetails,
} from '../api/queries'
import { CenteredSpinner } from '../components/CenteredSpinner'
import { CopyIdButton } from '../components/CopyIdButton'
import { ErrorMessage } from '../components/ErrorMessage'
import { CaseScoreTrendChart } from '../components/CaseScoreTrendChart'
import { MetricChip } from '../components/MetricChip'
import { MetricTally } from '../components/MetricTally'
import { OpenInCpsLink } from '../components/OpenInCpsLink'
import { PartialResultsBanner } from '../components/PartialResultsBanner'
import { RawJson } from '../components/RawJson'
import { StatusPill } from '../components/StatusPill'
import { StreakIndicator } from '../components/StreakIndicator'
import { useAgentDisplayName } from '../hooks/useAgentDisplayName'
import { formatDateTime, getTestSetName } from '../lib/eval'
import { getCpsTestSetUrl } from '../lib/cpsLinks'
import {
  buildCaseTimelines,
  deriveCaseLabel,
  formatScore,
  metricLabel,
  parseMetricScore,
  resolveCaseLabel,
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
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingHorizontalXL,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
  },
  titleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    columnGap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
    rowGap: tokens.spacingVerticalS,
  },
  metricsCell: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
  },
  aiList: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
  },
  aiItem: {
    padding: tokens.spacingHorizontalM,
    borderLeft: `3px solid ${tokens.colorPaletteRedBorderActive}`,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
  },
  aiHeader: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  aiText: {
    fontStyle: 'italic',
    lineHeight: 1.5,
  },
  questionText: {
    fontSize: tokens.fontSizeBase400,
    lineHeight: 1.5,
    color: tokens.colorNeutralForeground1,
    whiteSpace: 'pre-wrap',
  },
  expectedText: {
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
    fontFamily: tokens.fontFamilyBase,
    color: tokens.colorNeutralForeground2,
    backgroundColor: tokens.colorNeutralBackground2,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    maxHeight: '320px',
    overflowY: 'auto',
  },
  keywordList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalS,
  },
  driftCaption: {
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
  hintCard: {
    marginTop: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    borderLeft: `3px solid ${tokens.colorPaletteYellowBorderActive}`,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
  },
  hintLabel: {
    color: tokens.colorNeutralForeground3,
  },
  hintText: {
    fontStyle: 'italic',
    color: tokens.colorNeutralForeground2,
  },
  transcript: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
  },
  turnRow: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXXS,
  },
  turnRoleUser: {
    alignSelf: 'flex-end',
    color: tokens.colorBrandForeground2,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    paddingRight: tokens.spacingHorizontalS,
  },
  turnRoleAgent: {
    alignSelf: 'flex-start',
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    paddingLeft: tokens.spacingHorizontalS,
  },
  bubbleUser: {
    alignSelf: 'flex-end',
    maxWidth: '75%',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorBrandBackground2,
    color: tokens.colorNeutralForeground1,
    borderRadius: tokens.borderRadiusLarge,
    borderBottomRightRadius: tokens.borderRadiusSmall,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  bubbleAgent: {
    alignSelf: 'flex-start',
    maxWidth: '75%',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
    borderRadius: tokens.borderRadiusLarge,
    borderBottomLeftRadius: tokens.borderRadiusSmall,
    lineHeight: 1.5,
    whiteSpace: 'pre-wrap',
  },
  stepList: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
  },
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase300,
  },
  stepKind: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
})

export function CaseDetailPage() {
  const styles = useStyles()
  const navigate = useNavigate()
  const { agentId, testSetId, caseId } = useParams<{
    agentId: string
    testSetId: string
    caseId: string
  }>()
  const { name: agentDisplayName } = useAgentDisplayName(agentId)

  const setQuery = useTestSetDetails(agentId, testSetId)
  const runsQuery = useTestRunsWithDetails(agentId, testSetId)
  const defsQuery = useTestCaseDefinitions(agentId)
  const definition = caseId ? defsQuery.data?.get(caseId) : undefined

  const setRuns = useMemo(
    () =>
      (runsQuery.data ?? []).filter((r) => r.testSetId === testSetId),
    [runsQuery.data, testSetId],
  )

  const timeline = useMemo(() => {
    if (!caseId) return undefined
    const map = buildCaseTimelines(setRuns)
    return map.get(caseId)
  }, [setRuns, caseId])

  const inferredLabel = useMemo(
    () => (timeline ? deriveCaseLabel(timeline) : null),
    [timeline],
  )

  const resolvedLabel = useMemo(() => {
    if (!caseId) return null
    return resolveCaseLabel(caseId, {
      inferredLabel,
      definitions: defsQuery.data,
    })
  }, [caseId, inferredLabel, defsQuery.data])

  const caseLabel = resolvedLabel?.source !== 'guid'
    ? resolvedLabel?.label ?? null
    : null

  // For the timeline table we want newest-first.
  const appearancesDesc = useMemo(() => {
    if (!timeline) return []
    return [...timeline.appearances].sort(
      (a, b) =>
        new Date(b.runStartTime).getTime() -
        new Date(a.runStartTime).getTime(),
    )
  }, [timeline])

  const aiAcrossRuns = useMemo(() => {
    if (!timeline) return []
    const out: {
      runStartTime: string
      runId: string
      runName: string | undefined
      metricType: string
      status: string
      text: string
    }[] = []
    for (const a of [...timeline.appearances].sort(
      (x, y) =>
        new Date(y.runStartTime).getTime() -
        new Date(x.runStartTime).getTime(),
    )) {
      for (const m of a.metrics) {
        const text = m.result?.aiResultReason
        if (!text) continue
        out.push({
          runStartTime: a.runStartTime,
          runId: a.runId,
          runName: a.runName,
          metricType: m.type ?? 'Unknown',
          status: m.result?.status ?? 'Unknown',
          text,
        })
      }
    }
    return out
  }, [timeline])

  // Sorting check & loading states
  if (runsQuery.isLoadingList) {
    return <CenteredSpinner label="Loading runs…" />
  }
  if (runsQuery.error) {
    return (
      <ErrorMessage title="Couldn't load runs" error={runsQuery.error} />
    )
  }

  const runsLoadedCount = runsQuery.detailsLoaded
  const runsTotalCount = runsQuery.detailsTotal

  if (!timeline) {
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
          <RouterLink
            to={`/agents/${agentId}/testsets/${encodeURIComponent(testSetId ?? '')}`}
            className={styles.crumbLink}
          >
            {getTestSetName(setQuery.data)}
          </RouterLink>
          <ChevronRight20Regular />
          <span>Case</span>
        </div>
        <div className={styles.card}>
          {runsQuery.isLoadingDetails ? (
            <Caption1>
              Loading runs ({runsLoadedCount}/{runsTotalCount})…
            </Caption1>
          ) : (
            <Body1>
              No appearances of case <code>{caseId}</code> in any of the
              runs we've loaded for this test set yet.
            </Body1>
          )}
        </div>
      </div>
    )
  }

  const latest = appearancesDesc[0]

  // CPS doesn't have a per-case page; the most useful "go look at it in CPS"
  // link is the test set's evaluation config page.
  const envId = setRuns.find((r) => r.environmentId)?.environmentId
  const cpsTestSetUrl = getCpsTestSetUrl(envId, agentId, testSetId)

  return (
    <div className={styles.root}>
      <div className={styles.crumbs}>
        <RouterLink to="/agents" className={styles.crumbLink}>
          Agents
        </RouterLink>
        <ChevronRight20Regular />
        <RouterLink to={`/agents/${agentId}`} className={styles.crumbLink}>
          {agentDisplayName || agentId}
        </RouterLink>
        <ChevronRight20Regular />
        <RouterLink
          to={`/agents/${agentId}/testsets/${encodeURIComponent(testSetId ?? '')}`}
          className={styles.crumbLink}
        >
          {getTestSetName(setQuery.data)}
        </RouterLink>
        <ChevronRight20Regular />
        <span title={caseLabel ? `Case ID: ${caseId}` : caseId}>
          {caseLabel ?? `Case ${caseId?.slice(0, 8)}…`}
        </span>
      </div>

      <div className={styles.titleRow}>
        <div>
          <Title2>{caseLabel ?? 'Test case'}</Title2>
          <div style={{ display: 'flex', alignItems: 'center', columnGap: 4 }}>
            <Caption1 className={styles.meta}>
              {caseLabel ? <>Case ID: <code>{caseId}</code></> : caseId}
            </Caption1>
            <CopyIdButton value={caseId} noun="case ID" iconOnly />
          </div>
        </div>
        <OpenInCpsLink
          url={cpsTestSetUrl}
          label="Open test set in Copilot Studio"
          tooltip="CPS doesn't have a per-case page — opens the parent test set"
          appearance="outline"
        />
      </div>

      {runsQuery.detailsErrors.length > 0 ? (
        <PartialResultsBanner
          failures={runsQuery.detailsErrors}
          totalRuns={runsQuery.detailsTotal}
        />
      ) : null}

      {definition?.kind === 'MultiTurnEvaluationCase' &&
      definition.turns &&
      definition.turns.length > 0 ? (
        <div className={styles.card}>
          <div className={styles.titleRow}>
            <Subtitle1>Conversation script</Subtitle1>
            <div style={{ display: 'flex', gap: tokens.spacingHorizontalS }}>
              <Badge appearance="tint" color="severe">
                Multi-turn
              </Badge>
              <Badge appearance="tint" color="brand">
                From Dataverse
              </Badge>
            </div>
          </div>
          <Caption1 className={styles.driftCaption}>
            Scripted user↔agent transcript the test set drives. Each user
            turn is sent in sequence; graders score the agent&apos;s actual
            replies against the scripted agent turns shown here.
          </Caption1>
          <div className={styles.transcript}>
            {definition.turns.map((t, i) => (
              <div className={styles.turnRow} key={i}>
                <span
                  className={
                    t.role === 'user'
                      ? styles.turnRoleUser
                      : styles.turnRoleAgent
                  }
                >
                  {t.role === 'user' ? 'User' : 'Agent (scripted)'}
                </span>
                <div
                  className={
                    t.role === 'user' ? styles.bubbleUser : styles.bubbleAgent
                  }
                >
                  {t.text}
                </div>
              </div>
            ))}
          </div>
          <Caption1 className={styles.driftCaption}>
            Reflects the current Dataverse definition. If the script was
            edited after older runs ran, those runs may have been scored
            against different wording.
          </Caption1>
        </div>
      ) : definition?.input ? (
        <div className={styles.card}>
          <div className={styles.titleRow}>
            <Subtitle1>Question (sent to the agent)</Subtitle1>
            <Badge appearance="tint" color="brand">
              From Dataverse
            </Badge>
          </div>
          <Body1 as="p" className={styles.questionText}>
            “{definition.input}”
          </Body1>
          <Caption1 className={styles.driftCaption}>
            Reflects the current Dataverse definition. If the question was
            edited after older runs ran, those runs may have been scored
            against different wording.
          </Caption1>
        </div>
      ) : resolvedLabel?.source === 'guid' ? (
        <div className={styles.card}>
          <div className={styles.titleRow}>
            <Subtitle1>Question text not available</Subtitle1>
            <Badge appearance="tint" color="warning">
              Not in live test set
            </Badge>
          </div>
          <Body1 as="p">
            This case appears in {appearancesDesc.length} historical run
            {appearancesDesc.length === 1 ? '' : 's'} but is no longer in the
            live Dataverse test set. It may have been deleted, renamed, or
            replaced with a new case.
          </Body1>
          <Caption1 className={styles.driftCaption}>
            Copilot Studio doesn&apos;t expose the original input text on
            historical results, so we can&apos;t recover the question that was
            actually asked. Open the test set in Copilot Studio to see the
            current case list.
          </Caption1>
          {resolvedLabel.hint ? (
            <div className={styles.hintCard}>
              <Caption1 className={styles.hintLabel}>
                Historical reference (extracted from grader text — may
                describe the answer rather than the question, treat as
                approximate):
              </Caption1>
              <Body2 className={styles.hintText}>
                “{resolvedLabel.hint}”
              </Body2>
            </div>
          ) : null}
        </div>
      ) : null}

      {definition?.expectedOutput ? (
        <div className={styles.card}>
          <Subtitle1>Expected response</Subtitle1>
          <pre className={styles.expectedText}>{definition.expectedOutput}</pre>
        </div>
      ) : null}

      {definition?.expectedExecutionSteps &&
      definition.expectedExecutionSteps.length > 0 ? (
        <div className={styles.card}>
          <Subtitle1>
            Expected execution steps (
            {definition.expectedExecutionSteps.length})
          </Subtitle1>
          <Caption1>
            Scored by Topic Routing / Tool Call graders. The agent is
            expected to fire these in order during the test
            {definition.kind === 'MultiTurnEvaluationCase'
              ? ' conversation.'
              : ' turn.'}
          </Caption1>
          <div className={styles.stepList}>
            {definition.expectedExecutionSteps.map((s, i) => (
              <div className={styles.stepRow} key={i}>
                <Badge appearance="outline" color="informative">
                  {i + 1}
                </Badge>
                <span>{s.schemaName ?? '(no schemaName)'}</span>
                <span className={styles.stepKind}>{s.kind}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {definition && definition.expectedKeywords.length > 0 ? (
        <div className={styles.card}>
          <Subtitle1>
            Expected keywords ({definition.expectedKeywords.length})
          </Subtitle1>
          <Caption1>
            Used by Keyword-match graders.{' '}
            {definition.kind === 'MultiTurnEvaluationCase'
              ? "For conversational cases, the keywords are scored against the agent's final response in the conversation."
              : "The agent's response must contain these terms."}
          </Caption1>
          <div className={styles.keywordList}>
            {definition.expectedKeywords.map((k, i) => (
              <Badge
                key={`${k}-${i}`}
                appearance="outline"
                color="informative"
              >
                {k}
              </Badge>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.card}>
        <Subtitle1>Streak</Subtitle1>
        <StreakIndicator timeline={timeline} />
        {latest ? (
          <Caption1>
            Latest appearance: {formatDateTime(latest.runStartTime)} ·{' '}
            {latest.runName ?? latest.runId}
          </Caption1>
        ) : null}
      </div>

      <div className={styles.card}>
        <Subtitle1>Numeric score history</Subtitle1>
        <Caption1>
          Per-run score on Compare meaning / Text similarity for this case.
        </Caption1>
        <CaseScoreTrendChart timeline={timeline} />
      </div>

      <div className={styles.card}>
        <Subtitle1>Run history ({appearancesDesc.length})</Subtitle1>
        <Table aria-label="Case run history" size="small">
          <TableHeader>
            <TableRow>
              <TableHeaderCell>Run</TableHeaderCell>
              <TableHeaderCell>Status</TableHeaderCell>
              <TableHeaderCell>Tally</TableHeaderCell>
              <TableHeaderCell>Metrics</TableHeaderCell>
              <TableHeaderCell />
            </TableRow>
          </TableHeader>
          <TableBody>
            {appearancesDesc.map((a) => (
              <TableRow key={a.runId}>
                <TableCell>
                  <Subtitle2>
                    {formatDateTime(a.runStartTime)}
                  </Subtitle2>
                  <Caption1 className={styles.meta}>
                    {a.runName ?? a.runId}
                  </Caption1>
                </TableCell>
                <TableCell>
                  <StatusPill status={a.status} />
                </TableCell>
                <TableCell>
                  <MetricTally metrics={a.metrics} />
                </TableCell>
                <TableCell>
                  <div className={styles.metricsCell}>
                    {a.metrics.map((m, idx) => {
                      const score = parseMetricScore(m)
                      const detail =
                        score !== null
                          ? formatScore(score)
                          : (m.result?.status ?? '—')
                      return (
                        <MetricChip
                          key={`${a.runId}-${m.type}-${idx}`}
                          type={m.type ?? 'Unknown'}
                          status={m.result?.status}
                          detail={detail}
                          tooltip={
                            m.result?.errorReason ||
                            m.result?.aiResultReason ||
                            undefined
                          }
                        />
                      )
                    })}
                  </div>
                </TableCell>
                <TableCell>
                  <Button
                    size="small"
                    appearance="subtle"
                    icon={<Open16Regular />}
                    onClick={() =>
                      navigate(
                        `/agents/${agentId}/runs/${encodeURIComponent(a.runId)}`,
                      )
                    }
                  >
                    Run
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {aiAcrossRuns.length > 0 ? (
        <div className={styles.card}>
          <Subtitle1>AI explanations across runs</Subtitle1>
          <Caption1>
            From <code>aiResultReason</code> on metrics that scored this
            case. Newest first.
          </Caption1>
          <div className={styles.aiList}>
            {aiAcrossRuns.map((r, i) => (
              <div key={i} className={styles.aiItem}>
                <div className={styles.aiHeader}>
                  <MetricChip
                    type={r.metricType}
                    status={r.status}
                    small
                  />
                  <span>{formatDateTime(r.runStartTime)}</span>
                  <span>· {metricLabel(r.metricType)}</span>
                </div>
                <Body2 className={styles.aiText}>“{r.text}”</Body2>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <RawJson
        title={`Raw appearances for case ${caseId?.slice(0, 8)}… (${
          timeline.appearances.length
        }, for debugging)`}
        data={timeline}
      />
    </div>
  )
}
