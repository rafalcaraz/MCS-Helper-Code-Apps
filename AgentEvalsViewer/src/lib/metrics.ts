import {
  compareRunsByStartTimeAsc,
  compareRunsByStartTimeDesc,
  getCaseStatus,
  type CaseStatus,
} from './eval'
import type {
  TestCaseMetric,
  TestCaseResult,
  TestRun,
} from '../generated/models/MicrosoftCopilotStudioModel'
import type { CaseDefinition } from '../api/dataverse'

/** A "definitions map" as returned by `useTestCaseDefinitions`. */
export type CaseDefinitionsMap = ReadonlyMap<string, CaseDefinition>

/**
 * Where a label came from — surfaced to the UI for honest provenance.
 *
 *  - `dataverse` — the current live question text, authoritative.
 *  - `guid`      — the case is not in the live Dataverse test set anymore
 *                  (deleted or renamed). Caller should show the GUID slug
 *                  and let the maker know the question text isn't available.
 *
 * NOTE: We deliberately do **not** promote AI-mined phrases to "inferred"
 * label sources anymore. They were causing customer confusion ("we don't
 * have that question") because the tier-3 patterns mine the *expected
 * answer* text rather than the question. Mined phrases now live on
 * `ResolvedCaseLabel.hint` so the Case Detail page can surface them as a
 * historical reference with strong disclaimers, while leaderboards / inbox
 * / clusters / heatmap rows always render the authoritative Dataverse
 * question or the GUID slug.
 */
export type CaseLabelSource = 'dataverse' | 'guid'

export interface ResolvedCaseLabel {
  /** Always non-empty; falls back to a GUID slug if nothing else. */
  label: string
  /** Where the label came from. UI uses this to badge/tooltip the label. */
  source: CaseLabelSource
  /**
   * When source is `'guid'` AND we extracted a phrase from old grader text,
   * we keep it here so the Case Detail page can surface it as a "historical
   * reference" hint. Never use as primary label text — the phrase may
   * describe the *answer* rather than the *question*.
   */
  hint?: string | null
  /**
   * Tier of the inferred hint, if any. 1 = strongest (user-question shape),
   * 2 = topic-shape, 3 = expected-answer-shape (weakest). Allows the UI to
   * tone the hint disclaimer accordingly.
   */
  hintTier?: 1 | 2 | 3
}

export interface DerivedCaseLabel {
  label: string
  /**
   *  1 = tier-1 user-question pattern ("The user asks to ___")
   *  2 = tier-2 topic pattern ("doesn't address X about TOPIC")
   *  3 = tier-3 expected-response pattern ("Expected response confirms ___")
   *      — describes the answer, not the question
   */
  tier: 1 | 2 | 3
}

/**
 * Resolve the best human-readable label for one case.
 *
 *   1. Dataverse `input` (the literal authored question, current/live)
 *   2. GUID slug ("case xxxxxxxx…") — and any AI-mined phrase is preserved
 *      on `.hint` for the Case Detail page to surface as a historical
 *      reference with appropriate disclaimers.
 *
 * `inferredLabel` accepts either a `DerivedCaseLabel` (preferred — carries
 * tier info) or a bare string (legacy callers; treated as tier 1).
 */
export function resolveCaseLabel(
  caseId: string,
  options: {
    inferredLabel?: DerivedCaseLabel | string | null
    definitions?: CaseDefinitionsMap
  } = {},
): ResolvedCaseLabel {
  const def = options.definitions?.get(caseId)
  if (def?.input && def.input.trim().length > 0) {
    return { label: def.input.trim(), source: 'dataverse' }
  }

  const inferred =
    typeof options.inferredLabel === 'string'
      ? ({ label: options.inferredLabel, tier: 1 } satisfies DerivedCaseLabel)
      : options.inferredLabel ?? null

  if (inferred && inferred.label.trim().length > 0) {
    return {
      label: `case ${caseId.slice(0, 8)}…`,
      source: 'guid',
      hint: inferred.label.trim(),
      hintTier: inferred.tier,
    }
  }
  return { label: `case ${caseId.slice(0, 8)}…`, source: 'guid' }
}


export type MetricStatus = 'Pass' | 'Fail' | 'Invalid' | 'Error' | 'Unknown'

export const METRIC_LABELS: Record<string, string> = {
  GeneralQuality: 'General quality',
  CapabilityUse: 'Tool use',
  AnyKeywordMatch: 'Keyword match (any)',
  AllKeywordMatch: 'Keyword match (all)',
  CompareMeaning: 'Compare meaning',
  TextSimilarity: 'Text similarity',
  CustomLabels: 'Custom labels',
}

function humanize(s: string): string {
  return s
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
}

export function metricLabel(type: string | undefined): string {
  if (!type) return 'Unknown metric'
  return METRIC_LABELS[type] ?? humanize(type)
}

const METRIC_COLORS: Record<string, string> = {
  GeneralQuality: '#0078d4',
  CapabilityUse: '#8a3ffc',
  AnyKeywordMatch: '#107c10',
  AllKeywordMatch: '#13a10e',
  CompareMeaning: '#cc1f72',
  TextSimilarity: '#ca5010',
  CustomLabels: '#7a7574',
}

const FALLBACK_PALETTE = [
  '#005a9e',
  '#bf0077',
  '#498205',
  '#8764b8',
  '#c19c00',
  '#0a7c84',
  '#a4373a',
]

export function metricColor(type: string | undefined): string {
  if (!type) return '#8a8886'
  if (METRIC_COLORS[type]) return METRIC_COLORS[type]
  let hash = 0
  for (let i = 0; i < type.length; i++) {
    hash = (hash * 31 + type.charCodeAt(i)) | 0
  }
  return FALLBACK_PALETTE[Math.abs(hash) % FALLBACK_PALETTE.length]
}

export function normalizeMetricStatus(s: string | undefined): MetricStatus {
  if (!s) return 'Unknown'
  const v = s.trim().toLowerCase()
  if (v === 'pass' || v === 'passed' || v === 'success') return 'Pass'
  if (v === 'fail' || v === 'failed') return 'Fail'
  if (v === 'invalid') return 'Invalid'
  if (v === 'error' || v === 'errored') return 'Error'
  return 'Unknown'
}

