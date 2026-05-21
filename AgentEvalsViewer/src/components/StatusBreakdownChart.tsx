import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
  statusColor,
} from '../lib/eval'
import { buildTimeTickFormatterForSpan } from '../lib/timeAxis'

export interface StatusBreakdownChartProps {
  runs: TestRun[]
  height?: number
}

interface Bucket {
  label: string
  Pass: number
  Fail: number
  Invalid: number
  Error: number
}

export function StatusBreakdownChart({
  runs,
  height = 280,
}: StatusBreakdownChartProps) {
  const data = useMemo<Bucket[]>(() => {
    const sorted = [...runs].sort(compareRunsByStartTimeAsc)
    const timestamps = sorted
      .map((r) => (r.startTime ? new Date(r.startTime).getTime() : NaN))
      .filter((t) => !Number.isNaN(t))
    const span =
      timestamps.length > 1
        ? timestamps[timestamps.length - 1] - timestamps[0]
        : 0
    const format = buildTimeTickFormatterForSpan(span)
    return sorted
      .map((run) => {
        const c = countResults(run.testCasesResults)
        const ts = run.startTime ? new Date(run.startTime).getTime() : NaN
        const label = Number.isNaN(ts) ? '—' : format(ts)
        return {
          label,
          Pass: c.pass,
          Fail: c.fail,
          Invalid: c.invalid,
          Error: c.error,
        }
      })
      .filter((b) => b.Pass + b.Fail + b.Invalid + b.Error > 0)
  }, [runs])

  if (data.length === 0) {
    return null
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 16, right: 24, bottom: 8, left: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={tokens.colorNeutralStroke2} />
        <XAxis dataKey="label" stroke={tokens.colorNeutralForeground3} />
        <YAxis allowDecimals={false} stroke={tokens.colorNeutralForeground3} />
        <Tooltip contentStyle={{ fontSize: 12 }} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="Pass" stackId="a" fill={statusColor('Pass')} />
        <Bar dataKey="Fail" stackId="a" fill={statusColor('Fail')} />
        <Bar dataKey="Invalid" stackId="a" fill={statusColor('Invalid')} />
        <Bar dataKey="Error" stackId="a" fill={statusColor('Error')} />
      </BarChart>
    </ResponsiveContainer>
  )
}
