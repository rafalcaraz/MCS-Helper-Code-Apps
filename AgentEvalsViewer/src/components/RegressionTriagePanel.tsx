import { useMemo } from 'react'
import { Link as RouterLink } from 'react-router-dom'
import {
  Badge,
  Body1,
  Caption1,
  Link as FluentLink,
  Subtitle2,
  makeStyles,
  shorthands,
  tokens,
} from '@fluentui/react-components'
import {
  ArrowDown16Regular,
  ArrowUp16Regular,
  CheckmarkCircle16Regular,
} from '@fluentui/react-icons'
import {
  useTestRuns,
  useTestRunDetails,
} from '../api/queries'
import { useAgentSnapshots } from '../hooks/useAgentSnapshots'
import {
  compareRunsByStartTimeDesc,
  countResults,
  formatPassRate,
  formatRelativeTime,
} from '../lib/eval'
import { diffSnapshots } from '../lib/snapshotDiff'
import type { TestRun } from '../generated/models/MicrosoftCopilotStudioModel'

const useStyles = makeStyles({
  card: {
    backgroundColor: tokens.colorNeutralBackground1,
    padding: tokens.spacingHorizontalXL,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
  },
  cardRegression: {
    ...shorthands.borderLeft('4px', 'solid', tokens.colorPaletteRedBorder1),
  },
  cardImproved: {
    ...shorthands.borderLeft('4px', 'solid', tokens.colorPaletteGreenBorder1),
  },
  cardNeutral: {
    ...shorthands.borderLeft(
      '4px',
      'solid',
      tokens.colorNeutralStroke2,
    ),
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    columnGap: tokens.spacingHorizontalM,
    rowGap: tokens.spacingVerticalXS,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
  },
  versus: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  versusRate: {
    fontFamily: tokens.fontFamilyMonospace,
    fontWeight: 600,
  },
  versusOld: {
    color: tokens.colorNeutralForeground3,
  },
  triage: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
  },
  triageIntro: {
    color: tokens.colorNeutralForeground2,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
    paddingBlock: tokens.spacingVerticalS,
    ...shorthands.borderTop('1px', 'solid', tokens.colorNeutralStroke2),
  },
  sectionTitle: {
    display: 'flex',
    alignItems: 'center',
    columnGap: tokens.spacingHorizontalXS,
  },
  sectionBody: {
    color: tokens.colorNeutralForeground2,
  },
  list: {
    margin: 0,
    paddingInlineStart: tokens.spacingHorizontalL,
    color: tokens.colorNeutralForeground2,
  },
  evidenceStrong: {
    color: tokens.colorPaletteGreenForeground1,
    fontWeight: 600,
  },
  evidenceWeak: {
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
})

export interface RegressionTriagePanelProps {
  agentId: string
  run: TestRun
}

/** Pass-rate drop (percentage points) below which we expand into full triage. */
const REGRESSION_THRESHOLD_PP = 5

/**
 * "Did I change something, or did the world change?" — the killer
 * regression-triage UX. Sits on the run detail page.
 *
 * Three states:
 *   1. No previous run for this test set → renders nothing.
 *   2. Pass rate stable or improved (or dropped < 5pp) → tiny "vs previous"
 *      pill so the user can navigate easily. No triage UI.
 *   3. Pass rate dropped >= 5pp → expanded triage card with:
 *      - the delta + deep link to previous run
 *      - **snapshot evidence** (ground-truth attribution when both runs
 *        have linked ZIP snapshots — uses diffSnapshots())
 *      - a four-bucket hypothesis checklist (You / Org / Microsoft /
 *        External) so the maker has an actionable starting point even
 *        when snapshot evidence is incomplete.
 *
 * Deliberately makes ZERO inferential claims — when snapshots aren't
 * available, the panel says so and prompts the maker to upload them.
 */
