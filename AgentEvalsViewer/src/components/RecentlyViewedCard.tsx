import { useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Body1,
  Caption1,
  Subtitle1,
  makeStyles,
  shorthands,
  tokens,
} from '@fluentui/react-components'
import { History20Regular, Open16Regular } from '@fluentui/react-icons'
import { useRecentVisits } from '../hooks/useLastViewedRun'
import { useAgentDisplayNameResolver } from '../hooks/useAgentDisplayName'
import { formatRelativeTime } from '../lib/eval'

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
  header: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
  },
  headerIcon: {
    color: tokens.colorBrandForeground1,
  },
  intro: {
    color: tokens.colorNeutralForeground2,
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
    paddingBlock: tokens.spacingVerticalS,
    paddingInline: tokens.spacingHorizontalM,
    borderRadius: tokens.borderRadiusMedium,
    ...shorthands.border('1px', 'solid', tokens.colorNeutralStroke2),
    backgroundColor: tokens.colorNeutralBackground2,
    textDecoration: 'none',
    color: tokens.colorNeutralForeground1,
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground3Hover,
    },
  },
  itemBody: {
    flexGrow: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    rowGap: '2px',
  },
  primary: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  secondary: {
    color: tokens.colorNeutralForeground3,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  openIcon: {
    color: tokens.colorNeutralForeground3,
    flexShrink: 0,
  },
})

export interface RecentlyViewedCardProps {
  /** Maximum number of recent visits to show. */
  limit?: number
}

/**
 * Home-page "where was I?" widget. Lists the test sets the maker last
 * opened, with a relative timestamp and the name of the latest run they
 * saw at the time. Clicking jumps straight back to the test set detail.
 *
 * Resolves agent friendly names from the tracked-agents store at render
 * time (falls back to the name captured when the visit was recorded, so
 * removing an agent doesn't blank out the row).
 *
 * Renders nothing if no recent visits — keeps the page tidy for new
 * makers who haven't navigated anywhere yet.
 */
export function RecentlyViewedCard({ limit = 6 }: RecentlyViewedCardProps) {
  const styles = useStyles()
  const visits = useRecentVisits(limit)
  const resolveAgentName = useAgentDisplayNameResolver()

  const items = useMemo(() => {
    return visits.map((v) => {
      const resolved = resolveAgentName(v.agentId)
      const agentName = resolved.resolved
        ? resolved.name
        : v.entry.agentName ?? resolved.name
      const testSetName =
        v.entry.testSetName ?? v.testSetId.slice(0, 8) + '…'
      const runName = v.entry.runName
      const relative = formatRelativeTime(v.entry.viewedAt)
      const href = `/agents/${v.agentId}/testsets/${encodeURIComponent(v.testSetId)}`
      return { ...v, agentName, testSetName, runName, relative, href }
    })
  }, [visits, resolveAgentName])

  if (items.length === 0) return null

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <History20Regular className={styles.headerIcon} />
        <Subtitle1>Pick up where you left off</Subtitle1>
      </div>
      <Body1 as="p" className={styles.intro}>
        Test sets you've opened recently. Click to jump straight back in.
      </Body1>
      <ul className={styles.list}>
        {items.map((it) => (
          <li key={`${it.agentId}::${it.testSetId}`}>
            <RouterLink to={it.href} className={styles.item}>
              <div className={styles.itemBody}>
                <Body1 className={styles.primary}>
                  <strong>{it.testSetName}</strong>
                  {' · '}
                  {it.agentName}
                </Body1>
                <Caption1 className={styles.secondary}>
                  Last visited {it.relative}
                  {it.runName ? <> — you saw <strong>{it.runName}</strong></> : null}
                </Caption1>
              </div>
              <Open16Regular className={styles.openIcon} />
            </RouterLink>
          </li>
        ))}
      </ul>
    </div>
  )
}
