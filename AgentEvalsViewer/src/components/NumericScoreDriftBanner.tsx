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
  detectNumericScoreDrift,
  formatPercent,
  formatScore,
  metricLabel,
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
    marginBottom: tokens.spacingVerticalXXS,
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
  delta: {
    fontFamily: tokens.fontFamilyMonospace,
    color: tokens.colorPaletteRedForeground1,
    fontWeight: tokens.fontWeightSemibold,
  },
  metric: {
    color: tokens.colorNeutralForeground3,
  },
})

export interface NumericScoreDriftBannerProps {
  runs: TestRun[]
  agentId: string | undefined
  testSetId: string | undefined
  definitions?: CaseDefinitionsMap
  /** Show at most N entries inline. Default 6. */
  maxItems?: number
  /** Drop fraction threshold. Default 0.2 (20%). */
  thresholdPct?: number
}

/**
 * Surface cases whose latest CompareMeaning / TextSimilarity score dropped
 * meaningfully versus a rolling 30-day baseline. Binary pass/fail can hide
 * this kind of gradual drift; this banner is the early-warning lane.
 *
 * Renders nothing when no drift is detected.
 */
export function NumericScoreDriftBanner({
  runs,
  agentId,
  testSetId,
  definitions,
  maxItems = 6,
  thresholdPct = 0.2,
}: NumericScoreDriftBannerProps) {
  const styles = useStyles()
  const drifts = useMemo(
    () => detectNumericScoreDrift(runs, { thresholdPct }),
    [runs, thresholdPct],
  )

  if (drifts.length === 0) return null

  const shown = drifts.slice(0, maxItems)
  const overflow = drifts.length - shown.length
  const thresholdLabel = `${Math.round(thresholdPct * 100)}%`

  return (
    <MessageBar intent="warning">
      <MessageBarBody>
        <MessageBarTitle>
          {drifts.length} case{drifts.length === 1 ? '' : 's'} drifted on
          numeric scores — silent regression alert
        </MessageBarTitle>
        <Body1 as="p">
          These cases still pass/fail the same, but their numeric similarity
          score dropped by at least {thresholdLabel} versus the rolling 30-day
          baseline. Often the first sign of a knowledge-source or grounding
          regression.
        </Body1>
        <ul className={styles.list}>
          {shown.map((d) => {
            const resolved = resolveCaseLabel(d.caseId, { definitions })
            const href =
              agentId && testSetId
                ? `/agents/${agentId}/testsets/${encodeURIComponent(
                    testSetId,
                  )}/cases/${encodeURIComponent(d.caseId)}`
                : null
            const labelEl = href ? (
              <RouterLink to={href} className={styles.link}>
                {resolved.label}
              </RouterLink>
            ) : (
              <span>{resolved.label}</span>
            )
            return (
              <li key={`${d.caseId}-${d.metricType}`} className={styles.item}>
                {labelEl}{' '}
                <span className={styles.metric}>
                  · {metricLabel(d.metricType)}
                </span>{' '}
                <span className={styles.delta}>
                  {formatScore(d.latestScore)} ← {formatScore(d.baselineScore)}{' '}
                  (−{formatPercent(d.deltaPct)})
                </span>
              </li>
            )
          })}
        </ul>
        {overflow > 0 ? (
          <Caption1 className={styles.hint}>… and {overflow} more</Caption1>
        ) : null}
        <Caption1 className={styles.hint}>
          Baseline is the mean of prior scores from the last 30 days
          (minimum 3 observations). Open a case to inspect its score-over-time
          chart.
        </Caption1>
      </MessageBarBody>
    </MessageBar>
  )
}
