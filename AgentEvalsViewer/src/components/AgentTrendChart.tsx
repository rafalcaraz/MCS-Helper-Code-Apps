import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  Body1,
  Caption1,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import type { TestRun } from '../generated/models/MicrosoftCopilotStudioModel'
import { buildAgentTrend } from '../lib/metrics'
import {
  buildTimeTickFormatter,
  formatTooltipDateTime,
} from '../lib/timeAxis'
import type { SnapshotChartMarker } from '../lib/snapshotChartMarkers'
import { renderSnapshotMarkerLabel } from './snapshotMarkerLabel'

const useStyles = makeStyles({
  empty: {
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
  caption: {
    color: tokens.colorNeutralForeground3,
  },
})

export interface AgentTrendChartProps {
  /** Every run across every test set on the agent. */
  runs: readonly TestRun[]
  height?: number
  /** Optional vertical markers for snapshot publishes. */
  snapshotMarkers?: readonly SnapshotChartMarker[]
  /**
   * When set, marker labels become clickable and navigate to that agent's
   * snapshot page with the corresponding snapshot pre-selected.
   */
  agentId?: string
}

/**
 * Per-day strict pass-rate aggregated across every test set on the agent.
 *
 * Renders nothing visible (caller can decide to render an empty card frame)
 * when there are fewer than 2 days of data — a single-point line tells you
 * nothing about trend.
 *
 * Snapshot markers, when supplied, render as dashed vertical reference lines
 * with a 📸 label — letting the maker correlate a publish event with a
 * pass-rate dip (Layer 3 timeline overlay). When `agentId` is provided the
 * labels become click-through entry points to the design snapshot page.
 */
export function AgentTrendChart({
  runs,
  height = 220,
  snapshotMarkers,
  agentId,
}: AgentTrendChartProps) {
  const styles = useStyles()
  const navigate = useNavigate()
  const points = useMemo(() => buildAgentTrend(runs), [runs])
  const data = useMemo(
    () =>
      points
        .filter((p) => p.passRate !== null)
        .map((p) => ({
          ts: p.ts,
          date: p.date,
          passRate: (p.passRate ?? 0) * 100,
          passing: p.passing,
          total: p.total,
          runCount: p.runCount,
          testSetCount: p.testSetCount,
        })),
    [points],
  )

  // Only show markers that fall within the chart's x-domain — otherwise
  // Recharts silently extends the domain and we lose all the resolution.
  const visibleMarkers = useMemo(() => {
    if (!snapshotMarkers || data.length === 0) return []
    const min = data[0].ts
    const max = data[data.length - 1].ts
    return snapshotMarkers.filter((m) => m.ts >= min && m.ts <= max)
  }, [snapshotMarkers, data])

  if (data.length < 2) {
    return (
      <div>
        <Body1 className={styles.empty}>
          {data.length === 0
            ? 'No runs yet — kick off an evaluation in Copilot Studio.'
            : 'Only one day of data so far. Run more evaluations across days to see a trend.'}
        </Body1>
      </div>
    )
  }

  const tickFormatter = buildTimeTickFormatter(data.map((p) => p.ts))

  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={data}
          margin={{ top: 12, right: 24, bottom: 8, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke={tokens.colorNeutralStroke2} />
          <XAxis
            dataKey="ts"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={tickFormatter}
            stroke={tokens.colorNeutralForeground3}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(v: number) => `${v}%`}
            stroke={tokens.colorNeutralForeground3}
          />
          <Tooltip
            formatter={(value, name, payload) => {
              if (name === 'Pass rate') {
                const passing = payload.payload?.passing ?? 0
                const total = payload.payload?.total ?? 0
                return [
                  typeof value === 'number'
                    ? `${value.toFixed(0)}% (${passing}/${total})`
                    : `${value}`,
                  'Pass rate',
                ]
              }
              return [`${value}`, String(name)]
            }}
            labelFormatter={(label, payload) => {
              const head =
                typeof label === 'number'
                  ? formatTooltipDateTime(label)
                  : String(label)
              const first = payload?.[0]?.payload
              if (!first) return head
              const sets = first.testSetCount ?? 0
              const runs = first.runCount ?? 0
              return `${head}\n${runs} run${runs === 1 ? '' : 's'} · ${sets} test set${sets === 1 ? '' : 's'}`
            }}
            contentStyle={{ fontSize: 12, whiteSpace: 'pre-line' }}
          />
          {visibleMarkers.map((m) => (
            <ReferenceLine
              key={m.id}
              x={m.ts}
              stroke={tokens.colorPaletteBerryForeground1}
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={renderSnapshotMarkerLabel(
                m,
                agentId
                  ? () =>
                      navigate(
                        `/agents/${agentId}/snapshot?at=${encodeURIComponent(m.snapshot.uploadedAt)}`,
                      )
                  : undefined,
              )}
            />
          ))}
          <Line
            type="monotone"
            dataKey="passRate"
            stroke={tokens.colorBrandStroke1}
            strokeWidth={2}
            dot={{ r: 3, fill: tokens.colorBrandStroke1 }}
            activeDot={{ r: 5 }}
            name="Pass rate"
          />
        </LineChart>
      </ResponsiveContainer>
      <Caption1 className={styles.caption}>
        Strict pass-rate per day, summed across every test set. Each point pools
        all runs that landed in that calendar day (UTC).
        {visibleMarkers.length > 0
          ? agentId
            ? ` Dashed 📸 lines mark uploaded snapshot publishes — click a label to inspect.`
            : ` Dashed 📸 lines mark uploaded snapshot publishes.`
          : ''}
      </Caption1>
    </div>
  )
}

/**
 * Build a Recharts ReferenceLine `label` prop that renders a clickable
 * snapshot marker. When `onClick` is undefined the label stays static.
 *
 * Recharts passes a `viewBox` with the line's x position. We render a
 * `<g>` with a small invisible hit-target rect behind the text so the
 * pointer hover/click area is larger than the glyph itself.
 */
// Renderer moved to './snapshotMarkerLabel' so this file can satisfy the
// react-refresh "components-only export" rule.
