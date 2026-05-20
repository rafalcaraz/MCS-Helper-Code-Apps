/**
 * SnapshotRunBadge — when a snapshot was uploaded as a ZIP whose filename
 * embeds a Maker Evaluation id (eval run id), this badge shows the linked
 * run inline on the snapshot detail. If the id doesn't match any run in the
 * agent's run list, it shows a yellow warning instead.
 *
 * This is the only place in the app that claims a snapshot ↔ run relationship,
 * and it only does so when we have ground truth from the filename — never
 * temporal inference.
 */
import { useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import { Badge, Caption1, makeStyles, tokens } from '@fluentui/react-components'
import {
  CheckmarkCircle16Filled,
  Warning16Filled,
  Open16Regular,
} from '@fluentui/react-icons'
import { useTestRuns, useTestSets } from '../api/queries'
import { formatDateTime, formatRelativeTime } from '../lib/eval'

const useStyles = makeStyles({
  row: {
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
  },
  meta: {
    color: tokens.colorNeutralForeground3,
  },
  link: {
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: '2px',
    color: tokens.colorBrandForegroundLink,
    textDecorationLine: 'none',
    ':hover': { textDecorationLine: 'underline' },
  },
  short: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
})

interface Props {
  agentId: string
  evalRunId: string | undefined | null
  sourceFileKind: 'zip' | 'yaml' | undefined
}

export function SnapshotRunBadge({ agentId, evalRunId, sourceFileKind }: Props) {
  const styles = useStyles()
  const runsQuery = useTestRuns(agentId)
  const setsQuery = useTestSets(agentId)

  const matchedRun = useMemo(() => {
    if (!evalRunId || !runsQuery.data) return null
    return (
      runsQuery.data.find(
        (r) => r.id?.toLowerCase() === evalRunId.toLowerCase(),
      ) ?? null
    )
  }, [evalRunId, runsQuery.data])

  const testSet = useMemo(() => {
    if (!matchedRun?.testSetId || !setsQuery.data) return null
    return setsQuery.data.find((s) => s.id === matchedRun.testSetId) ?? null
  }, [matchedRun, setsQuery.data])

  if (!evalRunId) return null

  const short = evalRunId.slice(0, 8)

  if (runsQuery.isLoading) {
    return (
      <Badge appearance="outline" color="subtle">
        <span className={styles.row}>
          📸 Looking up run <code className={styles.short}>{short}…</code>
        </span>
      </Badge>
    )
  }

  if (!matchedRun) {
    return (
      <Badge appearance="filled" color="warning" icon={<Warning16Filled />}>
        <span className={styles.row}>
          ZIP refers to run <code className={styles.short}>{short}…</code> which
          isn't in this agent's runs
        </span>
      </Badge>
    )
  }

  const runHref = `/agents/${agentId}/runs/${matchedRun.id}`
  const testSetName = testSet?.displayName ?? matchedRun.testSetId?.slice(0, 8)
  const when = matchedRun.startTime
    ? formatRelativeTime(matchedRun.startTime)
    : null
  const whenAbs = matchedRun.startTime ? formatDateTime(matchedRun.startTime) : null

  return (
    <span className={styles.row}>
      <Badge
        appearance="filled"
        color="success"
        icon={<CheckmarkCircle16Filled />}
        title={
          sourceFileKind === 'zip'
            ? 'Linked from the ZIP filename — ground truth, not an inference.'
            : 'Linked from the YAML filename pattern.'
        }
      >
        From eval run
      </Badge>
      <RouterLink to={runHref} className={styles.link}>
        {matchedRun.name?.trim() || `Run ${short}`}
        <Open16Regular />
      </RouterLink>
      {testSetName ? (
        <Caption1 className={styles.meta}>· {testSetName}</Caption1>
      ) : null}
      {when ? (
        <Caption1 className={styles.meta} title={whenAbs ?? undefined}>
          · {when}
        </Caption1>
      ) : null}
    </span>
  )
}
