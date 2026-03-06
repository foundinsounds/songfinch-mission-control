'use client'

import { memo, useId } from 'react'

/**
 * MiniSparkline — A tiny SVG sparkline chart for inline trend visualization.
 * Renders a smooth polyline within a compact viewBox.
 *
 * Wrapped in React.memo — pure component that only re-renders when props change.
 *
 * @param {Object} props
 * @param {number[]} props.data — array of numeric values
 * @param {string} [props.color='#f97316'] — stroke color
 * @param {number} [props.width=48] — SVG width in px
 * @param {number} [props.height=16] — SVG height in px
 * @param {boolean} [props.filled=false] — show gradient fill under line
 */
function MiniSparkline({ data = [], color = '#f97316', width = 48, height = 16, filled = false }) {
  if (!data || data.length < 2) return null

  const padding = 1
  const effectiveW = width - padding * 2
  const effectiveH = height - padding * 2

  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * effectiveW
    const y = padding + effectiveH - ((val - min) / range) * effectiveH
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  // Stable unique gradient id per component instance (replaces Math.random)
  const gradId = useId()

  // Area fill path (line down to bottom, across, back up)
  const firstPoint = data[0]
  const lastPoint = data[data.length - 1]
  const areaPath = filled ? [
    `M ${padding},${padding + effectiveH - ((firstPoint - min) / range) * effectiveH}`,
    ...data.map((val, i) => {
      const x = padding + (i / (data.length - 1)) * effectiveW
      const y = padding + effectiveH - ((val - min) / range) * effectiveH
      return `L ${x.toFixed(1)},${y.toFixed(1)}`
    }),
    `L ${padding + effectiveW},${padding + effectiveH}`,
    `L ${padding},${padding + effectiveH}`,
    'Z'
  ].join(' ') : null

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="shrink-0">
      {filled && (
        <>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill={`url(#${gradId})`} />
        </>
      )}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      {data.length > 0 && (() => {
        const lastVal = data[data.length - 1]
        const cx = padding + effectiveW
        const cy = padding + effectiveH - ((lastVal - min) / range) * effectiveH
        return <circle cx={cx} cy={cy} r="1.5" fill={color} />
      })()}
    </svg>
  )
}

export default memo(MiniSparkline)
