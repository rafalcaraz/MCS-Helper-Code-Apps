import type {
  TestCaseMetric,
  TestCaseResult,
  TestRun,
  TestSet,
} from '../generated/models/MicrosoftCopilotStudioModel'

export type CaseStatus = 'Pass' | 'Fail' | 'Invalid' | 'Error' | 'Unknown'

export type RunState =
  | 'Completed'
  | 'Running'
  | 'Failed'
  | 'Stopped'
  | 'Queued'
  | 'Unknown'

export interface RunStatusCounts {
  pass: number
  fail: number
  invalid: number
  error: number
  unknown: number
  total: number
  passRate: number | null
}

const PASS_VALUES = new Set(['pass', 'passed', 'success', 'succeeded'])
const FAIL_VALUES = new Set(['fail', 'failed'])
const INVALID_VALUES = new Set(['invalid'])
const ERROR_VALUES = new Set(['error', 'errored'])

export function normalizeCaseStatus(state: string | undefined): CaseStatus {
  if (!state) return 'Unknown'
  const v = state.trim().toLowerCase()
  if (PASS_VALUES.has(v)) return 'Pass'
  if (FAIL_VALUES.has(v)) return 'Fail'
  if (INVALID_VALUES.has(v)) return 'Invalid'
  if (ERROR_VALUES.has(v)) return 'Error'
  return 'Unknown'
}

/**
 * Roll up a list of metric statuses into a single verdict.
 * Order of precedence: Error > Fail > Invalid > Pass.
 * Unknown metrics are skipped from the rollup.
 *
 * `mode = 'liberal'` flips Pass to win over Fail (any single passing
 * metric → Pass), useful when grading agents against multiple parallel
 * graders where ANY signal counts.
 */
function rollupMetricStatuses(
  metrics: TestCaseMetric[] | undefined,
  mode: 'strict' | 'liberal' = 'strict',
): CaseStatus {
  if (!metrics || metrics.length === 0) return 'Unknown'
  let sawPass = false
  let sawFail = false
  let sawInvalid = false
  let sawError = false
  for (const m of metrics) {
    const s = normalizeCaseStatus(m.result?.status)
    if (s === 'Error') sawError = true
    else if (s === 'Fail') sawFail = true
    else if (s === 'Invalid') sawInvalid = true
    else if (s === 'Pass') sawPass = true
  }
  if (mode === 'liberal') {
    if (sawPass) return 'Pass'
    if (sawError) return 'Error'
    if (sawFail) return 'Fail'
    if (sawInvalid) return 'Invalid'
    return 'Unknown'
  }
  if (sawError) return 'Error'
  if (sawFail) return 'Fail'
  if (sawInvalid) return 'Invalid'
  if (sawPass) return 'Pass'
  return 'Unknown'
}

export interface CaseStatusOptions {
  /** 'strict' (default): any failing metric fails the case. 'liberal': any passing metric passes the case. */
  mode?: 'strict' | 'liberal'
  /** Metric type names to ignore in the rollup (e.g. exclude Keyword match). */
  excludeMetrics?: ReadonlySet<string>
}

/**
 * Get the effective status for a test case.
 * Copilot Studio leaves `case.state` empty for normal Pass/Fail outcomes
 * and only populates it for run-level errors. Otherwise the case's
 * verdict is derived from its metric results.
 *
 * Pass `options` to flip the rollup to liberal mode (any-pass-wins) or
 * exclude specific metric types from the rollup (e.g. drop keyword
 * graders so the case isn't penalized for rephrased answers).
 */
export function getCaseStatus(
  c: TestCaseResult,
  options?: CaseStatusOptions,
): CaseStatus {
  const explicit = normalizeCaseStatus(c.state)
  if (explicit !== 'Unknown') return explicit
  const exclude = options?.excludeMetrics
  const metrics =
    exclude && exclude.size > 0
      ? (c.metricsResults ?? []).filter(
          (m) => !m.type || !exclude.has(m.type),
        )
      : c.metricsResults
  return rollupMetricStatuses(metrics, options?.mode ?? 'strict')
}

export function countResults(
  results: TestCaseResult[] | undefined,
): RunStatusCounts {
  const counts: RunStatusCounts = {
    pass: 0,
    fail: 0,
    invalid: 0,
    error: 0,
    unknown: 0,
    total: 0,
    passRate: null,
  }
  if (!results || results.length === 0) return counts
  for (const r of results) {
    counts.total += 1
    switch (getCaseStatus(r)) {
      case 'Pass':
        counts.pass += 1
        break
      case 'Fail':
        counts.fail += 1
        break
      case 'Invalid':
        counts.invalid += 1
        break
      case 'Error':
        counts.error += 1
        break
      default:
        counts.unknown += 1
    }
  }
  const evaluable = counts.pass + counts.fail
  counts.passRate = evaluable > 0 ? counts.pass / evaluable : null
  return counts
}

export function formatPassRate(rate: number | null): string {
  if (rate === null || Number.isNaN(rate)) return '—'
  return `${(rate * 100).toFixed(0)}%`
}

export function formatDateTime(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString()
}

export function formatDate(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString()
}

/**
 * Returns a short relative-time label like "3 min ago", "2 hr ago",
 * "yesterday", "3 days ago". Returns "—" if the input is missing or invalid.
 * `now` is injectable for tests; otherwise reads Date.now().
 */
export function formatRelativeTime(
  iso: string | undefined,
  nowMs?: number,
): string {
  if (!iso) return '—'
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return iso
  const now = nowMs ?? Date.now()
  const diffMs = now - then
  if (diffMs < 0) return 'just now'
  const sec = Math.floor(diffMs / 1000)
  if (sec < 45) return 'just now'
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const day = Math.floor(hr / 24)
  if (day === 1) return 'yesterday'
  if (day < 30) return `${day} days ago`
  const mo = Math.floor(day / 30)
  if (mo < 12) return `${mo} mo ago`
  const yr = Math.floor(day / 365)
  return `${yr} yr ago`
}

export function formatDuration(
  startIso: string | undefined,
  endIso: string | undefined,
): string {
  if (!startIso || !endIso) return '—'
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '—'
  const ms = end - start
  if (ms < 1000) return `${ms} ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s} s`
  const m = Math.floor(s / 60)
  const remS = s % 60
  return `${m}m ${remS}s`
}

export function compareRunsByStartTimeAsc(a: TestRun, b: TestRun): number {
  const aT = a.startTime ? new Date(a.startTime).getTime() : 0
  const bT = b.startTime ? new Date(b.startTime).getTime() : 0
  return aT - bT
}

export function compareRunsByStartTimeDesc(
  a: TestRun,
  b: TestRun,
): number {
  return -compareRunsByStartTimeAsc(a, b)
}

export function getTestSetName(testSet: TestSet | undefined): string {
  if (!testSet) return 'Test set'
  return testSet.displayName?.trim() || testSet.id || 'Test set'
}

export function statusColor(status: CaseStatus): string {
  switch (status) {
    case 'Pass':
      return '#107c10'
    case 'Fail':
      return '#d13438'
    case 'Invalid':
      return '#b88600'
    case 'Error':
      return '#8a3ffc'
    default:
      return '#8a8886'
  }
}
