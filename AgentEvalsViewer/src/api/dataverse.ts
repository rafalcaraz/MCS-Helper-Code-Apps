import { parse as parseYaml } from 'yaml'
import type { IOperationResult } from '@microsoft/power-apps/data'
import { MicrosoftDataverseService } from '../generated/services/MicrosoftDataverseService'

/**
 * Discriminator for the kind of evaluation case we recognize on this
 * agent. Mirrors the `kind:` field at the top of the botcomponent's
 * `data` YAML.
 *
 * - `EvaluationData` — single-turn question/answer test cases (the
 *   original shape and still the most common).
 * - `MultiTurnEvaluationCase` — newer shape used by Copilot Studio's
 *   *conversational* evaluation feature. Stores a scripted
 *   user/agent transcript instead of a single input.
 */
export type CaseKind = 'EvaluationData' | 'MultiTurnEvaluationCase'

/** One turn within a conversational test case's scripted transcript. */
export interface ConversationTurn {
  role: 'user' | 'agent'
  text: string
}

/**
 * An execution-step expectation declared on the case definition.
 * Single-turn cases typically have one of these (e.g. expected
 * topic to trigger); conversational cases may declare several since
 * the agent is expected to traverse multiple topics across the
 * scripted turns.
 */
export interface ExpectedExecutionStep {
  kind: string
  schemaName?: string
}

/**
 * Definition of a single test case as authored in Copilot Studio.
 * Pulled from the `botcomponent` row whose `botcomponentid` equals
 * the connector's `testCaseId`.
 *
 * For multi-turn cases, `input` is populated with the first user
 * turn's text so existing label-resolution / heatmap / leaderboard
 * code keeps working without conditional plumbing. `turns` holds
 * the full scripted transcript for richer UI affordances.
 */
export interface CaseDefinition {
  caseId: string
  /** Single-turn or multi-turn — see {@link CaseKind}. */
  kind: CaseKind
  /**
   * The literal user message the agent will receive when the case runs.
   * For multi-turn cases this is the FIRST user turn's text (so labels
   * and heatmap rows still have something readable to show).
   */
  input: string | null
  /**
   * Reference answer the AI graders compare the agent's response to.
   * Always null for multi-turn cases (no single canonical answer —
   * each scripted agent turn is its own expected response).
   */
  expectedOutput: string | null
  /** Keywords used by AnyKeywordMatch / AllKeywordMatch graders. */
  expectedKeywords: string[]
  /**
   * Scripted user↔agent transcript. Only populated for
   * `MultiTurnEvaluationCase` rows; empty/undefined for single-turn.
   */
  turns?: ConversationTurn[]
  /**
   * Expected execution steps (e.g. ExpectedTopicTriggeredStep). Same
   * shape regardless of kind; multi-turn cases may declare several.
   */
  expectedExecutionSteps?: ExpectedExecutionStep[]
  /** displayOrder in the CPS UI; useful for stable sort. May be missing. */
  displayOrder: number | null
  /** Original parsed YAML, kept for debugging. */
  rawYaml: string
}

/** Botcomponent componenttype value for "Test Case". */
const COMPONENT_TYPE_TEST_CASE = 19

interface BotComponentRow {
  botcomponentid?: string
  name?: string
  data?: string
}

interface SingleTurnYaml {
  kind?: string
  rows?: Array<{
    input?: string
    expectedOutput?: string
    expectedKeywords?: string[]
    expectedExecutionSteps?: Array<{ kind?: string; schemaName?: string }>
  }>
  extensionData?: {
    displayOrder?: string | number
  }
}

interface MultiTurnYaml {
  kind?: string
  expectedKeywords?: string[]
  expectedExecutionSteps?: Array<{ kind?: string; schemaName?: string }>
  activities?: Array<{
    activity?: {
      value?: {
        from?: { role?: string }
      }
      text?: string | string[]
    }
  }>
  extensionData?: {
    displayOrder?: string | number
  }
}

interface ListRecordsResponseShape {
  value?: BotComponentRow[]
  '@odata.nextLink'?: string
}

