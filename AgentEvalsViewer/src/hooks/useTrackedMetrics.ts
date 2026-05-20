import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_PREFIX = 'agent-evals-viewer.tracked-metrics.'

function storageKey(testSetId: string): string {
  return `${STORAGE_PREFIX}${testSetId}`
}

function readStorage(testSetId: string): string[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(storageKey(testSetId))
    if (raw === null) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return null
    return parsed.filter((x): x is string => typeof x === 'string')
  } catch {
    return null
  }
}

function writeStorage(testSetId: string, value: string[] | null): void {
  if (typeof window === 'undefined') return
  if (value === null) {
    window.localStorage.removeItem(storageKey(testSetId))
    return
  }
  window.localStorage.setItem(storageKey(testSetId), JSON.stringify(value))
}

export interface UseTrackedMetricsResult {
  /** Set of metric types the maker considers critical for this test set's composite. null = all metrics are critical (default). */
  critical: Set<string> | null
  /** True if the maker has overridden the default. */
  isCustomized: boolean
  setCritical: (next: Set<string> | null) => void
  toggle: (type: string) => void
  reset: () => void
}

/**
 * Per-test-set persistence of which metric types are considered "critical"
 * for the composite Pass/Fail badge. Default (null) = all observed metrics
 * are critical, matching the strictest reading. Maker can uncheck to ignore
 * noisy or informational metrics.
 */
export function useTrackedMetrics(
  testSetId: string | undefined,
  observedMetrics: string[],
): UseTrackedMetricsResult {
  const [keyed, setKeyed] = useState<{
    key: string | undefined
    value: string[] | null
  }>(() => ({
    key: testSetId,
    value: testSetId ? readStorage(testSetId) : null,
  }))

  // Derived-state-from-prop pattern (React docs endorse this): when the
  // testSetId changes, reset the stored value during render rather than in
  // an effect. Avoids the cascading-render anti-pattern.
  if (keyed.key !== testSetId) {
    setKeyed({
      key: testSetId,
      value: testSetId ? readStorage(testSetId) : null,
    })
  }
  const stored = keyed.value

  // Cross-tab sync — event handler is the right home for setState here.
  useEffect(() => {
    if (typeof window === 'undefined' || !testSetId) return
    const onStorage = (event: StorageEvent) => {
      if (event.key === storageKey(testSetId)) {
        setKeyed({ key: testSetId, value: readStorage(testSetId) })
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [testSetId])

  const critical = useMemo<Set<string> | null>(() => {
    if (stored === null) return null
    return new Set(stored)
  }, [stored])

  const setCritical = useCallback(
    (next: Set<string> | null) => {
      if (!testSetId) return
      const arr = next === null ? null : [...next].sort()
      writeStorage(testSetId, arr)
      setKeyed({ key: testSetId, value: arr })
    },
    [testSetId],
  )

  const toggle = useCallback(
    (type: string) => {
      if (!testSetId) return
      const baseline = stored ?? observedMetrics
      const next = new Set(baseline)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      const arr = [...next].sort()
      writeStorage(testSetId, arr)
      setKeyed({ key: testSetId, value: arr })
    },
    [testSetId, stored, observedMetrics],
  )

  const reset = useCallback(() => {
    if (!testSetId) return
    writeStorage(testSetId, null)
    setKeyed({ key: testSetId, value: null })
  }, [testSetId])

  return {
    critical,
    isCustomized: stored !== null,
    setCritical,
    toggle,
    reset,
  }
}