export function metricStatusColor(s: MetricStatus): string {
  switch (s) {
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

// ---- per-metric data parsers ----

export interface InvocationStep {
  schemaName: string
  stepType: string
}

function parseInvocationSteps(raw: unknown): InvocationStep[] {
  if (typeof raw !== 'string' || !raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((x) => {
        const obj = (x ?? {}) as Record<string, unknown>
        return {
          schemaName: typeof obj.SchemaName === 'string' ? obj.SchemaName : '',
          stepType: typeof obj.StepType === 'string' ? obj.StepType : '',
        }
      })
      .filter((s) => s.schemaName)
  } catch {
    return []
  }
}

export function parseMissingInvocationSteps(
  metric: TestCaseMetric,
): InvocationStep[] {
  const data = metric?.result?.data as Record<string, unknown> | undefined
  return parseInvocationSteps(data?.missinginvocationsteps)
}

export function parseTriggeredInvocationSteps(
  metric: TestCaseMetric,
): InvocationStep[] {
  const data = metric?.result?.data as Record<string, unknown> | undefined
  return parseInvocationSteps(data?.triggeredinvocationsteps)
}

/** Schema names are like "copilots_header_msftcsa_X.action.ServiceNow-CreateRecord". Tail is the human-friendly part. */
export function simplifySchemaName(schema: string): string {
  if (!schema) return schema
  const parts = schema.split('.')
  return parts[parts.length - 1] ?? schema
}

export function parseMetricScore(metric: TestCaseMetric): number | null {
  const data = metric?.result?.data as Record<string, unknown> | undefined
  if (!data) return null
  const raw = data.score
  if (raw == null) return null
  const n =
    typeof raw === 'string' ? parseFloat(raw) : typeof raw === 'number' ? raw : NaN
  return Number.isFinite(n) ? n : null
}

/** Metrics whose `data.score` is meaningful (0-1 numeric scale). */
export const NUMERIC_SCORE_METRICS = new Set<string>([
  'CompareMeaning',
  'TextSimilarity',
])

export function metricHasNumericScore(type: string | undefined): boolean {
  return Boolean(type && NUMERIC_SCORE_METRICS.has(type))
}

// ---- per-run aggregations ----

export interface MetricStats {
  type: string
  label: string
  color: string
  pass: number
  fail: number
  invalid: number
  error: number
  /** pass + fail + invalid (errors are excluded from the denominator). */
  total: number
  totalWithError: number
  /** pass / total. null if total is 0. */
  passRate: number | null
  /** Numeric scores collected from data.score (only for NUMERIC_SCORE_METRICS). */
  numericScores: number[]
  avgScore: number | null
}

function emptyStats(type: string): MetricStats {
  return {
    type,
    label: metricLabel(type),
    color: metricColor(type),
    pass: 0,
    fail: 0,
    invalid: 0,
    error: 0,
    total: 0,
    totalWithError: 0,
    passRate: null,
    numericScores: [],
    avgScore: null,
  }
}

function finalizeStats(s: MetricStats): MetricStats {
  s.total = s.pass + s.fail + s.invalid
  s.totalWithError = s.total + s.error
  s.passRate = s.total > 0 ? s.pass / s.total : null
  s.avgScore =
    s.numericScores.length > 0
      ? s.numericScores.reduce((a, b) => a + b, 0) / s.numericScores.length
      : null
  return s
}

/** Compute per-metric stats for a single run. */
export function computeRunMetricStats(
  run: TestRun | undefined,
): MetricStats[] {
  const map = new Map<string, MetricStats>()
  if (!run) return []
  const cases = run.testCasesResults ?? []
  for (const c of cases) {
    for (const m of c.metricsResults ?? []) {
      const type = m.type ?? 'Unknown'
      const stats = map.get(type) ?? emptyStats(type)
      const status = normalizeMetricStatus(m.result?.status)
      if (status === 'Pass') stats.pass += 1
      else if (status === 'Fail') stats.fail += 1
      else if (status === 'Invalid') stats.invalid += 1
      else if (status === 'Error') stats.error += 1
      const score = parseMetricScore(m)
      if (score !== null) stats.numericScores.push(score)
      map.set(type, stats)
    }
  }
  return [...map.values()]
    .map(finalizeStats)
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** Union of metric types observed across all runs. */
export function collectMetricTypes(runs: TestRun[]): string[] {
  const set = new Set<string>()
  for (const run of runs) {
    for (const c of run.testCasesResults ?? []) {
      for (const m of c.metricsResults ?? []) {
        if (m.type) set.add(m.type)
      }
    }
  }
  return [...set].sort((a, b) => metricLabel(a).localeCompare(metricLabel(b)))
}

// ---- composite (case-level) status ----

export type CompositeMode = 'strict' | 'liberal'

export interface CompositeRunResult {
  passing: number
  total: number
  passRate: number | null
  mode: CompositeMode
}

/**
 * Per-case Pass/Fail derived by combining the case's critical metrics.
 * - "strict" — all critical metrics must Pass for the case to count as passing.
 * - "liberal" — any critical metric Pass is enough.
 * Errored metrics are skipped (they neither pass nor block).
 */
export function computeCompositeRunResult(
  results: TestCaseResult[] | undefined,
  criticalMetrics: Set<string> | null,
  mode: CompositeMode = 'strict',
): CompositeRunResult {
  const cases = results ?? []
  if (cases.length === 0) {
    return { passing: 0, total: 0, passRate: null, mode }
  }
  let passing = 0
  let total = 0
  for (const c of cases) {
    const all = c.metricsResults ?? []
    const filtered = all.filter((m) => {
      if (!m.type) return false
      if (!criticalMetrics) return true
      return criticalMetrics.has(m.type)
    })
    const evaluable = filtered.filter((m) => {
      const s = normalizeMetricStatus(m.result?.status)
      return s === 'Pass' || s === 'Fail' || s === 'Invalid'
    })
    if (evaluable.length === 0) continue
    const statuses = evaluable.map((m) =>
      normalizeMetricStatus(m.result?.status),
    )
    const allPass = statuses.every((s) => s === 'Pass')
    const anyPass = statuses.some((s) => s === 'Pass')
    const isCasePass = mode === 'strict' ? allPass : anyPass
    total += 1
    if (isCasePass) passing += 1
  }
  return {
    passing,
    total,
    passRate: total > 0 ? passing / total : null,
    mode,
  }
}

// ---- cross-run aggregations (TestSet-level widgets) ----

export interface MissingToolEntry {
  schemaName: string
  shortName: string
  stepType: string
  occurrences: number
  runIds: Set<string>
}

export function aggregateMissingTools(runs: TestRun[]): MissingToolEntry[] {
  const map = new Map<string, MissingToolEntry>()
  for (const run of runs) {
    for (const c of run.testCasesResults ?? []) {
      for (const m of c.metricsResults ?? []) {
        if (m.type !== 'CapabilityUse') continue
        const missing = parseMissingInvocationSteps(m)
        for (const step of missing) {
          const key = step.schemaName
          const existing =
            map.get(key) ??
            ({
              schemaName: step.schemaName,
              shortName: simplifySchemaName(step.schemaName),
              stepType: step.stepType,
              occurrences: 0,
              runIds: new Set<string>(),
            } satisfies MissingToolEntry)
          existing.occurrences += 1
          if (run.id) existing.runIds.add(run.id)
          map.set(key, existing)
        }
      }
    }
  }
  return [...map.values()].sort((a, b) => b.occurrences - a.occurrences)
}

export interface ErrorReasonEntry {
  reason: string
  metricTypes: Set<string>
  occurrences: number
}

export function aggregateErrorReasons(runs: TestRun[]): ErrorReasonEntry[] {
  const map = new Map<string, ErrorReasonEntry>()
  for (const run of runs) {
    for (const c of run.testCasesResults ?? []) {
      for (const m of c.metricsResults ?? []) {
        const reason = m.result?.errorReason
        if (!reason) continue
        const existing =
          map.get(reason) ??
          ({
            reason,
            metricTypes: new Set<string>(),
            occurrences: 0,
          } satisfies ErrorReasonEntry)
        existing.occurrences += 1
        if (m.type) existing.metricTypes.add(m.type)
        map.set(reason, existing)
      }
    }
  }
  return [...map.values()].sort((a, b) => b.occurrences - a.occurrences)
}

export interface AiReason {
  text: string
  metricType: string
  caseId: string | undefined
  status: MetricStatus
}

export function collectAiResultReasons(
  run: TestRun | undefined,
): AiReason[] {
  if (!run) return []
  const out: AiReason[] = []
  for (const c of run.testCasesResults ?? []) {
    for (const m of c.metricsResults ?? []) {
      const text = m.result?.aiResultReason
      if (!text) continue
      out.push({
        text,
        metricType: m.type ?? 'Unknown',
        caseId: c.testCaseId,
        status: normalizeMetricStatus(m.result?.status),
      })
    }
  }
  return out
}

// ---- multi-run trend points ----

export interface MetricTrendPoint {
  ts: number
  startTime: string
  runId: string
  /** Pass-rate per metric type, in 0..100 (or undefined if metric absent). */
  passRates: Record<string, number | undefined>
  /** Average numeric score (0..1), only for NUMERIC_SCORE_METRICS. */
  avgScores: Record<string, number | undefined>
}

export function buildMetricTrendPoints(runs: TestRun[]): MetricTrendPoint[] {
  return runs
    .filter((r) => Boolean(r.startTime))
    .map((run) => {
      const stats = computeRunMetricStats(run)
      const passRates: Record<string, number | undefined> = {}
      const avgScores: Record<string, number | undefined> = {}
      for (const s of stats) {
        passRates[s.type] =
          s.passRate === null ? undefined : s.passRate * 100
        if (s.avgScore !== null) avgScores[s.type] = s.avgScore
      }
      return {
        ts: new Date(run.startTime!).getTime(),
        startTime: run.startTime!,
        runId: run.id ?? '',
        passRates,
        avgScores,
      }
    })
    .sort((a, b) => a.ts - b.ts)
}

// ---- formatters ----

export function formatScore(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return n.toFixed(2)
}

export function formatPercent(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return `${(n * 100).toFixed(0)}%`
}

// ---- per-case timelines (across runs) ----

export interface CaseAppearance {
  runId: string
  runStartTime: string
  runName: string | undefined
  status: CaseStatus
  metrics: TestCaseMetric[]
  caseState: string | undefined
}

export interface CaseTimeline {
  caseId: string
  appearances: CaseAppearance[]
}

/** Build a per-case timeline of appearances across the supplied runs (sorted oldest → newest). */
export function buildCaseTimelines(runs: TestRun[]): Map<string, CaseTimeline> {
  const sorted = [...runs].sort(compareRunsByStartTimeAsc)
  const map = new Map<string, CaseTimeline>()
  for (const run of sorted) {
    for (const c of run.testCasesResults ?? []) {
      if (!c.testCaseId) continue
      const existing =
        map.get(c.testCaseId) ??
        ({
          caseId: c.testCaseId,
          appearances: [],
        } as CaseTimeline)
      existing.appearances.push({
        runId: run.id ?? '',
        runStartTime: run.startTime ?? '',
        runName: run.name,
        status: getCaseStatus(c),
        metrics: c.metricsResults ?? [],
        caseState: c.state,
      })
      map.set(c.testCaseId, existing)
    }
  }
  return map
}

export type StreakKind =
  | 'passing'
  | 'failing'
  | 'flaky'
  | 'mixed'
  | 'unknown'

export interface CaseStreak {
  /** Latest contiguous run of the same status from the end of the timeline. */
  length: number
  /** Status that's currently streaking. */
  status: CaseStatus
  /** Pass rate over the last N runs. */
  recentPassRate: number | null
  recentN: number
  kind: StreakKind
}

export function analyzeCaseStreak(
  timeline: CaseTimeline,
  lookback = 10,
): CaseStreak {
  const apps = timeline.appearances
  if (apps.length === 0) {
    return {
      length: 0,
      status: 'Unknown',
      recentPassRate: null,
      recentN: 0,
      kind: 'unknown',
    }
  }
  const recent = apps.slice(-lookback)
  const passes = recent.filter((a) => a.status === 'Pass').length
  const recentPassRate = recent.length > 0 ? passes / recent.length : null

  const last = apps[apps.length - 1].status
  let length = 1
  for (let i = apps.length - 2; i >= 0; i--) {
    if (apps[i].status === last) length += 1
    else break
  }

  let kind: StreakKind = 'mixed'
  if (recentPassRate === 1) kind = 'passing'
  else if (recentPassRate === 0) kind = 'failing'
  else if (
    recentPassRate !== null &&
    recentPassRate >= 0.3 &&
    recentPassRate <= 0.7
  )
    kind = 'flaky'

  return {
    length,
    status: last,
    recentPassRate,
    recentN: recent.length,
    kind,
  }
}

// ---- run-vs-run diff ----

export interface DiffStatusFlip {
  caseId: string
  previousStatus: CaseStatus
  currentStatus: CaseStatus
}

export interface DiffScoreDrop {
  caseId: string
  metricType: string
  previousScore: number
  currentScore: number
  delta: number
}

export interface DiffNewError {
  caseId: string
  metricType: string
  reason: string
}

export interface DiffNewMissingTool {
  caseId: string
  schemaName: string
  shortName: string
}

export interface RunDiff {
  newFailures: DiffStatusFlip[]
  newlyFixed: DiffStatusFlip[]
  scoreDrops: DiffScoreDrop[]
  newErrorReasons: DiffNewError[]
  newMissingTools: DiffNewMissingTool[]
  changesCount: number
}

export interface DiffOptions {
  /** Score deltas of this magnitude (or larger) are reported as drops. Default 0.1. */
  scoreDropThreshold?: number
}

export function diffRuns(
  current: TestRun | undefined,
  previous: TestRun | undefined,
  options?: DiffOptions,
): RunDiff {
  const threshold = options?.scoreDropThreshold ?? 0.1
  const out: RunDiff = {
    newFailures: [],
    newlyFixed: [],
    scoreDrops: [],
    newErrorReasons: [],
    newMissingTools: [],
    changesCount: 0,
  }
  if (!current || !previous) return out

  const currentCases = new Map<string, TestCaseResult>()
  for (const c of current.testCasesResults ?? []) {
    if (c.testCaseId) currentCases.set(c.testCaseId, c)
  }
  const previousCases = new Map<string, TestCaseResult>()
  for (const c of previous.testCasesResults ?? []) {
    if (c.testCaseId) previousCases.set(c.testCaseId, c)
  }

  const failureLike = new Set<CaseStatus>(['Fail', 'Error', 'Invalid'])

  for (const [caseId, currentCase] of currentCases) {
    const previousCase = previousCases.get(caseId)
    if (!previousCase) continue
    const cur = getCaseStatus(currentCase)
    const prev = getCaseStatus(previousCase)
    if (prev === 'Pass' && failureLike.has(cur)) {
      out.newFailures.push({
        caseId,
        previousStatus: prev,
        currentStatus: cur,
      })
    } else if (failureLike.has(prev) && cur === 'Pass') {
      out.newlyFixed.push({
        caseId,
        previousStatus: prev,
        currentStatus: cur,
      })
    }

    const curScores = new Map<string, number>()
    for (const m of currentCase.metricsResults ?? []) {
      const s = parseMetricScore(m)
      if (s !== null && m.type) curScores.set(m.type, s)
    }
    const prevScores = new Map<string, number>()
    for (const m of previousCase.metricsResults ?? []) {
      const s = parseMetricScore(m)
      if (s !== null && m.type) prevScores.set(m.type, s)
    }
    for (const [metricType, prevScore] of prevScores) {
      const curScore = curScores.get(metricType)
      if (curScore !== undefined && prevScore - curScore >= threshold) {
        out.scoreDrops.push({
          caseId,
          metricType,
          previousScore: prevScore,
          currentScore: curScore,
          delta: prevScore - curScore,
        })
      }
    }
  }

  const prevReasons = new Set<string>()
  for (const c of previous.testCasesResults ?? []) {
    for (const m of c.metricsResults ?? []) {
      const r = m.result?.errorReason
      if (r) prevReasons.add(`${m.type ?? '?'}:${r}`)
    }
  }
  for (const [caseId, currentCase] of currentCases) {
    for (const m of currentCase.metricsResults ?? []) {
      const r = m.result?.errorReason
      if (!r) continue
      const k = `${m.type ?? '?'}:${r}`
      if (!prevReasons.has(k)) {
        out.newErrorReasons.push({
          caseId,
          metricType: m.type ?? 'Unknown',
          reason: r,
        })
      }
    }
  }

  const prevMissing = new Set<string>()
  for (const c of previous.testCasesResults ?? []) {
    for (const m of c.metricsResults ?? []) {
      if (m.type !== 'CapabilityUse') continue
      for (const step of parseMissingInvocationSteps(m)) {
        prevMissing.add(step.schemaName)
      }
    }
  }
  for (const [caseId, currentCase] of currentCases) {
    for (const m of currentCase.metricsResults ?? []) {
      if (m.type !== 'CapabilityUse') continue
      for (const step of parseMissingInvocationSteps(m)) {
        if (!prevMissing.has(step.schemaName)) {
          out.newMissingTools.push({
            caseId,
            schemaName: step.schemaName,
            shortName: simplifySchemaName(step.schemaName),
          })
        }
      }
    }
  }

  out.changesCount =
    out.newFailures.length +
    out.newlyFixed.length +
    out.scoreDrops.length +
    out.newErrorReasons.length +
    out.newMissingTools.length

  return out
}

// ---- friendly case labels (derived from AI explanations) ----

/**
 * Try to derive a short, human-friendly label for a test case by mining the
 * AI grader's `aiResultReason` text. Different graders write different shapes:
 *
 *   CustomLabels / GeneralQuality (best):
 *     "The user asks to create a ticket for a slow computer. The agent replies …"
 *
 *   CompareMeaning "doesn't … about" form (good):
 *     "The Agent answer doesn't give any information about logging a ticket, …"
 *     "The Agent answer does not give any instructions about changing an email signature."
 *
 *   CompareMeaning "Expected response …" form (ok — describes the answer, not
 *   the question, but at least disambiguates the case):
 *     "… while the Expected response confirms a support ticket was created."
 *
 * We score each match by tier (1 = best, higher = weaker) and walk every
 * metric in every appearance, keeping the best. Returns `null` when no usable
 * hint can be found (e.g. only AllKeywordMatch was used — no AI text at all).
 *
 * The connector API does NOT expose the test case's input text, so this
 * heuristic is the best we can do without a custom Dataverse query.
 */

interface LabelMatch {
  tier: number
  label: string
}

const USER_PATTERNS: RegExp[] = [
  /^The user asks (?:to |for |about |how to )?(.+?)(?:[.,;]\s|$)/i,
  /^The user wants (?:to (?:know )?)?(.+?)(?:[.,;]\s|$)/i,
  /^The user (?:is )?(?:asking|requesting) (?:to |for |about |how to )?(.+?)(?:[.,;]\s|$)/i,
  /^The user (?:needs|requires) (?:to )?(.+?)(?:[.,;]\s|$)/i,
  /^The user (.+?)(?:[.,;]\s|$)/i,
]

// "doesn't give any information about [TOPIC]" / "didn't address the question about [TOPIC]"
const ABOUT_PATTERN =
  /(?:doesn't|does not|did not|didn't|cannot|can't) (?:address|mention|provide|give|include|acknowledge|explain|cover|discuss)?\s*(?:any |the )?(?:information|instructions|details|response|help|answer|guidance)?\s*(?:about|on|for|regarding) (.+?)(?:[.,;]\s|$)/i

// "question (asked) about [TOPIC]" / "request about [TOPIC]"
const QUESTION_ABOUT_PATTERN =
  /(?:question|request|prompt) (?:asked )?about (.+?)(?:[.,;]\s|$)/i

// "Expected response confirms/explains/gives/... [TOPIC]"
// Stops at conjunctions like " and gives" / " while" so we don't slurp an
// entire compound clause.
const EXPECTED_PATTERN =
  /Expected response (?:confirms|explains|gives|provides|describes|shows|states|says|tells|mentions|details|covers) (?:that )?(.+?)(?:\s+(?:and gives|and provides|and shows|and describes|and tells|and explains|while|because|since|but|however)|[.,;]\s|$)/i

function tryExtractLabel(text: string): LabelMatch | null {
  const trimmed = text.trim()

  // Tier 1: explicit user-question phrasing
  for (const re of USER_PATTERNS) {
    const m = trimmed.match(re)
    if (m && m[1]) {
      const cleaned = cleanLabelFragment(m[1])
      if (cleaned) return { tier: 1, label: capitalize(cleaned) }
    }
  }

  // Tier 2: agent-failure references the topic via "about [TOPIC]"
  let m = trimmed.match(ABOUT_PATTERN)
  if (m && m[1]) {
    const cleaned = cleanLabelFragment(m[1])
    if (cleaned) return { tier: 2, label: capitalize(cleaned) }
  }

  // Tier 2: "question about [TOPIC]"
  m = trimmed.match(QUESTION_ABOUT_PATTERN)
  if (m && m[1]) {
    const cleaned = cleanLabelFragment(m[1])
    if (cleaned) return { tier: 2, label: capitalize(cleaned) }
  }

  // Tier 3: "Expected response …" — describes the answer, not the question,
  // but still disambiguates cases that share no other text.
  m = trimmed.match(EXPECTED_PATTERN)
  if (m && m[1]) {
    const cleaned = cleanLabelFragment(m[1])
    if (cleaned) return { tier: 3, label: capitalize(cleaned) }
  }

  return null
}

function cleanLabelFragment(s: string): string {
  let label = s.trim().replace(/\s+/g, ' ')
  // Strip dangling connector clauses that hint at sentence continuation.
  label = label.replace(
    /\s+(and gives|and provides|and shows|and describes|and tells|and explains|while|because|since|so that|but|however|making|that is|which is)$/i,
    '',
  )
  label = label.replace(/\s+(and|or|but|while|so|that|which)$/i, '')
  // Drop trailing punctuation and stray quote marks
  label = label.replace(/[\s.,;:!?'"`]+$/u, '')
  if (label.length > 70) label = label.slice(0, 67).trimEnd() + '…'
  return label
}

function capitalize(s: string): string {
  if (s.length === 0) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export function deriveCaseLabelFromMetrics(
  metrics: TestCaseMetric[],
): DerivedCaseLabel | null {
  let best: LabelMatch | null = null
  for (const m of metrics) {
    const text = m.result?.aiResultReason
    if (!text) continue
    const match = tryExtractLabel(text)
    if (match && (best === null || match.tier < best.tier)) {
      best = match
      if (best.tier === 1) break
    }
  }
  if (!best) return null
  return { label: best.label, tier: best.tier as 1 | 2 | 3 }
}

export function deriveCaseLabel(timeline: CaseTimeline): DerivedCaseLabel | null {
  let best: LabelMatch | null = null
  for (const a of timeline.appearances) {
    for (const m of a.metrics) {
      const text = m.result?.aiResultReason
      if (!text) continue
      const match = tryExtractLabel(text)
      if (match && (best === null || match.tier < best.tier)) {
        best = match
        if (best.tier === 1) return { label: best.label, tier: 1 }
      }
    }
  }
  if (!best) return null
  return { label: best.label, tier: best.tier as 1 | 2 | 3 }
}

// ---- heatmap data ----

const HEATMAP_STATUS_ORDER: Record<CaseStatus, number> = {
  Fail: 0,
  Error: 1,
  Invalid: 2,
  Unknown: 3,
  Pass: 4,
}

export interface HeatmapCell {
  status: CaseStatus
  /** Whether the case actually appeared in the run. */
  present: boolean
  runId: string
  runStartTime: string
  runName: string | undefined
}

export interface HeatmapRow {
  caseId: string
  /** Most recent observed status (most-right cell that's present). */
  recentStatus: CaseStatus
  /**
   * Friendly label — Dataverse `input` if available, else AI-mined,
   * else null. Components use `labelSource` to badge accordingly.
   */
  caseLabel: string | null
  /** Where the label came from. */
  labelSource: CaseLabelSource
  cells: HeatmapCell[]
}

export interface CaseHeatmapData {
  /** Run column metadata, oldest → newest. */
  columns: { runId: string; runStartTime: string; runName: string | undefined }[]
  rows: HeatmapRow[]
}

/** Build a case-by-run heatmap. Cases sorted with worst-recent-status first. */
export function buildCaseHeatmap(
  runs: TestRun[],
  definitions?: CaseDefinitionsMap,
  caseStatusOptions?: import('./eval').CaseStatusOptions,
): CaseHeatmapData {
  const sorted = [...runs].sort(compareRunsByStartTimeAsc)
  const columns = sorted.map((r) => ({
    runId: r.id ?? '',
    runStartTime: r.startTime ?? '',
    runName: r.name,
  }))

  const caseSet = new Set<string>()
  for (const r of sorted) {
    for (const c of r.testCasesResults ?? []) {
      if (c.testCaseId) caseSet.add(c.testCaseId)
    }
  }

  // AI-mined labels need full timeline scan (the same case can have rich
  // grader text in some runs and just GUIDs in others — we keep the best).
  // We compute these even when definitions are present so we have a clean
  // fallback for cases that exist in old runs but were since deleted.
  const inferredByCaseId = new Map<string, DerivedCaseLabel | null>()
  const timelines = buildCaseTimelines(sorted)
  for (const [caseId, t] of timelines) {
    inferredByCaseId.set(caseId, deriveCaseLabel(t))
  }

  const rows: HeatmapRow[] = []
  for (const caseId of caseSet) {
    const cells: HeatmapCell[] = sorted.map((run) => {
      const cr = (run.testCasesResults ?? []).find(
        (c) => c.testCaseId === caseId,
      )
      const present = Boolean(cr)
      return {
        status: cr ? getCaseStatus(cr, caseStatusOptions) : 'Unknown',
        present,
        runId: run.id ?? '',
        runStartTime: run.startTime ?? '',
        runName: run.name,
      }
    })
    let recentStatus: CaseStatus = 'Unknown'
    for (let i = cells.length - 1; i >= 0; i--) {
      if (cells[i].present) {
        recentStatus = cells[i].status
        break
      }
    }
    const resolved = resolveCaseLabel(caseId, {
      inferredLabel: inferredByCaseId.get(caseId) ?? null,
      definitions,
    })
    rows.push({
      caseId,
      recentStatus,
      caseLabel: resolved.source === 'guid' ? null : resolved.label,
      labelSource: resolved.source,
      cells,
    })
  }

  rows.sort(
    (a, b) =>
      HEATMAP_STATUS_ORDER[a.recentStatus] -
      HEATMAP_STATUS_ORDER[b.recentStatus],
  )

  return { columns, rows }
}

// ---- per-case score trend (for the case detail page) ----

export interface CaseScoreTrendPoint {
  ts: number
  startTime: string
  runId: string
  scores: Record<string, number | undefined>
}

export function buildCaseScoreTrend(
  timeline: CaseTimeline,
): CaseScoreTrendPoint[] {
  return timeline.appearances.map((a) => {
    const scores: Record<string, number | undefined> = {}
    for (const m of a.metrics) {
      const s = parseMetricScore(m)
      if (s !== null && m.type) scores[m.type] = s
    }
    return {
      ts: a.runStartTime ? new Date(a.runStartTime).getTime() : 0,
      startTime: a.runStartTime,
      runId: a.runId,
      scores,
    }
  })
}

// ---- per-case leaderboards ----

export interface PrimaryFailingMetric {
  /** Metric type token (e.g. 'AnyKeywordMatch'). */
  type: string
  /** Pretty label. */
  label: string
  /** Number of appearances where this specific metric failed (or was Invalid/Error). */
  failCount: number
  /** Total number of appearances where this metric was scored at all. */
  totalAppearances: number
  /** failCount / totalAppearances. */
  failRate: number
}

export interface LeaderboardEntry {
  caseId: string
  /**
   * Friendly label — Dataverse `input` if available, else AI-mined,
   * else null. Components use `labelSource` to badge accordingly.
   */
  caseLabel: string | null
  /** Where the label came from. */
  labelSource: CaseLabelSource
  totalAppearances: number
  recentPassRate: number | null
  recentN: number
  latestStatus: CaseStatus
  /** For Most Regressed/Improved: pass rate of older half */
  olderPassRate?: number | null
  /** For Most Regressed/Improved: pass rate of recent half */
  newerPassRate?: number | null
  /** For Most Regressed/Improved: newer - older (negative = regressed) */
  delta?: number
  /** For Flakiest: number of status transitions across recent appearances */
  flipCount?: number
  /**
   * The metric type most often responsible for failing this case across
   * its history — populated when at least one appearance has a failing
   * metric. Helps makers see "is this case actually bad, or is one grader
   * brittle?" Picks the metric with the highest fail count; ties broken by
   * highest fail rate. Returns null if the case never had a failing metric.
   */
  primaryFailingMetric?: PrimaryFailingMetric | null
}

export interface CaseLeaderboards {
  mostRegressed: LeaderboardEntry[]
  mostImproved: LeaderboardEntry[]
  flakiest: LeaderboardEntry[]
  neverPassed: LeaderboardEntry[]
  alwaysPassing: LeaderboardEntry[]
}

export interface LeaderboardOptions {
  /** how many recent appearances to weight in flakiest computation */
  windowSize?: number
  topN?: number
  /** minimum appearances required before a case can appear in regressed/improved */
  minAppearancesForTrend?: number
}

/**
 * Compute the four "what-deserves-attention-first" lists for a test set:
 * Most Regressed, Most Improved, Flakiest, Never Passed (+ Always Passing for completeness).
 *
 * - Regressed/Improved: split each case's history in half (older vs newer)
 *   and rank by delta in pass rate.
 * - Flakiest: count status transitions across the last `windowSize` runs.
 * - Never Passed: cases that have never been Pass in any observed run.
 * - Always Passing: cases that are Pass in every observed run.
 */
export function buildCaseLeaderboards(
  runs: TestRun[],
  options: LeaderboardOptions = {},
  definitions?: CaseDefinitionsMap,
): CaseLeaderboards {
  const { windowSize = 10, topN = 5, minAppearancesForTrend = 4 } = options
  const timelines = buildCaseTimelines(runs)

  const mostRegressed: LeaderboardEntry[] = []
  const mostImproved: LeaderboardEntry[] = []
  const flakiest: LeaderboardEntry[] = []
  const neverPassed: LeaderboardEntry[] = []
  const alwaysPassing: LeaderboardEntry[] = []

  for (const [caseId, t] of timelines) {
    const apps = t.appearances
    if (apps.length === 0) continue
    const recent = apps.slice(-windowSize)
    const passes = recent.filter((a) => a.status === 'Pass').length
    const recentPassRate = recent.length > 0 ? passes / recent.length : null
    const latestStatus = apps[apps.length - 1].status
    const total = apps.length

    const inferred = deriveCaseLabel(t)
    const resolved = resolveCaseLabel(caseId, {
      inferredLabel: inferred,
      definitions,
    })

    // Tally per-metric fail counts across this case's full history so we
    // can flag the metric type most often responsible for failures —
    // makers want to distinguish "case is bad" from "one grader is brittle."
    const metricFailCounts = new Map<string, { fail: number; total: number }>()
    for (const a of apps) {
      for (const m of a.metrics) {
        const type = m.type
        if (!type) continue
        const status = normalizeMetricStatus(m.result?.status)
        const slot =
          metricFailCounts.get(type) ?? { fail: 0, total: 0 }
        slot.total += 1
        if (status === 'Fail' || status === 'Invalid' || status === 'Error') {
          slot.fail += 1
        }
        metricFailCounts.set(type, slot)
      }
    }
    let primaryFailingMetric: PrimaryFailingMetric | null = null
    for (const [type, slot] of metricFailCounts) {
      if (slot.fail === 0) continue
      const failRate = slot.total > 0 ? slot.fail / slot.total : 0
      if (
        !primaryFailingMetric ||
        slot.fail > primaryFailingMetric.failCount ||
        (slot.fail === primaryFailingMetric.failCount &&
          failRate > primaryFailingMetric.failRate)
      ) {
        primaryFailingMetric = {
          type,
          label: metricLabel(type),
          failCount: slot.fail,
          totalAppearances: slot.total,
          failRate,
        }
      }
    }

    const base: LeaderboardEntry = {
      caseId,
      caseLabel: resolved.source === 'guid' ? null : resolved.label,
      labelSource: resolved.source,
      totalAppearances: total,
      recentPassRate,
      recentN: recent.length,
      latestStatus,
      primaryFailingMetric,
    }

    // Never passed (no Pass status in any appearance)
    const everPassed = apps.some((a) => a.status === 'Pass')
    if (!everPassed && total >= 1) {
      neverPassed.push(base)
    }

    // Always passing (Pass in every appearance, requires at least 2 runs)
    if (apps.every((a) => a.status === 'Pass') && total >= 2) {
      alwaysPassing.push(base)
    }

    // Flapping count over recent window
    let flips = 0
    for (let i = 1; i < recent.length; i++) {
      if (recent[i].status !== recent[i - 1].status) flips++
    }
    if (flips >= 2) {
      flakiest.push({ ...base, flipCount: flips })
    }

    // Most regressed / most improved (split older half vs newer half)
    if (apps.length >= minAppearancesForTrend) {
      const half = Math.floor(apps.length / 2)
      const older = apps.slice(0, half)
      const newer = apps.slice(apps.length - half)
      const olderPasses = older.filter((a) => a.status === 'Pass').length
      const newerPasses = newer.filter((a) => a.status === 'Pass').length
      const olderRate = older.length > 0 ? olderPasses / older.length : null
      const newerRate = newer.length > 0 ? newerPasses / newer.length : null
      if (olderRate !== null && newerRate !== null) {
        const delta = newerRate - olderRate
        if (delta < -0.0001) {
          mostRegressed.push({
            ...base,
            olderPassRate: olderRate,
            newerPassRate: newerRate,
            delta,
          })
        } else if (delta > 0.0001) {
          mostImproved.push({
            ...base,
            olderPassRate: olderRate,
            newerPassRate: newerRate,
            delta,
          })
        }
      }
    }
  }

  mostRegressed.sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0))
  mostImproved.sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
  flakiest.sort((a, b) => (b.flipCount ?? 0) - (a.flipCount ?? 0))
  neverPassed.sort((a, b) => b.totalAppearances - a.totalAppearances)
  alwaysPassing.sort((a, b) => b.totalAppearances - a.totalAppearances)

  return {
    mostRegressed: mostRegressed.slice(0, topN),
    mostImproved: mostImproved.slice(0, topN),
    flakiest: flakiest.slice(0, topN),
    neverPassed: neverPassed.slice(0, topN),
    alwaysPassing: alwaysPassing.slice(0, topN),
  }
}

// ---- per-metric leaderboards ----

/** A case that frequently fails on a given metric (used in metric drill-downs). */
export interface MetricAffectedCase {
  caseId: string
  caseLabel: string | null
  labelSource: CaseLabelSource
  /** How many appearances of this case had this metric Fail/Invalid/Error. */
  failCount: number
  /** How many appearances of this case had this metric scored at all. */
  totalCount: number
  /** failCount / totalCount. */
  failRate: number
}

export interface MetricStanding {
  type: string
  label: string
  color: string
  /** Pass/Fail/Invalid/Error totals across every (case × run) tuple where this metric was scored. */
  pass: number
  fail: number
  invalid: number
  error: number
  /** pass + fail + invalid (errors excluded from the denominator). */
  total: number
  /** pass / total. null if total is 0. */
  passRate: number | null
  /** Number of distinct cases where this metric was ever Fail/Invalid/Error. */
  affectedCaseCount: number
  /** Number of distinct runs where this metric had at least one failure. */
  affectedRunCount: number
  /**
   * Per-run pass rates (one entry per run in which this metric appeared).
   * Used to compute flakiness/stability — a metric whose rate swings
   * wildly run-over-run is unreliable.
   */
  perRunPassRates: number[]
  /**
   * Standard deviation of per-run pass rates (0..0.5 effectively).
   * Higher = more unstable. Computed against runs that actually scored
   * the metric; runs where the metric was absent are excluded so a
   * metric that was added partway through history isn't penalized.
   */
  flakeScore: number
  /** Top-N cases most affected by this metric, sorted by failRate desc then failCount desc. */
  topAffectedCases: MetricAffectedCase[]
}

export interface MetricLeaderboards {
  /** Lowest pass rate first; requires `minTotal` scored appearances. */
  hardest: MetricStanding[]
  /** Highest flakeScore first; requires `minRunsForFlake` runs and >0 fails. */
  flakiest: MetricStanding[]
  /** Every metric we saw, sorted by label. Useful for filter UIs. */
  all: MetricStanding[]
}

export interface MetricLeaderboardOptions {
  /** Minimum scored (case × run) appearances before a metric can rank "hardest." */
  minTotal?: number
  /** Minimum scored runs before a metric can rank "flakiest." */
  minRunsForFlake?: number
  /** How many cases to keep in each metric's `topAffectedCases`. */
  topCasesN?: number
  /** How many entries to return in each leaderboard. */
  topN?: number
}

function stddev(xs: number[]): number {
  if (xs.length < 2) return 0
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length
  const variance =
    xs.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / xs.length
  return Math.sqrt(variance)
}

/**
 * Slice evaluation history by *grader* (metric type) instead of by case.
 * Answers the "is the grader brittle?" question — a metric that
 * consistently fails across many cases (or swings wildly between runs)
 * may be more responsible for noise in the dashboard than the cases
 * themselves are.
 *
 * Two ranked lists are produced:
 * - **hardest** — metric types with the lowest aggregate pass rate
 *   (sorted ascending). Reveals graders that are stubbornly red.
 * - **flakiest** — metric types whose per-run pass rate swings most
 *   (sorted by stddev descending). Reveals graders whose output is
 *   inconsistent across runs even though the agent likely didn't change
 *   between them.
 *
 * For each metric, we also compute `topAffectedCases` — the specific
 * cases this metric most often flunks — so a maker can drill in and
 * decide whether to remove the grader, tighten the keyword list, or
 * actually fix the case.
 */
export function buildMetricLeaderboards(
  runs: TestRun[],
  options: MetricLeaderboardOptions = {},
  definitions?: CaseDefinitionsMap,
): MetricLeaderboards {
  const {
    minTotal = 3,
    minRunsForFlake = 3,
    topCasesN = 5,
    topN = 8,
  } = options

  // Aggregator state per metric type.
  type CaseTallies = Map<string, { fail: number; total: number }>
  interface MetricAgg {
    type: string
    pass: number
    fail: number
    invalid: number
    error: number
    /** caseId → counts (fail / total) for this metric within this case. */
    perCase: CaseTallies
    /** runId → counts (fail / total) for this metric within this run. */
    perRun: Map<string, { pass: number; fail: number; invalid: number }>
    failedRunIds: Set<string>
  }
  const agg = new Map<string, MetricAgg>()

  for (const run of runs) {
    const runId = run.id ?? ''
    for (const c of run.testCasesResults ?? []) {
      const caseId = c.testCaseId
      if (!caseId) continue
      for (const m of c.metricsResults ?? []) {
        const type = m.type
        if (!type) continue
        const status = normalizeMetricStatus(m.result?.status)
        const slot =
          agg.get(type) ??
          ({
            type,
            pass: 0,
            fail: 0,
            invalid: 0,
            error: 0,
            perCase: new Map(),
            perRun: new Map(),
            failedRunIds: new Set<string>(),
          } satisfies MetricAgg)
        if (status === 'Pass') slot.pass += 1
        else if (status === 'Fail') slot.fail += 1
        else if (status === 'Invalid') slot.invalid += 1
        else if (status === 'Error') slot.error += 1

        const caseSlot =
          slot.perCase.get(caseId) ?? { fail: 0, total: 0 }
        caseSlot.total += 1
        if (status === 'Fail' || status === 'Invalid' || status === 'Error') {
          caseSlot.fail += 1
          if (runId) slot.failedRunIds.add(runId)
        }
        slot.perCase.set(caseId, caseSlot)

        if (runId) {
          const runSlot =
            slot.perRun.get(runId) ?? { pass: 0, fail: 0, invalid: 0 }
          if (status === 'Pass') runSlot.pass += 1
          else if (status === 'Fail') runSlot.fail += 1
          else if (status === 'Invalid') runSlot.invalid += 1
          slot.perRun.set(runId, runSlot)
        }

        agg.set(type, slot)
      }
    }
  }

  const all: MetricStanding[] = []
  for (const m of agg.values()) {
    const total = m.pass + m.fail + m.invalid
    const passRate = total > 0 ? m.pass / total : null

    const perRunPassRates: number[] = []
    for (const r of m.perRun.values()) {
      const t = r.pass + r.fail + r.invalid
      if (t === 0) continue
      perRunPassRates.push(r.pass / t)
    }
    const flakeScore = stddev(perRunPassRates)

    let affectedCaseCount = 0
    const affectedCases: MetricAffectedCase[] = []
    for (const [caseId, slot] of m.perCase) {
      if (slot.fail === 0) continue
      affectedCaseCount += 1
      const resolved = resolveCaseLabel(caseId, { definitions })
      affectedCases.push({
        caseId,
        caseLabel: resolved.source === 'guid' ? null : resolved.label,
        labelSource: resolved.source,
        failCount: slot.fail,
        totalCount: slot.total,
        failRate: slot.total > 0 ? slot.fail / slot.total : 0,
      })
    }
    affectedCases.sort((a, b) => {
      if (b.failRate !== a.failRate) return b.failRate - a.failRate
      return b.failCount - a.failCount
    })

    all.push({
      type: m.type,
      label: metricLabel(m.type),
      color: metricColor(m.type),
      pass: m.pass,
      fail: m.fail,
      invalid: m.invalid,
      error: m.error,
      total,
      passRate,
      affectedCaseCount,
      affectedRunCount: m.failedRunIds.size,
      perRunPassRates,
      flakeScore,
      topAffectedCases: affectedCases.slice(0, topCasesN),
    })
  }

  const hardest = [...all]
    .filter((m) => m.passRate !== null && m.total >= minTotal)
    .sort((a, b) => (a.passRate ?? 1) - (b.passRate ?? 1))
    .slice(0, topN)

  const flakiest = [...all]
    .filter(
      (m) =>
        m.perRunPassRates.length >= minRunsForFlake &&
        m.fail + m.invalid + m.error > 0,
    )
    .sort((a, b) => b.flakeScore - a.flakeScore)
    .slice(0, topN)

  all.sort((a, b) => a.label.localeCompare(b.label))

  return { hardest, flakiest, all }
}

// ---- coverage drift (case count regressions) ----

export interface CoverageDrift {
  /** Number of cases in the latest run. */
  latestCount: number
  /** Median case count across the prior `baselineWindow` runs. */
  baselineCount: number
  /** Cases that appeared in any of the baseline runs but NOT in the latest. */
  missingCaseIds: string[]
  /** Latest run id (so callers can wire deep links). */
  latestRunId: string | undefined
  /** True if a meaningful drop is detected (latest < baseline AND missing > 0). */
  hasDrift: boolean
}

/**
 * Detect when the latest run executed fewer test cases than recent history
 * suggests it should — a silent "test set drift" signal that inflates pass-rate
 * for the wrong reason.
 *
 * Returns information about which cases are missing, by GUID. Callers can map
 * the GUIDs to friendly labels via `resolveCaseLabel` if Dataverse defs are
 * available.
 *
 * `runs` should be sorted newest-first (the page already does this).
 */
export function computeCoverageDrift(
  runs: TestRun[],
  baselineWindow = 5,
): CoverageDrift {
  const empty: CoverageDrift = {
    latestCount: 0,
    baselineCount: 0,
    missingCaseIds: [],
    latestRunId: undefined,
    hasDrift: false,
  }
  if (runs.length === 0) return empty

  const latest = runs[0]
  const latestCases = new Set<string>()
  for (const c of latest.testCasesResults ?? []) {
    if (c.testCaseId) latestCases.add(c.testCaseId)
  }
  const latestCount = latestCases.size

  const baselineRuns = runs.slice(1, 1 + baselineWindow)
  if (baselineRuns.length === 0) {
    return { ...empty, latestCount, latestRunId: latest.id ?? undefined }
  }

  const counts = baselineRuns.map(
    (r) => new Set((r.testCasesResults ?? []).map((c) => c.testCaseId).filter(Boolean) as string[]).size,
  )
  const sorted = [...counts].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const baselineCount =
    sorted.length % 2 === 0
      ? Math.round((sorted[mid - 1] + sorted[mid]) / 2)
      : sorted[mid]

  const baselineCaseIds = new Set<string>()
  for (const r of baselineRuns) {
    for (const c of r.testCasesResults ?? []) {
      if (c.testCaseId) baselineCaseIds.add(c.testCaseId)
    }
  }
  const missingCaseIds: string[] = []
  for (const id of baselineCaseIds) {
    if (!latestCases.has(id)) missingCaseIds.push(id)
  }

  return {
    latestCount,
    baselineCount,
    missingCaseIds,
    latestRunId: latest.id ?? undefined,
    hasDrift: latestCount < baselineCount && missingCaseIds.length > 0,
  }
}

// ---- flake rate (per case) ----

/**
 * Fraction of status transitions across the most recent `windowSize`
 * appearances. Returns 0..1 — values >0.3 indicate a flaky case whose
 * pass/fail signal is unreliable.
 */
export function computeFlakeRate(
  timeline: CaseTimeline,
  windowSize = 10,
): number {
  const recent = timeline.appearances.slice(-windowSize)
  if (recent.length < 2) return 0
  let flips = 0
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].status !== recent[i - 1].status) flips++
  }
  return flips / (recent.length - 1)
}

/** Map of caseId -> flake rate (0..1) computed across the supplied runs. */
export function computeFlakeRates(
  runs: TestRun[],
  windowSize = 10,
): Map<string, number> {
  const out = new Map<string, number>()
  const timelines = buildCaseTimelines(runs)
  for (const [id, t] of timelines) {
    out.set(id, computeFlakeRate(t, windowSize))
  }
  return out
}

// ---- anomaly markers on trend lines ----

export interface AnomalyMarker {
  ts: number
  metricType: string
  /** value at this ts (passRate 0..100 or score 0..1) */
  value: number
  /** mean of the trailing window */
  mean: number
  /** stddev of the trailing window */
  stddev: number
  /** how many stddev below the mean (positive number; threshold typically >=2) */
  sigmaBelow: number
}

/**
 * Find anomaly markers for a single metric line. For each point with a
 * trailing window of >= `minWindow` prior values, flag it if its value is
 * `thresholdSigma` standard deviations *below* the trailing mean.
 *
 * Returns an array of markers (one per anomalous point) in chronological order.
 */
export function findAnomalies(
  points: { ts: number; value: number | undefined | null }[],
  options: {
    metricType: string
    windowSize?: number
    minWindow?: number
    thresholdSigma?: number
  },
): AnomalyMarker[] {
  const {
    metricType,
    windowSize = 7,
    minWindow = 4,
    thresholdSigma = 2,
  } = options
  const out: AnomalyMarker[] = []
  for (let i = 0; i < points.length; i++) {
    const cur = points[i]
    if (cur.value === undefined || cur.value === null) continue
    const window: number[] = []
    for (let j = Math.max(0, i - windowSize); j < i; j++) {
      const v = points[j].value
      if (typeof v === 'number') window.push(v)
    }
    if (window.length < minWindow) continue
    const mean = window.reduce((a, b) => a + b, 0) / window.length
    const variance =
      window.reduce((sum, v) => sum + (v - mean) ** 2, 0) / window.length
    const stddev = Math.sqrt(variance)
    if (stddev < 1e-9) continue
    const sigmaBelow = (mean - cur.value) / stddev
    if (sigmaBelow >= thresholdSigma) {
      out.push({
        ts: cur.ts,
        metricType,
        value: cur.value,
        mean,
        stddev,
        sigmaBelow,
      })
    }
  }
  return out
}

// ---- since-last-visit diff ----

export interface SinceLastVisitDiff {
  /** Run id we're comparing against (the marker / "last viewed" run). */
  markerRunId: string | undefined
  markerStartTime: string | undefined
  /** Latest (current) run. */
  currentRunId: string | undefined
  currentStartTime: string | undefined
  /** Number of runs that completed strictly between marker and current. */
  runsSinceMarker: number
  /** Cases that were Pass at marker and Fail/Error/Invalid in the latest. */
  newRegressions: DiffStatusFlip[]
  /** Cases that were Fail/Error/Invalid at marker and Pass in the latest. */
  recoveries: DiffStatusFlip[]
  /** Cases that were Fail/Error/Invalid at marker AND in the latest. */
  stillFailing: DiffStatusFlip[]
  /** Cases that flipped at least once between marker and current but landed back at the same status. */
  flippedAndBack: DiffStatusFlip[]
  /** True when there's no marker run (first visit) — caller should hide the inbox. */
  isFirstVisit: boolean
}

/**
 * Compute "what changed since the maker last looked at this test set."
 *
 * `runs` is the full list of runs for the test set, newest-first.
 * `markerRunId` is the run id the maker last viewed (read from localStorage).
 *
 * Behavior:
 * - If markerRunId is absent or doesn't match any run, returns isFirstVisit=true.
 * - If markerRunId matches the latest run (no new runs since), returns empty buckets.
 * - Otherwise, diffs the latest run against the marker run and ALSO inspects
 *   intermediate runs to populate `flippedAndBack`.
 */
export function diffSinceLastVisit(
  runs: TestRun[],
  markerRunId: string | null | undefined,
): SinceLastVisitDiff {
  const empty: SinceLastVisitDiff = {
    markerRunId: undefined,
    markerStartTime: undefined,
    currentRunId: undefined,
    currentStartTime: undefined,
    runsSinceMarker: 0,
    newRegressions: [],
    recoveries: [],
    stillFailing: [],
    flippedAndBack: [],
    isFirstVisit: true,
  }
  if (runs.length === 0) return empty

  const latest = runs[0]
  if (!markerRunId) {
    return {
      ...empty,
      currentRunId: latest.id ?? undefined,
      currentStartTime: latest.startTime ?? undefined,
      isFirstVisit: true,
    }
  }

  const markerIdx = runs.findIndex((r) => r.id === markerRunId)
  if (markerIdx < 0) {
    return {
      ...empty,
      currentRunId: latest.id ?? undefined,
      currentStartTime: latest.startTime ?? undefined,
      isFirstVisit: true,
    }
  }

  const marker = runs[markerIdx]
  if (markerIdx === 0) {
    // Latest IS the marker — nothing new since they last looked.
    return {
      markerRunId: marker.id ?? undefined,
      markerStartTime: marker.startTime ?? undefined,
      currentRunId: latest.id ?? undefined,
      currentStartTime: latest.startTime ?? undefined,
      runsSinceMarker: 0,
      newRegressions: [],
      recoveries: [],
      stillFailing: [],
      flippedAndBack: [],
      isFirstVisit: false,
    }
  }

  const failureLike = new Set<CaseStatus>(['Fail', 'Error', 'Invalid'])
  const markerCases = new Map<string, CaseStatus>()
  for (const c of marker.testCasesResults ?? []) {
    if (c.testCaseId) markerCases.set(c.testCaseId, getCaseStatus(c))
  }
  const latestCases = new Map<string, CaseStatus>()
  for (const c of latest.testCasesResults ?? []) {
    if (c.testCaseId) latestCases.set(c.testCaseId, getCaseStatus(c))
  }

  const newRegressions: DiffStatusFlip[] = []
  const recoveries: DiffStatusFlip[] = []
  const stillFailing: DiffStatusFlip[] = []

  for (const [caseId, latestStatus] of latestCases) {
    const markerStatus = markerCases.get(caseId)
    if (markerStatus === undefined) continue
    if (markerStatus === 'Pass' && failureLike.has(latestStatus)) {
      newRegressions.push({
        caseId,
        previousStatus: markerStatus,
        currentStatus: latestStatus,
      })
    } else if (failureLike.has(markerStatus) && latestStatus === 'Pass') {
      recoveries.push({
        caseId,
        previousStatus: markerStatus,
        currentStatus: latestStatus,
      })
    } else if (failureLike.has(markerStatus) && failureLike.has(latestStatus)) {
      stillFailing.push({
        caseId,
        previousStatus: markerStatus,
        currentStatus: latestStatus,
      })
    }
  }

  // intermediate flip detection — runs strictly between marker and latest
  const intermediate = runs.slice(1, markerIdx)
  const flippedAndBack: DiffStatusFlip[] = []
  if (intermediate.length > 0) {
    for (const [caseId, latestStatus] of latestCases) {
      const markerStatus = markerCases.get(caseId)
      if (markerStatus === undefined) continue
      // only consider cases that look "stable" at the endpoints
      if (markerStatus !== latestStatus) continue
      let saw = false
      for (const r of intermediate) {
        const c = (r.testCasesResults ?? []).find((cc) => cc.testCaseId === caseId)
        if (!c) continue
        if (getCaseStatus(c) !== latestStatus) {
          saw = true
          break
        }
      }
      if (saw) {
        flippedAndBack.push({
          caseId,
          previousStatus: markerStatus,
          currentStatus: latestStatus,
        })
      }
    }
  }

  return {
    markerRunId: marker.id ?? undefined,
    markerStartTime: marker.startTime ?? undefined,
    currentRunId: latest.id ?? undefined,
    currentStartTime: latest.startTime ?? undefined,
    runsSinceMarker: markerIdx,
    newRegressions,
    recoveries,
    stillFailing,
    flippedAndBack,
    isFirstVisit: false,
  }
}

// ---- failure-reason clustering ----

export interface ReasonClusterItem {
  caseId: string | undefined
  metricType: string
  reason: string
}

export interface ReasonCluster {
  /** Representative reason text (the first item in the cluster). */
  representative: string
  /** All items grouped into this cluster. */
  items: ReasonClusterItem[]
  /** Number of distinct cases (caseId) in the cluster. */
  caseCount: number
  /** Predominant metric type in the cluster. */
  metricType: string
}

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'was', 'are', 'were', 'be', 'been',
  'and', 'or', 'but', 'of', 'to', 'in', 'on', 'for', 'with',
  'that', 'this', 'it', 'as', 'at', 'by', 'from', 'has', 'have',
  'had', 'not', 'no', 'do', 'does', 'did', 'so', 'if', 'than',
])