function unwrap<T>(result: IOperationResult<T>): T {
  if (!result.success) {
    const message =
      result.error && 'message' in result.error
        ? (result.error as { message?: string }).message
        : undefined
    throw new Error(message ?? 'Dataverse call failed')
  }
  if (result.data === undefined || result.data === null) {
    throw new Error('Dataverse returned no data')
  }
  return result.data
}

/**
 * Resolve and cache the Dataverse organization URL for the current user.
 *
 * The Power Apps Dataverse connector's `ListRecords` (no-organization
 * variant) defaults to the connection's bound environment, which Code Apps
 * doesn't populate — so we have to call `GetOrganizations` and pass an
 * explicit URL via `ListRecordsWithOrganization`. The user can pin one via
 * `VITE_DATAVERSE_ORG_URL` if they have multiple orgs and need disambiguation.
 */
let cachedOrgUrl: string | null = null
let inflightOrgPromise: Promise<string> | null = null

export async function getOrganizationUrl(): Promise<string> {
  if (cachedOrgUrl) return cachedOrgUrl
  if (inflightOrgPromise) return inflightOrgPromise

  const pinned = (import.meta.env.VITE_DATAVERSE_ORG_URL as string | undefined)
    ?.trim()
  if (pinned) {
    cachedOrgUrl = pinned
    return pinned
  }

  inflightOrgPromise = (async () => {
    const result = await MicrosoftDataverseService.GetOrganizations()
    const data = unwrap(result)
    const orgs = data.value ?? []
    if (orgs.length === 0) {
      throw new Error(
        "Dataverse returned no organizations for this user. Ensure the Dataverse connector is wired and the user has access to at least one Power Platform environment.",
      )
    }
    const url = orgs[0]?.Url
    if (!url) {
      throw new Error(
        'Dataverse GetOrganizations returned an entry with no Url field.',
      )
    }
    if (orgs.length > 1) {
      // We don't have an env-id field on OrganizationsDynamicValuesListItem,
      // so we can't auto-disambiguate. Surface this in the console so makers
      // know they should pin VITE_DATAVERSE_ORG_URL.
      console.warn(
        `[dataverse] Found ${orgs.length} organizations; using "${
          orgs[0]?.FriendlyName ?? url
        }". Set VITE_DATAVERSE_ORG_URL to pin a specific org.`,
        orgs.map((o) => ({ url: o.Url, name: o.FriendlyName })),
      )
    }
    cachedOrgUrl = url
    return url
  })()

  try {
    return await inflightOrgPromise
  } finally {
    inflightOrgPromise = null
  }
}

