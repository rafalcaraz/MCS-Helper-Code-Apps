import { useMemo, useState } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Badge,
  Body1,
  Button,
  Caption1,
  Subtitle1,
  Switch,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  ArrowReset20Regular,
  CheckmarkCircle20Filled,
  ErrorCircle20Filled,
  Warning20Filled,
} from '@fluentui/react-icons'
import type { TestRun } from '../generated/models/MicrosoftCopilotStudioModel'
import type { LastViewedEntry } from '../hooks/useLastViewedRun'
import {
  computeFlakeRates,
  diffSinceLastVisit,
  resolveCaseLabel,
  type CaseDefinitionsMap,
  type DiffStatusFlip,
} from '../lib/metrics'
import { formatDateTime, formatRelativeTime } from '../lib/eval'

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
    rowGap: tokens.spacingVerticalS,
  },
  meta: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  buckets: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  bucket: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  bucketHeader: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
  },
  bucketTitle: {
    fontWeight: tokens.fontWeightSemibold,
  },
  list: {
    margin: 0,
    paddingInlineStart: tokens.spacingHorizontalL,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
  },
  link: {
    color: tokens.colorBrandForegroundLink,
    textDecoration: 'none',
    ':hover': { textDecoration: 'underline' },
  },
  flakyBadge: {
    marginInlineStart: tokens.spacingHorizontalXS,
  },
  emptyAll: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    color: tokens.colorPaletteGreenForeground1,
    padding: tokens.spacingVerticalS,
  },
  firstVisit: {
    color: tokens.colorNeutralForeground3,
    padding: tokens.spacingVerticalS,
  },
  noNew: {
    color: tokens.colorNeutralForeground3,
    padding: tokens.spacingVerticalS,
  },
  empty: {
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
    fontSize: tokens.fontSizeBase200,
  },
})

const FLAKE_THRESHOLD = 0.3

export interface SinceLastVisitInboxProps {
  runs: TestRun[]
  agentId: string | undefined
  testSetId: string | undefined
  markerRunId: string | null
  /**
   * Richer last-viewed entry (timestamp + friendly run/agent/test set
   * names). Used to render a memory-jogging caption on the "first visit"
   * and "you're caught up" branches so the maker can recall what they were
   * looking at last time.
   */
  lastEntry?: LastViewedEntry | null
  onClearMarker: () => void
  definitions?: CaseDefinitionsMap
}

/**
 * Headline widget on TestSetDetailPage. Answers: "What changed since I
 * last looked?" Uses the localStorage-backed marker to compute three buckets:
 *   - new regressions (Pass→Fail since marker)
 *   - recoveries (Fail→Pass since marker)
 *   - still failing (Fail at marker AND Fail in latest)
 *
 * Flaky cases (flip rate >30%) are excluded from "new regressions" by default
 * because their pass/fail signal is unreliable. Toggle restores them.
 *
 * On first visit (no marker), shows a friendly hint and the marker is set
 * automatically by the page.
 */