function normalizeReason(s: string): string[] {
  return s
    .toLowerCase()
    // strip GUIDs and numbers
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\b/g, ' ')
    .replace(/[^a-z\s]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
}

function shingles(tokens: string[], n = 2): Set<string> {
  const out = new Set<string>()
  if (tokens.length < n) {
    if (tokens.length > 0) out.add(tokens.join(' '))
    return out
  }
  for (let i = 0; i <= tokens.length - n; i++) {
    out.add(tokens.slice(i, i + n).join(' '))
  }
  return out
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  const union = a.size + b.size - inter
  return union === 0 ? 0 : inter / union
}

/**
 * Group reasons that share the same shape. Uses 2-shingle Jaccard similarity
 * with a 0.5 threshold — empirically that catches "doesn't mention X" /
 * "didn't address Y" variations of the same template without merging
 * unrelated failures.
 *
 * Items with empty / very short reasons are skipped (no signal to cluster on).
 */
export function clusterFailureReasons(
  items: ReasonClusterItem[],
  options: { threshold?: number; minClusterSize?: number } = {},
): ReasonCluster[] {
  const threshold = options.threshold ?? 0.5
  const minClusterSize = options.minClusterSize ?? 2

  type Bucket = {
    items: ReasonClusterItem[]
    repTokens: string[]
    repShingles: Set<string>
    cases: Set<string>
    metricCounts: Map<string, number>
  }
  const buckets: Bucket[] = []

  for (const item of items) {
    const tokens = normalizeReason(item.reason)
    if (tokens.length < 3) continue
    const sh = shingles(tokens)
    let placed = false
    for (const b of buckets) {
      if (jaccard(b.repShingles, sh) >= threshold) {
        b.items.push(item)
        if (item.caseId) b.cases.add(item.caseId)
        b.metricCounts.set(item.metricType, (b.metricCounts.get(item.metricType) ?? 0) + 1)
        placed = true
        break
      }
    }
    if (!placed) {
      const cases = new Set<string>()
      if (item.caseId) cases.add(item.caseId)
      buckets.push({
        items: [item],
        repTokens: tokens,
        repShingles: sh,
        cases,
        metricCounts: new Map([[item.metricType, 1]]),
      })
    }
  }

  return buckets
    .filter((b) => b.items.length >= minClusterSize)
    .map((b) => {
      let metricType = 'Unknown'
      let topCount = 0
      for (const [t, c] of b.metricCounts) {
        if (c > topCount) {
          metricType = t
          topCount = c
        }
      }
      return {
        representative: b.items[0].reason,
        items: b.items,
        caseCount: b.cases.size,
        metricType,
      }
    })
    .sort((a, b) => b.caseCount - a.caseCount || b.items.length - a.items.length)
}