function parseDisplayOrder(raw: unknown): number | null {
  if (typeof raw === 'number') return raw
  if (typeof raw === 'string') {
    const n = Number(raw)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function normalizeRole(role: unknown): 'user' | 'agent' | null {
  if (typeof role !== 'string') return null
  const r = role.toLowerCase()
  if (r === 'user') return 'user'
  if (r === 'agent' || r === 'bot' || r === 'assistant') return 'agent'
  return null
}

type ActivityYaml = NonNullable<MultiTurnYaml['activities']>[number]
type StepYaml = NonNullable<
  NonNullable<SingleTurnYaml['rows']>[number]['expectedExecutionSteps']
>[number]

function activityToTurn(activity: ActivityYaml): ConversationTurn | null {
  const role = normalizeRole(activity?.activity?.value?.from?.role)
  if (!role) return null
  const raw = activity?.activity?.text
  const text = Array.isArray(raw)
    ? raw.filter((t): t is string => typeof t === 'string').join(' ').trim()
    : typeof raw === 'string'
      ? raw.trim()
      : ''
  if (!text) return null
  return { role, text }
}

function parseExpectedSteps(
  raw: StepYaml[] | undefined,
): ExpectedExecutionStep[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const steps: ExpectedExecutionStep[] = []
  for (const s of raw) {
    if (!s || typeof s !== 'object') continue
    const kindRaw = (s as { kind?: unknown }).kind
    if (typeof kindRaw !== 'string') continue
    const step: ExpectedExecutionStep = { kind: kindRaw }
    const schemaNameRaw = (s as { schemaName?: unknown }).schemaName
    if (typeof schemaNameRaw === 'string') {
      step.schemaName = schemaNameRaw
    }
    steps.push(step)
  }
  return steps.length > 0 ? steps : undefined
}

/**
 * Normalize a parsed botcomponent.data row into a CaseDefinition,
 * or return null if it isn't a recognized test case kind (e.g. it's
 * the test-set row's grader config — `kind: EvaluationSet` — or some
 * other shape we don't model yet).
 *
 * Handles two kinds:
 *   - `EvaluationData` (single-turn Q/A)
 *   - `MultiTurnEvaluationCase` (conversational, scripted transcript)
 */
function rowToDefinition(row: BotComponentRow): CaseDefinition | null {
  const id = row.botcomponentid
  const dataStr = row.data
  if (!id || !dataStr) return null

  let parsed: { kind?: string }
  try {
    parsed = parseYaml(dataStr) as { kind?: string }
  } catch {
    // Malformed YAML — skip silently; better to fall back to other label
    // sources than to crash the whole heatmap on one bad row.
    return null
  }

  if (parsed?.kind === 'EvaluationData') {
    const single = parsed as SingleTurnYaml
    const firstRow = Array.isArray(single.rows) ? single.rows[0] : undefined
    if (!firstRow) return null

    const keywords = Array.isArray(firstRow.expectedKeywords)
      ? firstRow.expectedKeywords.filter(
          (k): k is string => typeof k === 'string',
        )
      : []

    return {
      caseId: id,
      kind: 'EvaluationData',
      input: typeof firstRow.input === 'string' ? firstRow.input : null,
      expectedOutput:
        typeof firstRow.expectedOutput === 'string'
          ? firstRow.expectedOutput
          : null,
      expectedKeywords: keywords,
      expectedExecutionSteps: parseExpectedSteps(firstRow.expectedExecutionSteps),
      displayOrder: parseDisplayOrder(single.extensionData?.displayOrder),
      rawYaml: dataStr,
    }
  }

  if (parsed?.kind === 'MultiTurnEvaluationCase') {
    const multi = parsed as MultiTurnYaml
    const turns: ConversationTurn[] = Array.isArray(multi.activities)
      ? multi.activities
          .map((a) => activityToTurn(a))
          .filter((t): t is ConversationTurn => t !== null)
      : []

    // First user turn doubles as the case "input" so label-resolution,
    // heatmap rows, leaderboards, etc. show something readable without
    // any per-kind branching downstream.
    const firstUserTurn = turns.find((t) => t.role === 'user')

    const keywords = Array.isArray(multi.expectedKeywords)
      ? multi.expectedKeywords.filter(
          (k): k is string => typeof k === 'string',
        )
      : []

    return {
      caseId: id,
      kind: 'MultiTurnEvaluationCase',
      input: firstUserTurn?.text ?? null,
      expectedOutput: null,
      expectedKeywords: keywords,
      turns: turns.length > 0 ? turns : undefined,
      expectedExecutionSteps: parseExpectedSteps(multi.expectedExecutionSteps),
      displayOrder: parseDisplayOrder(multi.extensionData?.displayOrder),
      rawYaml: dataStr,
    }
  }

  return null
}

/**
 * Fetch the live test-case definitions for one agent (cdsBotId) directly
 * from Dataverse. Returns a Map keyed by caseId (= botcomponentid) for
 * O(1) lookup.
 *
 * Returns both single-turn (`EvaluationData`) and multi-turn
 * (`MultiTurnEvaluationCase`) rows. Filters out test-set rows
 * (`kind: EvaluationSet`) and any other unrecognized YAML shapes —
 * those are grader/config rows, not cases.
 *
 * Failures (no Dataverse permission, malformed rows, etc.) propagate to
 * the caller — react-query will surface them as `error` and the UI
 * gracefully falls back to AI-mined / GUID labels.
 */
export async function fetchTestCaseDefinitions(
  cdsBotId: string,
): Promise<Map<string, CaseDefinition>> {
  const map = new Map<string, CaseDefinition>()
  const organization = await getOrganizationUrl()
  let skiptoken: string | undefined

  // Pull all Test Case rows for this bot. The connector paginates server-side;
  // walk @odata.nextLink via $skiptoken until exhausted. Pagination cap kept
  // generous (10 pages) since real test sets max out at hundreds of cases.
  for (let page = 0; page < 10; page++) {
    const result = await MicrosoftDataverseService.ListRecordsWithOrganization(
      organization,
      'botcomponents',
      undefined,
      undefined,
      undefined,
      undefined,
      'botcomponentid,name,data',
      `componenttype eq ${COMPONENT_TYPE_TEST_CASE} and _parentbotid_value eq ${cdsBotId}`,
      undefined,
      undefined,
      undefined,
      undefined,
      skiptoken,
    )
    const data = unwrap(result) as ListRecordsResponseShape
    const items = data.value ?? []
    for (const item of items) {
      const def = rowToDefinition(item)
      if (def) map.set(def.caseId, def)
    }
    const nextLink = data['@odata.nextLink']
    if (!nextLink) break
    // Extract $skiptoken from nextLink. Connector expects just the token
    // value, not the full URL.
    const tokenMatch = /[?&]\$skiptoken=([^&]+)/.exec(nextLink)
    if (!tokenMatch) break
    skiptoken = decodeURIComponent(tokenMatch[1])
  }

  return map
}

// ---- systemuser lookup (resolve ownerId → friendly name) ----

export interface SystemUser {
  systemuserid: string
  fullname: string | null
  internalemailaddress: string | null
  azureActiveDirectoryObjectId: string | null
}

interface SystemUserRow {
  systemuserid?: string
  fullname?: string
  internalemailaddress?: string
  azureactivedirectoryobjectid?: string
}

interface SystemUsersResponse {
  value?: SystemUserRow[]
  '@odata.nextLink'?: string
}

/** Chunk an array into batches of size n. */
function chunk<T>(arr: readonly T[], n: number): T[][] {
  if (n <= 0) return [arr.slice()]
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n))
  return out
}

