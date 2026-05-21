import { useMemo } from 'react'
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
import {
  buildCaseScoreTrend,
  metricColor,
  metricLabel,
  metricHasNumericScore,
  type CaseTimeline,
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

interface Row {
  ts: number
  [key: string]: number | null | undefined
}

export interface CaseScoreTrendChartProps {
  timeline: CaseTimeline
  height?: number
}

export function CaseScoreTrendChart({
  timeline,
  height = 260,
}: CaseScoreTrendChartProps) {
  const styles = useStyles()
  const points = useMemo(() => buildCaseScoreTrend(timeline), [timeline])

  const numericTypes = useMemo(() => {
    const set = new Set<string>()
    for (const p of points) {
      for (const t of Object.keys(p.scores)) {
        if (metricHasNumericScore(t)) set.add(t)
      }
    }
    return [...set].sort()
  }, [points])

  const data = useMemo<Row[]>(() => {
    return points
      .map((p) => {
        const row: Row = { ts: p.ts }
        let any = false
        for (const t of numericTypes) {
          const score = p.scores[t]
          row[t] = score ?? null
          if (score !== undefined) any = true
        }
        return any ? row : null
      })
      .filter((r): r is Row => r !== null)
  }, [points, numericTypes])

  if (data.length === 0 || numericTypes.length === 0) {
    return (
      <Caption1 className={styles.empty}>
        This case doesn't have any numeric-scoring metrics.
      </Caption1>
    )
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
          wrapperStyle={{ fontSize: 12 }}
          formatter={(value) => metricLabel(String(value))}
        />
        {numericTypes.map((t) => (
          <Line
            key={t}
            type="monotone"
            dataKey={t}
            stroke={metricColor(t)}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}