// ============================================================================
// Agent landing-page insight model
// ============================================================================
//
// Given the runs for a single test set + the maker's "last viewed run" marker,
// compute a single highest-priority signal worth surfacing on the agent
// landing card. Priority order (matches both feedback agents' converged plan):
//
//   coverage-drift > new-regressions > anomaly-drop > stale > recoveries
//   > all-passing > streak-passing > mixed > first-run > no-runs
//
// The caller renders ONE Badge per card based on `kind` + `label`, and sorts
// cards by `priority` desc to bring the test sets needing attention to the top.

export type LandingInsightKind =
  | 'no-runs'
  | 'first-run'
  | 'coverage-drift'
  | 'new-regressions'
  | 'anomaly-drop'
  | 'stale'
  | 'recoveries'
  | 'all-passing'
  | 'streak-passing'
  | 'mixed'

export interface AgentLandingCardInsight {
  kind: LandingInsightKind
  /** Short label suitable for a Badge ("1 new regression"). */
  label: string
  /** Tooltip / longer explanation. */
  detail: string
  severity: 'success' | 'warning' | 'danger' | 'info' | 'subtle'
  /** Higher = more urgent. Use for sorting cards. */
  priority: number
  // ---- raw signals (callers can render secondary chrome from these) ----
  latestPassRate: number | null
  /** percentage points (positive = improving). */
  passRateDelta: number | null
  daysSinceLatest: number | null
  runsSinceMarker: number
  newRegressionsCount: number
  recoveriesCount: number
  hasCoverageDrift: boolean
  hasAnomaly: boolean
  isStale: boolean
}

