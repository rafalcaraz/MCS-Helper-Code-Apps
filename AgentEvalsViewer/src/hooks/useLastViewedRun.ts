import { useCallback, useMemo, useSyncExternalStore } from 'react'

const STORAGE_KEY = 'agent-evals-viewer.last-viewed-runs'

/**
 * Rich entry persisted per (agent, testSet) pair. Replaced the original
 * `Record<string, string>` shape. Reads migrate legacy values transparently
 * (treated as `{ runId, viewedAt: '' }`) so existing makers don't lose their
 * markers when this code ships.
 */
export interface LastViewedEntry {
  /** The run id the maker last saw as "latest" for this test set. */
  runId: string
  /** ISO timestamp of when the marker was written. May be empty for legacy entries. */
  viewedAt: string
  /** Friendly name of the run at the time of visit (helps the maker recall what they saw). */
  runName?: string
  /** Friendly name of the agent at the time of visit. */
  agentName?: string
  /** Friendly name of the test set at the time of visit. */
  testSetName?: string
}

/** Normalized store: every value is a `LastViewedEntry`, legacy strings already migrated. */
type Store = Record<string, LastViewedEntry>
/** Raw shape on disk — may include legacy string values from previous app versions. */
type RawStore = Record<string, LastViewedEntry | string>

function isEntry(value: unknown): value is LastViewedEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as LastViewedEntry).runId === 'string'
  )
}

function normalize(value: LastViewedEntry | string | undefined): LastViewedEntry | null {
  if (!value) return null
  if (typeof value === 'string') return { runId: value, viewedAt: '' }
  if (isEntry(value)) {
    return {
      runId: value.runId,
      viewedAt: typeof value.viewedAt === 'string' ? value.viewedAt : '',
      runName: typeof value.runName === 'string' ? value.runName : undefined,
      agentName: typeof value.agentName === 'string' ? value.agentName : undefined,
      testSetName: typeof value.testSetName === 'string' ? value.testSetName : undefined,
    }
  }
  return null
}

function readRawStore(): RawStore {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null) return {}
    return parsed as RawStore
  } catch {
    return {}
  }
}

function readStore(): Store {
  const raw = readRawStore()
  const out: Store = {}
  for (const [k, v] of Object.entries(raw)) {
    const entry = normalize(v)
    if (entry) out[k] = entry
  }
  return out
}

function writeStore(store: Store): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

function key(agentId: string | undefined, testSetId: string | undefined): string {
  return `${agentId ?? ''}::${testSetId ?? ''}`
}

const KEY_SEPARATOR = '::'

/** Parses a store key back into agent + test set ids. Returns null on malformed keys. */
function parseKey(k: string): { agentId: string; testSetId: string } | null {
  const idx = k.indexOf(KEY_SEPARATOR)
  if (idx <= 0) return null
  const agentId = k.slice(0, idx)
  const testSetId = k.slice(idx + KEY_SEPARATOR.length)
  if (!agentId || !testSetId) return null
  return { agentId, testSetId }
}

const listeners = new Set<() => void>()

function subscribe(callback: () => void): () => void {
  listeners.add(callback)
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) callback()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage)
  }
  return () => {
    listeners.delete(callback)
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage)
    }
  }
}

function notifyAll(): void {
  invalidateCache()
  listeners.forEach((l) => l())
}

function getServerSnapshot(): string | null {
  return null
}

const EMPTY_STORE: Store = Object.freeze({}) as Store
let cachedStore: Store | null = null
function getCachedStore(): Store {
  if (cachedStore === null) cachedStore = readStore()
  return cachedStore
}
function invalidateCache(): void {
  cachedStore = null
}

function getStoreServerSnapshot(): Store {
  return EMPTY_STORE
}

/** Optional metadata supplied at the time of marking a run as viewed. */
export interface MarkAsViewedMeta {
  runName?: string
  agentName?: string
  testSetName?: string
}

