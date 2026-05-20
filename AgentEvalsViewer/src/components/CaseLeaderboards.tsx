import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Caption1,
  Subtitle2,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  ArrowSwap20Regular,
  ArrowTrendingDown20Regular,
  CheckmarkCircle20Filled,
  ErrorCircle20Filled,
} from '@fluentui/react-icons'
import type { TestRun } from '../generated/models/MicrosoftCopilotStudioModel'
import {
  buildCaseLeaderboards,
  type CaseDefinitionsMap,
  formatPercent,
  type LeaderboardEntry,
} from '../lib/metrics'
import { statusColor } from '../lib/eval'

const useStyles = makeStyles({
  root: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
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
  list: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusSmall,
    background: 'transparent',
    borderTopWidth: '0',
    borderRightWidth: '0',
    borderBottomWidth: '0',
    borderLeftWidth: '0',
    borderTopStyle: 'none',
    borderRightStyle: 'none',
    borderBottomStyle: 'none',
    borderLeftStyle: 'none',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  rowDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: tokens.borderRadiusCircular,
    flexShrink: 0,
  },
  rowMain: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0,
  },
  rowCaseLabel: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorBrandForegroundLink,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowCaseLabelFallback: {
    fontFamily: tokens.fontFamilyMonospace,
    fontStyle: 'italic',
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowDetail: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
  },
  rowCulprit: {
    color: tokens.colorPaletteDarkOrangeForeground1,
    fontSize: tokens.fontSizeBase100,
    fontStyle: 'italic',
  },
  conversationBadge: {
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorBrandForeground1,
    background: tokens.colorBrandBackground2,
    borderRadius: tokens.borderRadiusSmall,
    paddingLeft: '4px',
    paddingRight: '4px',
    flexShrink: 0,
  },
  rowCaseLabelGroup: {
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    minWidth: 0,
  },
  empty: {
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
})

interface BoardProps {
  title: string
  icon: ReactNode
  entries: LeaderboardEntry[]
  emptyHint: string
  onPickCase: (caseId: string) => void
  formatDetail: (entry: LeaderboardEntry) => string
  /** When true, render the per-case "consistently fails on: <metric>" hint. */
  showCulprit?: boolean
  /** Definitions map — when provided, multi-turn cases get a 💬 badge. */
  definitions?: CaseDefinitionsMap
}

