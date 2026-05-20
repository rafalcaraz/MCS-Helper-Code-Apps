import {
  Tooltip,
  makeStyles,
  mergeClasses,
  tokens,
} from '@fluentui/react-components'
import {
  metricLabel,
  metricStatusColor,
  normalizeMetricStatus,
  type MetricStatus,
} from '../lib/metrics'

const useStyles = makeStyles({
  chip: {
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
    color: tokens.colorNeutralForegroundOnBrand,
    lineHeight: 1.2,
    whiteSpace: 'nowrap',
  },
  small: {
    fontSize: tokens.fontSizeBase100,
    paddingTop: '1px',
    paddingBottom: '1px',
    paddingLeft: tokens.spacingHorizontalXS,
    paddingRight: tokens.spacingHorizontalXS,
  },
  dot: {
    width: '6px',
    height: '6px',
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: 'rgba(255,255,255,0.85)',
    display: 'inline-block',
  },
})

export interface MetricChipProps {
  type: string
  status: string | undefined
  /** Optional secondary text, e.g. "100%" or "0.42". */
  detail?: string
  small?: boolean
  tooltip?: string
}

export function MetricChip({
  type,
  status,
  detail,
  small,
  tooltip,
}: MetricChipProps) {
  const styles = useStyles()
  const normalized: MetricStatus = normalizeMetricStatus(status)
  const bg = metricStatusColor(normalized)
  const label = metricLabel(type)
  const text = detail ? `${label} · ${detail}` : `${label} · ${normalized}`

  const node = (
    <span
      className={mergeClasses(styles.chip, small ? styles.small : undefined)}
      style={{ backgroundColor: bg }}
    >
      <span className={styles.dot} />
      {text}
    </span>
  )

  if (tooltip) {
    return (
      <Tooltip content={tooltip} relationship="description" withArrow>
        {node}
      </Tooltip>
    )
  }
  return node
}
