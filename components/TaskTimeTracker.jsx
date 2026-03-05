'use client'

import { useState, useEffect, useMemo } from 'react'

/**
 * Formats a duration in milliseconds to a human-readable string.
 * e.g., "2h 15m", "3d 4h", "45m", "<1m"
 */
function formatDuration(ms) {
  if (ms < 60000) return '<1m'
  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  return `${minutes}m`
}

/**
 * Get color class based on elapsed time relative to expected duration.
 * Tasks that take longer than expected shift from green → yellow → red.
 */
function getTimeColor(elapsedMs, expectedMs) {
  if (!expectedMs) {
    // No expectation, color by absolute time
    const hours = elapsedMs / 3600000
    if (hours < 2) return 'text-accent-green'
    if (hours < 8) return 'text-accent-blue'
    if (hours < 24) return 'text-yellow-400'
    return 'text-red-400'
  }

  const ratio = elapsedMs / expectedMs
  if (ratio < 0.5) return 'text-accent-green'
  if (ratio < 0.8) return 'text-accent-blue'
  if (ratio < 1.0) return 'text-yellow-400'
  if (ratio < 1.5) return 'text-orange-400'
  return 'text-red-400'
}

/**
 * Estimate expected duration based on content type.
 * Returns expected milliseconds or null if unknown.
 */
function getExpectedDuration(contentType) {
  const estimates = {
    'Blog Post': 4 * 3600000,       // 4 hours
    'Social Post': 1 * 3600000,     // 1 hour
    'Email': 2 * 3600000,           // 2 hours
    'Ad Copy': 1.5 * 3600000,       // 1.5 hours
    'Video Script': 6 * 3600000,    // 6 hours
    'Press Release': 3 * 3600000,   // 3 hours
    'Newsletter': 4 * 3600000,      // 4 hours
  }
  return estimates[contentType] || null
}

/**
 * Compact inline time tracker for task cards.
 * Shows elapsed time since task creation/assignment with a visual indicator.
 */
export function TaskTimeInline({ task }) {
  const [now, setNow] = useState(Date.now())

  // Live update every minute
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000)
    return () => clearInterval(timer)
  }, [])

  const elapsed = useMemo(() => {
    const start = task.startedAt || task.assignedAt || task.createdAt
    if (!start) return 0
    return now - new Date(start).getTime()
  }, [task, now])

  const isDone = task.status === 'Done'
  const expected = getExpectedDuration(task.contentType)
  const color = isDone ? 'text-gray-600' : getTimeColor(elapsed, expected)
  const progress = expected ? Math.min(1, elapsed / expected) : null

  if (!task.createdAt && !task.assignedAt) return null

  return (
    <div className="flex items-center gap-1" title={`Elapsed: ${formatDuration(elapsed)}`}>
      {/* Clock icon */}
      <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 ${color}`}>
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
      <span className={`text-[9px] font-mono ${color}`}>
        {isDone ? '✓' : formatDuration(elapsed)}
      </span>
      {/* Mini progress bar */}
      {progress !== null && !isDone && (
        <div className="w-8 h-1 bg-dark-600 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${Math.min(100, progress * 100)}%`,
              backgroundColor: progress > 1 ? '#ef4444' : progress > 0.8 ? '#eab308' : '#22c55e',
            }}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Full time tracker display for task modals.
 * Shows elapsed, estimated, and time remaining/overtime.
 */
export function TaskTimeDetail({ task }) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  const created = task.createdAt ? new Date(task.createdAt) : null
  const started = task.startedAt || task.assignedAt ? new Date(task.startedAt || task.assignedAt) : null
  const isDone = task.status === 'Done'

  const elapsed = started ? now - started.getTime() : created ? now - created.getTime() : 0
  const expected = getExpectedDuration(task.contentType)
  const remaining = expected ? expected - elapsed : null
  const color = isDone ? 'text-gray-500' : getTimeColor(elapsed, expected)

  return (
    <div className="space-y-2">
      {/* Time stats row */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Elapsed */}
        <div className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={color}>
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
          <div>
            <div className="text-[9px] text-gray-500 uppercase tracking-wider">Elapsed</div>
            <div className={`text-[13px] font-bold font-mono ${color}`}>
              {isDone ? '—' : formatDuration(elapsed)}
            </div>
          </div>
        </div>

        {/* Estimated */}
        {expected && (
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
              <path d="M5 22h14" /><path d="M5 2h14" /><path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
              <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
            </svg>
            <div>
              <div className="text-[9px] text-gray-500 uppercase tracking-wider">Estimated</div>
              <div className="text-[13px] font-bold font-mono text-gray-400">{formatDuration(expected)}</div>
            </div>
          </div>
        )}

        {/* Remaining / Overtime */}
        {expected && !isDone && (
          <div className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={remaining > 0 ? 'text-accent-green' : 'text-red-400'}>
              <path d="M10 2h4" /><path d="M12 14V6" /><circle cx="12" cy="14" r="8" />
            </svg>
            <div>
              <div className="text-[9px] text-gray-500 uppercase tracking-wider">
                {remaining > 0 ? 'Remaining' : 'Overtime'}
              </div>
              <div className={`text-[13px] font-bold font-mono ${remaining > 0 ? 'text-accent-green' : 'text-red-400'}`}>
                {remaining > 0 ? formatDuration(remaining) : `+${formatDuration(Math.abs(remaining))}`}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      {expected && !isDone && (
        <div className="relative">
          <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (elapsed / expected) * 100)}%`,
                backgroundColor: elapsed > expected ? '#ef4444' : elapsed > expected * 0.8 ? '#eab308' : '#22c55e',
              }}
            />
          </div>
          {/* 100% marker */}
          <div className="absolute top-0 right-0 w-px h-2 bg-gray-500" style={{ left: '100%' }} />
        </div>
      )}

      {/* Timestamps */}
      <div className="flex gap-4 text-[9px] text-gray-600">
        {created && <span>Created: {created.toLocaleDateString()} {created.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>}
        {started && <span>Started: {new Date(task.startedAt || task.assignedAt).toLocaleDateString()}</span>}
      </div>
    </div>
  )
}

/**
 * Summary time stats across all tasks — for headers/dashboards.
 */
export function TaskTimeSummary({ tasks }) {
  const stats = useMemo(() => {
    const active = tasks.filter(t => t.status === 'In Progress' || t.status === 'Assigned')
    const now = Date.now()

    let totalElapsed = 0
    let overdue = 0

    active.forEach(t => {
      const start = t.startedAt || t.assignedAt || t.createdAt
      if (!start) return
      const elapsed = now - new Date(start).getTime()
      totalElapsed += elapsed

      const expected = getExpectedDuration(t.contentType)
      if (expected && elapsed > expected) overdue++
    })

    return {
      activeCount: active.length,
      totalElapsed: formatDuration(totalElapsed),
      avgTime: active.length > 0 ? formatDuration(totalElapsed / active.length) : '—',
      overdue,
    }
  }, [tasks])

  return (
    <div className="flex items-center gap-3 text-[10px]">
      <div className="flex items-center gap-1">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
          <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
        </svg>
        <span className="text-gray-400">Avg: <strong className="text-gray-200">{stats.avgTime}</strong></span>
      </div>
      {stats.overdue > 0 && (
        <span className="text-red-400 font-semibold">{stats.overdue} overdue</span>
      )}
    </div>
  )
}
