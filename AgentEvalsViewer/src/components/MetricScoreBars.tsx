import { Caption1, makeStyles, tokens } from '@fluentui/react-components'
import { computeRunMetricStats, type MetricStats } from '../lib/metrics'
import type { TestRun } from '../generated/models/MicrosoftCopilotStudioModel'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '180px 1fr 130px',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
  },
  label: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  trackWrap: {
    position: 'relative',
    height: '14px',
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusCircular,
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRadius: tokens.borderRadiusCircular,
    transition: 'width 240ms ease',
  },
  value: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
    textAlign: 'right',
  },
  pct: {
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    fontFamily: tokens.fontFamilyBase,
  },
  errBadge: {
    color: tokens.colorPaletteDarkOrangeForeground1,
    marginLeft: tokens.spacingHorizontalXS,
    fontSize: tokens.fontSizeBase200,
  },
  empty: {
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
})

export interface MetricScoreBarsProps {
  run: TestRun
}

interface RowProps {
  stats: MetricStats
}

function Row({ stats }: RowProps) {
  const styles = useStyles()
  const pct = stats.passRate === null ? 0 : stats.passRate * 100
  return (
    <div className={styles.row}>
      <span className={styles.label}>{stats.label}</span>
      <div
        className={styles.trackWrap}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${stats.label} pass rate`}
      >
        <div
          className={styles.fill}
          style={{
            width: `${pct}%`,
            backgroundColor:
              stats.passRate === null ? tokens.colorNeutralStroke2 : stats.color,
          }}
        />
      </div>
      <span className={styles.value}>
        <span className={styles.pct}>
          {stats.passRate === null ? '—' : `${pct.toFixed(0)}%`}
        </span>
        {stats.total > 0 ? ` (${stats.pass}/${stats.total})` : ''}
        {stats.error > 0 ? (
          <span className={styles.errBadge}>· {stats.error} err</span>
        ) : null}
      </span>
    </div>
  )
}

export function MetricScoreBars({ run }: MetricScoreBarsProps) {
  const styles = useStyles()
  const stats = computeRunMetricStats(run)
  if (stats.length === 0) {
    return (
      <Caption1 className={styles.empty}>
        No metric results in this run.
      </Caption1>
    )
  }
  return (
    <div className={styles.root}>
      {stats.map((s) => (
        <Row key={s.type} stats={s} />
      ))}
    </div>
  )
}
