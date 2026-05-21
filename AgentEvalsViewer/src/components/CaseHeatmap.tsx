import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Caption1,
  Checkbox,
  ToggleButton,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import type { TestRun } from '../generated/models/MicrosoftCopilotStudioModel'
import {
  analyzeCaseStreak,
  buildCaseHeatmap,
  collectMetricTypes,
  metricColor,
  metricLabel,
  type CaseDefinitionsMap,
  type CaseStreak,
  type CaseTimeline,
  type HeatmapCell,
  type HeatmapRow,
} from '../lib/metrics'
import { formatDateTime } from '../lib/eval'
import { statusColor, type CaseStatus } from '../lib/eval'

const CELL_SIZE = 14
const CELL_GAP = 3
const ROW_LABEL_WIDTH = 280

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
  },
  legend: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
    rowGap: tokens.spacingVerticalXS,
  },
  swatch: {
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  swatchSquare: {
    width: '12px',
    height: '12px',
    borderRadius: '2px',
    border: `1px solid ${tokens.colorNeutralStroke3}`,
  },
  scrollWrap: {
    overflowX: 'auto',
    overflowY: 'hidden',
    paddingBottom: tokens.spacingVerticalS,
  },
  table: {
    display: 'inline-block',
    minWidth: '100%',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    columnGap: `${CELL_GAP}px`,
    paddingTop: '1px',
    paddingBottom: '1px',
  },
  label: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    width: `${ROW_LABEL_WIDTH}px`,
    minWidth: `${ROW_LABEL_WIDTH}px`,
    paddingRight: tokens.spacingHorizontalS,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorBrandForegroundLink,
    background: 'transparent',
    border: 'none',
    textAlign: 'left',
    cursor: 'pointer',
    overflow: 'hidden',
    ':hover': {
      textDecoration: 'underline',
    },
  },
  labelText: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
    minWidth: 0,
  },
  labelGuid: {
    fontFamily: tokens.fontFamilyMonospace,
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
  conversationBadge: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorBrandForeground1,
    background: tokens.colorBrandBackground2,
    borderRadius: tokens.borderRadiusSmall,
    paddingLeft: '4px',
    paddingRight: '4px',
    paddingTop: '1px',
    paddingBottom: '1px',
    flexShrink: 0,
    marginRight: '4px',
  },
  passPill: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground2,
    background: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusSmall,
    paddingLeft: '4px',
    paddingRight: '4px',
    paddingTop: '1px',
    paddingBottom: '1px',
    flexShrink: 0,
  },
  streakChip: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
    borderRadius: tokens.borderRadiusSmall,
    paddingLeft: '4px',
    paddingRight: '4px',
    paddingTop: '1px',
    paddingBottom: '1px',
    flexShrink: 0,
    color: tokens.colorNeutralForegroundStaticInverted,
  },
  recentDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: tokens.borderRadiusCircular,
    flexShrink: 0,
  },
  cell: {
    width: `${CELL_SIZE}px`,
    height: `${CELL_SIZE}px`,
    borderRadius: '2px',
    flexShrink: 0,
    cursor: 'pointer',
    borderTopWidth: '1px',
    borderRightWidth: '1px',
    borderBottomWidth: '1px',
    borderLeftWidth: '1px',
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
    ':hover': {
      borderTopColor: tokens.colorNeutralStrokeAccessible,
      borderRightColor: tokens.colorNeutralStrokeAccessible,
      borderBottomColor: tokens.colorNeutralStrokeAccessible,
      borderLeftColor: tokens.colorNeutralStrokeAccessible,
      transform: 'scale(1.15)',
    },
  },
  tooltipBody: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: '2px',
    maxWidth: '320px',
  },
  tooltipTitle: {
    fontWeight: tokens.fontWeightSemibold,
  },
  tooltipMeta: {
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase100,
  },
  empty: {
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
  toolbar: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalXS,
    padding: `${tokens.spacingVerticalXS} 0`,
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
    marginBottom: tokens.spacingVerticalXS,
  },
  toolbarGroup: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    rowGap: tokens.spacingVerticalXXS,
  },
  toolbarLabel: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    marginRight: tokens.spacingHorizontalXXS,
  },
  excludeChip: {
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: '4px',
    padding: `2px ${tokens.spacingHorizontalXS}`,
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    fontSize: tokens.fontSizeBase200,
    cursor: 'pointer',
    backgroundColor: tokens.colorNeutralBackground1,
    userSelect: 'none',
  },
  swatchDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
})

