import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'agent-evals-viewer.tracked-agents'

export interface TrackedAgent {
  agentId: string
  nickname: string
  addedAt: string
}

function readStorage(): TrackedAgent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is TrackedAgent =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as TrackedAgent).agentId === 'string' &&
        typeof (item as TrackedAgent).nickname === 'string' &&
        typeof (item as TrackedAgent).addedAt === 'string',
    )
  } catch {
    return []
  }
}

function writeStorage(agents: TrackedAgent[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(agents))
}

export interface UseTrackedAgentsResult {
  agents: TrackedAgent[]
  addAgent: (agent: { agentId: string; nickname: string }) => void
  removeAgent: (agentId: string) => void
  renameAgent: (agentId: string, nickname: string) => void
  getAgent: (agentId: string) => TrackedAgent | undefined
}

export function useTrackedAgents(): UseTrackedAgentsResult {
  const [agents, setAgents] = useState<TrackedAgent[]>(() => readStorage())

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
        setAgents(readStorage())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const addAgent = useCallback<UseTrackedAgentsResult['addAgent']>(
    ({ agentId, nickname }) => {
      const trimmedId = agentId.trim()
      const trimmedNickname = nickname.trim() || trimmedId
      if (!trimmedId) return
      setAgents((current) => {
        if (current.some((a) => a.agentId === trimmedId)) return current
        const next = [
          ...current,
          {
            agentId: trimmedId,
            nickname: trimmedNickname,
            addedAt: new Date().toISOString(),
          },
        ]
        writeStorage(next)
        return next
      })
    },
    [],
  )

  const removeAgent = useCallback<UseTrackedAgentsResult['removeAgent']>(
    (agentId) => {
      setAgents((current) => {
        const next = current.filter((a) => a.agentId !== agentId)
        writeStorage(next)
        return next
      })
    },
    [],
  )

  const renameAgent = useCallback<UseTrackedAgentsResult['renameAgent']>(
    (agentId, nickname) => {
      const trimmed = nickname.trim()
      if (!trimmed) return
      setAgents((current) => {
        const next = current.map((a) =>
          a.agentId === agentId ? { ...a, nickname: trimmed } : a,
        )
        writeStorage(next)
        return next
      })
    },
    [],
  )

  const getAgent = useCallback<UseTrackedAgentsResult['getAgent']>(
    (agentId) => agents.find((a) => a.agentId === agentId),
    [agents],
  )

  return { agents, addAgent, removeAgent, renameAgent, getAgent }
}