export interface ComputeLandingInsightOptions {
  /** Current time in ms since epoch — accepted as a parameter to keep the function pure (React 19 useMemo purity). */
  now?: number
  /** Days without a new run before the test set is considered stale. */
  staleDays?: number
}

function strictPassRate(run: TestRun | undefined): number | null {
  if (!run) return null
  const r = computeCompositeRunResult(run.testCasesResults, null, 'strict')
  return r.passRate
}

export function computeAgentLandingInsight(
  runs: ReadonlyArray<TestRun>,
  markerRunId: string | null | undefined,
  options: ComputeLandingInsightOptions = {},
): AgentLandingCardInsight {
  const now = options.now ?? Date.now()
  const staleDays = options.staleDays ?? 14

  const sorted = [...runs].sort(compareRunsByStartTimeDesc)
  const latest = sorted[0]
  const prior = sorted[1]

  const latestPassRate = strictPassRate(latest)
  const priorPassRate = strictPassRate(prior)
  const passRateDelta =
    latestPassRate !== null && priorPassRate !== null
      ? (latestPassRate - priorPassRate) * 100
      : null

  const latestTime = latest?.startTime
    ? new Date(latest.startTime).getTime()
    : null
  const daysSinceLatest =
    latestTime !== null && Number.isFinite(latestTime)
      ? Math.max(0, (now - latestTime) / 86_400_000)
      : null

  // Coverage drift (median of recent runs vs latest case count)
  const drift = runs.length >= 2 ? computeCoverageDrift([...runs]) : null
  const hasCoverageDrift = drift?.hasDrift ?? false

  // Anomaly: build pass-rate-over-time points and check whether latest fires
  let hasAnomaly = false
  if (sorted.length >= 5 && latestTime !== null) {
    const points = sorted
      .slice()
      .reverse()
      .map((r) => {
        const t = r.startTime ? new Date(r.startTime).getTime() : NaN
        const pr = strictPassRate(r)
        return { ts: t, value: pr === null ? null : pr * 100 }
      })
      .filter((p): p is { ts: number; value: number } =>
        Number.isFinite(p.ts) && p.value !== null,
      )
    if (points.length >= 5) {
      const anomalies = findAnomalies(points, { metricType: 'strict' })
      hasAnomaly = anomalies.some((a) => a.ts === latestTime)
    }
  }

  // Diff vs marker
  const diff = diffSinceLastVisit(sorted, markerRunId)
  const newRegressionsCount = diff.newRegressions.length
  const recoveriesCount = diff.recoveries.length
  const runsSinceMarker = diff.runsSinceMarker

  const isStale =
    daysSinceLatest !== null && daysSinceLatest >= staleDays && runs.length > 0

  // Pick a single insight in priority order.
  if (runs.length === 0) {
    return {
      kind: 'no-runs',
      label: 'No runs yet',
      detail: 'No evaluation runs in the last 89 days.',
      severity: 'subtle',
      priority: 0,
      latestPassRate: null,
      passRateDelta: null,
      daysSinceLatest: null,
      runsSinceMarker: 0,
      newRegressionsCount: 0,
      recoveriesCount: 0,
      hasCoverageDrift: false,
      hasAnomaly: false,
      isStale: false,
    }
  }

  if (runs.length === 1) {
    return {
      kind: 'first-run',
      label: 'First run',
      detail: 'Run again to see a trend.',
      severity: 'info',
      priority: 5,
      latestPassRate,
      passRateDelta: null,
      daysSinceLatest,
      runsSinceMarker,
      newRegressionsCount,
      recoveriesCount,
      hasCoverageDrift,
      hasAnomaly,
      isStale,
    }
  }

  if (hasCoverageDrift && drift) {
    const missing = drift.missingCaseIds.length
    return {
      kind: 'coverage-drift',
      label: `Coverage drift: ${drift.latestCount}/${drift.baselineCount} cases`,
      detail: `Latest run executed ${drift.latestCount} cases; baseline was ${drift.baselineCount}. ${missing} missing case${missing === 1 ? '' : 's'}.`,
      severity: 'warning',
      priority: 100,
      latestPassRate,
      passRateDelta,
      daysSinceLatest,
      runsSinceMarker,
      newRegressionsCount,
      recoveriesCount,
      hasCoverageDrift: true,
      hasAnomaly,
      isStale,
    }
  }

  if (newRegressionsCount > 0) {
    return {
      kind: 'new-regressions',
      label: `${newRegressionsCount} new regression${newRegressionsCount === 1 ? '' : 's'}`,
      detail: `Since you last looked, ${newRegressionsCount} case${newRegressionsCount === 1 ? ' has' : 's have'} flipped from passing to failing.`,
      severity: 'danger',
      priority: 90,
      latestPassRate,
      passRateDelta,
      daysSinceLatest,
      runsSinceMarker,
      newRegressionsCount,
      recoveriesCount,
      hasCoverageDrift,
      hasAnomaly,
      isStale,
    }
  }

  if (hasAnomaly) {
    const deltaText =
      passRateDelta !== null && passRateDelta < 0
        ? ` (${passRateDelta.toFixed(0)} pp)`
        : ''
    return {
      kind: 'anomaly-drop',
      label: `Anomaly drop${deltaText}`,
      detail: 'Latest pass-rate is more than 2σ below the trailing-7-run mean.',
      severity: 'danger',
      priority: 80,
      latestPassRate,
      passRateDelta,
      daysSinceLatest,
      runsSinceMarker,
      newRegressionsCount,
      recoveriesCount,
      hasCoverageDrift,
      hasAnomaly: true,
      isStale,
    }
  }

  if (isStale && daysSinceLatest !== null) {
    const days = Math.floor(daysSinceLatest)
    return {
      kind: 'stale',
      label: `No runs in ${days}d`,
      detail: `Last evaluated ${days} day${days === 1 ? '' : 's'} ago. Consider scheduling regular runs.`,
      severity: 'warning',
      priority: 60,
      latestPassRate,
      passRateDelta,
      daysSinceLatest,
      runsSinceMarker,
      newRegressionsCount,
      recoveriesCount,
      hasCoverageDrift,
      hasAnomaly,
      isStale: true,
    }
  }

  if (recoveriesCount > 0) {
    return {
      kind: 'recoveries',
      label: `${recoveriesCount} recover${recoveriesCount === 1 ? 'y' : 'ies'}`,
      detail: `Since you last looked, ${recoveriesCount} case${recoveriesCount === 1 ? ' has' : 's have'} flipped from failing to passing.`,
      severity: 'success',
      priority: 40,
      latestPassRate,
      passRateDelta,
      daysSinceLatest,
      runsSinceMarker,
      newRegressionsCount,
      recoveriesCount,
      hasCoverageDrift,
      hasAnomaly,
      isStale: false,
    }
  }

  // Streak — count trailing strict-pass-rate === 1 runs
  if (latestPassRate === 1) {
    let streak = 0
    for (const r of sorted) {
      if (strictPassRate(r) === 1) streak++
      else break
    }
    if (streak >= 3) {
      return {
        kind: 'streak-passing',
        label: `${streak} runs green`,
        detail: `${streak} consecutive runs at 100% strict pass-rate.`,
        severity: 'success',
        priority: 30,
        latestPassRate,
        passRateDelta,
        daysSinceLatest,
        runsSinceMarker,
        newRegressionsCount,
        recoveriesCount,
        hasCoverageDrift: false,
        hasAnomaly: false,
        isStale: false,
      }
    }
    return {
      kind: 'all-passing',
      label: 'All passing',
      detail: 'Latest run: 100% strict pass-rate.',
      severity: 'success',
      priority: 20,
      latestPassRate,
      passRateDelta,
      daysSinceLatest,
      runsSinceMarker,
      newRegressionsCount,
      recoveriesCount,
      hasCoverageDrift: false,
      hasAnomaly: false,
      isStale: false,
    }
  }

  // Default — show pass rate + delta
  const deltaSuffix =
    passRateDelta !== null && Math.abs(passRateDelta) >= 1
      ? ` (${passRateDelta > 0 ? '+' : ''}${passRateDelta.toFixed(0)} pp)`
      : ''
  const label =
    latestPassRate !== null
      ? `${(latestPassRate * 100).toFixed(0)}%${deltaSuffix}`
      : 'No data'
  return {
    kind: 'mixed',
    label,
    detail:
      latestPassRate !== null
        ? `Latest strict pass-rate ${(latestPassRate * 100).toFixed(0)}%.`
        : 'No passable cases in the latest run.',
    severity: 'info',
    priority: 10,
    latestPassRate,
    passRateDelta,
    daysSinceLatest,
    runsSinceMarker,
    newRegressionsCount,
    recoveriesCount,
    hasCoverageDrift: false,
    hasAnomaly: false,
    isStale: false,
  }
}

