import {
  Body2,
  Button,
  Caption1,
  Checkbox,
  Divider,
  Popover,
  PopoverSurface,
  PopoverTrigger,
  RadioGroup,
  Radio,
  Subtitle2,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import { Settings20Regular } from '@fluentui/react-icons'
import {
  computeCompositeRunResult,
  metricLabel,
  type CompositeMode,
} from '../lib/metrics'
import { useTrackedMetrics } from '../hooks/useTrackedMetrics'
import type { TestCaseResult } from '../generated/models/MicrosoftCopilotStudioModel'

const useStyles = makeStyles({
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground1,
    fontSize: tokens.fontSizeBase300,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    whiteSpace: 'nowrap',
  },
  title: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  pct: {
    fontWeight: tokens.fontWeightBold,
    fontFamily: tokens.fontFamilyMonospace,
  },
  popoverSurface: {
    minWidth: '320px',
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
  },
  popoverList: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
  },
  cogBtn: {
    minWidth: 'auto',
    padding: 0,
    backgroundColor: 'transparent',
    border: 'none',
  },
  customizedDot: {
    display: 'inline-block',
    width: '6px',
    height: '6px',
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorBrandForeground1,
  },
})

export interface CompositeBadgeProps {
  testSetId: string | undefined
  results: TestCaseResult[] | undefined
  observedMetrics: string[]
  mode?: CompositeMode
  onModeChange?: (m: CompositeMode) => void
  /** Per-test-set "mode" persistence isn't wired here — kept simple. */
}

/**
 * Small badge showing the composite "all critical metrics passing" pass rate
 * for a run, with a popover to configure which metrics are critical.
 */
export function CompositeBadge({
  testSetId,
  results,
  observedMetrics,
  mode = 'strict',
  onModeChange,
}: CompositeBadgeProps) {
  const styles = useStyles()
  const tracked = useTrackedMetrics(testSetId, observedMetrics)
  const composite = computeCompositeRunResult(
    results,
    tracked.critical,
    mode,
  )

  const pctText =
    composite.passRate === null
      ? '—'
      : `${(composite.passRate * 100).toFixed(0)}%`

  const checkedSet = tracked.critical ?? new Set(observedMetrics)

  return (
    <Popover withArrow positioning="below-end">
      <PopoverTrigger disableButtonEnhancement>
        <button
          type="button"
          className={styles.badge}
          aria-label="Configure composite score"
        >
          <span className={styles.title}>
            {mode === 'strict' ? 'Strict pass' : 'Liberal pass'}
          </span>
          <span className={styles.pct}>{pctText}</span>
          <Caption1>
            ({composite.passing}/{composite.total})
          </Caption1>
          {tracked.isCustomized ? (
            <Tooltip
              content="Custom critical metrics applied"
              relationship="description"
            >
              <span className={styles.customizedDot} aria-hidden />
            </Tooltip>
          ) : null}
          <Settings20Regular />
        </button>
      </PopoverTrigger>
      <PopoverSurface className={styles.popoverSurface}>
        <Subtitle2>Composite scoring</Subtitle2>
        <Body2>
          Different metrics measure different things. Pick which ones are
          “critical” for this test set, and how to combine them into a
          single Pass/Fail.
        </Body2>
        <Divider />
        <Caption1>Mode</Caption1>
        <RadioGroup
          value={mode}
          onChange={(_, d) =>
            onModeChange?.(d.value === 'liberal' ? 'liberal' : 'strict')
          }
          layout="vertical"
        >
          <Radio
            value="strict"
            label="Strict — all critical metrics must Pass"
          />
          <Radio
            value="liberal"
            label="Liberal — any critical metric Pass is enough"
          />
        </RadioGroup>
        <Divider />
        <Caption1>Critical metrics</Caption1>
        <div className={styles.popoverList}>
          {observedMetrics.length === 0 ? (
            <Caption1>No metrics observed yet.</Caption1>
          ) : (
            observedMetrics.map((t) => (
              <Checkbox
                key={t}
                checked={checkedSet.has(t)}
                onChange={() => tracked.toggle(t)}
                label={metricLabel(t)}
              />
            ))
          )}
        </div>
        {tracked.isCustomized ? (
          <Button appearance="subtle" size="small" onClick={tracked.reset}>
            Reset to all metrics critical
          </Button>
        ) : null}
      </PopoverSurface>
    </Popover>
  )
}