/**
 * Resolve a list of systemuser GUIDs → friendly name + email. Used to map
 * `TestRun.ownerId` (and any other systemuser foreign keys) to "Rafael Lopez
 * Alcaraz" instead of a raw GUID.
 *
 * Strategy: chunk the IDs (50 per call) and OR-join them into a single
 * `$filter` per chunk to minimise round trips. Unknown IDs (e.g. service
 * principal owners, deleted users) simply won't appear in the returned map —
 * callers should render a graceful fallback.
 *
 * Failures (no Dataverse permission on systemuser, etc.) propagate as
 * thrown errors; react-query surfaces them and the UI falls back to GUIDs.
 */
/**
 * Resolve a batch of user GUIDs to systemuser rows.
 *
 * Important: `TestRun.ownerId` from the Copilot Studio connector is sometimes
 * the **AAD object id**, not the Dataverse `systemuserid`. We therefore filter
 * on BOTH columns (OR-joined) and key the returned map under both ids — so
 * callers can `.get(<whatever GUID they have>)` and get a hit either way.
 *
 * Service-principal or deleted owners may resolve to nothing — those are
 * silently absent from the returned map. Callers should render a graceful
 * fallback ("user <8 char prefix>…").
 *
 * Chunks 25 ids per call: each row now contributes 2 filter clauses (~120
 * chars each), so 25 ids ≈ 3000 chars of filter — comfortably under the
 * default ODATA url limit.
 */