const LEGEND_STATUSES: CaseStatus[] = [
  'Pass',
  'Fail',
  'Error',
  'Invalid',
  'Unknown',
]

function cellColor(cell: HeatmapCell): string {
  if (!cell.present) return tokens.colorNeutralBackground3
  return statusColor(cell.status)
}

function summarizeRow(row: HeatmapRow): {
  passes: number
  appearances: number
  passRate: number | null
} {
  let passes = 0
  let appearances = 0
  for (const c of row.cells) {
    if (!c.present) continue
    appearances++
    if (c.status === 'Pass') passes++
  }
  return {
    passes,
    appearances,
    passRate: appearances > 0 ? passes / appearances : null,
  }
}

/**
 * Synthesize a minimal CaseTimeline from a heatmap row so we can reuse
 * `analyzeCaseStreak`. We only feed back the status + run id — the streak
 * analyzer doesn't read metrics, so leaving them empty is safe.
 */
function rowStreak(row: HeatmapRow, lookback = 10): CaseStreak {
  const timeline: CaseTimeline = {
    caseId: row.caseId,
    appearances: row.cells
      .filter((c) => c.present)
      .map((c) => ({
        runId: c.runId,
        runStartTime: c.runStartTime,
        runName: c.runName,
        status: c.status,
        metrics: [],
        caseState: undefined,
      })),
  }
  return analyzeCaseStreak(timeline, lookback)
}

function streakChipLabel(streak: CaseStreak): string | null {
  if (streak.kind === 'unknown' || streak.length === 0) return null
  if (streak.kind === 'passing')
    return `✓ ${streak.length}`
  if (streak.kind === 'failing')
    return `🔥 ${streak.length}`
  if (streak.kind === 'flaky') {
    const passes = Math.round((streak.recentPassRate ?? 0) * streak.recentN)
    return `≈ ${passes}/${streak.recentN}`
  }
  return null
}

function streakChipColor(streak: CaseStreak): string {
  switch (streak.kind) {
    case 'passing':
      return tokens.colorPaletteGreenForeground1
    case 'failing':
      return tokens.colorPaletteRedForeground1
    case 'flaky':
      return tokens.colorPaletteMarigoldForeground2
    default:
      return tokens.colorNeutralForeground3
  }
}

function streakChipTooltip(streak: CaseStreak): string {
  if (streak.kind === 'passing')
    return `Passing ${streak.length} run${streak.length === 1 ? '' : 's'} in a row`
  if (streak.kind === 'failing')
    return `Failing ${streak.length} run${streak.length === 1 ? '' : 's'} in a row`
  if (streak.kind === 'flaky') {
    const passes = Math.round((streak.recentPassRate ?? 0) * streak.recentN)
    return `Flaky · ${passes}/${streak.recentN} pass in the last ${streak.recentN}`
  }
  return ''
}

export interface CaseHeatmapProps {
  runs: TestRun[]
  agentId: string | undefined
  testSetId: string | undefined
  /** Optional Dataverse-sourced case definitions for real labels. */
  definitions?: CaseDefinitionsMap
}

/**
 * GitHub-contribution-graph style grid: rows = test cases (worst-recent
 * first), columns = runs (oldest → newest). Click a row label or a cell
 * to drill into that case's history.
 */
