import { Badge, Tooltip, makeStyles, tokens } from '@fluentui/react-components'
import { Clock20Regular } from '@fluentui/react-icons'
import { formatCadenceDuration, type RunCadence } from '../lib/cadence'

const useStyles = makeStyles({
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
  },
})

export interface StalenessChipProps {
  cadence: RunCadence
}

/**
 * Yellow chip that fires when a test set's scheduled runs are running
 * behind cadence. Renders nothing when the cadence object says we're
 * on time. The tooltip carries the math (median + sample size) so the
 * maker can sanity-check the claim.
 */
export function StalenessChip({ cadence }: StalenessChipProps) {
  const styles = useStyles()
  if (!cadence.isStale) return null

  const lastRun = formatCadenceDuration(cadence.ageMs)
  const typical = formatCadenceDuration(cadence.medianGapMs)
  const overdue = formatCadenceDuration(cadence.ageMs - cadence.medianGapMs)

  return (
    <Tooltip
      content={
        `Last scheduled run fired ${lastRun} ago. ` +
        `Typically runs every ${typical} (median of last ${cadence.sampleSize} scheduled gaps). ` +
        `Overdue by ~${overdue}. ` +
        `If you scheduled this via Power Automate, check the flow's run history.`
      }
      relationship="label"
    >
      <Badge
        appearance="filled"
        color="warning"
        className={styles.chip}
        icon={<Clock20Regular />}
      >
        Scheduled run stale · {lastRun} ago
      </Badge>
    </Tooltip>
  )
}
