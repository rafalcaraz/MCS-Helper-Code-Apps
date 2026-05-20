import { useMemo } from 'react'
import {
  Body2,
  Caption1,
  Subtitle2,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { CheckmarkCircleRegular } from '@fluentui/react-icons'
import {
  aggregateCapabilityCoverage,
  summarizeCapabilityCoverage,
} from '../lib/metrics'
import type { TestRun } from '../generated/models/MicrosoftCopilotStudioModel'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
  },
  strap: {
    display: 'flex',
    alignItems: 'baseline',
    columnGap: tokens.spacingHorizontalXS,
  },
  strapNumber: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  strapDenom: {
    color: tokens.colorNeutralForeground3,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
  },
  shortName: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  schema: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    fontFamily: tokens.fontFamilyMonospace,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'block',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    borderRadius: tokens.borderRadiusCircular,
    paddingTop: '2px',
    paddingBottom: '2px',
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: 'nowrap',
  },
  badgeRed: {
    backgroundColor: tokens.colorPaletteRedBackground2,
    color: tokens.colorPaletteRedForeground1,
  },
  badgeAmber: {
    backgroundColor: tokens.colorPaletteMarigoldBackground2,
    color: tokens.colorPaletteMarigoldForeground1,
  },
  badgeGreen: {
    backgroundColor: tokens.colorPaletteGreenBackground2,
    color: tokens.colorPaletteGreenForeground1,
  },
  empty: {
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
})

export interface CapabilityCoverageCardProps {
  runs: TestRun[]
  /** Max entries to list. Default 8. */
  limit?: number
}

/**
 * Per-tool coverage: how often each expected tool/topic actually fired across
 * the supplied runs. Complements TopFailingToolsCard by showing the *whole*
 * tool inventory (including the well-behaved ones) and surfacing partial
 * coverage that pure pass-rate misses.
 */
export function CapabilityCoverageCard({
  runs,
  limit = 8,
}: CapabilityCoverageCardProps) {
  const styles = useStyles()
  const entries = useMemo(() => aggregateCapabilityCoverage(runs), [runs])
  const summary = useMemo(
    () => summarizeCapabilityCoverage(entries),
    [entries],
  )
  const shown = entries.slice(0, limit)

  const badgeClassFor = (fireRate: number): string => {
    if (fireRate >= 0.95) return `${styles.badge} ${styles.badgeGreen}`
    if (fireRate >= 0.5) return `${styles.badge} ${styles.badgeAmber}`
    return `${styles.badge} ${styles.badgeRed}`
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <CheckmarkCircleRegular />
        <Subtitle2>Capability coverage</Subtitle2>
      </div>
      <div className={styles.strap}>
        <span className={styles.strapNumber}>
          {summary.firingTools}/{summary.totalTools}
        </span>
        <span className={styles.strapDenom}>
          expected tools/topics firing at least once across {runs.length}{' '}
          run{runs.length === 1 ? '' : 's'}
        </span>
      </div>
      <Caption1>
        Each tool/topic listed below was either invoked successfully
        (triggered) or expected-and-missing in at least one run. The fire-rate
        is the fraction of expected runs in which it actually fired.
      </Caption1>
      {shown.length === 0 ? (
        <Body2 className={styles.empty}>
          No CapabilityUse metric data yet — turn on the Capability Use grader
          in Copilot Studio to populate this view.
        </Body2>
      ) : (
        <div className={styles.list}>
          {shown.map((e) => {
            const pct = Math.round(e.fireRate * 100)
            const summaryText = `Fired in ${e.triggeredRunIds.size}/${e.expectedRunCount} expected run${e.expectedRunCount === 1 ? '' : 's'}`
            return (
              <div key={e.schemaName} className={styles.row}>
                <div>
                  <span className={styles.shortName}>{e.shortName}</span>
                  <span className={styles.schema} title={e.schemaName}>
                    {e.stepType ? `${e.stepType} · ` : ''}
                    {e.schemaName}
                  </span>
                </div>
                <span
                  className={badgeClassFor(e.fireRate)}
                  title={summaryText}
                >
                  {pct}% · {e.triggeredRunIds.size}/{e.expectedRunCount}
                </span>
              </div>
            )
          })}
        </div>
      )}
      {entries.length > shown.length ? (
        <Caption1>
          … and {entries.length - shown.length} more tool
          {entries.length - shown.length === 1 ? '' : 's'} with full coverage
        </Caption1>
      ) : null}
    </div>
  )
}