// ---- agent-level health summary (for the strip above the test-set grid) ----

export interface AgentHealthSummary {
  totalSets: number
  healthySets: number
  setsWithRegressions: number
  setsWithDrift: number
  setsWithAnomaly: number
  staleSets: number
  setsWithNoRuns: number
  /** Sum of latest-run case counts across all test sets. */
  totalCasesLatest: number
  /** Cases passing strictly in the latest run, summed across test sets. */
  passingCasesLatest: number
}

export function summarizeAgentHealth(
  insights: ReadonlyArray<{ insight: AgentLandingCardInsight; latest: TestRun | undefined }>,
): AgentHealthSummary {
  const out: AgentHealthSummary = {
    totalSets: insights.length,
    healthySets: 0,
    setsWithRegressions: 0,
    setsWithDrift: 0,
    setsWithAnomaly: 0,
    staleSets: 0,
    setsWithNoRuns: 0,
    totalCasesLatest: 0,
    passingCasesLatest: 0,
  }
  for (const { insight, latest } of insights) {
    if (insight.kind === 'no-runs') out.setsWithNoRuns += 1
    if (insight.newRegressionsCount > 0) out.setsWithRegressions += 1
    if (insight.hasCoverageDrift) out.setsWithDrift += 1
    if (insight.hasAnomaly) out.setsWithAnomaly += 1
    if (insight.isStale) out.staleSets += 1
    if (
      insight.kind === 'all-passing' ||
      insight.kind === 'streak-passing' ||
      insight.kind === 'recoveries' ||
      (insight.kind === 'mixed' && (insight.latestPassRate ?? 0) >= 0.8)
    ) {
      out.healthySets += 1
    }

    if (latest) {
      const composite = computeCompositeRunResult(
        latest.testCasesResults,
        null,
        'strict',
      )
      out.totalCasesLatest += composite.total
      out.passingCasesLatest += composite.passing
    }
  }
  return out
}

