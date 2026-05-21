import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query'
import type { IOperationResult } from '@microsoft/power-apps/data'
import type {
  TestRun,
  TestRunsResponse,
  TestSet,
  TestSetsResponse,
} from '../generated/models/MicrosoftCopilotStudioModel'
import { MicrosoftCopilotStudioService } from '../generated/services/MicrosoftCopilotStudioService'
import {
  fetchAccessibleBots,
  fetchTestCaseDefinitions,
  fetchUsersByIds,
  type BotInfo,
  type CaseDefinition,
  type SystemUser,
} from './dataverse'

function unwrap<T>(result: IOperationResult<T>): T {
  if (!result.success) {
    const message =
      result.error && 'message' in result.error
        ? (result.error as { message?: string }).message
        : undefined
    throw new Error(message ?? 'Connector call failed')
  }
  if (result.data === undefined || result.data === null) {
    throw new Error('Connector returned no data')
  }
  return result.data
}

export function useTestSets(
  agentId: string | undefined,
): UseQueryResult<TestSet[], Error> {
  return useQuery({
    queryKey: ['testSets', agentId],
    enabled: Boolean(agentId),
    queryFn: async () => {
      const result =
        await MicrosoftCopilotStudioService.GetAgentMakerEvaluationTestSets(
          agentId!,
        )
      return unwrap<TestSetsResponse>(result).value ?? []
    },
  })
}

export function useTestSetDetails(
  agentId: string | undefined,
  testSetId: string | undefined,
): UseQueryResult<TestSet, Error> {
  return useQuery({
    queryKey: ['testSet', agentId, testSetId],
    enabled: Boolean(agentId && testSetId),
    queryFn: async () => {
      const result =
        await MicrosoftCopilotStudioService.GetAgentMakerEvaluationTestSetDetails(
          agentId!,
          testSetId!,
        )
      return unwrap<TestSet>(result)
    },
  })
}

export function useTestRuns(
  agentId: string | undefined,
): UseQueryResult<TestRun[], Error> {
  return useQuery({
    queryKey: ['testRuns', agentId],
    enabled: Boolean(agentId),
    queryFn: async () => {
      const result =
        await MicrosoftCopilotStudioService.GetAgentMakerEvaluationTestRuns(
          agentId!,
        )
      return unwrap<TestRunsResponse>(result).value ?? []
    },
  })
}

export function useTestRunDetails(
  agentId: string | undefined,
  runId: string | undefined,
): UseQueryResult<TestRun, Error> {
  return useQuery({
    queryKey: ['testRun', agentId, runId],
    enabled: Boolean(agentId && runId),
    queryFn: async () => {
      const result =
        await MicrosoftCopilotStudioService.GetAgentMakerEvaluationTestRunDetails(
          agentId!,
          runId!,
        )
      return unwrap<TestRun>(result)
    },
  })
}

export interface RunDetailFailure {
  runId: string
  runName: string | undefined
  testSetId: string | undefined
  error: Error
}

export interface RunsWithDetailsResult {
  data: TestRun[]
  isLoadingList: boolean
  isLoadingDetails: boolean
  detailsLoaded: number
  detailsTotal: number
  /** Per-run failures (scoped to the testSetIdFilter when supplied). Empty when all loaded ok. */
  detailsErrors: RunDetailFailure[]
  /** Only set for *list-level* failures (no runs to show at all). Per-run failures live in detailsErrors. */
  error: Error | null
}

/**
 * Fan-out helper: list endpoint returns TestRun metadata only (no
 * testCasesResults). To compute pass-rate / breakdown across many runs
 * we have to call GetAgentMakerEvaluationTestRunDetails once per run.
 * Each fan-out call shares its cache key with `useTestRunDetails` so
 * navigating into a run page is instant after this has run.
 *
 * Passing `testSetIdFilter` scopes the progress counter and the
 * `detailsErrors` array to runs belonging to that test set — the
 * fan-out itself still covers every run on the agent so the cache
 * stays warm for other pages.
 */
