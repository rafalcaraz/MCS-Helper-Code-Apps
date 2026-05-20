import { tokens } from '@fluentui/react-components'
import type { SnapshotChartMarker } from '../lib/snapshotChartMarkers'

/**
 * Build a Recharts ReferenceLine `label` prop that renders a clickable
 * snapshot marker. When `onClick` is undefined the label stays static.
 *
 * Recharts passes a `viewBox` with the line's x position. We render an SVG
 * `<g>` with an invisible hit-target `<rect>` behind the text so the pointer
 * hover/click area is larger than the glyph itself.
 *
 * Exported as a plain function (not a component) and lives in its own file
 * so Vite's fast-refresh constraint on component-only modules isn't violated.
 */
export function renderSnapshotMarkerLabel(
  marker: SnapshotChartMarker,
  onClick: (() => void) | undefined,
) {
  return (props: {
    viewBox?: { x?: number; y?: number; width?: number; height?: number }
  }) => {
    const x = props.viewBox?.x ?? 0
    const y = (props.viewBox?.y ?? 0) - 4
    const clickable = !!onClick
    return (
      <g
        style={clickable ? { cursor: 'pointer' } : undefined}
        onClick={onClick}
      >
        <title>{marker.description}</title>
        {clickable ? (
          <rect
            x={x - 24}
            y={y - 14}
            width={48}
            height={16}
            fill="transparent"
          />
        ) : null}
        <text
          x={x}
          y={y}
          fill={tokens.colorPaletteBerryForeground1}
          fontSize={11}
          fontWeight={600}
          textAnchor="middle"
          style={clickable ? { textDecoration: 'underline' } : undefined}
        >
          {marker.label}
        </text>
      </g>
    )
  }
}
