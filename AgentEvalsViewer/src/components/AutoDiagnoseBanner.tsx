import {
  Badge,
  Body1,
  Caption1,
  MessageBar,
  MessageBarActions,
  MessageBarBody,
  MessageBarTitle,
  Subtitle2,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  CheckmarkCircle20Filled,
  ErrorCircle20Filled,
  Info20Regular,
  Warning20Filled,
} from '@fluentui/react-icons'
import type { TestRun } from '../generated/models/MicrosoftCopilotStudioModel'
import {
  useDiagnoseRunPattern,
  type AffectedMetric,
  type DiagnoseResult,
} from '../lib/autoDiagnose'
import { metricColor } from '../lib/metrics'

const useStyles = makeStyles({
  body: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
  },
  metricsRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
    marginTop: tokens.spacingVerticalXS,
  },
  metricChip: {
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXXS,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalS}`,
    borderRadius: tokens.borderRadiusMedium,
    fontSize: tokens.fontSizeBase200,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  swatch: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  delta: {
    fontWeight: tokens.fontWeightSemibold,
  },
  actionList: {
    margin: 0,
    paddingLeft: tokens.spacingHorizontalL,
    color: tokens.colorNeutralForeground2,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXXS,
  },
  actionsLabel: {
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontSize: tokens.fontSizeBase100,
    fontWeight: tokens.fontWeightSemibold,
  },
  baselineCaption: {
    color: tokens.colorNeutralForeground3,
  },
})

function severityToIntent(s: DiagnoseResult['severity']) {
  switch (s) {
    case 'danger':
      return 'error' as const
    case 'warning':
      return 'warning' as const
    case 'success':
      return 'success' as const
    case 'info':
    default:
      return 'info' as const
  }
}

function severityIcon(s: DiagnoseResult['severity']) {
  switch (s) {
    case 'danger':
      return <ErrorCircle20Filled />
    case 'warning':
      return <Warning20Filled />
    case 'success':
      return <CheckmarkCircle20Filled />
    case 'info':
    default:
      return <Info20Regular />
  }
}

function MetricChip({ m }: { m: AffectedMetric }) {
  const styles = useStyles()
  const isDrop = m.deltaPp < 0
  return (
    <span
      className={styles.metricChip}
      title={`${m.label}: baseline ${(m.baselinePassRate * 100).toFixed(0)}% → latest ${(m.latestPassRate * 100).toFixed(0)}%`}
      style={{
        borderColor: isDrop
          ? tokens.colorPaletteRedBorderActive
          : tokens.colorPaletteGreenBorderActive,
        backgroundColor: isDrop
          ? tokens.colorPaletteRedBackground1
          : tokens.colorPaletteGreenBackground1,
      }}
    >
      <span
        className={styles.swatch}
        style={{ backgroundColor: metricColor(m.type) }}
        aria-hidden
      />
      {m.label}
      <span
        className={styles.delta}
        style={{
          color: isDrop
            ? tokens.colorPaletteRedForeground1
            : tokens.colorPaletteGreenForeground1,
        }}
      >
        {isDrop ? '−' : '+'}
        {Math.abs(m.deltaPp).toFixed(0)}pp
      </span>
    </span>
  )
}

export interface AutoDiagnoseBannerProps {
  runs: ReadonlyArray<TestRun>
}

/**
 * Pattern-recognition banner that translates per-metric pass-rate changes
 * into a plain-English diagnosis ("knowledge source likely broken",
 * "tool/connector likely broken", "platform-wide regression", etc.) plus
 * 1–3 concrete suggested actions.
 *
 * Rendered above the "Latest vs prior run" card on the test-set page.
 * Stable / no-baseline states render quietly; drops render loudly.
 */
export function AutoDiagnoseBanner({ runs }: AutoDiagnoseBannerProps) {
  const styles = useStyles()
  const result = useDiagnoseRunPattern(runs)

  // Don't render anything when there's literally nothing to say
  // (no runs at all). Stable / no-baseline still render — they're useful.
  if (runs.length === 0) return null

  const intent = severityToIntent(result.severity)

  return (
    <MessageBar intent={intent} icon={severityIcon(result.severity)}>
      <MessageBarBody className={styles.body}>
        <MessageBarTitle>{result.title}</MessageBarTitle>
        <Body1>{result.description}</Body1>

        {result.droppedMetrics.length > 0 ? (
          <div className={styles.metricsRow}>
            {result.droppedMetrics.map((m) => (
              <MetricChip key={m.type} m={m} />
            ))}
          </div>
        ) : null}

        {result.suggestedActions.length > 0 ? (
          <div>
            <Caption1 className={styles.actionsLabel}>What to try</Caption1>
            <ul className={styles.actionList}>
              {result.suggestedActions.map((a, i) => (
                <li key={i}>
                  <Body1>{a}</Body1>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {result.baselineRuns > 0 ? (
          <Caption1 className={styles.baselineCaption}>
            Baseline computed from the prior {result.baselineRuns} run
            {result.baselineRuns === 1 ? '' : 's'}.
          </Caption1>
        ) : null}
      </MessageBarBody>
      <MessageBarActions>
        <Badge appearance="tint" size="small">
          {patternLabel(result.pattern)}
        </Badge>
      </MessageBarActions>
    </MessageBar>
  )
}

function patternLabel(p: DiagnoseResult['pattern']): string {
  switch (p) {
    case 'no-baseline':
      return 'gathering data'
    case 'stable':
      return 'stable'
    case 'improved':
      return 'improving'
    case 'knowledge-source-broken':
      return 'knowledge'
    case 'connector-broken':
      return 'connector'
    case 'keyword-only-broken':
      return 'keywords only'
    case 'platform-wide':
      return 'platform'
    case 'partial-degradation':
      return 'partial'
  }
}

// Suppress unused-import lint warning on Subtitle2 — kept for future
// expansion of the "What to try" section.
void Subtitle2
