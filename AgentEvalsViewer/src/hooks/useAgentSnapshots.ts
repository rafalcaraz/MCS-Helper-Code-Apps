/**
 * useAgentSnapshots — localStorage-backed CRUD for uploaded agent snapshots,
 * keyed per cdsBotId. Multi-tab safe via the `storage` event.
 *
 * Storage shape:
 *   key:   "agentSnapshots:v1"
 *   value: JSON Record<cdsBotId, AgentSnapshot[]>   // sorted newest-first
 *
 * Snapshots can be large (50KB+) so we keep the most recent 10 per agent and
 * drop the oldest when the cap is reached.
 */
import { useCallback, useSyncExternalStore } from 'react'
import type { AgentSnapshot } from '../lib/snapshotParser'

const STORAGE_KEY = 'agentSnapshots:v1'
const MAX_PER_AGENT = 10

type Store = Record<string, AgentSnapshot[]>

function readStore(): Store {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    return parsed as Store
  } catch {
    return {}
  }
}

function writeStore(s: Store): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } catch (err) {
    console.error('[useAgentSnapshots] write failed', err)
  }
}

// Cache the parsed store so getSnapshot returns a stable reference until
// the underlying data actually changes. Without this the useSyncExternalStore
// throws "The result of getSnapshot should be cached to avoid an infinite loop".
let cachedRaw: string | null | undefined
let cachedStore: Store = {}

function getStore(): Store {
  if (typeof window === 'undefined') return cachedStore
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (raw === cachedRaw) return cachedStore
  cachedRaw = raw
  cachedStore = raw ? safeParse(raw) : {}
  return cachedStore
}

function safeParse(raw: string): Store {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {}
    }
    return parsed as Store
  } catch {
    return {}
  }
}

function subscribe(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) onChange()
  }
  window.addEventListener('storage', handler)
  // Listen on a custom event for same-tab writes (storage event doesn't fire
  // in the same tab that wrote it).
  const sameTabHandler = () => onChange()
  window.addEventListener('agentSnapshots:changed', sameTabHandler)
  return () => {
    window.removeEventListener('storage', handler)
    window.removeEventListener('agentSnapshots:changed', sameTabHandler)
  }
}

function notifySameTab(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event('agentSnapshots:changed'))
}

function getServerSnapshot(): Store {
  return cachedStore
}

export interface UseAgentSnapshotsResult {
  /** Snapshots for this agent, sorted newest-first by uploadedAt. */
  snapshots: AgentSnapshot[]
  /** Add a snapshot — caller is responsible for validating cdsBotId matches. */
  addSnapshot: (snapshot: AgentSnapshot) => void
  /** Remove one snapshot by uploadedAt (acts as the per-agent unique id). */
  removeSnapshot: (uploadedAt: string) => void
  /** Update the user-supplied label on a snapshot. */
  setSnapshotLabel: (uploadedAt: string, label: string) => void
  /** Wipe every snapshot for this agent. */
  clearAll: () => void
}

export function useAgentSnapshots(agentId: string): UseAgentSnapshotsResult {
  const store = useSyncExternalStore(subscribe, getStore, getServerSnapshot)
  const snapshots = store[agentId] ?? []

  const addSnapshot = useCallback(
    (snapshot: AgentSnapshot) => {
      const next = readStore()
      const existing = next[agentId] ?? []
      const incoming = [snapshot, ...existing.filter((s) => s.uploadedAt !== snapshot.uploadedAt)]
      incoming.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
      next[agentId] = incoming.slice(0, MAX_PER_AGENT)
      writeStore(next)
      notifySameTab()
    },
    [agentId],
  )

  const removeSnapshot = useCallback(
    (uploadedAt: string) => {
      const next = readStore()
      const existing = next[agentId] ?? []
      next[agentId] = existing.filter((s) => s.uploadedAt !== uploadedAt)
      if (next[agentId].length === 0) delete next[agentId]
      writeStore(next)
      notifySameTab()
    },
    [agentId],
  )

  const setSnapshotLabel = useCallback(
    (uploadedAt: string, label: string) => {
      const next = readStore()
      const existing = next[agentId] ?? []
      next[agentId] = existing.map((s) =>
        s.uploadedAt === uploadedAt ? { ...s, label } : s,
      )
      writeStore(next)
      notifySameTab()
    },
    [agentId],
  )

  const clearAll = useCallback(() => {
    const next = readStore()
    delete next[agentId]
    writeStore(next)
    notifySameTab()
  }, [agentId])

  return { snapshots, addSnapshot, removeSnapshot, setSnapshotLabel, clearAll }
}
