import { Badge } from '@fluentui/react-components'
import type { CaseStatus } from '../lib/eval'

const COLOR_MAP: Record<
  CaseStatus,
  'success' | 'danger' | 'warning' | 'severe' | 'subtle'
> = {
  Pass: 'success',
  Fail: 'danger',
  Invalid: 'warning',
  Error: 'severe',
  Unknown: 'subtle',
}

export interface StatusPillProps {
  status: CaseStatus
}

export function StatusPill({ status }: StatusPillProps) {
  return (
    <Badge color={COLOR_MAP[status]} appearance="filled">
      {status}
    </Badge>
  )
}
