import { useMemo } from 'react'
import type { TestRun } from '../generated/models/MicrosoftCopilotStudioModel'
import {
  computeRunMetricStats,
  metricLabel,
  type MetricStats,
} from './metrics'
import { compareRunsByStartTimeDesc } from './eval'

/**
 * The kind of pattern detected when comparing the latest run against a
 * baseline of recent prior runs. Used to drive the auto-diagnose banner.
 *
 *  - `no-baseline`         — fewer than 2 prior runs; can't reliably diagnose.
 *  - `stable`              — no metric dropped meaningfully.
 *  - `improved`            — latest run improved over baseline.
 *  - `knowledge-source-broken` — General quality + Compare meaning (or Text
 *    similarity) collapsed together while tool use stayed fine. Strong signal
 *    that a knowledge source (SharePoint, website, file) changed shape or
 *    became unreachable, so the LLM is generating answers that no longer
 *    match the expected reference.
 *  - `connector-broken`    — Tool use collapsed in isolation. The agent is
 *    failing to invoke a tool/connector — auth probably expired or the
 *    connector got revoked.
 *  - `keyword-only-broken` — Only keyword-match graders dropped; semantic
 *    graders (compare meaning / general quality) are stable. Often means the
 *    agent rephrased its answers — not a real regression, but worth
 *    confirming the keyword list is still appropriate.
 *  - `platform-wide`       — Most or all metrics dropped at once. Likely a
 *    platform/runtime issue (Copilot Studio outage, agent unpublished,
 *    test set itself broken).
 *  - `partial-degradation` — Some metrics dropped, no clean pattern.
 */
export type DiagnosePattern =
  | 'no-baseline'
  | 'stable'
  | 'improved'
  | 'knowledge-source-broken'
  | 'connector-broken'
  | 'keyword-only-broken'
  | 'platform-wide'
  | 'partial-degradation'

export interface AffectedMetric {
  type: string
  label: string
  baselinePassRate: number
  latestPassRate: number
  deltaPp: number
}

export interface DiagnoseResult {
  pattern: DiagnosePattern
  severity: 'success' | 'warning' | 'danger' | 'info'
  /** Short banner title. */
  title: string
  /** One-paragraph plain-English explanation. */
  description: string
  /** 1–3 concrete next steps. */
  suggestedActions: string[]
  /** Metrics that meaningfully dropped vs baseline. */
  droppedMetrics: AffectedMetric[]
  /** Metrics that stayed stable (within ±10pp of baseline). */
  stableMetrics: AffectedMetric[]
  /** How many runs were used to compute the baseline. */
  baselineRuns: number
}

export interface DiagnoseOptions {
  /** Number of prior runs to average for baseline. Default 5. */
  baselineWindow?: number
  /** A metric is "dropped" if it falls this many percentage points or more below baseline. Default 25. */
  dropThresholdPp?: number
  /** Baseline pass rate must be at least this high for a drop to count (otherwise the metric was already broken). Default 0.5 (50%). */
  baselineFloor?: number
  /** Improvement threshold (pp) to flag as "improved". Default 15. */
  improveThresholdPp?: number
}

const KNOWLEDGE_METRICS = new Set([
  'GeneralQuality',
  'CompareMeaning',
  'TextSimilarity',
])
const KEYWORD_METRICS = new Set(['AnyKeywordMatch', 'AllKeywordMatch'])
const TOOL_METRICS = new Set(['CapabilityUse'])

function aggregateBaseline(
  baselineRuns: ReadonlyArray<TestRun>,
): Map<string, MetricStats> {
  const acc = new Map<string, { pass: number; total: number }>()
  for (const r of baselineRuns) {
    const stats = computeRunMetricStats(r)
    for (const s of stats) {
      const cur = acc.get(s.type) ?? { pass: 0, total: 0 }
      cur.pass += s.pass
      cur.total += s.total
      acc.set(s.type, cur)
    }
  }
  const out = new Map<string, MetricStats>()
  for (const [type, { pass, total }] of acc) {
    out.set(type, {
      type,
      label: metricLabel(type),
      color: '',
      pass,
      fail: 0,
      invalid: 0,
      error: 0,
      total,
      totalWithError: total,
      passRate: total > 0 ? pass / total : null,
      numericScores: [],
      avgScore: null,
    })
  }
  return out
}

/**
 * Pattern-match the latest run vs. a rolling baseline of prior runs and
 * return a plain-English diagnosis. Pure function — caller owns the runs.
 */
