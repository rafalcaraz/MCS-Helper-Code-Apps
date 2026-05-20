import type { ReactNode } from 'react'
import { useState } from 'react'
import {
  Button,
  Caption1,
  Subtitle1,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  ArrowMaximize20Regular,
  ArrowMinimize20Regular,
} from '@fluentui/react-icons'

const useStyles = makeStyles({
  root: {
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingHorizontalXL,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
  },
  expanded: {
    gridColumn: '1 / -1',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    columnGap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
    rowGap: tokens.spacingVerticalS,
  },
  titleBlock: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
    flex: 1,
    minWidth: 0,
  },
})

export interface ExpandableChartCardProps {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  /** Header-right slot for things like loading spinners or extra controls. */
  headerRight?: ReactNode
  /** Default expanded state. Useful when you want one chart big by default. */
  defaultExpanded?: boolean
}

/**
 * Card wrapper for a chart with an Expand/Collapse toggle. When expanded,
 * the card spans both columns of its parent grid (gridColumn: 1 / -1).
 */
export function ExpandableChartCard({
  title,
  subtitle,
  children,
  headerRight,
  defaultExpanded = false,
}: ExpandableChartCardProps) {
  const styles = useStyles()
  const [expanded, setExpanded] = useState(defaultExpanded)

  return (
    <div className={`${styles.root} ${expanded ? styles.expanded : ''}`}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <Subtitle1>{title}</Subtitle1>
          {subtitle ? <Caption1>{subtitle}</Caption1> : null}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            columnGap: tokens.spacingHorizontalS,
          }}
        >
          {headerRight}
          <Tooltip
            content={expanded ? 'Collapse to compact view' : 'Expand to full width'}
            relationship="label"
            withArrow
          >
            <Button
              size="small"
              appearance="subtle"
              icon={
                expanded ? (
                  <ArrowMinimize20Regular />
                ) : (
                  <ArrowMaximize20Regular />
                )
              }
              onClick={() => setExpanded((e) => !e)}
              aria-label={expanded ? 'Collapse chart' : 'Expand chart'}
            >
              {expanded ? 'Collapse' : 'Expand'}
            </Button>
          </Tooltip>
        </div>
      </div>
      {children}
    </div>
  )
}
