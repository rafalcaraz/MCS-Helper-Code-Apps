import {
  Body2,
  Caption1,
  Subtitle2,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { WarningRegular } from '@fluentui/react-icons'
import { aggregateErrorReasons, metricLabel } from '../lib/metrics'
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
  reason: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  metricList: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
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
    backgroundColor: tokens.colorPaletteDarkOrangeBackground2,
    color: tokens.colorPaletteDarkOrangeForeground1,
  },
  empty: {
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
})

export interface TopErrorReasonsCardProps {
  runs: TestRun[]
  limit?: number
}

/** Aggregates the `errorReason` codes that show up across the supplied runs. */
export function TopErrorReasonsCard({
  runs,
  limit = 8,
}: TopErrorReasonsCardProps) {
  const styles = useStyles()
  const reasons = aggregateErrorReasons(runs).slice(0, limit)

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <WarningRegular />
        <Subtitle2>Top error reasons</Subtitle2>
      </div>
      <Caption1>
        Distinct <code>errorReason</code> codes across {runs.length} run
        {runs.length === 1 ? '' : 's'}.
      </Caption1>
      {reasons.length === 0 ? (
        <Body2 className={styles.empty}>
          No error reasons recorded — all metrics produced a Pass/Fail
          verdict.
        </Body2>
      ) : (
        <div className={styles.list}>
          {reasons.map((r) => (
            <div key={r.reason} className={styles.row}>
              <div>
                <span className={styles.reason}>{r.reason}</span>
                <span className={styles.metricList}>
                  In:{' '}
                  {[...r.metricTypes].map(metricLabel).join(', ')}
                </span>
              </div>
              <span className={styles.badge}>{r.occurrences}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