export interface UseLastViewedRunResult {
  /** Run id the maker last viewed for this test set, or null on first visit. */
  markerRunId: string | null
  /** Full last-viewed entry (with timestamp + friendly names), or null on first visit. */
  lastEntry: LastViewedEntry | null
  /**
   * Mark the supplied runId as viewed. The optional meta enriches the
   * stored entry so later "you last looked at X" copy can be human-friendly.
   * Re-marking the same runId updates timestamp + meta (don't no-op — meta
   * may have improved since the previous write, e.g. friendly names loaded).
   */
  markAsViewed: (runId: string | undefined, meta?: MarkAsViewedMeta) => void
  /** Forget the marker (e.g. when maker explicitly resets). */
  clear: () => void
}

/**
 * Persists a per-(agent, testSet) "last viewed run id" marker plus richer
 * metadata (timestamp + friendly names) in localStorage.
 *
 * Used by the SinceLastVisitInbox to compute "what changed since you last
 * looked," and by the home-page Recently viewed widget to remind makers
 * which test sets they were last looking at. The hook *does not*
 * automatically mark the latest run as viewed — that is the page's
 * responsibility (typically on mount, after a brief delay so the maker
 * actually sees the inbox before the marker advances).
 *
 * Backed by `useSyncExternalStore` to satisfy React 19's
 * `react-hooks/set-state-in-effect` rule and to keep cross-tab sync clean
 * (a single subscribe path).
 */
export function useLastViewedRun(
  agentId: string | undefined,
  testSetId: string | undefined,
): UseLastViewedRunResult {
  const k = key(agentId, testSetId)

  const lastEntry = useSyncExternalStore(
    subscribe,
    useCallback(() => getCachedStore()[k] ?? null, [k]),
    getServerSnapshot,
  )

  const markAsViewed = useCallback(
    (runId: string | undefined, meta?: MarkAsViewedMeta) => {
      if (!runId) return
      const store = readStore()
      store[k] = {
        runId,
        viewedAt: new Date().toISOString(),
        runName: meta?.runName,
        agentName: meta?.agentName,
        testSetName: meta?.testSetName,
      }
      writeStore(store)
      notifyAll()
    },
    [k],
  )

  const clear = useCallback(() => {
    const store = readStore()
    if (!(k in store)) return
    delete store[k]
    writeStore(store)
    notifyAll()
  }, [k])

  return {
    markerRunId: lastEntry?.runId ?? null,
    lastEntry,
    markAsViewed,
    clear,
  }
}

/**
 * Returns the full normalized marker store: a Record keyed by
 * `${agentId}::${testSetId}` with `LastViewedEntry` values.
 * Useful when a page needs markers for several test sets at once —
 * calling `useLastViewedRun` inside a `.map()` would violate the rules
 * of hooks.
 */
export function useAllLastViewedRuns(): Store {
  return useSyncExternalStore(subscribe, getCachedStore, getStoreServerSnapshot)
}

/** A single recent visit, suitable for rendering as a list item. */
export interface RecentVisit {
  agentId: string
  testSetId: string
  entry: LastViewedEntry
}

/**
 * Returns the maker's recent visits sorted by `viewedAt` desc. Legacy
 * entries (no timestamp) are excluded — without a time we can't sort them
 * meaningfully and they'd cluster at the bottom regardless.
 *
 * Optionally clamped to `limit` most-recent entries.
 */
export function useRecentVisits(limit?: number): RecentVisit[] {
  const store = useAllLastViewedRuns()
  return useMemo(() => {
    const visits: RecentVisit[] = []
    for (const [k, entry] of Object.entries(store)) {
      const ids = parseKey(k)
      if (!ids) continue
      if (!entry.viewedAt) continue
      visits.push({ agentId: ids.agentId, testSetId: ids.testSetId, entry })
    }
    visits.sort((a, b) => {
      const ta = Date.parse(a.entry.viewedAt)
      const tb = Date.parse(b.entry.viewedAt)
      if (!Number.isFinite(ta) && !Number.isFinite(tb)) return 0
      if (!Number.isFinite(ta)) return 1
      if (!Number.isFinite(tb)) return -1
      return tb - ta
    })
    return typeof limit === 'number' ? visits.slice(0, limit) : visits
  }, [store, limit])
}

/**
 * Pure helper for callers that already have the marker store + ids.
 * Mirrors `useLastViewedRun().markerRunId`.
 */
export function getMarkerRunIdFor(
  store: Store,
  agentId: string | undefined,
  testSetId: string | undefined,
): string | null {
  return store[key(agentId, testSetId)]?.runId ?? null
}