export async function fetchUsersByIds(
  ids: readonly string[],
): Promise<Map<string, SystemUser>> {
  const out = new Map<string, SystemUser>()
  const unique = [...new Set(ids.filter((id) => typeof id === 'string' && id.length > 0))]
  if (unique.length === 0) return out

  const organization = await getOrganizationUrl()
  const batches = chunk(unique, 25)

  for (const batch of batches) {
    // Try BOTH columns since the connector hands back AAD object ids for
    // some run records and systemuserids for others — we don't know which.
    const filter = batch
      .map(
        (id) =>
          `(systemuserid eq ${id} or azureactivedirectoryobjectid eq ${id})`,
      )
      .join(' or ')
    const result = await MicrosoftDataverseService.ListRecordsWithOrganization(
      organization,
      'systemusers',
      undefined,
      undefined,
      undefined,
      undefined,
      'systemuserid,fullname,internalemailaddress,azureactivedirectoryobjectid',
      filter,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
    )
    const data = unwrap(result) as SystemUsersResponse
    for (const row of data.value ?? []) {
      if (!row.systemuserid) continue
      const user: SystemUser = {
        systemuserid: row.systemuserid,
        fullname: row.fullname ?? null,
        internalemailaddress: row.internalemailaddress ?? null,
        azureActiveDirectoryObjectId: row.azureactivedirectoryobjectid ?? null,
      }
      // Key by both ids so callers can look up under either form.
      out.set(row.systemuserid, user)
      if (row.azureactivedirectoryobjectid) {
        out.set(row.azureactivedirectoryobjectid, user)
      }
    }
  }

  return out
}

// ---- bots lookup (discover agents the user has access to) ----

/**
 * One row from the Dataverse `bots` table, narrowed to just the fields
 * we care about for picker/display use. Mirrors the same shape
 * `MCSTranscriptViewer` exposes, so detail pages can resolve a friendly
 * name without poking around in typed connector models.
 */
export interface BotInfo {
  botId: string
  displayName: string
  schemaName: string
}

interface BotRow {
  botid?: string
  name?: string
  schemaname?: string
}

interface BotsResponse {
  value?: BotRow[]
  '@odata.nextLink'?: string
}

/**
 * Componentstate values we want to exclude — Deleted (2) and
 * DeletedUnpublished (3). Source: `Botscomponentstate` enum in the
 * MCSTranscriptViewer's generated `BotsModel.ts`.
 */
const BOT_COMPONENTSTATE_DELETED = 2
const BOT_COMPONENTSTATE_DELETED_UNPUBLISHED = 3

/** Statecode value for "Active" bots. */
const BOT_STATECODE_ACTIVE = 0

/**
 * Fetch every bot row the current caller can see in this Dataverse
 * environment. Dataverse RBAC already does the "only what they have
 * access to" filtering for us — no extra security-role logic on the
 * client. Returns active, non-deleted rows; sorted by display name.
 *
 * Reuses the existing generic Dataverse connector that the rest of
 * this app already uses (no `power.config.json` change, no typed
 * `BotsService`). Failures propagate to callers — react-query surfaces
 * them and the AgentsPage shows a graceful empty-state.
 */
export async function fetchAccessibleBots(): Promise<BotInfo[]> {
  const out: BotInfo[] = []
  const organization = await getOrganizationUrl()
  let skiptoken: string | undefined

  // Pagination cap kept generous (20 pages × ~100 rows) — most envs have
  // dozens of bots, not thousands. If we ever hit the cap the user is
  // beyond what a discovery UI can usefully render anyway.
  for (let page = 0; page < 20; page++) {
    const result = await MicrosoftDataverseService.ListRecordsWithOrganization(
      organization,
      'bots',
      undefined,
      undefined,
      undefined,
      undefined,
      'botid,name,schemaname',
      `statecode eq ${BOT_STATECODE_ACTIVE} ` +
        `and componentstate ne ${BOT_COMPONENTSTATE_DELETED} ` +
        `and componentstate ne ${BOT_COMPONENTSTATE_DELETED_UNPUBLISHED}`,
      undefined,
      undefined,
      undefined,
      undefined,
      skiptoken,
    )
    const data = unwrap(result) as BotsResponse
    for (const row of data.value ?? []) {
      if (!row.botid) continue
      out.push({
        botId: row.botid,
        displayName: row.name ?? row.schemaname ?? row.botid,
        schemaName: row.schemaname ?? '',
      })
    }
    const nextLink = data['@odata.nextLink']
    if (!nextLink) break
    const tokenMatch = /[?&]\$skiptoken=([^&]+)/.exec(nextLink)
    if (!tokenMatch) break
    skiptoken = decodeURIComponent(tokenMatch[1])
  }

  // Stable alphabetical sort so the picker has a predictable order.
  out.sort((a, b) =>
    (a.displayName || a.schemaName).localeCompare(
      b.displayName || b.schemaName,
    ),
  )

  return out
}
