import { useState, useCallback } from 'react'
import {
  Button,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components'
import {
  Copy20Regular,
  Checkmark20Filled,
} from '@fluentui/react-icons'

const useStyles = makeStyles({
  root: {
    minWidth: 'auto',
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
})

export interface CopyIdButtonProps {
  /** The GUID / id to copy. Renders nothing when blank. */
  value: string | null | undefined
  /** Label that appears on the button next to the icon. */
  label?: string
  /** Human-readable noun for tooltip text ("agent ID", "run ID"…). */
  noun?: string
  /** Visual treatment. Defaults to `subtle`. */
  appearance?: 'subtle' | 'secondary' | 'transparent'
  /** Compact display: icon only, no label. */
  iconOnly?: boolean
}

/**
 * Tiny copy-to-clipboard button used wherever a GUID is rendered. Defaults to
 * a subtle inline appearance so it doesn't compete with surrounding content.
 * Shows a checkmark for ~1.4s after a successful copy as the affordance.
 */
export function CopyIdButton({
  value,
  label,
  noun = 'ID',
  appearance = 'subtle',
  iconOnly = false,
}: CopyIdButtonProps) {
  const styles = useStyles()
  const [copied, setCopied] = useState(false)

  const onClick = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (!value) return
      try {
        await navigator.clipboard.writeText(value)
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1400)
      } catch {
        // Browsers without clipboard access just silently no-op; we can't
        // do much better short of a textarea + execCommand hack.
      }
    },
    [value],
  )

  if (!value) return null

  const tooltip = copied ? `${noun} copied` : `Copy ${noun} to clipboard`

  return (
    <Tooltip content={tooltip} relationship="label" withArrow>
      <Button
        appearance={appearance}
        size="small"
        className={styles.root}
        icon={copied ? <Checkmark20Filled /> : <Copy20Regular />}
        onClick={onClick}
        aria-label={tooltip}
      >
        {!iconOnly ? (label ?? 'Copy') : undefined}
      </Button>
    </Tooltip>
  )
}
