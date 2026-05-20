import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Badge,
  Caption1,
  Subtitle1,
  Subtitle2,
  Tooltip,
  makeStyles,
  shorthands,
  tokens,
} from '@fluentui/react-components'
import {
  ArrowSwap20Regular,
  ChevronDown16Regular,
  ChevronRight16Regular,
  ErrorCircle20Filled,
} from '@fluentui/react-icons'
import type { TestRun } from '../generated/models/MicrosoftCopilotStudioModel'
import {
  buildMetricLeaderboards,
  formatPercent,
  type CaseDefinitionsMap,
  type MetricAffectedCase,
  type MetricStanding,
} from '../lib/metrics'

const useStyles = makeStyles({
  root: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  card: {
    backgroundColor: tokens.colorNeutralBackground2,
    padding: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
    minHeight: '180px',
  },
  cardHeader: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
  },
  cardHint: {
    color: tokens.colorNeutralForeground3,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
  },
  row: {
    display: 'flex',
    flexDirection: 'column',
    paddingBlock: tokens.spacingVerticalXS,
    paddingInline: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusSmall,
    ...shorthands.border('1px', 'solid', 'transparent'),
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
      borderTopColor: tokens.colorNeutralStroke2,
      borderRightColor: tokens.colorNeutralStroke2,
      borderBottomColor: tokens.colorNeutralStroke2,
      borderLeftColor: tokens.colorNeutralStroke2,
    },
  },
  rowHeader: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
  },
  metricSwatch: {
    display: 'inline-block',
    width: '10px',
    height: '10px',
    borderRadius: tokens.borderRadiusCircular,
    flexShrink: 0,
  },
  metricName: {
    fontSize: tokens.fontSizeBase300,
    flexGrow: 1,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  metricStat: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    flexShrink: 0,
  },
  rowDetail: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
    paddingLeft: '18px',
  },
  drillList: {
    listStyle: 'none',
    margin: 0,
    paddingLeft: '24px',
    paddingTop: tokens.spacingVerticalXS,
    display: 'flex',
    flexDirection: 'column',
    rowGap: '2px',
  },
  drillItem: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    fontSize: tokens.fontSizeBase200,
  },
  drillLabel: {
    color: tokens.colorBrandForegroundLink,
    cursor: 'pointer',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flexGrow: 1,
    minWidth: 0,
    background: 'transparent',
    border: 'none',
    padding: 0,
    textAlign: 'left',
    ':hover': {
      textDecoration: 'underline',
    },
  },
  drillLabelFallback: {
    fontFamily: tokens.fontFamilyMonospace,
    fontStyle: 'italic',
    color: tokens.colorNeutralForeground3,
  },
  drillCount: {
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase100,
    flexShrink: 0,
  },
  empty: {
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
  badge: {
    flexShrink: 0,
  },
  sectionHeader: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
  },
})

function passRateBadgeColor(rate: number | null): 'severe' | 'warning' | 'success' {
  if (rate === null) return 'warning'
  if (rate < 0.5) return 'severe'
  if (rate < 0.85) return 'warning'
  return 'success'
}

function flakeBadgeColor(score: number): 'severe' | 'warning' | 'success' {
  if (score >= 0.25) return 'severe'
  if (score >= 0.1) return 'warning'
  return 'success'
}

interface BoardProps {
  title: string
  hint: string
  icon: React.ReactNode
  entries: MetricStanding[]
  emptyHint: string
  renderStat: (m: MetricStanding) => React.ReactNode
  onPickCase: (caseId: string) => void
}

