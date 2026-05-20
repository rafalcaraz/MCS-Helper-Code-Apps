import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  makeStyles,
  shorthands,
  tokens,
  Title3,
  Body1,
} from '@fluentui/react-components'
import { Bot24Regular } from '@fluentui/react-icons'

const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalM,
    paddingBlock: tokens.spacingVerticalM,
    paddingInline: tokens.spacingHorizontalXXL,
    backgroundColor: tokens.colorNeutralBackground1,
    ...shorthands.borderBottom(
      '1px',
      'solid',
      tokens.colorNeutralStroke2,
    ),
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    color: tokens.colorNeutralForeground1,
    textDecoration: 'none',
  },
  brandText: {
    fontWeight: tokens.fontWeightSemibold,
  },
  envBadge: {
    marginInlineStart: 'auto',
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  main: {
    flexGrow: 1,
    paddingBlock: tokens.spacingVerticalXL,
    paddingInline: tokens.spacingHorizontalXXL,
    maxWidth: '1400px',
    width: '100%',
    boxSizing: 'border-box',
    marginInline: 'auto',
  },
})

export interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const styles = useStyles()
  const location = useLocation()

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <Link to="/agents" className={styles.brand} aria-label="Home">
          <Bot24Regular />
          <Title3 className={styles.brandText}>
            Agent Evaluations Viewer
          </Title3>
        </Link>
        <Body1 className={styles.envBadge} aria-label="current route">
          {location.pathname}
        </Body1>
      </header>
      <main className={styles.main}>{children}</main>
    </div>
  )
}
