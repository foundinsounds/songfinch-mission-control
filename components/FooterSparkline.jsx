'use client'

import { useState, useMemo, useEffect, useRef, useCallback } from 'react'

/**
 * FooterSparkline — Persistent bottom activity strip showing:
 * - SVG sparkline of task completions over last 24h (hourly buckets)
 * - Mini stat pills: active, completed today, in review
 * - Collapsible: ~28px collapsed (stats only), ~48px expanded (with sparkline)
 * - Slide-up entrance animation
 * - z-30 so BulkActions (z-100) floats above
 */

// Tiny pill component for inline stats
function StatPill({ icon, label, count, color = 'text-gray-400' }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium tabular-nums ${color}`}
      style={{ background: 'rgba(255,255,255,0.04)' }}
    >
      <span className="leading-none">{icon}</span>
      <span>{count}</span>
      <span className="hidden sm:inline text-gray-600">{label}</span>
    </span>
  )
}

// SVG sparkline for hourly completion data
function ActivitySparkline({ data = [], width = 120, height = 24 }) {
  if (!data || data.length < 2) return null

  const padding = 2
  const effectiveW = width - padding * 2
  const effectiveH = height - padding * 2

  const max = Math.max(...data, 1)
  const min = 0
  const range = max - min || 1

  const points = data.map((val, i) => {
    const x = padding + (i / (data.length - 1)) * effectiveW
    const y = padding + effectiveH - ((val - min) / range) * effectiveH
    return { x: parseFloat(x.toFixed(1)), y: parseFloat(y.toFixed(1)) }
  })

  const linePoints = points.map(p => `${p.x},${p.y}`).join(' ')

  // Area path: line down to bottom, across, back up
  const areaPath = [
    `M ${points[0].x},${points[0].y}`,
    ...points.slice(1).map(p => `L ${p.x},${p.y}`),
    `L ${points[points.length - 1].x},${padding + effectiveH}`,
    `L ${points[0].x},${padding + effectiveH}`,
    'Z'
  ].join(' ')

  const gradientId = 'footer-sparkline-area'

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="shrink-0 opacity-70 hover:opacity-100 transition-opacity duration-300"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {/* Area fill */}
      <path d={areaPath} fill={`url(#${gradientId})`} />
      {/* Line */}
      <polyline
        points={linePoints}
        fill="none"
        stroke="#f97316"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="2"
        fill="#f97316"
        className="animate-pulse"
      />
      {/* Subtle grid lines */}
      {[0.25, 0.5, 0.75].map(pct => (
        <line
          key={pct}
          x1={padding}
          y1={padding + effectiveH * (1 - pct)}
          x2={padding + effectiveW}
          y2={padding + effectiveH * (1 - pct)}
          stroke="rgba(255,255,255,0.03)"
          strokeWidth="0.5"
        />
      ))}
    </svg>
  )
}