export function SinceLastVisitInbox({
  runs,
  agentId,
  testSetId,
  markerRunId,
  lastEntry,
  onClearMarker,
  definitions,
}: SinceLastVisitInboxProps) {
  const styles = useStyles()
  const [includeFlaky, setIncludeFlaky] = useState(false)

  const diff = useMemo(
    () => diffSinceLastVisit(runs, markerRunId),
    [runs, markerRunId],
  )
  const flakeRates = useMemo(() => computeFlakeRates(runs, 10), [runs])

  // Filter "new regressions" by flake rate when toggle is off.
  const filteredRegressions = useMemo(() => {
    if (includeFlaky) return diff.newRegressions
    return diff.newRegressions.filter(
      (r) => (flakeRates.get(r.caseId) ?? 0) < FLAKE_THRESHOLD,
    )
  }, [diff.newRegressions, flakeRates, includeFlaky])

  const flakyCount = diff.newRegressions.length - filteredRegressions.length

  const renderCaseLink = (flip: DiffStatusFlip) => {
    const resolved = resolveCaseLabel(flip.caseId, { definitions })
    const href =
      agentId && testSetId
        ? `/agents/${agentId}/testsets/${encodeURIComponent(
            testSetId,
          )}/cases/${encodeURIComponent(flip.caseId)}`
        : null
    const isFlaky = (flakeRates.get(flip.caseId) ?? 0) >= FLAKE_THRESHOLD
    return (
      <li key={flip.caseId}>
        {href ? (
          <RouterLink to={href} className={styles.link}>
            {resolved.label}
          </RouterLink>
        ) : (
          resolved.label
        )}
        {isFlaky ? (
          <Badge
            className={styles.flakyBadge}
            size="small"
            appearance="outline"
            color="warning"
            title="Flaky case (flip rate >30% across recent runs)"
          >
            flaky
          </Badge>
        ) : null}
      </li>
    )
  }

  if (diff.isFirstVisit) {
    return (
      <div className={styles.root}>
        <div className={styles.header}>
          <Subtitle1>Since you last looked</Subtitle1>
          <Caption1 className={styles.meta}>
            First visit — we'll start tracking from this run.
          </Caption1>
        </div>
        <Body1 as="p" className={styles.firstVisit}>
          Next time you open this test set, we'll show what changed since now:
          new regressions, recoveries, and cases still failing.
        </Body1>
      </div>
    )
  }

  if (diff.runsSinceMarker === 0) {
    const lastVisitedAt = lastEntry?.viewedAt
      ? formatRelativeTime(lastEntry.viewedAt)
      : null
    const lastRunName = lastEntry?.runName
    const lastRunIdShort = !lastRunName && lastEntry?.runId
      ? lastEntry.runId.slice(0, 8)
      : null
    return (
      <div className={styles.root}>
        <div className={styles.header}>
          <Subtitle1>Since you last looked</Subtitle1>
          <Caption1 className={styles.meta}>
            No new runs since you last viewed this test set.
          </Caption1>
        </div>
        <Body1 as="p" className={styles.noNew}>
          You're caught up. New runs will be summarized here next time.
        </Body1>
        {lastVisitedAt ? (
          <Caption1 className={styles.meta}>
            You last visited {lastVisitedAt}
            {lastRunName ? (
              <>
                {' — at that point the latest run was '}
                <strong>{lastRunName}</strong>.
              </>
            ) : lastRunIdShort ? (
              <>
                {' — the latest run at that point was '}
                <code>{lastRunIdShort}…</code>.
              </>
            ) : (
              '.'
            )}
          </Caption1>
        ) : null}
      </div>
    )
  }

  const noChanges =
    filteredRegressions.length === 0 &&
    diff.recoveries.length === 0 &&
    diff.stillFailing.length === 0

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <div>
          <Subtitle1>Since you last looked</Subtitle1>
          <Caption1 className={styles.meta}>
            {diff.runsSinceMarker} new run
            {diff.runsSinceMarker === 1 ? '' : 's'} since{' '}
            {formatDateTime(diff.markerStartTime)}
            {lastEntry?.runName ? (
              <> (you last saw <strong>{lastEntry.runName}</strong>).</>
            ) : (
              '.'
            )}
          </Caption1>
        </div>
        <div className={styles.controls}>
          <Switch
            label="Include flaky cases"
            checked={includeFlaky}
            onChange={(_, d) => setIncludeFlaky(Boolean(d.checked))}
          />
          <Button
            size="small"
            appearance="subtle"
            icon={<ArrowReset20Regular />}
            onClick={onClearMarker}
            title="Forget the marker — next visit will reset"
          >
            Reset
          </Button>
        </div>
      </div>

      {noChanges ? (
        <div className={styles.emptyAll}>
          <CheckmarkCircle20Filled />
          <Body1>
            No changes since you last looked across {diff.runsSinceMarker}{' '}
            run{diff.runsSinceMarker === 1 ? '' : 's'}.
          </Body1>
        </div>
      ) : (
        <div className={styles.buckets}>
          <div className={styles.bucket}>
            <div className={styles.bucketHeader}>
              <ErrorCircle20Filled
                style={{ color: tokens.colorPaletteRedForeground1 }}
              />
              <span className={styles.bucketTitle}>
                New regressions ({filteredRegressions.length}
                {flakyCount > 0 && !includeFlaky ? ` · ${flakyCount} hidden` : ''})
              </span>
            </div>
            {filteredRegressions.length === 0 ? (
              <Caption1 className={styles.empty}>
                {flakyCount > 0
                  ? `${flakyCount} flip${flakyCount === 1 ? '' : 's'} hidden — toggle "Include flaky cases" to show.`
                  : 'No cases regressed since marker.'}
              </Caption1>
            ) : (
              <ul className={styles.list}>
                {filteredRegressions.map(renderCaseLink)}
              </ul>
            )}
          </div>

          <div className={styles.bucket}>
            <div className={styles.bucketHeader}>
              <CheckmarkCircle20Filled
                style={{ color: tokens.colorPaletteGreenForeground1 }}
              />
              <span className={styles.bucketTitle}>
                Recoveries ({diff.recoveries.length})
              </span>
            </div>
            {diff.recoveries.length === 0 ? (
              <Caption1 className={styles.empty}>
                Nothing recovered since marker.
              </Caption1>
            ) : (
              <ul className={styles.list}>
                {diff.recoveries.map(renderCaseLink)}
              </ul>
            )}
          </div>

          <div className={styles.bucket}>
            <div className={styles.bucketHeader}>
              <Warning20Filled
                style={{ color: tokens.colorPaletteDarkOrangeForeground1 }}
              />
              <span className={styles.bucketTitle}>
                Still failing ({diff.stillFailing.length})
              </span>
            </div>
            {diff.stillFailing.length === 0 ? (
              <Caption1 className={styles.empty}>
                Nothing has been failing since marker.
              </Caption1>
            ) : (
              <ul className={styles.list}>
                {diff.stillFailing.map(renderCaseLink)}
              </ul>
            )}
          </div>
        </div>
      )}

      {diff.flippedAndBack.length > 0 ? (
        <Caption1 className={styles.meta}>
          Note: {diff.flippedAndBack.length} case
          {diff.flippedAndBack.length === 1 ? '' : 's'} flipped and recovered
          between marker and latest — likely flaky, not a stable regression.
        </Caption1>
      ) : null}
    </div>
  )
}
