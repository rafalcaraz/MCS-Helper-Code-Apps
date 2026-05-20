import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Body2,
  Caption1,
  Subtitle1,
  Subtitle2,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  ArrowDownloadRegular,
  ArrowExitRegular,
  CheckmarkCircle20Filled,
  ErrorCircle20Filled,
  ToolboxRegular,
  WarningRegular,
} from '@fluentui/react-icons'
import type { TestRun } from '../generated/models/MicrosoftCopilotStudioModel'
import { diffRuns, formatScore, metricLabel } from '../lib/metrics'
import { formatDateTime } from '../lib/eval'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
    rowGap: tokens.spacingVerticalS,
  },
  meta: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  noChanges: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    color: tokens.colorPaletteGreenForeground1,
    fontSize: tokens.fontSizeBase300,
  },
  sections: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
    margin: 0,
    padding: 0,
    listStyle: 'none',
  },
  itemBtn: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    padding: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    border: 'none',
    backgroundColor: 'transparent',
    color: tokens.colorNeutralForeground1,
    fontFamily: tokens.fontFamilyBase,
    fontSize: tokens.fontSizeBase300,
    textAlign: 'left',
    cursor: 'pointer',
    width: '100%',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground3,
    },
  },
  caseId: {
    fontFamily: tokens.fontFamilyMonospace,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  failBadge: {
    color: tokens.colorPaletteRedForeground1,
  },
  fixBadge: {
    color: tokens.colorPaletteGreenForeground1,
  },
  dropBadge: {
    color: tokens.colorPaletteDarkOrangeForeground1,
    fontFamily: tokens.fontFamilyMonospace,
    fontWeight: tokens.fontWeightSemibold,
  },
  toolName: {
    fontFamily: tokens.fontFamilyMonospace,
    fontWeight: tokens.fontWeightSemibold,
  },
})

export interface RunDiffCardProps {
  current: TestRun | undefined
  previous: TestRun | undefined
  agentId: string | undefined
  testSetId: string | undefined
}

/**
 * "What changed since the previous run" — the 10-second daily check-in
 * widget. Shown above the trend charts on TestSetDetailPage.
 */
export function RunDiffCard({
  current,
  previous,
  agentId,
  testSetId,
}: RunDiffCardProps) {
  const styles = useStyles()
  const navigate = useNavigate()
  const diff = useMemo(
    () => diffRuns(current, previous),
    [current, previous],
  )

  const goToCase = (caseId: string) => {
    if (!agentId || !testSetId || !caseId) return
    navigate(
      `/agents/${agentId}/testsets/${encodeURIComponent(
        testSetId,
      )}/cases/${encodeURIComponent(caseId)}`,
    )
  }

  if (!current) return null

  if (!previous) {
    return (
      <div className={styles.root}>
        <div className={styles.header}>
          <Subtitle1>Diff vs previous run</Subtitle1>
        </div>
        <Caption1>
          Only one run on record yet — nothing to compare. Run the test set
          again to start tracking changes.
        </Caption1>
      </div>
    )
  }

  const noChanges = diff.changesCount === 0

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <Subtitle1>Diff vs previous run</Subtitle1>
          <Caption1 className={styles.meta}>
            {formatDateTime(previous.startTime)} →{' '}
            {formatDateTime(current.startTime)}
          </Caption1>
        </div>
        <Caption1 className={styles.meta}>
          {diff.changesCount === 0
            ? 'no changes'
            : `${diff.changesCount} change${diff.changesCount === 1 ? '' : 's'}`}
        </Caption1>
      </div>

      {noChanges ? (
        <div className={styles.noChanges}>
          <CheckmarkCircle20Filled />
          <span>
            Nothing changed since the previous run — same Pass/Fail per
            case, same scores, same errors.
          </span>
        </div>
      ) : (
        <div className={styles.sections}>
          {diff.newFailures.length > 0 ? (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <ErrorCircle20Filled className={styles.failBadge} />
                <Subtitle2>
                  New failures ({diff.newFailures.length})
                </Subtitle2>
              </div>
              <ul className={styles.list}>
                {diff.newFailures.map((f) => (
                  <li key={`f-${f.caseId}`}>
                    <button
                      type="button"
                      className={styles.itemBtn}
                      onClick={() => goToCase(f.caseId)}
                    >
                      <ArrowExitRegular />
                      <span>
                        case{' '}
                        <span className={styles.caseId}>
                          {f.caseId.slice(0, 8)}…
                        </span>
                      </span>
                      <span className={styles.failBadge}>
                        {f.previousStatus} → {f.currentStatus}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {diff.newlyFixed.length > 0 ? (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <CheckmarkCircle20Filled className={styles.fixBadge} />
                <Subtitle2>
                  Newly fixed ({diff.newlyFixed.length})
                </Subtitle2>
              </div>
              <ul className={styles.list}>
                {diff.newlyFixed.map((f) => (
                  <li key={`x-${f.caseId}`}>
                    <button
                      type="button"
                      className={styles.itemBtn}
                      onClick={() => goToCase(f.caseId)}
                    >
                      <CheckmarkCircle20Filled />
                      <span>
                        case{' '}
                        <span className={styles.caseId}>
                          {f.caseId.slice(0, 8)}…
                        </span>
                      </span>
                      <span className={styles.fixBadge}>
                        {f.previousStatus} → Pass
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {diff.scoreDrops.length > 0 ? (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <ArrowDownloadRegular />
                <Subtitle2>
                  Score drops ({diff.scoreDrops.length})
                </Subtitle2>
              </div>
              <ul className={styles.list}>
                {diff.scoreDrops.map((d, i) => (
                  <li key={`d-${i}`}>
                    <button
                      type="button"
                      className={styles.itemBtn}
                      onClick={() => goToCase(d.caseId)}
                    >
                      <span>
                        {metricLabel(d.metricType)} on{' '}
                        <span className={styles.caseId}>
                          {d.caseId.slice(0, 8)}…
                        </span>
                      </span>
                      <span className={styles.dropBadge}>
                        {formatScore(d.previousScore)} →{' '}
                        {formatScore(d.currentScore)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {diff.newErrorReasons.length > 0 ? (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <WarningRegular />
                <Subtitle2>
                  New error reasons ({diff.newErrorReasons.length})
                </Subtitle2>
              </div>
              <ul className={styles.list}>
                {diff.newErrorReasons.map((e, i) => (
                  <li key={`e-${i}`}>
                    <button
                      type="button"
                      className={styles.itemBtn}
                      onClick={() => goToCase(e.caseId)}
                    >
                      <span className={styles.toolName}>{e.reason}</span>
                      <Body2>· {metricLabel(e.metricType)}</Body2>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {diff.newMissingTools.length > 0 ? (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>
                <ToolboxRegular />
                <Subtitle2>
                  New missing tools ({diff.newMissingTools.length})
                </Subtitle2>
              </div>
              <ul className={styles.list}>
                {diff.newMissingTools.map((t, i) => (
                  <li key={`t-${i}`}>
                    <button
                      type="button"
                      className={styles.itemBtn}
                      onClick={() => goToCase(t.caseId)}
                    >
                      <span className={styles.toolName}>{t.shortName}</span>
                      <Caption1 className={styles.caseId}>
                        {t.schemaName}
                      </Caption1>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
