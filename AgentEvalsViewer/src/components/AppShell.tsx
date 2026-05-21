import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  makeStyles,
  Menu,
  MenuItemRadio,
  MenuList,
  MenuPopover,
  MenuTrigger,
  shorthands,
  tokens,
  ToolbarButton,
  Tooltip,
  Title3,
} from '@fluentui/react-components'
import {
  Bot24Regular,
  Color24Regular,
  DarkTheme24Regular,
  Settings24Regular,
  WeatherSunny24Regular,
} from '@fluentui/react-icons'
import { useThemeMode, type ThemeMode } from '../lib/themeContext'

const useStyles = makeStyles({
  root: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground1,
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
    borderRadius: tokens.borderRadiusMedium,
    paddingBlock: '2px',
    paddingInline: tokens.spacingHorizontalXS,
  },
  brandText: {
    fontWeight: tokens.fontWeightSemibold,
  },
  spacer: {
    marginInlineStart: 'auto',
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
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

const MODE_LABELS: Record<ThemeMode, string> = {
  light: 'Light',
  dark: 'Dark',
  highContrast: 'High contrast',
  system: 'Match system',
}

/**
 * Best-effort, human-readable name for the current route. Used by the
 * polite live region so screen-reader users hear that navigation happened
 * — replacing the previous raw-pathname header text, which was both
 * unhelpful for sighted users and just noisy for assistive tech.
 */
function describeRoute(pathname: string): string {
  if (pathname === '/' || pathname === '') return 'Agents'
  const parts = pathname.split('/').filter(Boolean)
  // /agents/:id/...
  if (parts[0] === 'agents') {
    if (parts.length === 1) return 'Agents'
    if (parts.length === 2) return 'Agent overview'
    const segment = parts[2]
    if (segment === 'snapshot') return 'Agent snapshot'
    if (segment === 'testsets') {
      if (parts[4] === 'cases') return 'Test case'
      return 'Test set'
    }
    if (segment === 'runs') return 'Run details'
  }
  return parts.join(' › ')
}

function ThemeToggle() {
  const { mode, setMode } = useThemeMode()
  const selectedValues = { mode: [mode] }
  const tooltip = `Theme: ${MODE_LABELS[mode]}`
  return (
    <Menu
      checkedValues={selectedValues}
      onCheckedValueChange={(_, data) => {
        const next = data.checkedItems[0] as ThemeMode | undefined
        if (next) setMode(next)
      }}
    >
      <MenuTrigger disableButtonEnhancement>
        <Tooltip content={tooltip} relationship="label" withArrow>
          <ToolbarButton
            aria-label={`Theme: ${MODE_LABELS[mode]}. Activate to change.`}
            icon={
              mode === 'dark' ? (
                <DarkTheme24Regular />
              ) : mode === 'highContrast' ? (
                <Color24Regular />
              ) : mode === 'light' ? (
                <WeatherSunny24Regular />
              ) : (
                <Settings24Regular />
              )
            }
          />
        </Tooltip>
      </MenuTrigger>
      <MenuPopover>
        <MenuList>
          <MenuItemRadio name="mode" value="light">
            {MODE_LABELS.light}
          </MenuItemRadio>
          <MenuItemRadio name="mode" value="dark">
            {MODE_LABELS.dark}
          </MenuItemRadio>
          <MenuItemRadio name="mode" value="highContrast">
            {MODE_LABELS.highContrast}
          </MenuItemRadio>
          <MenuItemRadio name="mode" value="system">
            {MODE_LABELS.system}
          </MenuItemRadio>
        </MenuList>
      </MenuPopover>
    </Menu>
  )
}

export function AppShell({ children }: AppShellProps) {
  const styles = useStyles()
  const location = useLocation()

  // Polite live region for route changes. SPA navigations don't fire the
  // usual "page loaded" announcement, so we synthesize one ourselves.
  // We delay the first announcement past initial mount so screen readers
  // don't read both the page contents AND the route name on first load.
  const [routeAnnouncement, setRouteAnnouncement] = useState('')
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true
      return
    }
    setRouteAnnouncement(`Navigated to ${describeRoute(location.pathname)}`)
  }, [location.pathname])

  return (
    <div className={styles.root}>
      <a href="#main-content" className="sr-only sr-only-focusable">
        Skip to main content
      </a>
      <header className={styles.header}>
        <Link to="/agents" className={styles.brand} aria-label="Home">
          <Bot24Regular aria-hidden />
          <Title3 className={styles.brandText}>
            Agent Evaluations Viewer
          </Title3>
        </Link>
        <div className={styles.spacer} />
        <div className={styles.toolbar} role="toolbar" aria-label="App settings">
          <ThemeToggle />
        </div>
      </header>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {routeAnnouncement}
      </div>
      <main id="main-content" tabIndex={-1} className={styles.main}>
        {children}
      </main>
    </div>
  )
}