export function diagnoseRunPattern(
  runs: ReadonlyArray<TestRun>,
  options: DiagnoseOptions = {},
): DiagnoseResult {
  const {
    baselineWindow = 5,
    dropThresholdPp = 25,
    baselineFloor = 0.5,
    improveThresholdPp = 15,
  } = options

  const sorted = [...runs].sort(compareRunsByStartTimeDesc)
  const latest = sorted[0]
  const prior = sorted.slice(1, 1 + baselineWindow)

  if (!latest || prior.length < 2) {
    const havePrior = prior.length
    const description =
      havePrior === 0
        ? 'You only have one run so far. Once a couple more runs land we can start spotting patterns — what changed, and why it likely changed.'
        : 'You have 1 prior run — we need at least 2 to average a baseline before calling out a regression. One more run and this card will switch on.'
    return {
      pattern: 'no-baseline',
      severity: 'info',
      title: 'Not enough runs yet for diagnosis',
      description,
      suggestedActions: [
        'Run the test set a few more times — ideally on a schedule via Power Automate so the data accumulates without you thinking about it.',
      ],
      droppedMetrics: [],
      stableMetrics: [],
      baselineRuns: prior.length,
    }
  }

  const latestStats = new Map(
    computeRunMetricStats(latest).map((s) => [s.type, s]),
  )
  const baseline = aggregateBaseline(prior)

  const dropped: AffectedMetric[] = []
  const stable: AffectedMetric[] = []
  const improved: AffectedMetric[] = []

  for (const [type, baseStats] of baseline) {
    const latestS = latestStats.get(type)
    if (
      !latestS ||
      latestS.passRate === null ||
      baseStats.passRate === null
    ) {
      continue
    }
    const baseline_ = baseStats.passRate
    const latest_ = latestS.passRate
    const deltaPp = (latest_ - baseline_) * 100
    const entry: AffectedMetric = {
      type,
      label: metricLabel(type),
      baselinePassRate: baseline_,
      latestPassRate: latest_,
      deltaPp,
    }
    if (
      deltaPp <= -dropThresholdPp &&
      baseline_ >= baselineFloor
    ) {
      dropped.push(entry)
    } else if (deltaPp >= improveThresholdPp && latest_ >= baselineFloor) {
      improved.push(entry)
    } else {
      stable.push(entry)
    }
  }

  // Sort drops worst-first for display
  dropped.sort((a, b) => a.deltaPp - b.deltaPp)

  if (dropped.length === 0) {
    if (improved.length > 0) {
      const top = improved[improved.length - 1]
      return {
        pattern: 'improved',
        severity: 'success',
        title: 'Quality is improving',
        description: `${top.label} climbed by ${top.deltaPp.toFixed(0)} percentage points compared to the last ${prior.length} runs (baseline ${(top.baselinePassRate * 100).toFixed(0)}% → latest ${(top.latestPassRate * 100).toFixed(0)}%). Whatever you changed recently is helping.`,
        suggestedActions: [
          'Commit/note the change that caused the improvement so you can replicate it.',
        ],
        droppedMetrics: [],
        stableMetrics: stable,
        baselineRuns: prior.length,
      }
    }
    return {
      pattern: 'stable',
      severity: 'success',
      title: 'No regressions vs recent baseline',
      description: `The latest run looks consistent with the prior ${prior.length} runs across all ${stable.length} metric${stable.length === 1 ? '' : 's'}. Keep an eye out anyway — drift can be subtle.`,
      suggestedActions: [
        'Set up a scheduled Power Automate run if you haven\'t already so this card stays current.',
      ],
      droppedMetrics: [],
      stableMetrics: stable,
      baselineRuns: prior.length,
    }
  }

  // Now classify the drop pattern
  const droppedTypes = new Set(dropped.map((d) => d.type))
  const allKnownMetrics = new Set([
    ...KNOWLEDGE_METRICS,
    ...KEYWORD_METRICS,
    ...TOOL_METRICS,
  ])
  const observedKnownMetrics = new Set(
    [...baseline.keys()].filter((t) => allKnownMetrics.has(t)),
  )

  const knowledgeDropped = [...KNOWLEDGE_METRICS].filter((m) =>
    droppedTypes.has(m),
  )
  const keywordDropped = [...KEYWORD_METRICS].filter((m) => droppedTypes.has(m))
  const toolDropped = [...TOOL_METRICS].filter((m) => droppedTypes.has(m))

  const toolObserved = [...TOOL_METRICS].some((m) => baseline.has(m))
  const keywordObserved = [...KEYWORD_METRICS].some((m) => baseline.has(m))

  // Platform-wide: most observed metrics dropped at once
  if (
    observedKnownMetrics.size >= 3 &&
    droppedTypes.size >= Math.ceil(observedKnownMetrics.size * 0.75)
  ) {
    return {
      pattern: 'platform-wide',
      severity: 'danger',
      title: 'Platform-wide regression detected',
      description: `${dropped.length} of ${observedKnownMetrics.size} metrics dropped at once in the latest run. That breadth usually means something fundamental changed — the agent itself, the runtime, or the test set wiring — not a single tool or knowledge source.`,
      suggestedActions: [
        'Open the agent in Copilot Studio and confirm it\'s still published and not in a broken state.',
        'Check Copilot Studio service health for outages in your region.',
        'If the test set itself was edited recently, re-confirm the case definitions match what the agent should answer.',
      ],
      droppedMetrics: dropped,
      stableMetrics: stable,
      baselineRuns: prior.length,
    }
  }

  // Knowledge-source broken: GQ + (CM or TS) dropped, tool use stable
  if (
    knowledgeDropped.length >= 2 &&
    toolObserved &&
    toolDropped.length === 0
  ) {
    const droppedNames = knowledgeDropped.map(metricLabel).join(' and ')
    return {
      pattern: 'knowledge-source-broken',
      severity: 'danger',
      title: 'Knowledge source likely broken',
      description: `${droppedNames} all dropped sharply in the latest run, but Tool use is still firing normally. That signature usually means a knowledge source (SharePoint site, website, uploaded file) changed shape or became unreachable — the agent is still calling the right tools, but the content it\'s grounding on isn\'t what it used to be.`,
      suggestedActions: [
        'Open each knowledge source attached to this agent and confirm the URL/site/file is still reachable and hasn\'t been restructured.',
        'For SharePoint: check if anyone reorganized the document library, renamed pages, or changed permissions.',
        'Spot-check one failing case in the Run Detail page — the AI grader\'s reasoning will usually tell you what the agent answered with instead.',
      ],
      droppedMetrics: dropped,
      stableMetrics: stable,
      baselineRuns: prior.length,
    }
  }

  // Connector broken: CapabilityUse dropped in isolation
  if (
    toolDropped.length > 0 &&
    knowledgeDropped.length === 0 &&
    keywordDropped.length === 0
  ) {
    return {
      pattern: 'connector-broken',
      severity: 'danger',
      title: 'Tool / connector likely broken',
      description: `Tool use dropped in the latest run while semantic graders stayed stable. That usually means the agent is failing to invoke a tool — auth probably expired, the connector was revoked, or a downstream API changed its contract.`,
      suggestedActions: [
        'Open the Top failing tools card below to see which specific tool stopped firing.',
        'Re-authenticate any connectors flagged there (especially if it\'s a connector you don\'t own).',
        'If the failing tool is a custom connector, verify the underlying API is still accepting requests.',
      ],
      droppedMetrics: dropped,
      stableMetrics: stable,
      baselineRuns: prior.length,
    }
  }

  // Keyword-only broken: only keyword graders dropped
  if (
    keywordObserved &&
    keywordDropped.length > 0 &&
    knowledgeDropped.length === 0 &&
    toolDropped.length === 0
  ) {
    return {
      pattern: 'keyword-only-broken',
      severity: 'warning',
      title: 'Keyword graders dropped, semantics stable',
      description: `Only the keyword-match graders are failing — semantic graders (Compare meaning / General quality) are stable. The agent is likely answering correctly but with different wording. This is often a false alarm caused by an over-strict expected-keyword list.`,
      suggestedActions: [
        'Open a failing case and compare the agent\'s actual answer with the expected keywords. If the meaning is right, broaden or remove the keyword constraint.',
        'Consider switching the case from AllKeywordMatch to AnyKeywordMatch, or to Compare meaning instead.',
      ],
      droppedMetrics: dropped,
      stableMetrics: stable,
      baselineRuns: prior.length,
    }
  }

  // Fallback: partial degradation
  const top = dropped[0]
  return {
    pattern: 'partial-degradation',
    severity: 'warning',
    title: `${dropped.length} metric${dropped.length === 1 ? '' : 's'} dropped vs baseline`,
    description: `${top.label} fell ${Math.abs(top.deltaPp).toFixed(0)} percentage points (baseline ${(top.baselinePassRate * 100).toFixed(0)}% → latest ${(top.latestPassRate * 100).toFixed(0)}%)${dropped.length > 1 ? ` and ${dropped.length - 1} other metric${dropped.length === 2 ? '' : 's'} dropped too` : ''}. The pattern doesn\'t cleanly match a known failure mode, so investigate case-by-case.`,
    suggestedActions: [
      'Open the Latest vs prior run diff above to see which specific cases regressed.',
      'Check the Top error reasons card below — recurring error strings often point at the cause.',
    ],
    droppedMetrics: dropped,
    stableMetrics: stable,
    baselineRuns: prior.length,
  }
}

/**
 * React-friendly wrapper. Memoizes diagnoseRunPattern so callers don't
 * recompute on every render.
 */
export function useDiagnoseRunPattern(
  runs: ReadonlyArray<TestRun>,
  options?: DiagnoseOptions,
): DiagnoseResult {
  return useMemo(
    () => diagnoseRunPattern(runs, options),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [runs, options?.baselineWindow, options?.dropThresholdPp, options?.baselineFloor, options?.improveThresholdPp],
  )
}
