import { Button, Tooltip } from '@fluentui/react-components'
import { Open16Regular } from '@fluentui/react-icons'

export interface OpenInCpsLinkProps {
  url: string | null
  label?: string
  tooltip?: string
  size?: 'small' | 'medium' | 'large'
  appearance?: 'subtle' | 'outline' | 'primary' | 'secondary' | 'transparent'
}

/**
 * "Open in Copilot Studio" external link button. Renders nothing if the
 * URL can't be built (missing envId / botId / etc). Always opens in a new tab.
 */
export function OpenInCpsLink({
  url,
  label = 'Open in Copilot Studio',
  tooltip,
  size = 'small',
  appearance = 'subtle',
}: OpenInCpsLinkProps) {
  if (!url) return null
  const button = (
    <Button
      as="a"
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      icon={<Open16Regular />}
      size={size}
      appearance={appearance}
    >
      {label}
    </Button>
  )
  if (!tooltip) return button
  return (
    <Tooltip content={tooltip} relationship="label" withArrow>
      {button}
    </Tooltip>
  )
}
