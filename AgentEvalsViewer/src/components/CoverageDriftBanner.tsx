import { useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Body1,
  Caption1,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import type { TestRun } from '../generated/models/MicrosoftCopilotStudioModel'
import {
  computeCoverageDrift,
  resolveCaseLabel,
  type CaseDefinitionsMap,
} from '../lib/metrics'

const useStyles = makeStyles({
  list: {
    margin: 0,
    paddingInlineStart: tokens.spacingHorizontalL,
    color: tokens.colorNeutralForeground2,
  },
  item: {
    fontSize: tokens.fontSizeBase200,
  },
  hint: {
    color: tokens.colorNeutralForeground3,
    marginTop: tokens.spacingVerticalXS,
  },
  link: {
    color: tokens.colorBrandForegroundLink,
    textDecoration: 'none',
    ':hover': { textDecoration: 'underline' },
  },
})

export interface CoverageDriftBannerProps {
  runs: TestRun[]
  agentId: string | undefined
  testSetId: string | undefined
  definitions?: CaseDefinitionsMap
  /** Number of prior runs to baseline against. Default 5. */
  baselineWindow?: number
  /** Max missing-case items to render inline. Default 5. */
  maxItems?: number
}

/**
 * When the latest run executed fewer cases than the median of recent runs,
 * surface the missing case IDs (or names) so the maker knows their pass-rate
 * isn't apples-to-apples. Renders nothing when no drift detected.
 */
export function CoverageDriftBanner({
  runs,
  agentId,
  testSetId,
  definitions,
  baselineWindow = 5,
  maxItems = 5,
}: CoverageDriftBannerProps) {
  const styles = useStyles()
  const drift = useMemo(
    () => computeCoverageDrift(runs, baselineWindow),
    [runs, baselineWindow],
  )

  if (!drift.hasDrift) return null

  const missingShown = drift.missingCaseIds.slice(0, maxItems)
  const overflow = drift.missingCaseIds.length - missingShown.length

  return (
    <MessageBar intent="warning">
      <MessageBarBody>
        <MessageBarTitle>
          Latest run executed {drift.latestCount} of ~{drift.baselineCount}{' '}
          cases — {drift.missingCaseIds.length} missing
        </MessageBarTitle>
        <Body1 as="p">
          One or more cases that ran in recent runs were skipped or removed for
          this run. Pass-rate is not directly comparable to prior runs.
        </Body1>
        <ul className={styles.list}>
          {missingShown.map((id) => {
            const resolved = resolveCaseLabel(id, { definitions })
            const href =
              agentId && testSetId
                ? `/agents/${agentId}/testsets/${encodeURIComponent(
                    testSetId,
                  )}/cases/${encodeURIComponent(id)}`
                : null
            return (
              <li key={id} className={styles.item}>
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
        {overflow > 0 ? (
          <Caption1 className={styles.hint}>
            … and {overflow} more
          </Caption1>
        ) : null}
        <Caption1 className={styles.hint}>
          Common causes: a test case was deleted in Copilot Studio, the run
          was filtered, or a case errored out before producing a result.
        </Caption1>
      </MessageBarBody>
    </MessageBar>
  )
}
