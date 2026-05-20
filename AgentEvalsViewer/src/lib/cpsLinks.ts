const CPS_BASE = 'https://copilotstudio.microsoft.com'

/**
 * URL to the Copilot Studio test-set (a.k.a. evaluation config) details page.
 * Pattern observed in CPS UI:
 *   /environments/{envId}/bots/{botId}/evaluation/configsDetails/{testSetId}
 */
export function getCpsTestSetUrl(
  envId: string | undefined,
  botId: string | undefined,
  testSetId: string | undefined,
): string | null {
  if (!envId || !botId || !testSetId) return null
  return `${CPS_BASE}/environments/${envId}/bots/${botId}/evaluation/configsDetails/${testSetId}`
}

/**
 * URL to the Copilot Studio run details page.
 * Pattern observed in CPS UI:
 *   /environments/{envId}/bots/{botId}/evaluation/runsDetails/{runId}/{testSetId}
 */
export function getCpsRunUrl(
  envId: string | undefined,
  botId: string | undefined,
  runId: string | undefined,
  testSetId: string | undefined,
): string | null {
  if (!envId || !botId || !runId || !testSetId) return null
  return `${CPS_BASE}/environments/${envId}/bots/${botId}/evaluation/runsDetails/${runId}/${testSetId}`
}

/**
 * URL to the Copilot Studio agent evaluation home (list of test sets).
 */
export function getCpsAgentEvaluationsUrl(
  envId: string | undefined,
  botId: string | undefined,
): string | null {
  if (!envId || !botId) return null
  return `${CPS_BASE}/environments/${envId}/bots/${botId}/evaluation`
}
