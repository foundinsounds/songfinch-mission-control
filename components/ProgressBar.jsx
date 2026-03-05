'use client'

/**
 * ProgressBar — Animated progress indicators for stats and completion tracking
 *
 * Variants:
 *   - bar: Horizontal progress bar (default)
 *   - ring: Circular progress ring
 *   - mini: Tiny inline bar
 *
 * Usage:
 *   <ProgressBar value={75} label="Tasks Complete" />
 *   <ProgressBar value={60} variant="ring" size={48} />
 *   <ProgressBar value={30} variant="mini" color="orange" />
 */

const COLORS = {
  green: { bar: 'bg-accent-green', ring: '#22c55e', bg: 'bg-accent-green/10' },
  orange: { bar: 'bg-accent-orange', ring: '#f97316', bg: 'bg-accent-orange/10' },
  blue: { bar: 'bg-accent-blue', ring: '#3b82f6', bg: 'bg-accent-blue/10' },
  purple: { bar: 'bg-accent-purple', ring: '#a855f7', bg: 'bg-accent-purple/10' },
  yellow: { bar: 'bg-accent-yellow', ring: '#eab308', bg: 'bg-accent-yellow/10' },
  red: { bar: 'bg-red-500', ring: '#ef4444', bg: 'bg-red-500/10' },
  gray: { bar: 'bg-gray-500', ring: '#6b7280', bg: 'bg-gray-500/10' },
}

function getAutoColor(value) {
  if (value >= 80) return 'green'
  if (value >= 50) return 'blue'
  if (value >= 25) return 'orange'
  return 'red'
}

// ---- Horizontal Bar ----
function BarProgress({ value, color = 'auto', label, showValue = true, height = 6, animated = true, className = '' }) {
  const resolvedColor = color === 'auto' ? getAutoColor(value) : color
  const c = COLORS[resolvedColor] || COLORS.blue
  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div className={className}>
      {(label || showValue) && (
        <div className="flex items-center justify-between mb-1">
          {label && <span className="text-[10px] text-gray-400 font-medium">{label}</span>}
          {showValue && <span className="text-[10px] text-gray-500 font-mono tabular-nums">{Math.round(clampedValue)}%</span>}
        </div>
      )}
      <div className={`w-full rounded-full overflow-hidden ${c.bg}`} style={{ height }}>
        <div
          className={`h-full rounded-full ${c.bar} ${animated ? 'animate-progress' : ''} transition-all duration-500`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  )
}

// ---- Circular Ring ----
function RingProgress({ value, color = 'auto', size = 48, strokeWidth = 3, showValue = true, label, className = '' }) {
  const resolvedColor = color === 'auto' ? getAutoColor(value) : color
  const c = COLORS[resolvedColor] || COLORS.blue
  const clampedValue = Math.min(100, Math.max(0, value))

  const radius = (size - strokeWidth * 2) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clampedValue / 100) * circumference

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-dark-600"
          />
          {/* Progress ring */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={c.ring}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
          />
        </svg>
        {showValue && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[10px] font-bold text-gray-300 tabular-nums">
              {Math.round(clampedValue)}%
            </span>
          </div>
        )}
      </div>
      {label && (
        <span className="text-[9px] text-gray-500 mt-1 text-center">{label}</span>
      )}
    </div>
  )
}

// ---- Mini Inline Bar ----
function MiniProgress({ value, color = 'auto', width = 60, className = '' }) {
  const resolvedColor = color === 'auto' ? getAutoColor(value) : color
  const c = COLORS[resolvedColor] || COLORS.blue
  const clampedValue = Math.min(100, Math.max(0, value))

  return (
    <div
      className={`inline-flex items-center gap-1.5 ${className}`}
    >
      <div className={`rounded-full overflow-hidden ${c.bg}`} style={{ width, height: 3 }}>
        <div
          className={`h-full rounded-full ${c.bar} transition-all duration-500`}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
      <span className="text-[9px] text-gray-500 font-mono tabular-nums">{Math.round(clampedValue)}%</span>
    </div>
  )
}

// ---- Multi-segment Bar (for pipeline visualization) ----
export function SegmentedProgress({ segments = [], height = 8, showLabels = true, className = '' }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0)
  if (total === 0) return null

  return (
    <div className={className}>
      <div className="flex rounded-full overflow-hidden" style={{ height }}>
        {segments.map((segment, i) => {
          const pct = (segment.value / total) * 100
          if (pct <= 0) return null
          const c = COLORS[segment.color] || COLORS.gray
          return (
            <div
              key={i}
              className={`${c.bar} transition-all duration-500 first:rounded-l-full last:rounded-r-full`}
              style={{ width: `${pct}%` }}
              title={`${segment.label}: ${segment.value} (${Math.round(pct)}%)`}
            />
          )
        })}
      </div>
      {showLabels && (
        <div className="flex items-center gap-3 mt-1.5">
          {segments.map((segment, i) => {
            const c = COLORS[segment.color] || COLORS.gray
            return (
              <div key={i} className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${c.bar}`} />
                <span className="text-[9px] text-gray-500">
                  {segment.label} ({segment.value})
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ---- Main Export ----
export default function ProgressBar({ variant = 'bar', ...props }) {
  switch (variant) {
    case 'ring': return <RingProgress {...props} />
    case 'mini': return <MiniProgress {...props} />
    default: return <BarProgress {...props} />
  }
}