export function RegressionTriagePanel({
  agentId,
  run,
}: RegressionTriagePanelProps) {
  const styles = useStyles()

  // Cheap call — list-level only — to find the previous run for this test set
  const runsQuery = useTestRuns(agentId)
  const previousRun = useMemo<TestRun | null>(() => {
    if (!runsQuery.data || !run.testSetId || !run.startTime) return null
    const thisTs = Date.parse(run.startTime)
    if (!Number.isFinite(thisTs)) return null
    const priors = runsQuery.data
      .filter((r) => {
        if (r.id === run.id) return false
        if (r.testSetId !== run.testSetId) return false
        if (!r.startTime) return false
        const t = Date.parse(r.startTime)
        return Number.isFinite(t) && t < thisTs
      })
      .sort(compareRunsByStartTimeDesc)
    return priors[0] ?? null
  }, [runsQuery.data, run.id, run.testSetId, run.startTime])

  // Pull the previous run's case-level data so we can compute its pass rate
  const prevRunQuery = useTestRunDetails(agentId, previousRun?.id)
  const prevRunFull = prevRunQuery.data ?? previousRun ?? null

  const { snapshots } = useAgentSnapshots(agentId)
  const thisRunSnapshot = useMemo(
    () =>
      run.id
        ? snapshots.find(
            (s) =>
              s.evalRunId?.toLowerCase() === run.id!.toLowerCase(),
          )
        : undefined,
    [snapshots, run.id],
  )
  const prevRunSnapshot = useMemo(
    () =>
      previousRun?.id
        ? snapshots.find(
            (s) =>
              s.evalRunId?.toLowerCase() ===
              previousRun.id!.toLowerCase(),
          )
        : undefined,
    [snapshots, previousRun],
  )

  const counts = countResults(run.testCasesResults)
  const prevCounts = countResults(prevRunFull?.testCasesResults)

  // If we can't compute deltas, we can still show a "vs previous" pill but
  // not the triage section.
  const haveBothRates =
    counts.passRate !== null &&
    prevCounts.passRate !== null &&
    counts.total > 0 &&
    prevCounts.total > 0
  const deltaPp = haveBothRates
    ? Math.round((counts.passRate! - prevCounts.passRate!) * 1000) / 10
    : null

  if (!previousRun) return null

  const isRegression = deltaPp !== null && deltaPp <= -REGRESSION_THRESHOLD_PP
  const isImprovement = deltaPp !== null && deltaPp >= REGRESSION_THRESHOLD_PP

  // The previous-run-link is shared by both the compact pill and the
  // expanded card; build it once.
  const prevRunHref = `/agents/${encodeURIComponent(agentId)}/runs/${encodeURIComponent(previousRun.id ?? '')}`
  const prevRunStartedAgo = previousRun.startTime
    ? formatRelativeTime(previousRun.startTime)
    : 'previously'

  const versus = (
    <div className={styles.versus}>
      <span className={styles.versusRate}>
        {formatPassRate(counts.passRate)}
      </span>
      <Caption1>this run</Caption1>
      <Caption1>·</Caption1>
      <span className={`${styles.versusRate} ${styles.versusOld}`}>
        {formatPassRate(prevCounts.passRate)}
      </span>
      <Caption1>previous</Caption1>
      <Caption1>·</Caption1>
      <RouterLink to={prevRunHref}>
        <FluentLink as="span">previous run {prevRunStartedAgo}</FluentLink>
      </RouterLink>
    </div>
  )

  // Compact pill: stable, slightly worse, or improved → no triage
  if (!isRegression) {
    let badge: React.ReactNode = null
    if (deltaPp !== null) {
      if (isImprovement) {
        badge = (
          <Badge appearance="filled" color="success" icon={<ArrowUp16Regular />}>
            +{Math.abs(deltaPp)}pp
          </Badge>
        )
      } else if (deltaPp < 0) {
        badge = (
          <Badge appearance="tint" color="warning" icon={<ArrowDown16Regular />}>
            {deltaPp}pp
          </Badge>
        )
      } else {
        badge = (
          <Badge appearance="tint" color="subtle" icon={<CheckmarkCircle16Regular />}>
            ±0pp
          </Badge>
        )
      }
    }
    return (
      <div className={`${styles.card} ${styles.cardNeutral}`}>
        <div className={styles.headerRow}>
          <div className={styles.headerLeft}>
            <Subtitle2>vs previous run</Subtitle2>
            {badge}
          </div>
          {versus}
        </div>
      </div>
    )
  }

  // Regression — full triage
  const snapEvidence = renderSnapshotEvidence({
    agentId,
    thisRunSnapshot,
    prevRunSnapshot,
    runId: run.id,
    prevRunId: previousRun.id,
    styles,
  })

  return (
    <div className={`${styles.card} ${styles.cardRegression}`}>
      <div className={styles.headerRow}>
        <div className={styles.headerLeft}>
          <Subtitle2>Pass rate dropped</Subtitle2>
          <Badge appearance="filled" color="danger" icon={<ArrowDown16Regular />}>
            {deltaPp}pp ({prevCounts.pass}/{prevCounts.total} → {counts.pass}/
            {counts.total})
          </Badge>
        </div>
        {versus}
      </div>

      <div className={styles.triage}>
        <Body1 className={styles.triageIntro}>
          <strong>Did I change something, or did the world?</strong> Work
          through the buckets below — snapshot evidence is the most decisive
          when available.
        </Body1>

        <div className={styles.section}>
          <Subtitle2 className={styles.sectionTitle}>
            🛠️ You — did the agent design change?
          </Subtitle2>
          <div className={styles.sectionBody}>{snapEvidence}</div>
        </div>

        <div className={styles.section}>
          <Subtitle2 className={styles.sectionTitle}>
            🏢 Your org — did a shared resource change?
          </Subtitle2>
          <ul className={styles.list}>
            <li>
              Has anyone modified a SharePoint site, doc library, or knowledge
              source the agent uses?
            </li>
            <li>
              Did an owner of a referenced resource leave / lose access?
            </li>
            <li>
              Was an Entra ID app secret or service principal rotated?
            </li>
          </ul>
        </div>

        <div className={styles.section}>
          <Subtitle2 className={styles.sectionTitle}>
            ☁️ Microsoft — platform-side change?
          </Subtitle2>
          <ul className={styles.list}>
            <li>
              Check{' '}
              <FluentLink
                href="https://admin.microsoft.com/Adminportal/Home#/servicehealth"
                target="_blank"
                rel="noreferrer noopener"
              >
                Microsoft 365 service health
              </FluentLink>{' '}
              for the run window.
            </li>
            <li>
              Verify the agent's model setting in Copilot Studio — model
              swaps are <em>not</em> visible in the snapshot ZIP.
            </li>
            <li>
              Any recent Copilot Studio platform release? Check the{' '}
              <FluentLink
                href="https://learn.microsoft.com/en-us/microsoft-copilot-studio/whats-new"
                target="_blank"
                rel="noreferrer noopener"
              >
                What's new
              </FluentLink>{' '}
              page.
            </li>
          </ul>
        </div>

        <div className={styles.section}>
          <Subtitle2 className={styles.sectionTitle}>
            🌍 External dependencies — third-party change?
          </Subtitle2>
          <ul className={styles.list}>
            <li>
              If the agent calls external APIs or connectors, did rate limits
              / schemas / auth change?
            </li>
            <li>
              For agents that summarize web content: did the source site
              redesign / paywall recently?
            </li>
          </ul>
        </div>
      </div>
    </div>
  )
}

