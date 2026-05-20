/**
 * Parser for Copilot Studio agent snapshot YAML files
 * (the `botcontent_<guid>.yaml` files produced by CPS's "Download bot content"
 * export, or the `pac copilot pull` command).
 *
 * The YAML is a complete authoring snapshot of an agent — `entity` (bot meta +
 * publish history + AI settings), `components[]` (every topic / knowledge
 * source / GPT component), and `flows[]` (Power Automate flows wired as
 * tools). This module normalizes that schema into shapes the UI can render
 * cheaply without re-parsing the YAML each render.
 */
import { parse as parseYaml } from 'yaml'

// Built-in CPS system topics — these are the ones present in every agent and
// are filtered out by default in the topics card (makers rarely care about
// them when reviewing a design). Match by the suffix after `.topic.` in the
// component's schemaName.
const SYSTEM_TOPIC_NAMES = new Set([
  'Signin',
  'Fallback',
  'MultipleTopicsMatched',
  'Search',
  'StartOver',
  'Escalate',
  'ResetConversation',
  'Greeting',
  'ThankYou',
  'ConversationStart',
  'Goodbye',
  'EndofConversation',
  'OnError',
])

export interface AgentSnapshotMeta {
  /** When the user uploaded this snapshot into the viewer. ISO timestamp. */
  uploadedAt: string
  /** Original filename — useful for display + diagnostics. */
  fileName: string
  /** Original file size in bytes. */
  rawSize: number
  /** Optional user-supplied label (e.g. "baseline", "before fixing X"). */
  label?: string
  /**
   * Maker Evaluation (eval run) id extracted from a ZIP / inner YAML filename.
   * When set, this is GROUND-TRUTH linkage to the eval run this snapshot was
   * captured for (see lib/snapshotZip.ts). Only set when the upload was a ZIP
   * (or a YAML named `botcontent_<guid>.yaml`); plain pasted YAML has none.
   */
  evalRunId?: string
  /** How we got the YAML — affects UI hints + the run-link confidence. */
  sourceFileKind?: 'zip' | 'yaml'
}

export interface AgentSnapshot extends AgentSnapshotMeta {
  cdsBotId: string
  displayName: string
  schemaName: string
  /** Global authoring version on the bot entity (increments on edit). */
  entityVersion: number

  authenticationMode?: string
  accessControlPolicy?: string
  language?: number
  template?: string

  generativeActionsEnabled?: boolean
  recognizerKind?: string

  aiSettings: {
    useModelKnowledge?: boolean
    isFileAnalysisEnabled?: boolean
    isSemanticSearchEnabled?: boolean
    contentModeration?: string
    optInUseLatestModels?: boolean
  }

  publishedOn?: string
  lastPublishedUserId?: string
  lastPublishedAt?: string
  contentVersion?: number

  components: SnapshotComponent[]
  flows: SnapshotFlow[]
}

export type SnapshotComponent =
  | TopicComponent
  | KnowledgeSourceComponent
  | GptSnapshotComponent
  | OtherComponent

interface SnapshotComponentBase {
  kind: string
  displayName: string
  id: string
  version: number
  schemaName: string
  description?: string
  createdAt?: string
  modifiedAt?: string
  createdBy?: string
  modifiedBy?: string
}

export interface TopicComponent extends SnapshotComponentBase {
  kind: 'DialogComponent'
  modelDescription?: string
  triggerKind?: string
  triggerQueries?: string[]
  isSystemTopic: boolean
}

export interface KnowledgeSourceComponent extends SnapshotComponentBase {
  kind: 'KnowledgeSourceComponent'
  sourceKind?: string
  sourceUrl?: string
  includeSubPages?: boolean
}

export interface GptSnapshotComponent extends SnapshotComponentBase {
  kind: 'GptComponent'
  instructions: string | null
  webBrowsing?: boolean
  modelNameHint?: string
}

export interface OtherComponent extends SnapshotComponentBase {
  kind: string
}

export interface SnapshotFlow {
  displayName: string
  isEnabled?: boolean
  workflowId?: string
  triggerType?: string
  connectionType?: string
  inputNames?: string[]
  outputNames?: string[]
}

export class SnapshotParseError extends Error {
  readonly hint?: string

  constructor(message: string, hint?: string) {
    super(message)
    this.name = 'SnapshotParseError'
    this.hint = hint
  }
}

function asString(v: unknown): string | undefined {
  return typeof v === 'string' ? v : undefined
}