export function useTestRunsWithDetails(
  agentId: string | undefined,
  testSetIdFilter?: string,
): RunsWithDetailsResult {
  const listQuery = useTestRuns(agentId)
  const runs = listQuery.data ?? []

  const detailQueries = useQueries({
    queries: runs.map((r) => ({
      queryKey: ['testRun', agentId, r.id],
      enabled: Boolean(agentId && r.id),
      staleTime: 60_000,
      queryFn: async () => {
        const result =
          await MicrosoftCopilotStudioService.GetAgentMakerEvaluationTestRunDetails(
            agentId!,
            r.id!,
          )
        return unwrap<TestRun>(result)
      },
    })),
  })

  const merged: TestRun[] = runs.map((r, i) => {
    const detail = detailQueries[i]?.data
    if (detail) {
      return { ...r, ...detail }
    }
    return r
  })

  const scopedIndexes = testSetIdFilter
    ? runs.reduce<number[]>((acc, r, i) => {
        if (r.testSetId === testSetIdFilter) acc.push(i)
        return acc
      }, [])
    : runs.map((_, i) => i)

  const scopedQueries = scopedIndexes.map((i) => detailQueries[i])
  const detailsLoaded = scopedQueries.filter((q) => q?.isSuccess).length
  const isLoadingDetails = scopedQueries.some((q) => q?.isLoading)
  const detailsErrors: RunDetailFailure[] = scopedQueries
    .map((q, idx) => {
      if (!q?.error) return null
      const sourceRun = runs[scopedIndexes[idx]]
      return {
        runId: sourceRun?.id ?? '',
        runName: sourceRun?.name,
        testSetId: sourceRun?.testSetId,
        error: q.error as Error,
      }
    })
    .filter((x): x is RunDetailFailure => x !== null)

  return {
    data: merged,
    isLoadingList: listQuery.isLoading,
    isLoadingDetails,
    detailsLoaded,
    detailsTotal: scopedIndexes.length,
    detailsErrors,
    // Only surface list-level errors globally. Per-run failures live in
    // detailsErrors so a single bad run doesn't black out the page.
    error: (listQuery.error as Error | null) ?? null,
  }
}

/**
 * Live test-case definitions (input / expectedOutput / keywords) sourced
 * directly from Dataverse. Used as the **first-priority label** for the
 * heatmap, leaderboards, run detail and case detail pages.
 *
 * Stale-while-revalidate is generous (5min) because authoring rarely
 * changes — and it's also "best effort": if Dataverse is denied or the
 * connection isn't wired, we silently fall back to AI-mined and GUID
 * labels so nothing breaks.
 */
export function useTestCaseDefinitions(
  agentId: string | undefined,
): UseQueryResult<Map<string, CaseDefinition>, Error> {
  return useQuery({
    queryKey: ['caseDefinitions', agentId],
    enabled: Boolean(agentId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
    queryFn: async () => fetchTestCaseDefinitions(agentId!),
  })
}

/**
 * Resolve systemuser GUIDs (e.g. `TestRun.ownerId`) → friendly name + email.
 *
 * Best-effort: if the user doesn't have read permission on `systemusers`,
 * the query errors out and callers fall back to rendering the raw GUID.
 * Stale-while-revalidate is generous (10min) since user records rarely
 * change relative to run frequency.
 */
export function useSystemUsers(
  ids: readonly string[],
): UseQueryResult<Map<string, SystemUser>, Error> {
  const uniqueSorted = Array.from(
    new Set(ids.filter((id) => typeof id === 'string' && id.length > 0)),
  ).sort()
  return useQuery({
    queryKey: ['systemusers', uniqueSorted],
    enabled: uniqueSorted.length > 0,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => fetchUsersByIds(uniqueSorted),
  })
}

/**
 * Discover the bots the current caller has access to in this Dataverse
 * environment. Powers the AgentsPage picker so the maker doesn't have
 * to paste an Agent ID — Dataverse RBAC already filters the list to
 * what they can see.
 *
 * Best-effort: if the caller doesn't have read on the `bots` table the
 * query surfaces an error and the page falls back to the manual
 * "add by ID" form. Stale-while-revalidate is long (10min) since the
 * bots list rarely changes across an editing session.
 */
export function useAccessibleBots(): UseQueryResult<BotInfo[], Error> {
  return useQuery({
    queryKey: ['accessibleBots'],
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
    queryFn: async () => fetchAccessibleBots(),
  })
}