export function CaseHeatmap({
  runs,
  agentId,
  testSetId,
  definitions,
}: CaseHeatmapProps) {
  const styles = useStyles()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'strict' | 'liberal'>('strict')
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set())

  const observedMetrics = useMemo(() => collectMetricTypes(runs), [runs])

  const data = useMemo(
    () => buildCaseHeatmap(runs, definitions, { mode, excludeMetrics: excluded }),
    [runs, definitions, mode, excluded],
  )

  const toggleExcluded = (type: string) => {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const goToCase = (caseId: string) => {
    if (!agentId || !testSetId || !caseId) return
    navigate(
      `/agents/${agentId}/testsets/${encodeURIComponent(
        testSetId,
      )}/cases/${encodeURIComponent(caseId)}`,
    )
  }

  if (data.rows.length === 0 || data.columns.length === 0) {
    return (
      <Caption1 className={styles.empty}>
        Not enough data for a heatmap yet — need at least one run with
        per-case results.
      </Caption1>
    )
  }

  const unlabeledCount = data.rows.filter((r) => !r.caseLabel).length

  return (
    <div className={styles.root}>
      <div className={styles.toolbar}>
        <div className={styles.toolbarGroup}>
          <span className={styles.toolbarLabel}>Composite:</span>
          <ToggleButton
            size="small"
            appearance={mode === 'strict' ? 'primary' : 'subtle'}
            checked={mode === 'strict'}
            onClick={() => setMode('strict')}
            title="Strict: any failing metric fails the case"
          >
            Strict
          </ToggleButton>
          <ToggleButton
            size="small"
            appearance={mode === 'liberal' ? 'primary' : 'subtle'}
            checked={mode === 'liberal'}
            onClick={() => setMode('liberal')}
            title="Liberal: any passing metric passes the case"
          >
            Liberal
          </ToggleButton>
        </div>
        {observedMetrics.length > 0 ? (
          <div className={styles.toolbarGroup}>
            <span className={styles.toolbarLabel}>Metrics:</span>
            {observedMetrics.map((type) => {
              const checked = !excluded.has(type)
              return (
                <Tooltip
                  key={type}
                  content={
                    checked
                      ? `Click to exclude ${metricLabel(type)} from the rollup`
                      : `Click to include ${metricLabel(type)} in the rollup`
                  }
                  relationship="label"
                  withArrow
                >
                  <Checkbox
                    size="medium"
                    checked={checked}
                    onChange={() => toggleExcluded(type)}
                    label={
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <span
                          className={styles.swatchDot}
                          style={{ backgroundColor: metricColor(type) }}
                          aria-hidden
                        />
                        {metricLabel(type)}
                      </span>
                    }
                  />
                </Tooltip>
              )
            })}
            {excluded.size > 0 ? (
              <button
                type="button"
                className={styles.excludeChip}
                onClick={() => setExcluded(new Set())}
                title="Re-include all metrics"
              >
                Reset
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className={styles.legend}>
        {LEGEND_STATUSES.map((s) => (
          <span key={s} className={styles.swatch}>
            <span
              className={styles.swatchSquare}
              style={{ backgroundColor: statusColor(s) }}
              aria-hidden
            />
            {s}
          </span>
        ))}
        <span className={styles.swatch}>
          <span
            className={styles.swatchSquare}
            style={{ backgroundColor: tokens.colorNeutralBackground3 }}
            aria-hidden
          />
          not in run
        </span>
      </div>
      <Caption1>
        {data.rows.length} case{data.rows.length === 1 ? '' : 's'} (rows) ×{' '}
        {data.columns.length} run{data.columns.length === 1 ? '' : 's'} (columns,
        oldest&nbsp;→&nbsp;newest) · worst-recent cases on top
      </Caption1>
      {unlabeledCount > 0 ? (
        <Caption1 className={styles.empty}>
          {unlabeledCount === data.rows.length
            ? 'No question text available for any case — Dataverse didn\u0027t return rows for these cases (they may have been deleted from the live test set). Click a row to see full per-run details.'
            : `${unlabeledCount} of ${data.rows.length} case${
                data.rows.length === 1 ? '' : 's'
              } shown by GUID — Dataverse didn\u0027t return rows (case may be deleted from the live test set).`}
        </Caption1>
      ) : null}
      <div className={styles.scrollWrap}>
        <div className={styles.table}>
          {data.rows.map((row) => {
            const summary = summarizeRow(row)
            const streak = rowStreak(row)
            const chipLabel = streakChipLabel(streak)
            const fallbackSlug = `case ${row.caseId.slice(0, 8)}…`
            const labelDisplay = row.caseLabel ?? fallbackSlug
            const isFallback = !row.caseLabel
            const def = definitions?.get(row.caseId)
            const isMultiTurn = def?.kind === 'MultiTurnEvaluationCase'
            const turnCount = def?.turns?.length
            const titleAttr = row.caseLabel
              ? `${isMultiTurn ? 'Conversational test case' + (turnCount ? ` (${turnCount} turns)` : '') + '\n\n' : ''}${row.caseLabel}\n\nCase ID: ${row.caseId}`
              : `${isMultiTurn ? 'Conversational test case' + (turnCount ? ` (${turnCount} turns)` : '') + '\n\n' : ''}Case ID: ${row.caseId}`
            return (
              <div key={row.caseId} className={styles.row}>
                <button
                  type="button"
                  className={styles.label}
                  onClick={() => goToCase(row.caseId)}
                  title={titleAttr}
                >
                  <span
                    className={styles.recentDot}
                    style={{ backgroundColor: statusColor(row.recentStatus) }}
                    aria-hidden
                  />
                  {isMultiTurn ? (
                    <span
                      className={styles.conversationBadge}
                      title={
                        turnCount
                          ? `Conversational case (${turnCount} authored turns)`
                          : 'Conversational case (multi-turn)'
                      }
                      aria-label="Conversational case"
                    >
                      💬
                    </span>
                  ) : null}
                  <span
                    className={`${styles.labelText} ${
                      isFallback ? styles.labelGuid : ''
                    }`}
                  >
                    {labelDisplay}
                  </span>
                  <span className={styles.passPill}>
                    {summary.passes}/{summary.appearances}
                  </span>
                  {chipLabel ? (
                    <span
                      className={styles.streakChip}
                      style={{ backgroundColor: streakChipColor(streak) }}
                      title={streakChipTooltip(streak)}
                      aria-label={streakChipTooltip(streak)}
                    >
                      {chipLabel}
                    </span>
                  ) : null}
                </button>
                {row.cells.map((cell, i) => (
                  <Tooltip
                    key={`${row.caseId}-${i}`}
                    withArrow
                    relationship="label"
                    content={
                      <div className={styles.tooltipBody}>
                        <div className={styles.tooltipTitle}>
                          {row.caseLabel ?? fallbackSlug}
                        </div>
                        {cell.runName && (
                          <div className={styles.tooltipMeta}>
                            Run: {cell.runName}
                          </div>
                        )}
                        <div className={styles.tooltipMeta}>
                          {formatDateTime(cell.runStartTime)}
                        </div>
                        <div>
                          <strong>
                            {cell.present ? cell.status : 'not in this run'}
                          </strong>
                          {summary.passRate !== null && (
                            <>
                              {' '}
                              · overall {summary.passes}/{summary.appearances}
                              {' '}({Math.round(summary.passRate * 100)}%)
                            </>
                          )}
                        </div>
                      </div>
                    }
                  >
                    <button
                      type="button"
                      className={styles.cell}
                      style={{ backgroundColor: cellColor(cell) }}
                      onClick={() => goToCase(row.caseId)}
                      aria-label={`${
                        row.caseLabel ?? fallbackSlug
                      } — ${
                        cell.present ? cell.status : 'absent'
                      } in run ${cell.runName ?? cell.runStartTime}`}
                    />
                  </Tooltip>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