function asNumber(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function asBoolean(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : undefined
}

function asArray(v: unknown): unknown[] | undefined {
  return Array.isArray(v) ? v : undefined
}

function isSystemTopic(schemaName: string, description?: string): boolean {
  if (description?.toLowerCase().startsWith('this system topic')) return true
  const m = /\.topic\.([^.]+)$/.exec(schemaName)
  if (m && SYSTEM_TOPIC_NAMES.has(m[1])) return true
  return false
}

function parseComponent(raw: unknown): SnapshotComponent | null {
  const r = asRecord(raw)
  if (!r) return null
  const kind = asString(r.kind) ?? 'Unknown'
  const audit = asRecord(r.auditInfo)
  const base: SnapshotComponentBase = {
    kind,
    displayName: asString(r.displayName) ?? '(untitled)',
    id: asString(r.id) ?? '',
    version: asNumber(r.version) ?? 0,
    schemaName: asString(r.schemaName) ?? '',
    description: asString(r.description),
    createdAt: asString(audit?.createdTimeUtc),
    modifiedAt: asString(audit?.modifiedTimeUtc),
    createdBy: asString(audit?.createdBy),
    modifiedBy: asString(audit?.modifiedBy),
  }

  if (kind === 'DialogComponent') {
    const dialog = asRecord(r.dialog)
    const beginDialog = asRecord(dialog?.beginDialog)
    const intent = asRecord(beginDialog?.intent)
    const triggerQueriesRaw = asArray(intent?.triggerQueries) ?? []
    const triggerQueries = triggerQueriesRaw
      .map((q) => asString(q))
      .filter((q): q is string => !!q)
    return {
      ...base,
      kind: 'DialogComponent',
      modelDescription: asString(dialog?.modelDescription),
      triggerKind: asString(beginDialog?.kind),
      triggerQueries: triggerQueries.length > 0 ? triggerQueries : undefined,
      isSystemTopic: isSystemTopic(base.schemaName, base.description),
    }
  }

  if (kind === 'KnowledgeSourceComponent') {
    const config = asRecord(r.configuration)
    const source = asRecord(config?.source)
    return {
      ...base,
      kind: 'KnowledgeSourceComponent',
      sourceKind: asString(source?.kind),
      sourceUrl: asString(source?.site) ?? asString(source?.url),
      includeSubPages: asBoolean(source?.includeSubPages),
    }
  }

  if (kind === 'GptComponent') {
    const meta = asRecord(r.metadata)
    const gptCaps = asRecord(meta?.gptCapabilities)
    const aiSettings = asRecord(meta?.aISettings)
    const model = asRecord(aiSettings?.model)
    const instructionsRaw = meta?.instructions
    let instructions: string | null = null
    if (typeof instructionsRaw === 'string' && instructionsRaw.trim().length > 0) {
      instructions = instructionsRaw
    }
    return {
      ...base,
      kind: 'GptComponent',
      instructions,
      webBrowsing: asBoolean(gptCaps?.webBrowsing),
      modelNameHint: asString(model?.modelNameHint),
    }
  }

  return { ...base, kind }
}

function parseFlow(raw: unknown): SnapshotFlow | null {
  const r = asRecord(raw)
  if (!r) return null
  const inputProps = asRecord(asRecord(r.inputType)?.properties)
  const outputProps = asRecord(asRecord(r.outputType)?.properties)
  return {
    displayName: asString(r.displayName) ?? '(untitled flow)',
    isEnabled: asBoolean(r.isEnabled),
    workflowId: asString(r.workflowId),
    triggerType: asString(r.triggerType),
    connectionType: asString(r.connectionType),
    inputNames: inputProps ? Object.keys(inputProps) : undefined,
    outputNames: outputProps ? Object.keys(outputProps) : undefined,
  }
}

export interface ParseSnapshotInput {
  yamlText: string
  fileName: string
  rawSize: number
  uploadedAt?: string
  label?: string
}

/**
 * Parse a CPS botcontent_*.yaml file into a normalized AgentSnapshot.
 * Throws SnapshotParseError with a maker-friendly message + actionable hint
 * on any structural problem.
 */
export function parseSnapshot(input: ParseSnapshotInput): AgentSnapshot {
  let doc: unknown
  try {
    doc = parseYaml(input.yamlText)
  } catch (err) {
    throw new SnapshotParseError(
      "Couldn't parse the file as YAML.",
      err instanceof Error
        ? `YAML error: ${err.message}`
        : 'Make sure the file is the unmodified botcontent_<guid>.yaml from Copilot Studio.',
    )
  }

  const root = asRecord(doc)
  if (!root) {
    throw new SnapshotParseError(
      "The file doesn't look like a Copilot Studio snapshot.",
      'Expected a YAML document with top-level keys: `kind`, `entity`, `components`.',
    )
  }

  if (asString(root.kind) !== 'BotDefinition') {
    throw new SnapshotParseError(
      `Unexpected snapshot kind: ${asString(root.kind) ?? '(missing)'}`,
      'The top-level `kind:` field should be `BotDefinition`. Make sure you uploaded the bot content YAML, not a topic or component file.',
    )
  }

  const entity = asRecord(root.entity)
  if (!entity) {
    throw new SnapshotParseError(
      "Snapshot is missing the `entity` block.",
      'This usually means the file is truncated or was edited after export.',
    )
  }

  const cdsBotId = asString(entity.cdsBotId)
  if (!cdsBotId) {
    throw new SnapshotParseError(
      "Snapshot is missing `entity.cdsBotId`.",
      'Without an agent id we can\'t tell which agent this snapshot belongs to.',
    )
  }

  const configuration = asRecord(entity.configuration)
  const aISettings = asRecord(configuration?.aISettings)
  const settings = asRecord(configuration?.settings)
  const recognizer = asRecord(configuration?.recognizer)
  const syncStatus = asRecord(entity.synchronizationStatus)

  const componentsRaw = asArray(root.components) ?? []
  const flowsRaw = asArray(root.flows) ?? []

  const components: SnapshotComponent[] = []
  for (const c of componentsRaw) {
    const parsed = parseComponent(c)
    if (parsed) components.push(parsed)
  }

  const flows: SnapshotFlow[] = []
  for (const f of flowsRaw) {
    const parsed = parseFlow(f)
    if (parsed) flows.push(parsed)
  }

  return {
    uploadedAt: input.uploadedAt ?? new Date().toISOString(),
    fileName: input.fileName,
    rawSize: input.rawSize,
    label: input.label,
    cdsBotId,
    displayName: asString(entity.displayName) ?? '(unnamed agent)',
    schemaName: asString(entity.schemaName) ?? '',
    entityVersion: asNumber(entity.version) ?? 0,
    authenticationMode: asString(entity.authenticationMode),
    accessControlPolicy: asString(entity.accessControlPolicy),
    language: asNumber(entity.language),
    template: asString(entity.template),
    generativeActionsEnabled: asBoolean(settings?.GenerativeActionsEnabled),
    recognizerKind: asString(recognizer?.kind),
    aiSettings: {
      useModelKnowledge: asBoolean(aISettings?.useModelKnowledge),
      isFileAnalysisEnabled: asBoolean(aISettings?.isFileAnalysisEnabled),
      isSemanticSearchEnabled: asBoolean(aISettings?.isSemanticSearchEnabled),
      contentModeration: asString(aISettings?.contentModeration),
      optInUseLatestModels: asBoolean(aISettings?.optInUseLatestModels),
    },
    publishedOn: asString(entity.publishedOn),
    lastPublishedUserId: asString(syncStatus?.lastPublishedUserId),
    lastPublishedAt: asString(syncStatus?.lastPublishedOnUtc),
    contentVersion: asNumber(syncStatus?.contentVersion),
    components,
    flows,
  }
}

export interface SnapshotComponentCounts {
  topics: number
  userTopics: number
  systemTopics: number
  knowledgeSources: number
  gpt: number
  flows: number
  other: number
}

export function countComponents(s: AgentSnapshot): SnapshotComponentCounts {
  const out: SnapshotComponentCounts = {
    topics: 0,
    userTopics: 0,
    systemTopics: 0,
    knowledgeSources: 0,
    gpt: 0,
    flows: s.flows.length,
    other: 0,
  }
  for (const c of s.components) {
    if (c.kind === 'DialogComponent') {
      out.topics += 1
      if ((c as TopicComponent).isSystemTopic) out.systemTopics += 1
      else out.userTopics += 1
    } else if (c.kind === 'KnowledgeSourceComponent') {
      out.knowledgeSources += 1
    } else if (c.kind === 'GptComponent') {
      out.gpt += 1
    } else {
      out.other += 1
    }
  }
  return out
}
