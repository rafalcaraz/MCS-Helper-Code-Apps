/**
 * Scheduled-run cadence detection.
 *
 * The use case: a maker wires up a Power Automate flow that runs their
 * test sets on a schedule (e.g. daily in prod). If that flow silently
 * stops firing — auth expired, connector broke, owner left, someone
 * disabled it — the dashboard should call it out, not just sit there
 * showing yesterday's number forever.
 *
 * Detection strategy: look at the most recent N inter-run gaps for
 * scheduled runs only, take the median, and flag "stale" when the gap
 * since the last scheduled run is meaningfully bigger than that median
 * (default 1.5×). Manual runs are deliberately ignored — they would
 * skew the cadence (a maker debugging 5× in 10 minutes does NOT mean
 * "we run every 2 minutes").
 *
 * Scheduled runs are identified by name prefix (default `Scheduled_`),
 * which is the convention we ship in our Power Automate template.
 */
import type { TestRun } from '../generated/models/MicrosoftCopilotStudioModel'

export const DEFAULT_SCHEDULED_NAME_PREFIX = 'Scheduled_'

export interface RunCadence {
  /** Number of inter-run gaps used to compute the median. */
  sampleSize: number
  /** Median gap (ms) between consecutive scheduled runs. */
  medianGapMs: number
  /** Epoch ms of the most recent scheduled run's startTime. */
  lastRunTs: number
  /** Epoch ms of the most recent scheduled run's id (if available). */
  lastRunId?: string
  /** now - lastRunTs (ms). */
  ageMs: number
  /** Threshold above which we consider the scheduled flow stale. */
  staleThresholdMs: number
  /** True when ageMs > staleThresholdMs. */
  isStale: boolean
  /** lastRunTs + medianGapMs — when we'd next expect a scheduled run. */
  expectedNextRunTs: number
}

export interface ComputeRunCadenceOptions {
  /** Override for `Date.now()` (mostly for tests + frozen-now). */
  now?: number
  /** Name prefix that marks a run as scheduled. Default `Scheduled_`. */
  scheduledNamePrefix?: string
  /**
   * Minimum number of inter-run gaps required before we'll commit to a
   * cadence claim. Below this we return null. Default 3 (i.e., need 4
   * scheduled runs).
   */
  minSamples?: number
  /**
   * Only consider the most recent N scheduled runs when computing the
   * cadence — biases the median toward recent behavior so a flow whose
   * schedule was changed last week doesn't get dragged by old history.
   * Default 10 (= last 9 gaps).
   */
  recentRunsWindow?: number
  /** Stale multiplier on the median gap. Default 1.5. */
  staleMultiplier?: number
}

/** True iff this run was created by the scheduled flow (by name prefix). */
export function isScheduledRun(
  run: TestRun,
  prefix: string = DEFAULT_SCHEDULED_NAME_PREFIX,
): boolean {
  return typeof run.name === 'string' && run.name.startsWith(prefix)
}

/**
 * Compute cadence for the scheduled runs of a single test set.
 * Returns null when there isn't enough scheduled-run history to make a
 * factual claim (we deliberately avoid guessing).
 */
export function computeRunCadence(
  runs: TestRun[],
  options: ComputeRunCadenceOptions = {},
): RunCadence | null {
  const now = options.now ?? Date.now()
  const prefix = options.scheduledNamePrefix ?? DEFAULT_SCHEDULED_NAME_PREFIX
  const minSamples = options.minSamples ?? 3
  const recentRunsWindow = options.recentRunsWindow ?? 10
  const staleMultiplier = options.staleMultiplier ?? 1.5

  const scheduled = runs
    .filter((r) => isScheduledRun(r, prefix))
    .map((r) => ({
      ts: r.startTime ? Date.parse(r.startTime) : NaN,
      id: r.id,
    }))
    .filter((x) => Number.isFinite(x.ts))
    .sort((a, b) => a.ts - b.ts)

  if (scheduled.length < minSamples + 1) return null

  const window = scheduled.slice(-recentRunsWindow)
  const gaps: number[] = []
  for (let i = 1; i < window.length; i += 1) {
    gaps.push(window[i].ts - window[i - 1].ts)
  }
  if (gaps.length < minSamples) return null

  const sortedGaps = [...gaps].sort((a, b) => a - b)
  const mid = Math.floor(sortedGaps.length / 2)
  const medianGapMs =
    sortedGaps.length % 2 === 1
      ? sortedGaps[mid]
      : (sortedGaps[mid - 1] + sortedGaps[mid]) / 2

  const last = window[window.length - 1]
  const ageMs = now - last.ts
  const staleThresholdMs = medianGapMs * staleMultiplier

  return {
    sampleSize: gaps.length,
    medianGapMs,
    lastRunTs: last.ts,
    lastRunId: last.id,
    ageMs,
    staleThresholdMs,
    isStale: ageMs > staleThresholdMs,
    expectedNextRunTs: last.ts + medianGapMs,
  }
}

/**
 * Format a duration in a way that's friendly for cadence copy:
 * "2.4 days" / "3 hours" / "12 minutes" / "a moment".
 */
export function formatCadenceDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return 'unknown'
  const days = ms / 86_400_000
  if (days >= 1.5) {
    return days >= 10
      ? `${Math.round(days)} days`
      : `${days.toFixed(1)} days`
  }
  if (days >= 0.95) return '1 day'
  const hours = ms / 3_600_000
  if (hours >= 1.5) return `${Math.round(hours)} hours`
  if (hours >= 0.95) return '1 hour'
  const minutes = ms / 60_000
  if (minutes >= 1.5) return `${Math.round(minutes)} minutes`
  return 'a moment'
}
