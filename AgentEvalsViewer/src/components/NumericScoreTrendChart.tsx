import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
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
  metricHasNumericScore,
} from '../lib/metrics'
import {
  buildTimeTickFormatter,
  formatTooltipDateTime,
} from '../lib/timeAxis'

const useStyles = makeStyles({
  empty: {
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
  },
})

export interface NumericScoreTrendChartProps {
  runs: TestRun[]
  height?: number
}

interface Row {
  ts: number
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

/**
 * Trend chart of *numeric* scores (0..1 range) for metrics whose
 * `data.score` is meaningful — currently CompareMeaning and TextSimilarity.
 * Captures gradual quality drift the binary Pass/Fail view hides.
 */
export function NumericScoreTrendChart({
  runs,
  height = 280,
}: NumericScoreTrendChartProps) {
  const styles = useStyles()
  const allTypes = useMemo(() => collectMetricTypes(runs), [runs])
  const numericTypes = useMemo(
    () => allTypes.filter(metricHasNumericScore),
    [allTypes],
  )
  const points = useMemo(() => buildMetricTrendPoints(runs), [runs])
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const data = useMemo<Row[]>(() => {
    return points
      .map((p) => {
        const row: Row = { ts: p.ts }
        let any = false
        for (const t of numericTypes) {
          const score = p.avgScores[t]
          row[t] = score ?? null
          if (score !== undefined) any = true
        }
        return any ? row : null
      })
      .filter((r): r is Row => r !== null)
  }, [points, numericTypes])

  const anomaliesByMetric = useMemo(() => {
    const out = new Map<string, Set<number>>()
    for (const t of numericTypes) {
      const series = points.map((p) => ({
        ts: p.ts,
        value: p.avgScores[t] ?? null,
      }))
      const found = findAnomalies(series, { metricType: t })
      out.set(t, new Set(found.map((a) => a.ts)))
    }
    return out
  }, [points, numericTypes])

  if (data.length === 0 || numericTypes.length === 0) {
    return (
      <Caption1 className={styles.empty}>
        No numeric-scoring metrics in these runs (Compare meaning or Text
        similarity).
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
        <CartesianGrid strokeDasharray="3 3" stroke={tokens.colorNeutralStroke2} />
        <XAxis
          dataKey="ts"
          type="number"
          domain={['dataMin', 'dataMax']}
          tickFormatter={buildTimeTickFormatter(data.map((d) => d.ts))}
          stroke={tokens.colorNeutralForeground3}
        />
        <YAxis
          domain={[0, 1]}
          tickFormatter={(v: number) => v.toFixed(1)}
          stroke={tokens.colorNeutralForeground3}
        />
        <Tooltip
          contentStyle={{ fontSize: 12 }}
          formatter={(value, name) => [
            typeof value === 'number' ? value.toFixed(3) : '—',
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
        {numericTypes.map((t) => {
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
