/**
 * snapshotZip — extract a Copilot Studio bot-content snapshot from a ZIP
 * downloaded via Settings → Advanced → Download bot content.
 *
 * The ZIP filename embeds the eval run id (Maker Evaluation id):
 *   evaluationBotContent.{evalRunId}.zip
 *   └── botcontent_{evalRunId}.yaml
 *
 * This is the same GUID that appears in CPS's internal snapshot endpoint
 *   .../makerevaluations/{evalRunId}/snapshot
 * which means it's a ground-truth link to a real eval run, not an inference.
 */
import JSZip from 'jszip'

const GUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i

const ZIP_NAME_RE = new RegExp(
  `^evaluationBotContent\\.(${GUID_RE.source})\\.zip$`,
  'i',
)
const INNER_NAME_RE = new RegExp(
  `^botcontent_(${GUID_RE.source})\\.ya?ml$`,
  'i',
)

export interface ExtractedSnapshotZip {
  /** The YAML text — feed to parseSnapshot() unchanged. */
  yamlText: string
  /** Filename of the inner YAML (preserved so AgentSnapshotMeta.fileName stays accurate). */
  innerFileName: string
  /** Byte size of the inner YAML (snapshot meta tracks the YAML size, not the ZIP). */
  innerSize: number
  /** Maker Evaluation (eval run) id parsed from the ZIP filename. */
  evalRunIdFromFileName: string | null
  /** Maker Evaluation id parsed from the inner YAML filename — should match. */
  evalRunIdFromInnerName: string | null
  /** Effective evalRunId — outer/inner agree or we prefer outer. null if neither matched the pattern. */
  evalRunId: string | null
  /** True when both filenames carried a GUID and they agreed — the strongest signal. */
  guidsAgree: boolean
}

export class SnapshotZipError extends Error {
  hint?: string
  constructor(message: string, hint?: string) {
    super(message)
    this.name = 'SnapshotZipError'
    this.hint = hint
  }
}

export async function extractSnapshotZip(file: File): Promise<ExtractedSnapshotZip> {
  let zip: JSZip
  try {
    zip = await JSZip.loadAsync(file)
  } catch (err) {
    throw new SnapshotZipError(
      "Couldn't read the ZIP file.",
      err instanceof Error ? err.message : 'The file may be corrupted.',
    )
  }

  // The CPS download contains a single botcontent_<guid>.yaml. We search for
  // any .yaml/.yml entry — tolerant of future schema changes that might add
  // sibling files.
  const yamlEntries = Object.values(zip.files).filter(
    (entry) => !entry.dir && /\.ya?ml$/i.test(entry.name),
  )

  if (yamlEntries.length === 0) {
    throw new SnapshotZipError(
      "This ZIP doesn't contain a snapshot YAML.",
      'Expected a botcontent_<guid>.yaml file inside. Are you sure this is a Copilot Studio bot-content export?',
    )
  }

  // Prefer the file whose name matches the canonical botcontent_<guid>.yaml
  // pattern; fall back to the first YAML found.
  const canonical =
    yamlEntries.find((e) => INNER_NAME_RE.test(stripDir(e.name))) ??
    yamlEntries[0]

  const yamlText = await canonical.async('string')
  const innerFileName = stripDir(canonical.name)
  const innerSize = new TextEncoder().encode(yamlText).length

  const outerMatch = file.name.match(ZIP_NAME_RE)
  const innerMatch = innerFileName.match(INNER_NAME_RE)
  const evalRunIdFromFileName = outerMatch?.[1]?.toLowerCase() ?? null
  const evalRunIdFromInnerName = innerMatch?.[1]?.toLowerCase() ?? null

  const guidsAgree = Boolean(
    evalRunIdFromFileName &&
      evalRunIdFromInnerName &&
      evalRunIdFromFileName === evalRunIdFromInnerName,
  )

  const evalRunId =
    evalRunIdFromFileName ?? evalRunIdFromInnerName ?? null

  return {
    yamlText,
    innerFileName,
    innerSize,
    evalRunIdFromFileName,
    evalRunIdFromInnerName,
    evalRunId,
    guidsAgree,
  }
}

function stripDir(p: string): string {
  const ix = Math.max(p.lastIndexOf('/'), p.lastIndexOf('\\'))
  return ix >= 0 ? p.slice(ix + 1) : p
}

/** Detect by extension whether this file should be routed through the ZIP path. */
export function isLikelyZip(file: File): boolean {
  return /\.zip$/i.test(file.name) || file.type === 'application/zip'
}