export default function FooterSparkline({ activity = [], tasks = [] }) {
  const [expanded, setExpanded] = useState(true)
  const [mounted, setMounted] = useState(false)
  const stripRef = useRef(null)

  // Entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100)
    return () => clearTimeout(timer)
  }, [])

  // Toggle collapsed/expanded
  const handleToggle = useCallback(() => {
    setExpanded(prev => !prev)
  }, [])

  // Compute hourly completion buckets (last 24 hours, 24 buckets of 1 hour each)
  const hourlyData = useMemo(() => {
    const now = Date.now()
    const bucketCount = 24
    const bucketMs = 60 * 60 * 1000 // 1 hour per bucket
    const counts = new Array(bucketCount).fill(0)

    activity.forEach(item => {
      const ts = new Date(item.timestamp).getTime()
      const age = now - ts
      if (age < 0 || age > bucketCount * bucketMs) return
      const bucket = Math.min(bucketCount - 1, Math.floor(age / bucketMs))
      // Reverse: bucket 0 = most recent, we want left = oldest, right = newest
      counts[bucketCount - 1 - bucket]++
    })

    return counts
  }, [activity])

  // Compute stats from tasks
  const stats = useMemo(() => {
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

    const active = tasks.filter(t =>
      t.status === 'In Progress' || t.status === 'Assigned'
    ).length

    // "Completed today" = tasks marked Done whose most recent timestamp is today
    // Since mock tasks don't have a completedAt, we count Done tasks with recent createdAt
    // or fall back to counting activity items with action 'completed' today
    const completedToday = activity.filter(item => {
      const ts = new Date(item.timestamp).getTime()
      return ts >= todayStart && (
        item.action === 'completed' ||
        item.type === 'Content Generated'
      )
    }).length || tasks.filter(t => {
      if (t.status !== 'Done') return false
      const created = new Date(t.createdAt).getTime()
      return created >= todayStart
    }).length

    const inReview = tasks.filter(t => t.status === 'Review').length

    return { active, completedToday, inReview }
  }, [tasks, activity])

  // Peak hourly activity for tooltip
  const peakHourly = useMemo(() => Math.max(...hourlyData, 0), [hourlyData])

  // Don't render if there's nothing to show
  if (activity.length === 0 && tasks.length === 0) return null

  return (
    <div
      ref={stripRef}
      onClick={handleToggle}
      className={`
        fixed bottom-0 left-0 right-0 z-30
        border-t border-dark-500/60
        cursor-pointer select-none
        transition-all duration-500 ease-out
        ${mounted ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'}
      `}
      style={{
        background: 'linear-gradient(to bottom, rgba(18,18,26,0.92), rgba(10,10,15,0.97))',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
      title={`Activity strip — ${activity.length} events (24h) — Peak: ${peakHourly}/hr — Click to ${expanded ? 'collapse' : 'expand'}`}
    >
      {/* Subtle top highlight line */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{
          background: 'linear-gradient(to right, transparent, rgba(249,115,22,0.15) 30%, rgba(249,115,22,0.15) 70%, transparent)'
        }}
      />

      <div
        className={`
          px-3 sm:px-4 flex items-center justify-between gap-2 sm:gap-3
          transition-all duration-300 ease-out overflow-hidden
          ${expanded ? 'h-12' : 'h-7'}
        `}
      >
        {/* Left: Stats pills */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <StatPill
            icon={<span className="w-1.5 h-1.5 rounded-full bg-accent-green inline-block" />}
            label="active"
            count={stats.active}
            color="text-accent-green/80"
          />
          <StatPill
            icon={<span className="text-[10px]">&#10003;</span>}
            label="today"
            count={stats.completedToday}
            color="text-gray-400"
          />
          <StatPill
            icon={<span className="w-1.5 h-1.5 rounded-full bg-accent-orange inline-block" />}
            label="review"
            count={stats.inReview}
            color="text-accent-orange/80"
          />
        </div>

        {/* Center: Sparkline (hidden on mobile, visible on md+) */}
        <div
          className={`
            hidden md:flex items-center gap-2 flex-1 justify-center
            transition-all duration-300
            ${expanded ? 'opacity-100 max-h-12' : 'opacity-0 max-h-0'}
          `}
        >
          <span className="text-[8px] text-gray-600 font-mono whitespace-nowrap">24h</span>
          <ActivitySparkline data={hourlyData} width={160} height={24} />
          <span className="text-[8px] text-gray-600 font-mono tabular-nums whitespace-nowrap">
            {activity.length} events
          </span>
        </div>

        {/* Right: Collapse indicator + mini activity count on mobile */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile: show event count when sparkline is hidden */}
          <span className="md:hidden text-[9px] text-gray-600 font-mono tabular-nums">
            {activity.length} events
          </span>
          {/* Collapse/expand chevron */}
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-gray-600 transition-transform duration-300 ${expanded ? 'rotate-180' : 'rotate-0'}`}
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </div>
      </div>
    </div>
  )
}
