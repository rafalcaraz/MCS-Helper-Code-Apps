import {
  Body2,
  Caption1,
  Subtitle2,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { ChatHelpRegular } from '@fluentui/react-icons'
import { collectAiResultReasons, metricLabel } from '../lib/metrics'
import { MetricChip } from './MetricChip'
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
  item: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
    borderLeft: `3px solid ${tokens.colorPaletteRedBorderActive}`,
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  text: {
    color: tokens.colorNeutralForeground1,
    fontStyle: 'italic',
    lineHeight: 1.5,
  },
  empty: {
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
})

export interface AiResultReasonsListProps {
  run: TestRun
  /** Max entries to show. Default 5. */
  limit?: number
}

/**
 * The LLM-generated `aiResultReason` strings, surfaced for the cases the
 * reviewer most likely needs to debug. Reading these is faster than
 * decoding metric scores.
 */
export function AiResultReasonsList({
  run,
  limit = 5,
}: AiResultReasonsListProps) {
  const styles = useStyles()
  const reasons = collectAiResultReasons(run)
    .filter((r) => r.status !== 'Pass')
    .slice(0, limit)

  if (reasons.length === 0) {
    return null
  }

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <ChatHelpRegular />
        <Subtitle2>Why these failed (AI explanations)</Subtitle2>
      </div>
      <Caption1>
        From <code>aiResultReason</code> on the worst-scoring metrics.
      </Caption1>
      {reasons.map((r, i) => (
        <div key={`${r.caseId}-${r.metricType}-${i}`} className={styles.item}>
          <div className={styles.meta}>
            <MetricChip type={r.metricType} status={r.status} small />
            <span title={r.caseId}>
              {r.caseId ? `case ${r.caseId.slice(0, 8)}…` : 'unknown case'}
            </span>
          </div>
          <Body2 className={styles.text}>“{r.text}”</Body2>
          <Caption1>— {metricLabel(r.metricType)}</Caption1>
        </div>
      ))}
    </div>
  )
}
