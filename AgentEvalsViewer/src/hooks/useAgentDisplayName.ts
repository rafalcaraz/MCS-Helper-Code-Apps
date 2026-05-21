import { useCallback, useMemo } from 'react'
import { useAccessibleBots } from '../api/queries'
import { useTrackedAgents } from './useTrackedAgents'

export interface AgentDisplayName {
  /** Best display string we have for the agent (nickname → bot name → GUID prefix). */
  name: string
  /** Schema name from Dataverse, if we have it. Used for secondary "subtitle" UI. */
  schemaName: string | null
  /** True iff the resolution was either tracked or discovered (not pure GUID fallback). */
  resolved: boolean
}

function shortGuid(agentId: string): string {
  if (!agentId) return ''
  return `${agentId.slice(0, 8)}…`
}

/**
 * Bulk-resolver factory: returns a `resolve(agentId)` callable so a
 * component can resolve many ids inside a `.map()` without breaking
 * the Rules of Hooks (you can't call `useAgentDisplayName` per row).
 *
 * Resolution order, same as `useAgentDisplayName`:
 *   1. User-tracked nickname (`useTrackedAgents` localStorage)
 *   2. Dataverse-discovered bot name (`useAccessibleBots`)
 *   3. GUID prefix fallback (`"01234567…"`).
 */
export function useAgentDisplayNameResolver(): (
  agentId: string | undefined,
) => AgentDisplayName {
  const { getAgent } = useTrackedAgents()
  const accessibleQuery = useAccessibleBots()
  const accessibleById = useMemo(() => {
    const map = new Map<string, { displayName: string; schemaName: string }>()
    for (const b of accessibleQuery.data ?? []) {
      map.set(b.botId, { displayName: b.displayName, schemaName: b.schemaName })
    }
    return map
  }, [accessibleQuery.data])

  return useCallback(
    (agentId: string | undefined): AgentDisplayName => {
      if (!agentId) {
        return { name: '', schemaName: null, resolved: false }
      }
      const tracked = getAgent(agentId)
      const discovered = accessibleById.get(agentId)
      if (tracked) {
        return {
          name: tracked.nickname,
          schemaName: discovered?.schemaName ?? null,
          resolved: true,
        }
      }
      if (discovered) {
        return {
          name: discovered.displayName,
          schemaName: discovered.schemaName || null,
          resolved: true,
        }
      }
      return { name: shortGuid(agentId), schemaName: null, resolved: false }
    },
    [getAgent, accessibleById],
  )
}

/**
 * Resolve the best human-readable name for an agent ID across both
 * sources of truth:
 *
 *   1. User-tracked nickname (`useTrackedAgents` localStorage) — wins,
 *      because if a maker explicitly nicknamed it that's what they want
 *      to see.
 *   2. Dataverse-discovered bot name (`useAccessibleBots`) — picks up
 *      bots the maker has access to without having to manually track
 *      them.
 *   3. Fallback: the first 8 chars of the GUID + "…".
 *
 * Detail-page headers and breadcrumbs use this so a discovered (but
 * not tracked) bot still shows its real display name everywhere.
 */
export function useAgentDisplayName(
  agentId: string | undefined,
): AgentDisplayName {
  const resolve = useAgentDisplayNameResolver()
  return useMemo(() => resolve(agentId), [resolve, agentId])
}

