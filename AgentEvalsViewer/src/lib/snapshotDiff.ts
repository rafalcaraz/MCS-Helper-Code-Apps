/**
 * Pure functions for diffing two AgentSnapshots.
 *
 * The shape is "component-aware": rather than a textual YAML diff (which
 * would be noisy and unreadable), we compare the normalized AgentSnapshot
 * fields side-by-side and produce a structured summary the UI can render
 * as cards.
 *
 * Identity:
 *   - Topics / Knowledge sources / GPT components: by `id`
 *   - Flows: by `workflowId` (falls back to `displayName`)
 *
 * No third-party diff library — we implement a tiny line-LCS for the
 * system prompt and entity-field equality for everything else. For the
 * scope of an authoring-snapshot diff this is overkill-free and zero-dep.
 */
import type {
  AgentSnapshot,
  GptSnapshotComponent,
  KnowledgeSourceComponent,
  SnapshotComponent,
  SnapshotFlow,
  TopicComponent,
} from './snapshotParser'

export interface SnapshotDiff {
  a: AgentSnapshot
  b: AgentSnapshot

  /** High-level "what changed" headline counts for the summary chips. */
  summary: DiffSummaryCounts

  meta: MetaFieldChange[]
  aiSettings: SettingChange[]
  topics: ComponentDiff<TopicComponent>
  knowledgeSources: ComponentDiff<KnowledgeSourceComponent>
  gpt: GptDiff | null
  flows: FlowDiff
}

export interface DiffSummaryCounts {
  topicsAdded: number
  topicsRemoved: number
  topicsModified: number
  ksAdded: number
  ksRemoved: number
  ksModified: number
  settingsChanged: number
  flowsAdded: number
  flowsRemoved: number
  flowsModified: number
  promptChanged: boolean
  promptLinesAdded: number
  promptLinesRemoved: number
  metaChanged: number
  totalChanges: number
}

export interface MetaFieldChange {
  field: string
  before: unknown
  after: unknown
}

export interface SettingChange {
  field: string
  label: string
  before: unknown
  after: unknown
}

export interface ComponentDiff<T extends SnapshotComponent> {
  added: T[]
  removed: T[]
  modified: ComponentChange<T>[]
}

export interface ComponentChange<T extends SnapshotComponent> {
  id: string
  before: T
  after: T
  /** Human-readable list of fields that differ. */
  changedFields: string[]
}

export interface FlowDiff {
  added: SnapshotFlow[]
  removed: SnapshotFlow[]
  modified: { id: string; before: SnapshotFlow; after: SnapshotFlow; changedFields: string[] }[]
}

export interface GptDiff {
  instructionsBefore: string
  instructionsAfter: string
  /** LCS-based line diff, suitable for side-by-side or unified rendering. */
  lines: PromptDiffLine[]
  addedLines: number
  removedLines: number
  webBrowsingChange: SettingChange | null
  modelChange: SettingChange | null
}

export type PromptDiffKind = 'same' | 'added' | 'removed'

export interface PromptDiffLine {
  kind: PromptDiffKind
  text: string
}

// --------------------------------------------------------------------------
//  Top-level
// --------------------------------------------------------------------------

export function diffSnapshots(a: AgentSnapshot, b: AgentSnapshot): SnapshotDiff {
  const meta = diffMeta(a, b)
  const aiSettings = diffAiSettings(a, b)
  const topics = diffComponents(a, b, 'DialogComponent', topicSignature)
  const knowledgeSources = diffComponents(
    a,
    b,
    'KnowledgeSourceComponent',
    knowledgeSourceSignature,
  )
  const gpt = diffGpt(a, b)
  const flows = diffFlows(a, b)

  const summary: DiffSummaryCounts = {
    topicsAdded: topics.added.length,
    topicsRemoved: topics.removed.length,
    topicsModified: topics.modified.length,
    ksAdded: knowledgeSources.added.length,
    ksRemoved: knowledgeSources.removed.length,
    ksModified: knowledgeSources.modified.length,
    settingsChanged: aiSettings.length,
    flowsAdded: flows.added.length,
    flowsRemoved: flows.removed.length,
    flowsModified: flows.modified.length,
    promptChanged: gpt?.lines.some((l) => l.kind !== 'same') ?? false,
    promptLinesAdded: gpt?.addedLines ?? 0,
    promptLinesRemoved: gpt?.removedLines ?? 0,
    metaChanged: meta.length,
    totalChanges: 0,
  }
  summary.totalChanges =
    summary.topicsAdded +
    summary.topicsRemoved +
    summary.topicsModified +
    summary.ksAdded +
    summary.ksRemoved +
    summary.ksModified +
    summary.settingsChanged +
    summary.flowsAdded +
    summary.flowsRemoved +
    summary.flowsModified +
    summary.metaChanged +
    (summary.promptChanged ? 1 : 0)

  return { a, b, summary, meta, aiSettings, topics, knowledgeSources, gpt, flows }
}

