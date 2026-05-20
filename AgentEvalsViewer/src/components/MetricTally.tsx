import { Tooltip, makeStyles, tokens } from '@fluentui/react-components'
import {
  CheckmarkCircle16Filled,
  DismissCircle16Filled,
  QuestionCircle16Filled,
} from '@fluentui/react-icons'
import {
  normalizeMetricStatus,
  type MetricStatus,
} from '../lib/metrics'

interface MetricLike {
  result?: { status?: string | null } | null
}

const useStyles = makeStyles({
  root: {
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    lineHeight: 1,
  },
  segment: {
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: '2px',
  },
  pass: { color: tokens.colorPaletteGreenForeground1 },
  fail: { color: tokens.colorPaletteRedForeground1 },
  unknown: { color: tokens.colorNeutralForeground3 },
  zero: { opacity: 0.35 },
})

export interface MetricTallyProps {
  /** A list of grader results for one row (e.g. one case in one run). */
  metrics: ReadonlyArray<MetricLike> | undefined
  /** Show segments with zero count dimmed (default true). */
  showZeros?: boolean
}

interface Counts {
  pass: number
  fail: number
  unknown: number
  total: number
}

function tally(metrics: ReadonlyArray<MetricLike> | undefined): Counts {
  const out: Counts = { pass: 0, fail: 0, unknown: 0, total: 0 }
  if (!metrics) return out
  for (const m of metrics) {
    const s: MetricStatus = normalizeMetricStatus(m.result?.status ?? undefined)
    out.total++
    if (s === 'Pass') out.pass++
    else if (s === 'Fail' || s === 'Error') out.fail++
    else out.unknown++
  }
  return out
}

/**
 * Compact pass/fail/unknown count summary for a row of grader results.
 *
 * Designed to sit next to a binary status pill ("Fail") to surface the fact
 * that, e.g., "this run failed but 4 of 5 graders actually passed."
 */
export function MetricTally({ metrics, showZeros = true }: MetricTallyProps) {
  const styles = useStyles()
  const c = tally(metrics)
  if (c.total === 0) {
    return <span className={styles.unknown}>—</span>
  }

  const tooltip =
    `${c.total} grader${c.total === 1 ? '' : 's'}: ` +
    `${c.pass} passed, ${c.fail} failed` +
    (c.unknown > 0 ? `, ${c.unknown} invalid/unknown` : '')

  return (
    <Tooltip content={tooltip} relationship="label" withArrow>
      <span className={styles.root} aria-label={tooltip}>
        <span
          className={`${styles.segment} ${styles.pass}${
            c.pass === 0 && showZeros ? ' ' + styles.zero : ''
          }`}
        >
          <CheckmarkCircle16Filled />
          {c.pass}
        </span>
        <span
          className={`${styles.segment} ${styles.fail}${
            c.fail === 0 && showZeros ? ' ' + styles.zero : ''
          }`}
        >
          <DismissCircle16Filled />
          {c.fail}
        </span>
        {(c.unknown > 0 || showZeros) && (
          <span
            className={`${styles.segment} ${styles.unknown}${
              c.unknown === 0 && showZeros ? ' ' + styles.zero : ''
            }`}
          >
            <QuestionCircle16Filled />
            {c.unknown}
          </span>
        )}
      </span>
    </Tooltip>
  )
}