function Board({
  title,
  icon,
  entries,
  emptyHint,
  onPickCase,
  formatDetail,
  showCulprit = false,
  definitions,
}: BoardProps) {
  const styles = useStyles()
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        {icon}
        <Subtitle2>{title}</Subtitle2>
      </div>
      {entries.length === 0 ? (
        <Caption1 className={styles.empty}>{emptyHint}</Caption1>
      ) : (
        <div className={styles.list}>
          {entries.map((e) => {
            const culprit = e.primaryFailingMetric
            const def = definitions?.get(e.caseId)
            const isMultiTurn = def?.kind === 'MultiTurnEvaluationCase'
            const turnCount = def?.turns?.length
            return (
              <button
                key={e.caseId}
                type="button"
                className={styles.row}
                onClick={() => onPickCase(e.caseId)}
                title={
                  e.caseLabel
                    ? `${isMultiTurn ? 'Conversational test case' + (turnCount ? ` (${turnCount} turns)` : '') + '\n\n' : ''}${e.caseLabel}\n\nCase ID: ${e.caseId} — open history`
                    : `${isMultiTurn ? 'Conversational test case' + (turnCount ? ` (${turnCount} turns)` : '') + '\n\n' : ''}Case ID: ${e.caseId} — open history`
                }
              >
                <span
                  className={styles.rowDot}
                  style={{ backgroundColor: statusColor(e.latestStatus) }}
                  aria-hidden
                />
                <div className={styles.rowMain}>
                  <span className={styles.rowCaseLabelGroup}>
                    {isMultiTurn ? (
                      <span
                        className={styles.conversationBadge}
                        aria-label="Conversational case"
                        title={
                          turnCount
                            ? `Conversational case (${turnCount} authored turns)`
                            : 'Conversational case (multi-turn)'
                        }
                      >
                        💬
                      </span>
                    ) : null}
                    <span
                      className={
                        e.caseLabel
                          ? styles.rowCaseLabel
                          : styles.rowCaseLabelFallback
                      }
                    >
                      {e.caseLabel ?? `case ${e.caseId.slice(0, 8)}…`}
                    </span>
                  </span>
                  <span className={styles.rowDetail}>{formatDetail(e)}</span>
                  {showCulprit && culprit ? (
                    <span
                      className={styles.rowCulprit}
                      title={`${culprit.failCount} of ${culprit.totalAppearances} appearances failed on this metric`}
                    >
                      consistently fails on: {culprit.label} (
                      {culprit.failCount}/{culprit.totalAppearances})
                    </span>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export interface CaseLeaderboardsProps {
  runs: TestRun[]
  agentId: string | undefined
  testSetId: string | undefined
  /** Optional Dataverse-sourced case definitions for real labels. */
  definitions?: CaseDefinitionsMap
}

/**
 * 4-up grid of leaderboards: Most Regressed, Flakiest, Never Passed,
 * Most Improved. Each row is a button that drills into the case page.
 */
export function CaseLeaderboards({
  runs,
  agentId,
  testSetId,
  definitions,
}: CaseLeaderboardsProps) {
  const styles = useStyles()
  const navigate = useNavigate()
  const data = useMemo(
    () => buildCaseLeaderboards(runs, undefined, definitions),
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

  return (
    <div className={styles.root}>
      <Board
        title="Most regressed"
        icon={
          <ArrowTrendingDown20Regular
            style={{ color: tokens.colorPaletteRedForeground1 }}
          />
        }
        entries={data.mostRegressed}
        emptyHint="No regressions detected — older runs and recent runs have similar pass profiles."
        onPickCase={goToCase}
        showCulprit
        definitions={definitions}
        formatDetail={(e) =>
          `${formatPercent(e.olderPassRate ?? 0)} → ${formatPercent(
            e.newerPassRate ?? 0,
          )} pass · ${e.totalAppearances} runs`
        }
      />
      <Board
        title="Flakiest"
        icon={
          <ArrowSwap20Regular
            style={{ color: tokens.colorPaletteYellowForeground1 }}
          />
        }
        entries={data.flakiest}
        emptyHint="No flapping detected in the recent run window."
        onPickCase={goToCase}
        showCulprit
        definitions={definitions}
        formatDetail={(e) =>
          `${e.flipCount ?? 0} status changes in last ${
            e.recentN
          } runs · ${formatPercent(e.recentPassRate)} pass`
        }
      />
      <Board
        title="Never passed"
        icon={
          <ErrorCircle20Filled
            style={{ color: tokens.colorPaletteRedForeground1 }}
          />
        }
        entries={data.neverPassed}
        emptyHint="Every case has passed at least once."
        onPickCase={goToCase}
        showCulprit
        definitions={definitions}
        formatDetail={(e) =>
          `0 of ${e.totalAppearances} run${
            e.totalAppearances === 1 ? '' : 's'
          } passed`
        }
      />
      <Board
        title="Most improved"
        icon={
          <CheckmarkCircle20Filled
            style={{ color: tokens.colorPaletteGreenForeground1 }}
          />
        }
        entries={data.mostImproved}
        emptyHint="No improvements yet — keep iterating."
        onPickCase={goToCase}
        definitions={definitions}
        formatDetail={(e) =>
          `${formatPercent(e.olderPassRate ?? 0)} → ${formatPercent(
            e.newerPassRate ?? 0,
          )} pass · ${e.totalAppearances} runs`
        }
      />
    </div>
  )
}