interface SnapshotEvidenceArgs {
  agentId: string
  thisRunSnapshot: ReturnType<typeof useAgentSnapshots>['snapshots'][number] | undefined
  prevRunSnapshot: ReturnType<typeof useAgentSnapshots>['snapshots'][number] | undefined
  runId: string | undefined
  prevRunId: string | undefined
  styles: ReturnType<typeof useStyles>
}

/**
 * Centralised snapshot-evidence rendering for the triage card. Four
 * states, each makes a different factual claim (or explicitly admits we
 * don't have enough data to claim anything):
 *   - Both snapshots → run diff, list the headline counts, deep link to
 *     full diff view.
 *   - Only one snapshot → say which side is missing and how to add it.
 *   - Neither → say so, link to upload page.
 *   - Same snapshot on both runs → say "the agent was identical at both
 *     runs" — this is the strongest "it wasn't you" signal we can give.
 */
function renderSnapshotEvidence({
  agentId,
  thisRunSnapshot,
  prevRunSnapshot,
  runId,
  prevRunId,
  styles,
}: SnapshotEvidenceArgs) {
  const uploadHref = `/agents/${encodeURIComponent(agentId)}/snapshot`

  if (!thisRunSnapshot && !prevRunSnapshot) {
    return (
      <>
        <Caption1 className={styles.evidenceWeak}>
          No snapshots are uploaded for either run.
        </Caption1>
        <Caption1>
          To attribute this regression, download the snapshot ZIP for each
          run from Copilot Studio's Evaluation page and drop them into the{' '}
          <RouterLink to={uploadHref}>
            <FluentLink as="span">snapshot uploader</FluentLink>
          </RouterLink>
          . The ZIP filename's GUID auto-links to the run.
        </Caption1>
      </>
    )
  }

  if (thisRunSnapshot && !prevRunSnapshot) {
    return (
      <Caption1>
        You have a snapshot for <strong>this</strong> run but not the
        previous one. Download the previous run's ZIP from Copilot Studio
        (run id <code>{prevRunId?.slice(0, 8)}…</code>) and{' '}
        <RouterLink to={uploadHref}>
          <FluentLink as="span">upload it</FluentLink>
        </RouterLink>{' '}
        to compare.
      </Caption1>
    )
  }

  if (!thisRunSnapshot && prevRunSnapshot) {
    return (
      <Caption1>
        You have a snapshot for the <strong>previous</strong> run but not
        this one. Download this run's ZIP from Copilot Studio (run id{' '}
        <code>{runId?.slice(0, 8)}…</code>) and{' '}
        <RouterLink to={uploadHref}>
          <FluentLink as="span">upload it</FluentLink>
        </RouterLink>{' '}
        to compare.
      </Caption1>
    )
  }

  // Both present
  const a = prevRunSnapshot!
  const b = thisRunSnapshot!

  if (a.uploadedAt === b.uploadedAt) {
    return (
      <Caption1 className={styles.evidenceStrong}>
        ✓ Same agent snapshot is linked to both runs — the agent design
        was identical when both runs executed. Strongly suspect an
        external cause (look at Microsoft / org / external buckets
        below).
      </Caption1>
    )
  }

  const diff = diffSnapshots(a, b)
  const c = diff.summary

  if (c.totalChanges === 0) {
    return (
      <Caption1 className={styles.evidenceStrong}>
        ✓ Snapshots compared — <strong>no agent design changes</strong>{' '}
        detected between the two runs. Strongly suspect an external
        cause (look at Microsoft / org / external buckets below).{' '}
        <RouterLink
          to={`/agents/${encodeURIComponent(agentId)}/snapshot?at=${encodeURIComponent(b.uploadedAt)}&compareAt=${encodeURIComponent(a.uploadedAt)}`}
        >
          <FluentLink as="span">Open full diff →</FluentLink>
        </RouterLink>
      </Caption1>
    )
  }

  const bits: string[] = []
  const total =
    c.topicsAdded +
    c.topicsRemoved +
    c.topicsModified
  if (total > 0) bits.push(`${total} topic change${total === 1 ? '' : 's'}`)
  const ksTotal = c.ksAdded + c.ksRemoved + c.ksModified
  if (ksTotal > 0) bits.push(`${ksTotal} knowledge-source change${ksTotal === 1 ? '' : 's'}`)
  if (c.promptChanged) bits.push('system prompt edited')
  if (c.settingsChanged > 0)
    bits.push(`${c.settingsChanged} AI setting${c.settingsChanged === 1 ? '' : 's'} changed`)
  const flowsTotal = c.flowsAdded + c.flowsRemoved + c.flowsModified
  if (flowsTotal > 0) bits.push(`${flowsTotal} flow change${flowsTotal === 1 ? '' : 's'}`)
  if (c.metaChanged > 0) bits.push(`${c.metaChanged} meta field${c.metaChanged === 1 ? '' : 's'} changed`)

  return (
    <>
      <Caption1>
        <strong>Agent design changed</strong> between the two runs:{' '}
        {bits.join(' · ')}.
      </Caption1>
      <Caption1>
        <RouterLink
          to={`/agents/${encodeURIComponent(agentId)}/snapshot?at=${encodeURIComponent(b.uploadedAt)}&compareAt=${encodeURIComponent(a.uploadedAt)}`}
        >
          <FluentLink as="span">Open full diff →</FluentLink>
        </RouterLink>
      </Caption1>
    </>
  )
}