function Board({
  title,
  hint,
  icon,
  entries,
  emptyHint,
  renderStat,
  onPickCase,
}: BoardProps) {
  const styles = useStyles()
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  const toggle = (type: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  return (
    <div className={styles.card}>
      <div className={styles.sectionHeader}>
        <div className={styles.cardHeader}>
          {icon}
          <Subtitle2>{title}</Subtitle2>
        </div>
        <Caption1 className={styles.cardHint}>{hint}</Caption1>
      </div>
      {entries.length === 0 ? (
        <Caption1 className={styles.empty}>{emptyHint}</Caption1>
      ) : (
        <div className={styles.list}>
          {entries.map((m) => {
            const isOpen = expanded.has(m.type)
            return (
              <div key={m.type}>
                <button
                  type="button"
                  className={styles.row}
                  onClick={() => toggle(m.type)}
                  aria-expanded={isOpen}
                  title={
                    isOpen
                      ? 'Hide affected cases'
                      : 'Show cases most affected by this metric'
                  }
                >
                  <div className={styles.rowHeader}>
                    {isOpen ? (
                      <ChevronDown16Regular />
                    ) : (
                      <ChevronRight16Regular />
                    )}
                    <span
                      className={styles.metricSwatch}
                      style={{ backgroundColor: m.color }}
                      aria-hidden
                    />
                    <span className={styles.metricName}>{m.label}</span>
                    {renderStat(m)}
                  </div>
                  <div className={styles.rowDetail}>
                    {m.pass}/{m.total} passed · {m.affectedCaseCount} case
                    {m.affectedCaseCount === 1 ? '' : 's'} affected ·{' '}
                    {m.affectedRunCount} run
                    {m.affectedRunCount === 1 ? '' : 's'} with failures
                  </div>
                </button>
                {isOpen ? (
                  <DrillList
                    cases={m.topAffectedCases}
                    onPickCase={onPickCase}
                  />
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DrillList({
  cases,
  onPickCase,
}: {
  cases: MetricAffectedCase[]
  onPickCase: (caseId: string) => void
}) {
  const styles = useStyles()
  if (cases.length === 0) {
    return (
      <ul className={styles.drillList}>
        <li>
          <Caption1 className={styles.empty}>
            No cases have failed on this metric.
          </Caption1>
        </li>
      </ul>
    )
  }
  return (
    <ul className={styles.drillList}>
      {cases.map((c) => (
        <li key={c.caseId} className={styles.drillItem}>
          <button
            type="button"
            className={`${styles.drillLabel} ${
              c.caseLabel ? '' : styles.drillLabelFallback
            }`}
            onClick={() => onPickCase(c.caseId)}
            title={`Case ID: ${c.caseId} — open history`}
          >
            {c.caseLabel ?? `case ${c.caseId.slice(0, 8)}…`}
          </button>
          <span className={styles.drillCount}>
            {c.failCount}/{c.totalCount} fail
          </span>
        </li>
      ))}
    </ul>
  )
}

export interface MetricLeaderboardsProps {
  runs: TestRun[]
  agentId: string | undefined
  testSetId: string | undefined
  /** Optional Dataverse-sourced case definitions for real labels in the drill-down. */
  definitions?: CaseDefinitionsMap
}

/**
 * Per-grader (metric type) leaderboards. Surfaces graders that may be
 * the actual source of red, rather than the cases themselves —
 * complements `CaseLeaderboards`, which slices the same data by case.
 *
 * Two cards:
 * - **Hardest graders** — lowest aggregate pass rate (sorted ascending).
 *   Reveals graders that are consistently red across many cases.
 * - **Flakiest graders** — biggest swing in per-run pass rate (sorted
 *   by stddev descending). Reveals graders whose results are unstable.
 *
 * Click any metric row to drill into the specific cases most affected
 * by it. Click a case to jump to its detail page.
 */
export function MetricLeaderboards({
  runs,
  agentId,
  testSetId,
  definitions,
}: MetricLeaderboardsProps) {
  const navigate = useNavigate()
  const styles = useStyles()
  const data = useMemo(
    () => buildMetricLeaderboards(runs, undefined, definitions),
    [runs, definitions],
  )

  const goToCase = (caseId: string) => {
    if (!agentId || !testSetId) return
    navigate(
      `/agents/${agentId}/testsets/${encodeURIComponent(
        testSetId,
      )}/cases/${encodeURIComponent(caseId)}`,
    )
  }

  // If there are zero metric stats at all, render nothing — the page is
  // probably still loading or the test set hasn't run yet.
  if (data.all.length === 0) {
    return (
      <Caption1 className={styles.empty}>
        No metric results yet — once at least one run is in, hardest and
        flakiest graders will be ranked here.
      </Caption1>
    )
  }

  return (
    <div className={styles.root}>
      <Board
        title="Hardest graders"
        hint="Lowest pass rate across every (case × run). A consistently low score here often means the grader is too strict — not necessarily that the agent is broken."
        icon={
          <ErrorCircle20Filled
            style={{ color: tokens.colorPaletteRedForeground1 }}
          />
        }
        entries={data.hardest}
        emptyHint="No metric scored yet — need at least one run."
        onPickCase={goToCase}
        renderStat={(m) => (
          <Badge
            className={styles.badge}
            appearance="tint"
            color={passRateBadgeColor(m.passRate)}
            title={`${m.pass} passed of ${m.total} scored appearances`}
          >
            {formatPercent(m.passRate)} pass
          </Badge>
        )}
      />
      <Board
        title="Flakiest graders"
        hint="Biggest swing in per-run pass rate. A high score here means the grader's output is inconsistent across runs — even when the agent likely didn't change."
        icon={
          <ArrowSwap20Regular
            style={{ color: tokens.colorPaletteYellowForeground1 }}
          />
        }
        entries={data.flakiest}
        emptyHint="No flakiness detected — graders are stable across runs."
        onPickCase={goToCase}
        renderStat={(m) => (
          <Tooltip
            relationship="label"
            content={`Standard deviation of per-run pass rate: ${m.flakeScore.toFixed(
              2,
            )} (higher = more unstable)`}
          >
            <Badge
              className={styles.badge}
              appearance="tint"
              color={flakeBadgeColor(m.flakeScore)}
            >
              ±{(m.flakeScore * 100).toFixed(0)} pp
            </Badge>
          </Tooltip>
        )}
      />
    </div>
  )
}

/** Wrapper that renders the heading alongside the boards. */
export function MetricLeaderboardsSection(props: MetricLeaderboardsProps) {
  const styles = useStyles()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', rowGap: tokens.spacingVerticalM }}>
      <div className={styles.sectionHeader}>
        <Subtitle1>Grader leaderboards</Subtitle1>
        <Caption1 className={styles.cardHint}>
          Two cases failing on the same grader? The grader may be the real
          culprit. These boards slice your evaluation history by metric type
          so you can spot brittle or unstable graders. Click a metric to see
          which cases it most often flunks.
        </Caption1>
      </div>
      <MetricLeaderboards {...props} />
    </div>
  )
}
