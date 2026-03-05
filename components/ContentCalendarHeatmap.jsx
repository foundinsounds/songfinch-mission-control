'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'

/**
 * ContentCalendarHeatmap -- GitHub-style contribution heatmap
 * Shows content production activity over the past 12 weeks.
 * Derives data from activity[] and cross-references tasks[] for content types.
 */

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Normalize a Date to midnight UTC key string YYYY-MM-DD */
function toDateKey(date) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parse a date key back to a Date */
function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/** Format a date key to a human-friendly label */
function formatDateLabel(key) {
  const d = parseKey(key)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

/** Build array of 12*7=84 date keys ending with the current week's Sunday */
function buildGrid() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Find the upcoming Sunday (or today if Sunday)
  const dow = today.getDay() // 0=Sun
  const endOffset = dow === 0 ? 0 : 7 - dow
  const endDate = new Date(today)
  endDate.setDate(endDate.getDate() + endOffset)

  // Go back 12 weeks (84 days) from that Sunday to get Monday start
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - 83) // 84 days total, 12 weeks

  const cells = []
  const cursor = new Date(startDate)
  for (let i = 0; i < 84; i++) {
    cells.push({
      key: toDateKey(cursor),
      date: new Date(cursor),
      week: Math.floor(i / 7),
      dayOfWeek: i % 7,
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return cells
}

/** Get the intensity level for a count */
function getIntensity(count, max) {
  if (count === 0) return 0
  if (max <= 0) return 0
  const ratio = count / max
  if (ratio >= 0.8) return 4 // peak
  if (ratio >= 0.5) return 3 // high
  if (ratio >= 0.25) return 2 // med
  return 1 // low
}

/** Cell color by intensity level */
const INTENSITY_STYLES = {
  0: { bg: 'rgba(42, 42, 58, 0.6)', border: 'rgba(42, 42, 58, 0.3)' },
  1: { bg: 'rgba(249, 115, 22, 0.15)', border: 'rgba(249, 115, 22, 0.2)' },
  2: { bg: 'rgba(249, 115, 22, 0.35)', border: 'rgba(249, 115, 22, 0.3)' },
  3: { bg: 'rgba(249, 115, 22, 0.6)', border: 'rgba(249, 115, 22, 0.45)' },
  4: { bg: 'rgba(249, 115, 22, 0.9)', border: 'rgba(249, 115, 22, 0.7)' },
}

/** Build a sparkline path from weekly totals */
function buildSparklinePath(weeklyTotals, width, height) {
  if (!weeklyTotals || weeklyTotals.length < 2) return ''
  const max = Math.max(...weeklyTotals, 1)
  const min = 0
  const range = max - min || 1
  const step = width / (weeklyTotals.length - 1)
  const padding = 2 // vertical padding

  return weeklyTotals.map((v, i) => {
    const x = i * step
    const y = padding + (height - padding * 2) - ((v - min) / range) * (height - padding * 2)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

export default function ContentCalendarHeatmap({ activity = [], tasks = [], onClose }) {
  const [hoveredCell, setHoveredCell] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [entered, setEntered] = useState(false)
  const panelRef = useRef(null)
  const gridRef = useRef(null)

  // Trigger entrance animation
  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Escape key handler
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Build the 12-week grid structure
  const grid = useMemo(() => buildGrid(), [])

  // Index activity items by date
  const activityByDate = useMemo(() => {
    const map = {}
    activity.forEach(item => {
      if (!item.timestamp) return
      const key = toDateKey(new Date(item.timestamp))
      if (!map[key]) map[key] = []
      map[key].push(item)
    })
    return map
  }, [activity])

  // Index tasks by date (prefer scheduledDate, then createdAt)
  const tasksByDate = useMemo(() => {
    const map = {}
    tasks.forEach(task => {
      const dateSource = task.scheduledDate || task.createdAt
      if (!dateSource) return
      const key = toDateKey(new Date(dateSource))
      if (!map[key]) map[key] = []
      map[key].push(task)
    })
    return map
  }, [tasks])

  // Count per date (combined activity + tasks, deduplicated by counting unique items)
  const countByDate = useMemo(() => {
    const map = {}
    const allKeys = new Set([...Object.keys(activityByDate), ...Object.keys(tasksByDate)])
    allKeys.forEach(key => {
      const activityCount = activityByDate[key]?.length || 0
      const taskCount = tasksByDate[key]?.length || 0
      map[key] = activityCount + taskCount
    })
    return map
  }, [activityByDate, tasksByDate])

  // Get content types for a date
  const getContentTypes = useCallback((key) => {
    const types = {}
    // From activity
    const acts = activityByDate[key] || []
    acts.forEach(a => {
      const t = a.type || 'Activity'
      types[t] = (types[t] || 0) + 1
    })
    // From tasks
    const tks = tasksByDate[key] || []
    tks.forEach(t => {
      const ct = t.contentType || t.type || 'Task'
      types[ct] = (types[ct] || 0) + 1
    })
    return types
  }, [activityByDate, tasksByDate])

  // Max count for scaling
  const maxCount = useMemo(() => {
    const values = Object.values(countByDate)
    return values.length > 0 ? Math.max(...values) : 1
  }, [countByDate])

  // Week labels (month abbreviation for the first day of each week column)
  const weekLabels = useMemo(() => {
    const labels = []
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    let lastMonth = -1
    for (let w = 0; w < 12; w++) {
      const cell = grid[w * 7] // Monday of each week
      if (cell) {
        const m = cell.date.getMonth()
        if (m !== lastMonth) {
          labels.push({ week: w, label: months[m] })
          lastMonth = m
        }
      }
    }
    return labels
  }, [grid])

  // Summary stats
  const stats = useMemo(() => {
    const validKeys = grid.map(c => c.key)

    let total = 0
    let busiestDay = null
    let busiestCount = 0

    validKeys.forEach(key => {
      const count = countByDate[key] || 0
      total += count
      if (count > busiestCount) {
        busiestCount = count
        busiestDay = key
      }
    })

    // Content type breakdown across whole period
    const typeBreakdown = {}
    validKeys.forEach(key => {
      const types = getContentTypes(key)
      Object.entries(types).forEach(([t, c]) => {
        typeBreakdown[t] = (typeBreakdown[t] || 0) + c
      })
    })

    const sortedTypes = Object.entries(typeBreakdown).sort((a, b) => b[1] - a[1])

    return { total, busiestDay, busiestCount, sortedTypes }
  }, [grid, countByDate, getContentTypes])

  // Weekly totals for the sparkline
  const weeklyTotals = useMemo(() => {
    const totals = []
    for (let w = 0; w < 12; w++) {
      let weekTotal = 0
      for (let d = 0; d < 7; d++) {
        const cell = grid[w * 7 + d]
        if (cell) weekTotal += (countByDate[cell.key] || 0)
      }
      totals.push(weekTotal)
    }
    return totals
  }, [grid, countByDate])

  // Sparkline geometry
  const sparkWidth = 240
  const sparkHeight = 40
  const sparkPath = useMemo(
    () => buildSparklinePath(weeklyTotals, sparkWidth, sparkHeight),
    [weeklyTotals]
  )
  const sparkFillPath = useMemo(() => {
    if (!sparkPath) return ''
    return `${sparkPath} L${sparkWidth},${sparkHeight} L0,${sparkHeight} Z`
  }, [sparkPath])

  // Tooltip handler
  const handleCellHover = useCallback((cell, e) => {
    if (!cell) {
      setHoveredCell(null)
      return
    }
    const rect = gridRef.current?.getBoundingClientRect()
    if (rect) {
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }
    setHoveredCell(cell)
  }, [])

  const todayKey = toDateKey(new Date())

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.() }}
    >
      <div
        ref={panelRef}
        className="bg-dark-800 border border-dark-500/80 rounded-2xl shadow-2xl w-[780px] max-w-[95vw] max-h-[88vh] overflow-hidden flex flex-col"
        style={{
          boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
          transform: entered ? 'translateY(0)' : 'translateY(24px)',
          opacity: entered ? 1 : 0,
          transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease-out',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-dark-500 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-orange/10 border border-accent-orange/25 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-gray-100">Content Activity</h2>
              <p className="text-[10px] text-gray-500">
                12-week production heatmap &middot; {stats.total} total items
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-dark-600"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">

          {/* Heatmap Grid */}
          <div className="relative" ref={gridRef}>
            {/* Month labels */}
            <div className="flex ml-[32px] mb-1">
              {weekLabels.map(({ week, label }, i) => (
                <span
                  key={`${label}-${i}`}
                  className="text-[10px] text-gray-500 font-medium"
                  style={{
                    position: 'relative',
                    left: `${week * (100 / 12)}%`,
                    marginRight: 'auto',
                  }}
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="flex gap-1">
              {/* Day-of-week labels */}
              <div className="flex flex-col gap-[3px] shrink-0 pt-0">
                {DAY_LABELS.map((d, i) => (
                  <div
                    key={d}
                    className="text-[10px] text-gray-600 h-[14px] w-[28px] flex items-center justify-end pr-1"
                    style={{ lineHeight: '14px' }}
                  >
                    {i % 2 === 0 ? d : ''}
                  </div>
                ))}
              </div>

              {/* Grid of cells -- columns = weeks, rows = days */}
              <div className="flex gap-[3px] flex-1 min-w-0">
                {Array.from({ length: 12 }, (_, weekIdx) => (
                  <div key={weekIdx} className="flex flex-col gap-[3px] flex-1 min-w-0">
                    {Array.from({ length: 7 }, (_, dayIdx) => {
                      const cellIdx = weekIdx * 7 + dayIdx
                      const cell = grid[cellIdx]
                      if (!cell) return <div key={dayIdx} className="aspect-square rounded-[2px]" />

                      const count = countByDate[cell.key] || 0
                      const intensity = getIntensity(count, maxCount)
                      const style = INTENSITY_STYLES[intensity]
                      const isToday = cell.key === todayKey
                      const isFuture = cell.date > new Date()

                      return (
                        <div
                          key={dayIdx}
                          className="aspect-square rounded-[3px] cursor-pointer transition-all duration-100"
                          style={{
                            backgroundColor: isFuture ? 'rgba(42,42,58,0.25)' : style.bg,
                            border: isToday
                              ? '1.5px solid rgba(249, 115, 22, 0.7)'
                              : `1px solid ${isFuture ? 'rgba(42,42,58,0.15)' : style.border}`,
                            minHeight: '14px',
                            opacity: isFuture ? 0.3 : 1,
                          }}
                          onMouseEnter={(e) => !isFuture && handleCellHover(cell, e)}
                          onMouseMove={(e) => !isFuture && handleCellHover(cell, e)}
                          onMouseLeave={() => setHoveredCell(null)}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Tooltip */}
            {hoveredCell && (
              <div
                className="absolute z-10 pointer-events-none"
                style={{
                  left: `${Math.min(tooltipPos.x, (gridRef.current?.offsetWidth || 600) - 200)}px`,
                  top: `${tooltipPos.y - 8}px`,
                  transform: 'translate(-50%, -100%)',
                }}
              >
                <div className="bg-dark-900 border border-dark-400 rounded-lg px-3 py-2 shadow-xl" style={{ minWidth: '140px' }}>
                  <div className="text-[11px] font-semibold text-gray-200 mb-1">
                    {formatDateLabel(hoveredCell.key)}
                  </div>
                  <div className="text-[10px] text-gray-400 font-mono">
                    {countByDate[hoveredCell.key] || 0} item{(countByDate[hoveredCell.key] || 0) !== 1 ? 's' : ''}
                  </div>
                  {(() => {
                    const types = getContentTypes(hoveredCell.key)
                    const entries = Object.entries(types)
                    if (entries.length === 0) return null
                    return (
                      <div className="mt-1.5 pt-1.5 border-t border-dark-500/50 space-y-0.5">
                        {entries.slice(0, 5).map(([type, cnt]) => (
                          <div key={type} className="flex items-center justify-between gap-3">
                            <span className="text-[9px] text-gray-500 truncate">{type}</span>
                            <span className="text-[9px] font-mono text-gray-400">{cnt}</span>
                          </div>
                        ))}
                        {entries.length > 5 && (
                          <div className="text-[9px] text-gray-600">+{entries.length - 5} more</div>
                        )}
                      </div>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3">
            <span className="text-[10px] text-gray-600">Less</span>
            <div className="flex gap-[3px]">
              {[0, 1, 2, 3, 4].map(level => (
                <div
                  key={level}
                  className="w-[14px] h-[14px] rounded-[3px]"
                  style={{
                    backgroundColor: INTENSITY_STYLES[level].bg,
                    border: `1px solid ${INTENSITY_STYLES[level].border}`,
                  }}
                />
              ))}
            </div>
            <span className="text-[10px] text-gray-600">More</span>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-dark-700/50 rounded-lg px-3 py-2.5 border border-dark-500/30">
              <div className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Total Items</div>
              <div className="text-[18px] font-bold text-accent-orange font-mono tabular-nums">
                {stats.total}
              </div>
              <div className="text-[9px] text-gray-600 mt-0.5">
                across 12 weeks
              </div>
            </div>
            <div className="bg-dark-700/50 rounded-lg px-3 py-2.5 border border-dark-500/30">
              <div className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Busiest Day</div>
              <div className="text-[14px] font-bold text-gray-200">
                {stats.busiestDay ? formatDateLabel(stats.busiestDay) : '--'}
              </div>
              <div className="text-[9px] text-gray-600 mt-0.5">
                {stats.busiestCount > 0 ? (
                  <span><span className="text-accent-orange font-mono font-semibold">{stats.busiestCount}</span> items produced</span>
                ) : 'No activity'}
              </div>
            </div>
            <div className="bg-dark-700/50 rounded-lg px-3 py-2.5 border border-dark-500/30">
              <div className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold mb-1">Content Types</div>
              <div className="text-[14px] font-bold text-gray-200 font-mono tabular-nums">
                {stats.sortedTypes.length}
              </div>
              <div className="text-[9px] text-gray-600 mt-0.5">
                {stats.sortedTypes.length > 0
                  ? `Top: ${stats.sortedTypes[0][0]}`
                  : 'No data'}
              </div>
            </div>
          </div>

          {/* Content Type Breakdown */}
          {stats.sortedTypes.length > 0 && (
            <div>
              <div className="text-[10px] text-gray-500 font-semibold mb-2 uppercase tracking-wider">
                Content Type Breakdown
              </div>
              <div className="space-y-1.5">
                {stats.sortedTypes.slice(0, 8).map(([type, count]) => {
                  const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
                  return (
                    <div key={type} className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400 w-24 truncate shrink-0">{type}</span>
                      <div className="flex-1 h-2 rounded-full bg-dark-600 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: '#f97316',
                            opacity: 0.3 + (pct / 100) * 0.7,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-500 font-mono tabular-nums w-8 text-right shrink-0">
                        {count}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Weekly Trend Sparkline */}
          <div>
            <div className="text-[10px] text-gray-500 font-semibold mb-2 uppercase tracking-wider">
              Weekly Trend
            </div>
            <div className="bg-dark-700/30 rounded-lg border border-dark-500/30 p-3">
              <div className="flex items-end gap-3">
                <svg
                  width={sparkWidth}
                  height={sparkHeight}
                  viewBox={`0 0 ${sparkWidth} ${sparkHeight}`}
                  className="flex-1"
                  preserveAspectRatio="none"
                  style={{ maxWidth: `${sparkWidth}px` }}
                >
                  {/* Grid lines */}
                  {[0.25, 0.5, 0.75].map(pct => (
                    <line
                      key={pct}
                      x1="0"
                      y1={sparkHeight * pct}
                      x2={sparkWidth}
                      y2={sparkHeight * pct}
                      stroke="rgba(42,42,58,0.5)"
                      strokeWidth="0.5"
                      strokeDasharray="4 3"
                    />
                  ))}
                  {/* Fill area */}
                  {sparkFillPath && (
                    <path
                      d={sparkFillPath}
                      fill="url(#heatmap-spark-grad)"
                    />
                  )}
                  {/* Line */}
                  {sparkPath && (
                    <path
                      d={sparkPath}
                      fill="none"
                      stroke="#f97316"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {/* End dot */}
                  {weeklyTotals.length > 0 && sparkPath && (() => {
                    const lastVal = weeklyTotals[weeklyTotals.length - 1]
                    const maxW = Math.max(...weeklyTotals, 1)
                    const y = 2 + (sparkHeight - 4) - ((lastVal) / maxW) * (sparkHeight - 4)
                    return (
                      <circle cx={sparkWidth} cy={y} r="3" fill="#f97316" stroke="#12121a" strokeWidth="1.5" />
                    )
                  })()}
                  <defs>
                    <linearGradient id="heatmap-spark-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f97316" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                </svg>

                {/* Weekly values alongside */}
                <div className="flex flex-col items-end shrink-0">
                  <span className="text-[10px] text-gray-500">This week</span>
                  <span className="text-[14px] font-bold text-accent-orange font-mono tabular-nums">
                    {weeklyTotals[weeklyTotals.length - 1] || 0}
                  </span>
                </div>
              </div>
              {/* Week number labels */}
              <div className="flex justify-between mt-1.5 ml-0">
                {weeklyTotals.map((_, i) => (
                  <span key={i} className="text-[8px] text-gray-700 font-mono" style={{ width: `${100 / 12}%`, textAlign: 'center' }}>
                    {i === 0 ? 'W1' : i === 11 ? 'W12' : i % 3 === 0 ? `W${i + 1}` : ''}
                  </span>
                ))}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
