import { useMemo } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { tokens } from '@fluentui/react-components'
import type { TestRun } from '../generated/models/MicrosoftCopilotStudioModel'
import {
  compareRunsByStartTimeAsc,
  countResults,
  formatPassRate,
} from '../lib/eval'
import {
  buildTimeTickFormatter,
  formatTooltipDateTime,
} from '../lib/timeAxis'

export interface PassRateTrendChartProps {
  runs: TestRun[]
  height?: number
}

interface Point {
  ts: number
  startTime: string
  passRate: number | null
  total: number
  pass: number
  fail: number
  runId: string
}

export function PassRateTrendChart({
  runs,
  height = 280,
}: PassRateTrendChartProps) {
  const data = useMemo<Point[]>(() => {
    return [...runs]
      .sort(compareRunsByStartTimeAsc)
      .map((run) => {
        const counts = countResults(run.testCasesResults)
        return {
          ts: run.startTime ? new Date(run.startTime).getTime() : 0,
          startTime: run.startTime ?? '',
          passRate: counts.passRate === null ? null : counts.passRate * 100,
          total: counts.total,
          pass: counts.pass,
          fail: counts.fail,
          runId: run.id ?? '',
        }
      })
      .filter((p) => p.passRate !== null)
  }, [runs])

  if (data.length === 0) {
    return null
  }

  const tickFormatter = buildTimeTickFormatter(data.map((p) => p.ts))

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
          tickFormatter={tickFormatter}
          stroke={tokens.colorNeutralForeground3}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v: number) => `${v}%`}
          stroke={tokens.colorNeutralForeground3}
        />
        <Tooltip
          formatter={(value) => [
            typeof value === 'number' ? `${value.toFixed(0)}%` : `${value}`,
            'Pass rate',
          ]}
          labelFormatter={(label) =>
            typeof label === 'number'
              ? formatTooltipDateTime(label)
              : String(label)
          }
          contentStyle={{ fontSize: 12 }}
        />
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
  )
}

export function PassRateSparkline({
  runs,
  width = 120,
  height = 32,
}: {
  runs: TestRun[]
  width?: number
  height?: number
}) {
  const points = useMemo(() => {
    return [...runs]
      .sort(compareRunsByStartTimeAsc)
      .map((run) => {
        const counts = countResults(run.testCasesResults)
        return counts.passRate
      })
      .filter((p): p is number => p !== null)
  }, [runs])

  if (points.length < 2) return null

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const stepX = width / (points.length - 1)
  const path = points
    .map((p, i) => {
      const x = i * stepX
      const y = height - ((p - min) / range) * height
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={`Pass-rate trend across ${points.length} runs (latest ${formatPassRate(points[points.length - 1])})`}
    >
      <path d={path} fill="none" stroke={tokens.colorBrandStroke1} strokeWidth={1.5} />
    </svg>
  )
}
