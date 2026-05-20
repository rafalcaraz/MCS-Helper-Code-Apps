/**
 * Helpers for overlaying snapshot publish events onto Recharts trend lines.
 *
 * The publish event is the meaningful one — that's the moment the maker
 * made their change live — but we fall back to the uploadedAt if publish
 * timestamp is missing.
 */
import type { AgentSnapshot } from './snapshotParser'

export interface SnapshotChartMarker {
  /** Stable id for React keys. */
  id: string
  /** Epoch ms — the x-coordinate the ReferenceLine sits on. */
  ts: number
  /** Short label shown in the tooltip / above the line. */
  label: string
  /** Longer description, used by the marker tooltip. */
  description: string
  /** The original snapshot for click-through. */
  snapshot: AgentSnapshot
}

/**
 * Project snapshots onto chart markers, deduplicating by timestamp (when
 * two snapshots have the same publishedOn we keep the newest upload).
 */
export function snapshotsToChartMarkers(
  snapshots: readonly AgentSnapshot[],
): SnapshotChartMarker[] {
  const markers: SnapshotChartMarker[] = []
  for (const s of snapshots) {
    const isoTs = s.lastPublishedAt ?? s.publishedOn ?? s.uploadedAt
    const ts = isoTs ? new Date(isoTs).getTime() : NaN
    if (!Number.isFinite(ts)) continue
    markers.push({
      id: s.uploadedAt,
      ts,
      label: `📸 v${s.entityVersion}`,
      description: s.label?.trim()
        ? `${s.label} (entity v${s.entityVersion})`
        : `Snapshot · entity v${s.entityVersion}`,
      snapshot: s,
    })
  }
  // Dedup near-identical timestamps (within 1 minute) — keep newest upload
  markers.sort((a, b) => a.ts - b.ts)
  const out: SnapshotChartMarker[] = []
  for (const m of markers) {
    const prev = out[out.length - 1]
    if (prev && Math.abs(prev.ts - m.ts) < 60_000) {
      if (m.snapshot.uploadedAt > prev.snapshot.uploadedAt) {
        out[out.length - 1] = m
      }
      continue
    }
    out.push(m)
  }
  return out
}