// --------------------------------------------------------------------------
//  Meta + AI settings (flat field-by-field equality)
// --------------------------------------------------------------------------

function diffMeta(a: AgentSnapshot, b: AgentSnapshot): MetaFieldChange[] {
  const fields: (keyof AgentSnapshot)[] = [
    'displayName',
    'entityVersion',
    'contentVersion',
    'authenticationMode',
    'accessControlPolicy',
    'template',
    'language',
    'generativeActionsEnabled',
    'recognizerKind',
    'publishedOn',
    'lastPublishedUserId',
    'lastPublishedAt',
  ]
  const out: MetaFieldChange[] = []
  for (const f of fields) {
    if (a[f] !== b[f]) {
      out.push({ field: String(f), before: a[f], after: b[f] })
    }
  }
  return out
}

function diffAiSettings(a: AgentSnapshot, b: AgentSnapshot): SettingChange[] {
  const labels: Record<keyof AgentSnapshot['aiSettings'], string> = {
    useModelKnowledge: 'Use model knowledge',
    isFileAnalysisEnabled: 'File analysis',
    isSemanticSearchEnabled: 'Semantic search',
    contentModeration: 'Content moderation',
    optInUseLatestModels: 'Opt in to latest models',
  }
  const out: SettingChange[] = []
  for (const k of Object.keys(labels) as (keyof AgentSnapshot['aiSettings'])[]) {
    const before = a.aiSettings[k]
    const after = b.aiSettings[k]
    if (before !== after) {
      out.push({ field: String(k), label: labels[k], before, after })
    }
  }
  return out
}

// --------------------------------------------------------------------------
//  Components — generic diff by id
// --------------------------------------------------------------------------

function diffComponents<T extends SnapshotComponent>(
  a: AgentSnapshot,
  b: AgentSnapshot,
  kind: T['kind'],
  signature: (c: T) => Record<string, unknown>,
): ComponentDiff<T> {
  const aMap = indexComponentsByKind<T>(a, kind)
  const bMap = indexComponentsByKind<T>(b, kind)
  const added: T[] = []
  const removed: T[] = []
  const modified: ComponentChange<T>[] = []

  for (const [id, before] of aMap) {
    const after = bMap.get(id)
    if (!after) {
      removed.push(before)
      continue
    }
    const changedFields = compareSignatures(signature(before), signature(after))
    if (changedFields.length > 0) {
      modified.push({ id, before, after, changedFields })
    }
  }
  for (const [id, after] of bMap) {
    if (!aMap.has(id)) added.push(after)
  }

  return { added, removed, modified }
}

function indexComponentsByKind<T extends SnapshotComponent>(
  s: AgentSnapshot,
  kind: T['kind'],
): Map<string, T> {
  const out = new Map<string, T>()
  for (const c of s.components) {
    if (c.kind === kind) {
      const id = c.id || c.schemaName || c.displayName
      out.set(id, c as T)
    }
  }
  return out
}

function compareSignatures(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
): string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const changed: string[] = []
  for (const k of keys) {
    if (!shallowEqual(before[k], after[k])) changed.push(k)
  }
  return changed
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i += 1) {
      if (a[i] !== b[i]) return false
    }
    return true
  }
  return false
}

// Signatures intentionally omit auditInfo timestamps — bumping
// modifiedTimeUtc without changing functional fields shouldn't count as a
// "change" to the maker (CPS rewrites these on every save).
function topicSignature(t: TopicComponent): Record<string, unknown> {
  return {
    displayName: t.displayName,
    description: t.description,
    modelDescription: t.modelDescription,
    triggerKind: t.triggerKind,
    triggerQueries: t.triggerQueries ?? [],
    isSystemTopic: t.isSystemTopic,
  }
}

function knowledgeSourceSignature(
  k: KnowledgeSourceComponent,
): Record<string, unknown> {
  return {
    displayName: k.displayName,
    description: k.description,
    sourceKind: k.sourceKind,
    sourceUrl: k.sourceUrl,
    includeSubPages: k.includeSubPages,
  }
}

// --------------------------------------------------------------------------
//  Flows — identity by workflowId
// --------------------------------------------------------------------------

