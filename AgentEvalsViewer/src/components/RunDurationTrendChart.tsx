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
import { Caption1, makeStyles, tokens } from '@fluentui/react-components'
import type { TestRun } from '../generated/models/MicrosoftCopilotStudioModel'
import { buildRunDurationTrend } from '../lib/metrics'
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

export interface RunDurationTrendChartProps {
  runs: TestRun[]
  height?: number
}

interface Row {
  ts: number
  startTime: string
  runId: string
  durationSec: number | null
  runName: string | undefined
}

function formatDurationSec(sec: number): string {
  if (sec < 60) return `${sec.toFixed(0)}s`
  const m = Math.floor(sec / 60)
  const r = Math.round(sec % 60)
  return `${m}m ${r}s`
}

/**
 * Line chart of per-run duration over time. Surfaces gradual agent slowdown
 * that the binary pass/fail view hides — e.g. a knowledge source returning
 * larger pages, an action growing latency, or a backing service degrading.
 */
export function RunDurationTrendChart({
  runs,
  height = 280,
}: RunDurationTrendChartProps) {
  const styles = useStyles()
  const data = useMemo<Row[]>(() => {
    const points = buildRunDurationTrend(runs)
    return points.map((p) => ({
      ts: p.ts,
      startTime: p.startTime,
      runId: p.runId,
      durationSec: p.durationMs === null ? null : p.durationMs / 1000,
      runName: p.runName,
    }))
  }, [runs])

  const withDuration = data.filter((d) => d.durationSec !== null)

  if (withDuration.length === 0) {
    return (
      <Caption1 className={styles.empty}>
        Not enough data to plot duration yet — need at least one run with both
        start and end timestamps.
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
          dataKey="durationSec"
          tickFormatter={(v: number) => formatDurationSec(v)}
          stroke={tokens.colorNeutralForeground3}
          width={64}
        />
        <Tooltip
          contentStyle={{ fontSize: 12 }}
          formatter={(value) => [
            typeof value === 'number' ? formatDurationSec(value) : '—',
            'Duration',
          ]}
          labelFormatter={(label) =>
            typeof label === 'number'
              ? formatTooltipDateTime(label)
              : String(label)
          }
        />
        <Line
          type="monotone"
          dataKey="durationSec"
          stroke={tokens.colorBrandStroke1}
          strokeWidth={2}
          dot={{ r: 3, fill: tokens.colorBrandStroke1 }}
          activeDot={{ r: 5 }}
          connectNulls={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
