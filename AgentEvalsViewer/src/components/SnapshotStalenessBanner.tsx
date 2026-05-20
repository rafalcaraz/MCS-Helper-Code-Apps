import { useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Body1,
  Button,
  Caption1,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import type { AgentSnapshot } from '../lib/snapshotParser'
import type { TestRun } from '../generated/models/MicrosoftCopilotStudioModel'
import { formatRelativeTime } from '../lib/eval'

const useStyles = makeStyles({
  body: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
  },
  detail: {
    color: tokens.colorNeutralForeground2,
  },
  monospace: {
    fontFamily: tokens.fontFamilyMonospace,
  },
})

export interface SnapshotStalenessBannerProps {
  agentId: string
  snapshots: readonly AgentSnapshot[]
  runs: readonly TestRun[]
}

/**
 * The "killer use case" for snapshots: if the maker has published the agent
 * AFTER their most recent evaluation run, the dashboard is showing stale
 * pass-rate numbers — they reflect the *previous* version of the agent.
 * Surface a friendly yellow banner pointing them at the snapshot.
 *
 * Silent (renders nothing) when:
 *   - no snapshots have been uploaded
 *   - no runs have been executed
 *   - the latest eval ran AFTER the latest snapshot publish (everything fresh)
 *   - we can't parse a timestamp on either side
 *
 * "Publish" timestamp is read in priority order: lastPublishedAt → publishedOn
 * → uploadedAt — falling back to upload time keeps the banner useful even
 * when the entity is missing publish metadata.
 */
export function SnapshotStalenessBanner({
  agentId,
  snapshots,
  runs,
}: SnapshotStalenessBannerProps) {
  const styles = useStyles()

  const result = useMemo(() => {
    if (snapshots.length === 0 || runs.length === 0) return null

    const latestSnapshot = [...snapshots]
      .map((s) => {
        const tsIso = s.lastPublishedAt ?? s.publishedOn ?? s.uploadedAt
        const ts = tsIso ? new Date(tsIso).getTime() : NaN
        return { snapshot: s, ts }
      })
      .filter((x) => Number.isFinite(x.ts))
      .sort((a, b) => b.ts - a.ts)[0]

    if (!latestSnapshot) return null

    const latestRun = [...runs]
      .map((r) => {
        const ts = r.startTime ? new Date(r.startTime).getTime() : NaN
        return { run: r, ts }
      })
      .filter((x) => Number.isFinite(x.ts))
      .sort((a, b) => b.ts - a.ts)[0]

    if (!latestRun) return null
    if (latestSnapshot.ts <= latestRun.ts) return null

    return {
      snapshot: latestSnapshot.snapshot,
      snapshotTs: latestSnapshot.ts,
      runTs: latestRun.ts,
    }
  }, [snapshots, runs])

  if (!result) return null

  const isUploadFallback =
    !result.snapshot.lastPublishedAt && !result.snapshot.publishedOn
  const sourceLabel = isUploadFallback ? 'uploaded' : 'published'

  return (
    <MessageBar intent="warning">
      <MessageBarBody>
        <MessageBarTitle>
          Agent edited since the last evaluation
        </MessageBarTitle>
        <div className={styles.body}>
          <Body1>
            Snapshot{' '}
            <span className={styles.monospace}>
              entity v{result.snapshot.entityVersion}
            </span>{' '}
            was {sourceLabel} <b>{formatRelativeTime(new Date(result.snapshotTs).toISOString())}</b>,
            but the most recent evaluation ran{' '}
            <b>{formatRelativeTime(new Date(result.runTs).toISOString())}</b>.
            The pass-rate numbers below reflect the previous version of the
            agent.
          </Body1>
          <Caption1 className={styles.detail}>
            Run an evaluation in Copilot Studio to refresh these dashboards
            against the current design.
          </Caption1>
        </div>
      </MessageBarBody>
      <MessageBarActions>
        <RouterLink
          to={`/agents/${agentId}/snapshot`}
          style={{ textDecoration: 'none' }}
        >
          <Button appearance="primary" size="small">
            View design snapshot
          </Button>
        </RouterLink>
      </MessageBarActions>
    </MessageBar>
  )
}
