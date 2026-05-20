import {
  Badge,
  Body1,
  Caption1,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import type {
  AgentActivitySummary,
  AgentHealthSummary,
} from '../lib/metrics'
import type { SystemUser } from '../api/dataverse'

const useStyles = makeStyles({
  strip: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: tokens.spacingHorizontalL,
  },
  tile: {
    backgroundColor: tokens.colorNeutralBackground1,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderRadius: tokens.borderRadiusLarge,
    boxShadow: tokens.shadow4,
    display: 'flex',
    flexDirection: 'column',
    rowGap: tokens.spacingVerticalXS,
    minWidth: 0,
  },
  tileLabel: {
    color: tokens.colorNeutralForeground3,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    fontWeight: tokens.fontWeightSemibold,
  },
  bigValue: {
    fontSize: tokens.fontSizeHero700,
    fontWeight: tokens.fontWeightSemibold,
    lineHeight: 1.1,
  },
  bigValueRow: {
    display: 'flex',
    alignItems: 'baseline',
    columnGap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  subtle: {
    color: tokens.colorNeutralForeground3,
  },
  chipRow: {
    display: 'flex',
    columnGap: tokens.spacingHorizontalXS,
    rowGap: tokens.spacingVerticalXS,
    flexWrap: 'wrap',
  },
  sparkline: {
    display: 'flex',
    alignItems: 'flex-end',
    columnGap: 2,
    height: '28px',
    marginTop: tokens.spacingVerticalXS,
  },
  bar: {
    flex: '1 1 auto',
    minWidth: 0,
    borderTopLeftRadius: '2px',
    borderTopRightRadius: '2px',
    borderBottomLeftRadius: '2px',
    borderBottomRightRadius: '2px',
  },
})

export interface AgentLandingKpiStripProps {
  health: AgentHealthSummary
  activity: AgentActivitySummary
  /** Optional resolved user lookup keyed by systemuserid (for owner names). */
  owners?: ReadonlyMap<string, SystemUser>
  /**
   * Wall-clock reference for "last run X min ago" copy. Passed in so the
   * parent can freeze it once per mount and we stay pure during render.
   */
  now: number
}

function formatRelative(ts: number | null, now: number): string {
  if (ts === null) return '—'
  const diffMs = now - ts
  if (diffMs < 0) return 'in the future'
  const min = Math.round(diffMs / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const d = Math.round(hr / 24)
  if (d < 14) return `${d} day${d === 1 ? '' : 's'} ago`
  const w = Math.round(d / 7)
  return `${w} wk${w === 1 ? '' : 's'} ago`
}

function ownerLabel(
  id: string,
  owners?: ReadonlyMap<string, SystemUser>,
): string {
  const u = owners?.get(id)
  return (
    u?.fullname?.trim() ||
    u?.internalemailaddress?.trim() ||
    `user ${id.slice(0, 8)}…`
  )
}

/**
 * Top-of-page "at a glance" dashboard for an agent.
 *
 * Four tiles:
 *   1. Overall health  — strict pass-rate across latest runs
 *   2. Test sets       — healthy / needs attention / stale chips
 *   3. Activity        — runs in last 7 days + 14-day sparkline + last-run age
 *   4. Owners          — distinct testers, named when resolved
 */
export function AgentLandingKpiStrip({
  health,
  activity,
  owners,
  now,
}: AgentLandingKpiStripProps) {
  const styles = useStyles()

  const healthPct =
    health.totalCasesLatest > 0
      ? Math.round((100 * health.passingCasesLatest) / health.totalCasesLatest)
      : null
  const healthColor: 'success' | 'warning' | 'danger' | 'subtle' =
    healthPct === null
      ? 'subtle'
      : healthPct >= 90
        ? 'success'
        : healthPct >= 70
          ? 'warning'
          : 'danger'

  const needsAttention =
    health.setsWithRegressions + health.setsWithDrift + health.setsWithAnomaly

  const peakDayCount = Math.max(1, ...activity.perDayLast14)

  const visibleOwners = activity.distinctOwnerIds.slice(0, 4)
  const extraOwners = Math.max(
    0,
    activity.distinctOwnerIds.length - visibleOwners.length,
  )

  return (
    <div className={styles.strip}>
      {/* TILE 1 — Overall health */}
      <div className={styles.tile}>
        <Caption1 className={styles.tileLabel}>Overall health</Caption1>
        {healthPct === null ? (
          <Body1 className={styles.subtle}>No runs yet</Body1>
        ) : (
          <>
            <div className={styles.bigValueRow}>
              <span
                className={styles.bigValue}
                style={{
                  color:
                    healthColor === 'success'
                      ? tokens.colorPaletteGreenForeground1
                      : healthColor === 'warning'
                        ? tokens.colorPaletteDarkOrangeForeground1
                        : healthColor === 'danger'
                          ? tokens.colorPaletteRedForeground1
                          : tokens.colorNeutralForeground1,
                }}
              >
                {healthPct}%
              </span>
              <Caption1 className={styles.subtle}>
                {health.passingCasesLatest}/{health.totalCasesLatest} cases
                passing
              </Caption1>
            </div>
            <Caption1 className={styles.subtle}>
              Strict pass-rate across latest runs of every test set
            </Caption1>
          </>
        )}
      </div>

      {/* TILE 2 — Test set breakdown */}
      <div className={styles.tile}>
        <Caption1 className={styles.tileLabel}>Test sets</Caption1>
        <div className={styles.bigValueRow}>
          <span className={styles.bigValue}>{health.totalSets}</span>
          <Caption1 className={styles.subtle}>tracked</Caption1>
        </div>
        <div className={styles.chipRow}>
          <Badge appearance="filled" color="success">
            ✓ {health.healthySets} healthy
          </Badge>
          {needsAttention > 0 ? (
            <Badge appearance="filled" color="danger" title="Sets with new regressions, coverage drift, or anomalies">
              ⚠ {needsAttention} needs attention
            </Badge>
          ) : null}
          {health.staleSets > 0 ? (
            <Badge appearance="filled" color="warning" title="Most recent run >14 days old">
              ⏳ {health.staleSets} stale
            </Badge>
          ) : null}
          {health.setsWithNoRuns > 0 ? (
            <Badge appearance="outline" color="subtle">
              {health.setsWithNoRuns} no runs
            </Badge>
          ) : null}
        </div>
      </div>

      {/* TILE 3 — Activity */}
      <div className={styles.tile}>
        <Caption1 className={styles.tileLabel}>Activity</Caption1>
        <div className={styles.bigValueRow}>
          <span className={styles.bigValue}>{activity.runsLast7Days}</span>
          <Caption1 className={styles.subtle}>runs · last 7 days</Caption1>
        </div>
        <Caption1 className={styles.subtle}>
          Last run {formatRelative(activity.lastRunTs, now)} · {activity.totalRuns} total
        </Caption1>
        {activity.runsLast14Days > 0 ? (
          <div
            className={styles.sparkline}
            aria-label="Runs per day for the last 14 days"
            title={`Last 14 days: ${activity.perDayLast14.join(', ')} runs/day`}
          >
            {activity.perDayLast14.map((count, idx) => {
              const heightPct = (count / peakDayCount) * 100
              return (
                <span
                  key={idx}
                  className={styles.bar}
                  style={{
                    height: `${count > 0 ? Math.max(10, heightPct) : 4}%`,
                    backgroundColor:
                      count > 0
                        ? tokens.colorBrandBackground
                        : tokens.colorNeutralStroke2,
                  }}
                />
              )
            })}
          </div>
        ) : null}
      </div>

      {/* TILE 4 — Owners */}
      <div className={styles.tile}>
        <Caption1 className={styles.tileLabel}>Tested by</Caption1>
        {activity.distinctOwnerIds.length === 0 ? (
          <Body1 className={styles.subtle}>No runs yet</Body1>
        ) : (
          <>
            <div className={styles.bigValueRow}>
              <span className={styles.bigValue}>
                {activity.distinctOwnerIds.length}
              </span>
              <Caption1 className={styles.subtle}>
                distinct {activity.distinctOwnerIds.length === 1 ? 'tester' : 'testers'}
              </Caption1>
            </div>
            <div className={styles.chipRow}>
              {visibleOwners.map((id) => (
                <Badge
                  key={id}
                  appearance="outline"
                  color="informative"
                  title={`systemuserid: ${id}`}
                >
                  {ownerLabel(id, owners)}
                </Badge>
              ))}
              {extraOwners > 0 ? (
                <Badge appearance="outline" color="subtle">
                  +{extraOwners} more
                </Badge>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