function diffFlows(a: AgentSnapshot, b: AgentSnapshot): FlowDiff {
  const aMap = indexFlows(a)
  const bMap = indexFlows(b)
  const added: SnapshotFlow[] = []
  const removed: SnapshotFlow[] = []
  const modified: FlowDiff['modified'] = []
  for (const [id, before] of aMap) {
    const after = bMap.get(id)
    if (!after) {
      removed.push(before)
      continue
    }
    const changedFields = compareSignatures(flowSignature(before), flowSignature(after))
    if (changedFields.length > 0) {
      modified.push({ id, before, after, changedFields })
    }
  }
  for (const [id, after] of bMap) {
    if (!aMap.has(id)) added.push(after)
  }
  return { added, removed, modified }
}

function indexFlows(s: AgentSnapshot): Map<string, SnapshotFlow> {
  const out = new Map<string, SnapshotFlow>()
  for (const f of s.flows) {
    const id = f.workflowId || f.displayName
    out.set(id, f)
  }
  return out
}

function flowSignature(f: SnapshotFlow): Record<string, unknown> {
  return {
    displayName: f.displayName,
    isEnabled: f.isEnabled,
    triggerType: f.triggerType,
    connectionType: f.connectionType,
    inputNames: f.inputNames ?? [],
    outputNames: f.outputNames ?? [],
  }
}

// --------------------------------------------------------------------------
//  GPT — instructions LCS line diff
// --------------------------------------------------------------------------

function diffGpt(a: AgentSnapshot, b: AgentSnapshot): GptDiff | null {
  const gptA = a.components.find(
    (c): c is GptSnapshotComponent => c.kind === 'GptComponent',
  )
  const gptB = b.components.find(
    (c): c is GptSnapshotComponent => c.kind === 'GptComponent',
  )
  if (!gptA && !gptB) return null
  const beforeText = gptA?.instructions ?? ''
  const afterText = gptB?.instructions ?? ''

  const lines = lineDiff(beforeText, afterText)
  const addedLines = lines.filter((l) => l.kind === 'added').length
  const removedLines = lines.filter((l) => l.kind === 'removed').length

  const webBrowsingChange =
    gptA?.webBrowsing !== gptB?.webBrowsing
      ? {
          field: 'webBrowsing',
          label: 'Web browsing',
          before: gptA?.webBrowsing,
          after: gptB?.webBrowsing,
        }
      : null

  const modelChange =
    gptA?.modelNameHint !== gptB?.modelNameHint
      ? {
          field: 'modelNameHint',
          label: 'Model',
          before: gptA?.modelNameHint,
          after: gptB?.modelNameHint,
        }
      : null

  return {
    instructionsBefore: beforeText,
    instructionsAfter: afterText,
    lines,
    addedLines,
    removedLines,
    webBrowsingChange,
    modelChange,
  }
}

/**
 * Classic LCS-based line diff.
 * O(N×M) memory/time — fine for system prompts (a few hundred lines at most).
 * Returns lines in the order they'd appear in a unified diff: kept lines in
 * their original positions, removed lines from `before` interleaved at the
 * point they were removed, added lines from `after` interleaved at insertion
 * point.
 */
export function lineDiff(before: string, after: string): PromptDiffLine[] {
  const aLines = before.length === 0 ? [] : before.split(/\r?\n/)
  const bLines = after.length === 0 ? [] : after.split(/\r?\n/)
  const m = aLines.length
  const n = bLines.length

  // dp[i][j] = length of LCS of aLines[0..i) and bLines[0..j)
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array<number>(n + 1).fill(0),
  )
  for (let i = 0; i < m; i += 1) {
    for (let j = 0; j < n; j += 1) {
      if (aLines[i] === bLines[j]) {
        dp[i + 1][j + 1] = dp[i][j] + 1
      } else {
        dp[i + 1][j + 1] = Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
  }

  const out: PromptDiffLine[] = []
  let i = m
  let j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) {
      out.push({ kind: 'same', text: aLines[i - 1] })
      i -= 1
      j -= 1
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      out.push({ kind: 'added', text: bLines[j - 1] })
      j -= 1
    } else if (i > 0) {
      out.push({ kind: 'removed', text: aLines[i - 1] })
      i -= 1
    }
  }
  out.reverse()
  return out
}

export function summarizeChange(value: unknown): string {
  if (value === undefined) return '(unset)'
  if (value === null) return '(null)'
  if (typeof value === 'boolean') return value ? 'On' : 'Off'
  if (typeof value === 'string') {
    if (value.length === 0) return '(empty)'
    return value.length > 80 ? `${value.slice(0, 77)}…` : value
  }
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return `[${value.length} items]`
  return JSON.stringify(value)
}
