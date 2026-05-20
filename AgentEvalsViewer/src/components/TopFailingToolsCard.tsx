import {
  Body2,
  Caption1,
  Subtitle2,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { ToolboxRegular } from '@fluentui/react-icons'
import { aggregateMissingTools } from '../lib/metrics'
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
    rowGap: tokens.spacingVerticalS,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    borderBottom: `1px solid ${tokens.colorNeutralStroke3}`,
  },
  shortName: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  schema: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    fontFamily: tokens.fontFamilyMonospace,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'block',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
    borderRadius: tokens.borderRadiusCircular,
    paddingTop: '2px',
    paddingBottom: '2px',
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    backgroundColor: tokens.colorPaletteRedBackground2,
    color: tokens.colorPaletteRedForeground1,
  },
  empty: {
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
})

export interface TopFailingToolsCardProps {
  runs: TestRun[]
  /** Max entries to show. Default 8. */
  limit?: number
}

/**
 * Aggregates `CapabilityUse.missinginvocationsteps` across the supplied
 * runs and surfaces the tools/topics that most often *failed to be invoked*.
 * The single most actionable widget for makers debugging tool routing.
 */
export function TopFailingToolsCard({
  runs,
  limit = 8,
}: TopFailingToolsCardProps) {
  const styles = useStyles()
  const tools = aggregateMissingTools(runs).slice(0, limit)

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <ToolboxRegular />
        <Subtitle2>Top tools/topics not invoked</Subtitle2>
      </div>
      <Caption1>
        Aggregated from <code>CapabilityUse.missinginvocationsteps</code>{' '}
        across {runs.length} run{runs.length === 1 ? '' : 's'}.
      </Caption1>
      {tools.length === 0 ? (
        <Body2 className={styles.empty}>
          No missing tool invocations recorded.
        </Body2>
      ) : (
        <div className={styles.list}>
          {tools.map((t) => (
            <div key={t.schemaName} className={styles.row}>
              <div>
                <span className={styles.shortName}>{t.shortName}</span>
                <span className={styles.schema} title={t.schemaName}>
                  {t.stepType ? `${t.stepType} · ` : ''}
                  {t.schemaName}
                </span>
              </div>
              <span
                className={styles.badge}
                title={`Failed in ${t.runIds.size} run(s)`}
              >
                {t.occurrences}× missing
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
