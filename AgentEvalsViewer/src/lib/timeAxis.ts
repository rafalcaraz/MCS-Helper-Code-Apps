/**
 * Adaptive tick formatter for time-series axes.
 *
 * Recharts/Date.toLocaleDateString defaults to month/day only, which
 * collapses an entire day of runs into a single "May 16" tick — useless
 * when filtering by "last 6 hours". Span-aware formatting picks the
 * right granularity for the actual data range.
 */

/** Pick a tick formatter based on the timestamp range present in the data. */
export function buildTimeTickFormatter(
  timestamps: ReadonlyArray<number>,
): (value: number) => string {
  if (timestamps.length === 0) return (v) => formatShortDay(v)

  let min = timestamps[0]
  let max = timestamps[0]
  for (const t of timestamps) {
    if (t < min) min = t
    if (t > max) max = t
  }
  return buildTimeTickFormatterForSpan(max - min)
}

/** Pick a tick formatter for a known span in milliseconds. */
export function buildTimeTickFormatterForSpan(
  spanMs: number,
): (value: number) => string {
  // Sub-hour: show H:MM with seconds suppressed
  if (spanMs <= ONE_HOUR_MS) {
    return (v) =>
      new Date(v).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
  }
  // Sub-day: time-of-day only ("2:30 PM")
  if (spanMs <= ONE_DAY_MS) {
    return (v) =>
      new Date(v).toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      })
  }
  // Up to a week: weekday + hour ("Fri 2 PM")
  if (spanMs <= ONE_WEEK_MS) {
    return (v) => {
      const d = new Date(v)
      const dow = d.toLocaleDateString(undefined, { weekday: 'short' })
      const hour = d.toLocaleTimeString(undefined, {
        hour: 'numeric',
      })
      return `${dow} ${hour}`
    }
  }
  // Up to ~2 months: short month + day ("May 16")
  if (spanMs <= 60 * ONE_DAY_MS) {
    return (v) => formatShortDay(v)
  }
  // Longer: month + year ("May 2026")
  return (v) =>
    new Date(v).toLocaleDateString(undefined, {
      month: 'short',
      year: 'numeric',
    })
}

/** Adaptive tooltip label formatter — always shows the most precise form. */
export function formatTooltipDateTime(value: number | string): string {
  const ts = typeof value === 'number' ? value : Number(value)
  if (Number.isNaN(ts)) return String(value)
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const ONE_HOUR_MS = 60 * 60 * 1000
const ONE_DAY_MS = 24 * ONE_HOUR_MS
const ONE_WEEK_MS = 7 * ONE_DAY_MS

function formatShortDay(v: number): string {
  return new Date(v).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}
