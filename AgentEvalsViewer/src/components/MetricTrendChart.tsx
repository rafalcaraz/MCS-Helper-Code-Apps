import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Caption1, makeStyles, tokens } from '@fluentui/react-components'
import type { TestRun } from '../generated/models/MicrosoftCopilotStudioModel'
import {
  buildMetricTrendPoints,
  collectMetricTypes,
  findAnomalies,
  metricColor,
  metricLabel,
} from '../lib/metrics'
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
})

export interface MetricTrendChartProps {
  runs: TestRun[]
  height?: number
  /** Optional vertical markers for snapshot publishes (Layer 3 overlay). */
  snapshotMarkers?: readonly SnapshotChartMarker[]
  /**
   * When set, snapshot marker labels become clickable and navigate to this
   * agent's snapshot page with the corresponding snapshot pre-selected.
   */
  agentId?: string
}

interface Row {
  ts: number
  startTime: string
  [key: string]: number | string | null | undefined
}

interface DotRenderProps {
  cx?: number
  cy?: number
  value?: number | null
  payload?: { ts?: number }
  dataKey?: string | number | ((obj: unknown) => unknown)
  stroke?: string
}

export function MetricTrendChart({
  runs,
  height = 300,
  snapshotMarkers,
  agentId,
}: MetricTrendChartProps) {
  const styles = useStyles()
  const navigate = useNavigate()
  const metricTypes = useMemo(() => collectMetricTypes(runs), [runs])
  const points = useMemo(() => buildMetricTrendPoints(runs), [runs])
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const data = useMemo<Row[]>(() => {
    return points.map((p) => {
      const row: Row = { ts: p.ts, startTime: p.startTime }
      for (const t of metricTypes) {
        row[t] = p.passRates[t] ?? null
      }
      return row
    })
  }, [points, metricTypes])

  const visibleMarkers = useMemo(() => {
    if (!snapshotMarkers || data.length === 0) return []
    const min = data[0].ts
    const max = data[data.length - 1].ts
    return snapshotMarkers.filter((m) => m.ts >= min && m.ts <= max)
  }, [snapshotMarkers, data])

  // Pre-compute anomaly timestamps per metric so the custom dot renderer
  // can flag anomalous points cheaply.
  const anomaliesByMetric = useMemo(() => {
    const out = new Map<string, Set<number>>()
    for (const t of metricTypes) {
      const series = points.map((p) => ({
        ts: p.ts,
        value: p.passRates[t] ?? null,
      }))
      const found = findAnomalies(series, { metricType: t })
      out.set(t, new Set(found.map((a) => a.ts)))
    }
    return out
  }, [points, metricTypes])

  if (data.length === 0 || metricTypes.length === 0) {
    return (
      <Caption1 className={styles.empty}>
        Not enough data to draw a trend yet — need at least one run with
        per-case metric results.
      </Caption1>
    )
  }

  const handleLegendClick = (entry: { dataKey?: string | number | ((obj: unknown) => unknown); value?: string }) => {
    const dk = entry.dataKey
    const key = String(typeof dk === 'string' || typeof dk === 'number' ? dk : entry.value ?? '')
    if (!key) return
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 16, right: 24, bottom: 8, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e1dfdd" />
        <XAxis
          dataKey="ts"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={buildTimeTickFormatter(data.map((d) => d.ts))}
          stroke="#605e5c"
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          stroke="#605e5c"
        />
        <Tooltip
          contentStyle={{ fontSize: 12 }}
          formatter={(value, name) => [
            typeof value === 'number' ? `${value.toFixed(0)}%` : '—',
            metricLabel(typeof name === 'string' ? name : undefined),
          ]}
          labelFormatter={(label) =>
            typeof label === 'number'
              ? formatTooltipDateTime(label)
              : String(label)
          }
        />
        <Legend
          wrapperStyle={{ fontSize: 12, cursor: 'pointer', userSelect: 'none' }}
          onClick={handleLegendClick}
          formatter={(value) => {
            const key = String(value)
            const isHidden = hidden.has(key)
            return (
              <span
                style={{
                  color: isHidden ? tokens.colorNeutralForeground4 : undefined,
                  textDecoration: isHidden ? 'line-through' : undefined,
                }}
                title={isHidden ? 'Click to show' : 'Click to hide'}
              >
                {metricLabel(key)}
              </span>
            )
          }}
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
        {metricTypes.map((t) => {
          const anomalyTs = anomaliesByMetric.get(t) ?? new Set<number>()
          const renderDot = (props: DotRenderProps) => {
            const ts = props.payload?.ts
            const isAnomaly = ts !== undefined && anomalyTs.has(ts)
            const cx = props.cx ?? 0
            const cy = props.cy ?? 0
            const color = metricColor(t)
            if (isAnomaly) {
              return (
                <g>
                  <circle
                    cx={cx}
                    cy={cy}
                    r={7}
                    fill="none"
                    stroke={tokens.colorPaletteRedForeground1}
                    strokeWidth={2}
                  />
                  <circle cx={cx} cy={cy} r={3} fill={color} />
                </g>
              )
            }
            return <circle cx={cx} cy={cy} r={3} fill={color} />
          }
          return (
            <Line
              key={t}
              type="monotone"
              dataKey={t}
              stroke={metricColor(t)}
              strokeWidth={2}
              dot={renderDot}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
              hide={hidden.has(t)}
            />
          )
        })}
      </LineChart>
    </ResponsiveContainer>
  )
}
