import {
  Caption1,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  analyzeCaseStreak,
  type CaseTimeline,
  type StreakKind,
} from '../lib/metrics'
import { statusColor } from '../lib/eval'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    paddingTop: '4px',
    paddingBottom: '4px',
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusCircular,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  dots: {
    display: 'flex',
    alignItems: 'center',
    columnGap: '3px',
  },
  dot: {
    width: '12px',
    height: '12px',
    borderRadius: '2px',
    border: `1px solid ${tokens.colorNeutralStroke3}`,
  },
  meta: {
    color: tokens.colorNeutralForeground3,
  },
})

const KIND_LABEL: Record<StreakKind, string> = {
  passing: 'Passing',
  failing: 'Failing',
  flaky: 'Flaky',
  mixed: 'Mixed',
  unknown: 'No data',
}

const KIND_COLOR: Record<StreakKind, string> = {
  passing: '#107c10',
  failing: '#d13438',
  flaky: '#b88600',
  mixed: '#7a7574',
  unknown: '#8a8886',
}

export interface StreakIndicatorProps {
  timeline: CaseTimeline
  lookback?: number
}

export function StreakIndicator({
  timeline,
  lookback = 10,
}: StreakIndicatorProps) {
  const styles = useStyles()
  const streak = analyzeCaseStreak(timeline, lookback)
  const recent = timeline.appearances.slice(-lookback)

  const labelText = (() => {
    if (streak.kind === 'passing')
      return `Passing ${streak.length} run${streak.length === 1 ? '' : 's'}`
    if (streak.kind === 'failing')
      return `Failing ${streak.length} run${streak.length === 1 ? '' : 's'} in a row`
    if (streak.kind === 'flaky') {
      const passes = recent.filter((a) => a.status === 'Pass').length
      return `Flaky · ${passes}/${recent.length} pass in last ${recent.length}`
    }
    if (streak.kind === 'mixed') {
      const passes = recent.filter((a) => a.status === 'Pass').length
      return `${passes}/${recent.length} pass in last ${recent.length}`
    }
    return 'No data'
  })()

  return (
    <div className={styles.root}>
      <span
        className={styles.pill}
        style={{ backgroundColor: KIND_COLOR[streak.kind] }}
      >
        {KIND_LABEL[streak.kind]}
      </span>
      <span className={styles.meta}>{labelText}</span>
      {recent.length > 0 ? (
        <div className={styles.dots} aria-label="recent run statuses">
          {recent.map((a, i) => (
            <Tooltip
              key={`${a.runId}-${i}`}
              withArrow
              relationship="label"
              content={`${a.status} · ${new Date(a.runStartTime).toLocaleString()}`}
            >
              <span
                className={styles.dot}
                style={{ backgroundColor: statusColor(a.status) }}
              />
            </Tooltip>
          ))}
        </div>
      ) : null}
      <Caption1 className={styles.meta}>
        across {timeline.appearances.length} total run
        {timeline.appearances.length === 1 ? '' : 's'}
      </Caption1>
    </div>
  )
}