// ---- numeric score drift (CompareMeaning, TextSimilarity) ----

export interface NumericScoreDrift {
  caseId: string
  metricType: string
  /** Mean of scores in the baseline window (older runs). */
  baselineScore: number
  /** Score on the latest run for this case. */
  latestScore: number
  /** Drop relative to baseline, expressed 0..1 (e.g. 0.22 = 22% lower than baseline). */
  deltaPct: number
  /** Number of baseline observations the mean was computed over. */
  baselineN: number
  /** Latest run id (so callers can link back to it). */
  latestRunId: string | undefined
}

export interface NumericScoreDriftOptions {
  /**
   * Relative drop threshold (latest < baseline by this fraction). Default 0.2 (= 20%).
   */
  thresholdPct?: number
  /**
   * Minimum baseline observations required to flag a drift. Without enough
   * history we can't tell drift from noise. Default 3.
   */
  minBaselineN?: number
  /**
   * Maximum age (ms) of runs to include in the baseline window. Older runs
   * are ignored even if available. Default 30 days.
   */
  baselineMaxAgeMs?: number
}

/**
 * Detect cases whose latest numeric score dropped meaningfully versus a
 * rolling baseline. Operates only on metrics in `NUMERIC_SCORE_METRICS`
 * (CompareMeaning, TextSimilarity) where `data.score` is a 0..1 value.
 *
 * For each (case, metric) we look at the latest appearance with a score and
 * compare it to the mean of prior scores in the baseline window. We flag the
 * case when the latest is below baseline by at least `thresholdPct`.
 *
 * Returns drift entries sorted by largest drop first.
 *
 * `runs` may be in any order — we sort defensively.
 */
