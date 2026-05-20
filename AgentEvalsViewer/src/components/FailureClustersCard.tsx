import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Badge,
  Body2,
  Button,
  Caption1,
  Subtitle2,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  ChevronDown16Regular,
  ChevronRight16Regular,
  CollectionsRegular,
} from '@fluentui/react-icons'
import {
  clusterFailureReasons,
  metricLabel,
  resolveCaseLabel,
  type CaseDefinitionsMap,
  type ReasonClusterItem,
} from '../lib/metrics'
import type { TestRun } from '../generated/models/MicrosoftCopilotStudioModel'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
  },
  cluster: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  clusterHeader: {
    display: 'flex',
    alignItems: 'flex-start',
    columnGap: tokens.spacingHorizontalS,
    cursor: 'pointer',
  },
  clusterTitle: {
    flex: 1,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
  },
  clusterMeta: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  members: {
    margin: 0,
    paddingInlineStart: tokens.spacingHorizontalL,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
  },
  link: {
    color: tokens.colorBrandForegroundLink,
    textDecoration: 'none',
    ':hover': { textDecoration: 'underline' },
  },
  empty: {
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
})

export interface FailureClustersCardProps {
  /**
   * Either a single run (latest run shown on TestSetDetailPage) or many.
   * The card extracts every failing case's `aiResultReason` text from each
   * run and clusters across them.
   */
  runs: TestRun[]
  agentId: string | undefined
  testSetId: string | undefined
  definitions?: CaseDefinitionsMap
  /** Show at most N clusters. Default 6. */
  limit?: number
}

/**
 * Groups failing cases by similarity of grader explanation text
 * (`aiResultReason`). Two cases failing for "the same reason" become a single
 * row with a count, instead of N copies in a flat list.
 *
 * Uses 2-shingle Jaccard similarity (>=0.5) — deterministic, no LLM, cheap.
 */
export function FailureClustersCard({
  runs,
  agentId,
  testSetId,
  definitions,
  limit = 6,
}: FailureClustersCardProps) {
  const styles = useStyles()
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]))

  const items = useMemo<ReasonClusterItem[]>(() => {
    const out: ReasonClusterItem[] = []
    for (const run of runs) {
      for (const c of run.testCasesResults ?? []) {
        for (const m of c.metricsResults ?? []) {
          const status = m.result?.status
          if (status === 'Pass') continue
          const reason = m.result?.aiResultReason
          if (!reason) continue
          out.push({
            caseId: c.testCaseId ?? undefined,
            metricType: m.type ?? 'Unknown',
            reason,
          })
        }
      }
    }
    return out
  }, [runs])

  const clusters = useMemo(
    () => clusterFailureReasons(items),
    [items],
  )

  const shown = clusters.slice(0, limit)

  const toggle = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <CollectionsRegular />
        <Subtitle2>Failure clusters</Subtitle2>
      </div>
      <Caption1>
        Cases grouped by similar grader explanation. One bug usually causes
        many failures — clusters surface that. Across {runs.length} run
        {runs.length === 1 ? '' : 's'}.
      </Caption1>
      {shown.length === 0 ? (
        <Body2 className={styles.empty}>
          No clusterable explanations yet — either no failures, or the
          graders in use don't produce <code>aiResultReason</code> text.
        </Body2>
      ) : (
        <div className={styles.list}>
          {shown.map((c, i) => {
            const isOpen = expanded.has(i)
            const distinctCases = c.caseCount
            return (
              <div key={i} className={styles.cluster}>
                <div
                  className={styles.clusterHeader}
                  onClick={() => toggle(i)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toggle(i)
                    }
                  }}
                  tabIndex={0}
                  role="button"
                  aria-expanded={isOpen}
                >
                  {isOpen ? <ChevronDown16Regular /> : <ChevronRight16Regular />}
                  <div className={styles.clusterTitle}>
                    {truncate(c.representative, 180)}
                    <div className={styles.clusterMeta}>
                      {distinctCases} case{distinctCases === 1 ? '' : 's'} ·{' '}
                      {c.items.length} occurrence
                      {c.items.length === 1 ? '' : 's'} ·{' '}
                      <Badge appearance="outline" size="small">
                        {metricLabel(c.metricType)}
                      </Badge>
                    </div>
                  </div>
                </div>
                {isOpen ? (
                  <ul className={styles.members}>
                    {dedupeByCaseId(c.items).map((m) => {
                      const id = m.caseId
                      if (!id) {
                        return (
                          <li key={`${m.metricType}-anon`}>{m.reason}</li>
                        )
                      }
                      const resolved = resolveCaseLabel(id, { definitions })
                      const href =
                        agentId && testSetId
                          ? `/agents/${agentId}/testsets/${encodeURIComponent(
                              testSetId,
                            )}/cases/${encodeURIComponent(id)}`
                          : null
                      return (
                        <li key={id}>
                          {href ? (
                            <RouterLink to={href} className={styles.link}>
                              {resolved.label}
                            </RouterLink>
                          ) : (
                            resolved.label
                          )}
                        </li>
                      )
                    })}
                  </ul>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
      {clusters.length > shown.length ? (
        <Button
          appearance="subtle"
          size="small"
          onClick={() => setExpanded(new Set(shown.map((_, i) => i)))}
        >
          {clusters.length - shown.length} more cluster
          {clusters.length - shown.length === 1 ? '' : 's'} hidden
        </Button>
      ) : null}
    </div>
  )
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s
  return s.slice(0, n - 1).trimEnd() + '…'
}

function dedupeByCaseId(items: ReasonClusterItem[]): ReasonClusterItem[] {
  const seen = new Set<string>()
  const out: ReasonClusterItem[] = []
  for (const item of items) {
    const key = item.caseId ?? `__anon__:${item.reason}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}
