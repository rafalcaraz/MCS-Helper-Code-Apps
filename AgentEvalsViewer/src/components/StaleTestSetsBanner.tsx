import {
  Caption1,
  Link as FluentLink,
  MessageBar,
  MessageBarBody,
  MessageBarTitle,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { formatCadenceDuration, type RunCadence } from '../lib/cadence'
import type { TestSet } from '../generated/models/MicrosoftCopilotStudioModel'
import { getTestSetName } from '../lib/eval'

const useStyles = makeStyles({
  list: {
    margin: 0,
    paddingInlineStart: tokens.spacingHorizontalL,
  },
  itemDetail: {
    color: tokens.colorNeutralForeground3,
  },
})

export interface StaleTestSetEntry {
  testSet: TestSet
  cadence: RunCadence
}

export interface StaleTestSetsBannerProps {
  agentId: string
  staleEntries: StaleTestSetEntry[]
}

/**
 * Yellow banner shown on the agent landing when one or more of its test
 * sets has fallen behind its scheduled-run cadence. Lists offending
 * sets with their overdue amount + a deep link into the set page so the
 * maker can act in one click.
 *
 * Renders nothing when nothing is stale.
 */
export function StaleTestSetsBanner({
  agentId,
  staleEntries,
}: StaleTestSetsBannerProps) {
  const styles = useStyles()
  if (staleEntries.length === 0) return null

  const isOne = staleEntries.length === 1
  const titleText = isOne
    ? '1 test set is behind its scheduled-run cadence'
    : `${staleEntries.length} test sets are behind their scheduled-run cadence`

  return (
    <MessageBar intent="warning">
      <MessageBarBody>
        <MessageBarTitle>{titleText}</MessageBarTitle>{' '}
        If you scheduled these via Power Automate, check the flow's run
        history — auth may have expired or the connection may be broken.
        <ul className={styles.list}>
          {staleEntries.map(({ testSet, cadence }) => {
            const lastRun = formatCadenceDuration(cadence.ageMs)
            const typical = formatCadenceDuration(cadence.medianGapMs)
            return (
              <li key={testSet.id}>
                <FluentLink
                  href={`/agents/${encodeURIComponent(agentId)}/testsets/${encodeURIComponent(
                    testSet.id ?? '',
                  )}`}
                >
                  {getTestSetName(testSet)}
                </FluentLink>{' '}
                <Caption1 className={styles.itemDetail}>
                  · last scheduled run {lastRun} ago · typically every{' '}
                  {typical}
                </Caption1>
              </li>
            )
          })}
        </ul>
      </MessageBarBody>
    </MessageBar>
  )
}
