import type { CSSProperties } from 'react'
import { makeStyles, tokens } from '@fluentui/react-components'
import {
  computeRunMetricStats,
  metricColor,
  metricLabel,
} from '../lib/metrics'
import type { TestRun } from '../generated/models/MicrosoftCopilotStudioModel'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    borderRadius: tokens.borderRadiusCircular,
    paddingTop: '2px',
    paddingBottom: '2px',
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    fontSize: tokens.fontSizeBase100,
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
    whiteSpace: 'nowrap',
    lineHeight: 1.2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  swatch: {
    width: '8px',
    height: '8px',
    borderRadius: tokens.borderRadiusCircular,
    flexShrink: 0,
  },
  pct: {
    fontWeight: tokens.fontWeightSemibold,
    fontFamily: tokens.fontFamilyMonospace,
  },
  empty: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    fontStyle: 'italic',
  },
})

export interface MetricChipStackProps {
  run: TestRun
  /** If true, only show metric label without the pass-rate %. */
  labelOnly?: boolean
}

/**
 * Compact summary of a run's per-metric pass rates as a row of small chips.
 * Designed for table cells and card densities, where MetricScoreBars would
 * be too tall.
 */
export function MetricChipStack({ run, labelOnly }: MetricChipStackProps) {
  const styles = useStyles()
  const stats = computeRunMetricStats(run)
  if (stats.length === 0) {
    return <span className={styles.empty}>No metrics</span>
  }
  return (
    <div className={styles.root}>
      {stats.map((s) => {
        const isNoData = s.passRate === null
        const isZero = s.passRate === 0
        const pct = isNoData ? 'n/a' : `${(s.passRate! * 100).toFixed(0)}%`
        const detail = labelOnly ? '' : ` ${pct}`
        const tooltip = isNoData
          ? `${s.label}: no passable cases (only Errored or Invalid results)`
          : `${s.label}: ${s.pass}/${s.total} passing${
              s.error > 0 ? ` (${s.error} errored)` : ''
            }`
        const chipStyle: CSSProperties = isNoData
          ? {
              borderStyle: 'dashed',
              borderColor: tokens.colorNeutralStroke2,
              color: tokens.colorNeutralForeground3,
            }
          : isZero
            ? {
                backgroundColor: tokens.colorPaletteRedForeground1,
                color: tokens.colorNeutralForegroundOnBrand,
                borderColor: tokens.colorPaletteRedBorderActive,
              }
            : s.passRate! < 0.5
              ? { borderColor: tokens.colorPaletteRedForeground1 }
              : {}
        return (
          <span
            key={s.type}
            className={styles.chip}
            title={tooltip}
            style={chipStyle}
          >
            <span
              className={styles.swatch}
              style={{
                backgroundColor: isZero
                  ? tokens.colorNeutralForegroundOnBrand
                  : metricColor(s.type),
              }}
              aria-hidden
            />
            {metricLabel(s.type)}
            {labelOnly ? null : <span className={styles.pct}>{detail}</span>}
          </span>
        )
      })}
    </div>
  )
}