export function detectNumericScoreDrift(
  runs: TestRun[],
  options?: NumericScoreDriftOptions,
): NumericScoreDrift[] {
  const thresholdPct = options?.thresholdPct ?? 0.2
  const minBaselineN = options?.minBaselineN ?? 3
  const baselineMaxAgeMs = options?.baselineMaxAgeMs ?? 30 * 24 * 3_600_000

  const timelines = buildCaseTimelines(runs)
  const out: NumericScoreDrift[] = []

  for (const [caseId, timeline] of timelines) {
    for (const metricType of NUMERIC_SCORE_METRICS) {
      const scored: { ts: number; score: number; runId: string }[] = []
      for (const app of timeline.appearances) {
        const ts = app.runStartTime
          ? new Date(app.runStartTime).getTime()
          : NaN
        if (!Number.isFinite(ts)) continue
        const metric = app.metrics.find((m) => m.type === metricType)
        if (!metric) continue
        const score = parseMetricScore(metric)
        if (score === null) continue
        scored.push({ ts, score, runId: app.runId })
      }
      if (scored.length < minBaselineN + 1) continue

      scored.sort((a, b) => a.ts - b.ts)
      const latest = scored[scored.length - 1]
      const cutoff = latest.ts - baselineMaxAgeMs
      const baseline = scored
        .slice(0, -1)
        .filter((p) => p.ts >= cutoff)
      if (baseline.length < minBaselineN) continue

      const baselineScore =
        baseline.reduce((a, b) => a + b.score, 0) / baseline.length
      if (baselineScore <= 0) continue
      const deltaPct = (baselineScore - latest.score) / baselineScore
      if (deltaPct < thresholdPct) continue

      out.push({
        caseId,
        metricType,
        baselineScore,
        latestScore: latest.score,
        deltaPct,
        baselineN: baseline.length,
        latestRunId: latest.runId || undefined,
      })
    }
  }

  out.sort((a, b) => b.deltaPct - a.deltaPct)
  return out
}

// ---- capability coverage (per-tool fire rate across runs) ----

export interface CapabilityCoverageEntry {
  schemaName: string
  shortName: string
  stepType: string
  /** Runs in which this tool was triggered at least once. */
  triggeredRunIds: Set<string>
  /** Runs in which this tool was reported missing at least once. */
  missingRunIds: Set<string>
  /** Total runs in which the tool was *expected* (triggered ∪ missing). */
  expectedRunCount: number
  /** triggeredRunIds.size / expectedRunCount, in 0..1. */
  fireRate: number
}

/**
 * Build per-tool coverage stats across the supplied runs.
 *
 * "Expected" runs are runs where the tool was either reported as triggered
 * (it fired) or as missing (it should have fired but didn't). A tool is
 * considered "covered" in a run when it appears in `triggeredinvocationsteps`
 * for at least one case.
 *
 * Returned entries are sorted by ascending fire rate (worst coverage first),
 * tiebreak by descending expected-run count so well-known tools surface ahead
 * of one-off observations.
 */
export function aggregateCapabilityCoverage(
  runs: TestRun[],
): CapabilityCoverageEntry[] {
  const map = new Map<string, CapabilityCoverageEntry>()

  const ensure = (
    schemaName: string,
    stepType: string,
  ): CapabilityCoverageEntry => {
    const existing = map.get(schemaName)
    if (existing) return existing
    const created: CapabilityCoverageEntry = {
      schemaName,
      shortName: simplifySchemaName(schemaName),
      stepType,
      triggeredRunIds: new Set<string>(),
      missingRunIds: new Set<string>(),
      expectedRunCount: 0,
      fireRate: 0,
    }
    map.set(schemaName, created)
    return created
  }

  for (const run of runs) {
    const runId = run.id ?? ''
    for (const c of run.testCasesResults ?? []) {
      for (const m of c.metricsResults ?? []) {
        if (m.type !== 'CapabilityUse') continue
        for (const step of parseTriggeredInvocationSteps(m)) {
          if (!step.schemaName) continue
          const entry = ensure(step.schemaName, step.stepType)
          if (runId) entry.triggeredRunIds.add(runId)
        }
        for (const step of parseMissingInvocationSteps(m)) {
          if (!step.schemaName) continue
          const entry = ensure(step.schemaName, step.stepType)
          if (runId) entry.missingRunIds.add(runId)
        }
      }
    }
  }

  const out: CapabilityCoverageEntry[] = []
  for (const entry of map.values()) {
    const expected = new Set<string>([
      ...entry.triggeredRunIds,
      ...entry.missingRunIds,
    ])
    entry.expectedRunCount = expected.size
    entry.fireRate =
      expected.size > 0 ? entry.triggeredRunIds.size / expected.size : 0
    out.push(entry)
  }

  out.sort((a, b) => {
    if (a.fireRate !== b.fireRate) return a.fireRate - b.fireRate
    return b.expectedRunCount - a.expectedRunCount
  })
  return out
}

export interface CapabilityCoverageSummary {
  /** Distinct tools observed across all runs (triggered or missing). */
  totalTools: number
  /**
   * Tools that fired successfully in the latest run where they were expected.
   * Counts a tool when its latest expected-run had it in `triggered`.
   */
  firingTools: number
  /** Tools whose latest expected appearance had them missing. */
  missingInLatest: number
}

/** Compact summary numbers for a header strap (e.g. "5 of 7 tools firing"). */
export function summarizeCapabilityCoverage(
  entries: CapabilityCoverageEntry[],
): CapabilityCoverageSummary {
  const totalTools = entries.length
  let firingTools = 0
  let missingInLatest = 0
  for (const e of entries) {
    if (e.fireRate >= 1) firingTools += 1
    else if (e.triggeredRunIds.size === 0) missingInLatest += 1
    else firingTools += 1
  }
  return { totalTools, firingTools, missingInLatest }
}

// ---- run duration trend ----

export interface RunDurationPoint {
  ts: number
  startTime: string
  runId: string
  runName: string | undefined
  /** Run duration in ms (endTime - startTime), or null if either timestamp missing. */
  durationMs: number | null
}

/**
 * Build a per-run duration series, oldest → newest.
 *
 * Runs missing either start or end time are kept in the series with
 * `durationMs = null` so the chart can break the line at those points (using
 * `connectNulls={false}`).
 */
export function buildRunDurationTrend(runs: TestRun[]): RunDurationPoint[] {
  return [...runs]
    .filter((r) => Boolean(r.startTime))
    .sort(compareRunsByStartTimeAsc)
    .map((r) => {
      const ts = new Date(r.startTime!).getTime()
      let durationMs: number | null = null
      if (r.endTime) {
        const end = new Date(r.endTime).getTime()
        if (Number.isFinite(end) && end >= ts) durationMs = end - ts
      }
      return {
        ts,
        startTime: r.startTime!,
        runId: r.id ?? '',
        runName: r.name,
        durationMs,
      }
    })
}

// ---- agent-wide trend (sums across all test sets, bucketed by day) ----

export interface AgentTrendPoint {
  /** Bucket timestamp (start of UTC day). Suitable for time-axis charts. */
  ts: number
  /** Friendly label for the bucket (yyyy-MM-dd). */
  date: string
  /** Total strict-passing cases across every run whose start time fell in the bucket. */
  passing: number
  /** Total cases across every run in the bucket. */
  total: number
  /** passing / total, or null if total is 0. Convenient for chart Y-axis. */
  passRate: number | null
  /** Number of runs that fell in the bucket. */
  runCount: number
  /** Number of distinct test sets that had a run in the bucket. */
  testSetCount: number
}

/**
 * Build a per-day trend of strict pass-rate across every test set on the agent.
 *
 * One run = one (testSetId, startTime) data point. We bucket runs by UTC day
 * and sum strict passing/total across every run that landed in the bucket.
 * If two test sets ran the same day they both contribute to that day's totals
 * — the resulting line is "how is the whole agent doing today".
 *
 * Returns an empty array when there are no runs with a parseable startTime.
 * Sorted ascending by ts.
 */
export function buildAgentTrend(runs: readonly TestRun[]): AgentTrendPoint[] {
  if (!runs.length) return []
  const buckets = new Map<
    number,
    {
      ts: number
      passing: number
      total: number
      runCount: number
      testSetIds: Set<string>
    }
  >()
  for (const run of runs) {
    if (!run.startTime) continue
    const t = new Date(run.startTime).getTime()
    if (!Number.isFinite(t)) continue
    // UTC day bucket — avoids timezone churn on the line
    const d = new Date(t)
    const bucketTs = Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
    )
    const composite = computeCompositeRunResult(
      run.testCasesResults,
      null,
      'strict',
    )
    let entry = buckets.get(bucketTs)
    if (!entry) {
      entry = {
        ts: bucketTs,
        passing: 0,
        total: 0,
        runCount: 0,
        testSetIds: new Set<string>(),
      }
      buckets.set(bucketTs, entry)
    }
    entry.passing += composite.passing
    entry.total += composite.total
    entry.runCount += 1
    if (run.testSetId) entry.testSetIds.add(run.testSetId)
  }
  const points: AgentTrendPoint[] = []
  for (const e of buckets.values()) {
    const d = new Date(e.ts)
    const yyyy = d.getUTCFullYear()
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    points.push({
      ts: e.ts,
      date: `${yyyy}-${mm}-${dd}`,
      passing: e.passing,
      total: e.total,
      passRate: e.total > 0 ? e.passing / e.total : null,
      runCount: e.runCount,
      testSetCount: e.testSetIds.size,
    })
  }
  points.sort((a, b) => a.ts - b.ts)
  return points
}

// ---- agent activity summary (powers landing KPI strip) ----

export interface AgentActivitySummary {
  /** Most recent run's start timestamp (epoch ms), or null when no runs. */
  lastRunTs: number | null
  /** Total runs across every test set on the agent. */
  totalRuns: number
  /** Runs in the last 7 days (rolling, from `now`). */
  runsLast7Days: number
  /** Runs in the last 14 days (rolling, from `now`). */
  runsLast14Days: number
  /**
   * Per-day run counts for the last 14 days, oldest first.
   * Length is always 14; days with no runs are 0. Suitable for a sparkline.
   */
  perDayLast14: number[]
  /** Distinct ownerIds seen across all runs. */
  distinctOwnerIds: string[]
}

export function summarizeAgentActivity(
  runs: readonly TestRun[],
  options: { now?: number } = {},
): AgentActivitySummary {
  const now = options.now ?? Date.now()
  const dayMs = 86_400_000
  const out: AgentActivitySummary = {
    lastRunTs: null,
    totalRuns: 0,
    runsLast7Days: 0,
    runsLast14Days: 0,
    perDayLast14: Array.from({ length: 14 }, () => 0),
    distinctOwnerIds: [],
  }
  if (!runs.length) return out
  const owners = new Set<string>()
  // Bucket index 13 = today, 0 = 13 days ago (UTC day boundaries).
  const todayUtc = (() => {
    const d = new Date(now)
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  })()
  for (const run of runs) {
    if (run.ownerId) owners.add(run.ownerId)
    if (!run.startTime) continue
    const t = new Date(run.startTime).getTime()
    if (!Number.isFinite(t)) continue
    out.totalRuns += 1
    if (out.lastRunTs === null || t > out.lastRunTs) out.lastRunTs = t
    const ageMs = now - t
    if (ageMs <= 7 * dayMs) out.runsLast7Days += 1
    if (ageMs <= 14 * dayMs) out.runsLast14Days += 1
    const d = new Date(t)
    const runUtcDay = Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
    )
    const dayDelta = Math.round((todayUtc - runUtcDay) / dayMs)
    if (dayDelta >= 0 && dayDelta < 14) {
      out.perDayLast14[13 - dayDelta] += 1
    }
  }
  out.distinctOwnerIds = [...owners]
  return out
}


