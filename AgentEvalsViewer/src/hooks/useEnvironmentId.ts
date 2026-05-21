import { useEffect, useState } from 'react'
import { getContext } from '@microsoft/power-apps/app'

// Module-level cache so we don't re-handshake on every page mount.
// The env id never changes within a single app session — once the
// Power Apps SDK hands it to us, we keep it.
let cached: string | null = null
let inflight: Promise<string | null> | null = null

async function loadEnvironmentId(): Promise<string | null> {
  if (cached) return cached
  if (inflight) return inflight
  inflight = (async () => {
    try {
      const ctx = await getContext()
      const id = ctx?.app?.environmentId?.trim() || null
      cached = id
      return id
    } catch (err) {
      console.warn('[useEnvironmentId] getContext() failed', err)
      return null
    } finally {
      inflight = null
    }
  })()
  return inflight
}

/**
 * Returns the Power Platform environment ID for the running app, or
 * `null` while it's being resolved / if the SDK handshake failed.
 *
 * Safe to call from any page — `PowerProvider` has already proven the
 * SDK is reachable before we render, so this should resolve quickly.
 */
export function useEnvironmentId(): string | null {
  const [envId, setEnvId] = useState<string | null>(cached)

  useEffect(() => {
    // If we already have a cached env id when this mounts, useState's
    // lazy initializer above already picked it up. Only kick off a
    // fetch when we still don't have one.
    if (cached) return
    let cancelled = false
    loadEnvironmentId().then((id) => {
      if (!cancelled) setEnvId(id)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return envId
}
