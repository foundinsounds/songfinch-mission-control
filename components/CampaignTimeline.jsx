'use client'

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'

// Campaign color palette — deterministic by name
const CAMPAIGN_COLORS = [
  '#f97316', // orange
  '#3b82f6', // blue
  '#22c55e', // green
  '#a855f7', // purple
  '#ec4899', // pink
  '#14b8a6', // teal
  '#eab308', // yellow
  '#ef4444', // red
  '#6366f1', // indigo
  '#f59e0b', // amber
]

function getCampaignColor(name, index) {
  return CAMPAIGN_COLORS[index % CAMPAIGN_COLORS.length]
}

// Helper: parse a date string to midnight local time
function parseDate(str) {
  if (!str) return null
  const d = new Date(str)
  if (isNaN(d.getTime())) return null
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

// Helper: format date as short label
function formatShortDate(date) {
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Helper: diff in days
function daysBetween(a, b) {
  return Math.round((b - a) / (1000 * 60 * 60 * 24))
}

// Helper: add days
function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

// Helper: get Monday of the week containing the date
function getWeekStart(date) {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day // Monday
  d.setDate(d.getDate() + diff)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

export default function CampaignTimeline({ tasks, onSelectTask, onFilterByCampaign }) {
  const scrollRef = useRef(null)
  const [hoveredCampaign, setHoveredCampaign] = useState(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  const [isMobile, setIsMobile] = useState(false)

  // Responsive check
  useEffect(() => {
    function check() {
      setIsMobile(window.innerWidth < 768)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Group tasks by campaign
  const campaignData = useMemo(() => {
    const groups = {}
    tasks.forEach(task => {
      const campaign = task.campaign || 'Uncategorized'
      if (!groups[campaign]) groups[campaign] = []
      groups[campaign].push(task)
    })

    // Build campaign objects with date ranges and stats
    return Object.entries(groups).map(([name, campaignTasks], idx) => {
      let earliest = null
      let latest = null

      campaignTasks.forEach(t => {
        const created = parseDate(t.createdAt)
        const scheduled = parseDate(t.scheduledDate)
        const dates = [created, scheduled].filter(Boolean)

        dates.forEach(d => {
          if (!earliest || d < earliest) earliest = d
          if (!latest || d > latest) latest = d
        })
      })

      // If all dates are the same, extend by 14 days for visibility
      if (earliest && latest && earliest.getTime() === latest.getTime()) {
        latest = addDays(latest, 14)
      }
      // If no dates at all, skip
      if (!earliest) earliest = new Date()
      if (!latest) latest = addDays(earliest, 7)

      // Ensure minimum bar width of 7 days
      if (daysBetween(earliest, latest) < 7) {
        latest = addDays(earliest, 7)
      }

      const done = campaignTasks.filter(t => t.status === 'Done').length
      const inProgress = campaignTasks.filter(t => t.status === 'In Progress' || t.status === 'Review').length
      const inbox = campaignTasks.filter(t => t.status === 'Inbox' || t.status === 'Assigned').length
      const total = campaignTasks.length

      return {
        name,
        tasks: campaignTasks,
        startDate: earliest,
        endDate: latest,
        done,
        inProgress,
        inbox,
        total,
        color: getCampaignColor(name, idx),
        progress: total > 0 ? Math.round((done / total) * 100) : 0,
      }
    }).sort((a, b) => a.startDate - b.startDate)
  }, [tasks])

  // Calculate timeline range — extend 2 weeks before earliest and 4 weeks after latest
  const timelineRange = useMemo(() => {
    if (campaignData.length === 0) {
      const today = new Date()
      return {
        start: addDays(today, -14),
        end: addDays(today, 28),
      }
    }
    const earliest = campaignData.reduce((min, c) => c.startDate < min ? c.startDate : min, campaignData[0].startDate)
    const latest = campaignData.reduce((max, c) => c.endDate > max ? c.endDate : max, campaignData[0].endDate)

    return {
      start: addDays(getWeekStart(earliest), -14),
      end: addDays(latest, 28),
    }
  }, [campaignData])

  // Generate week markers
  const weekMarkers = useMemo(() => {
    const markers = []
    let current = getWeekStart(timelineRange.start)
    while (current <= timelineRange.end) {
      markers.push(new Date(current))
      current = addDays(current, 7)
    }
    return markers
  }, [timelineRange])

  // Generate month markers for header
  const monthMarkers = useMemo(() => {
    const markers = []
    let current = new Date(timelineRange.start.getFullYear(), timelineRange.start.getMonth(), 1)
    while (current <= timelineRange.end) {
      const monthStart = new Date(current)
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0)
      // Clamp to timeline range
      const clampedStart = monthStart < timelineRange.start ? timelineRange.start : monthStart
      const clampedEnd = monthEnd > timelineRange.end ? timelineRange.end : monthEnd
      markers.push({
        label: current.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        shortLabel: current.toLocaleDateString('en-US', { month: 'short' }),
        start: clampedStart,
        end: clampedEnd,
      })
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1)
    }
    return markers
  }, [timelineRange])

  const totalDays = daysBetween(timelineRange.start, timelineRange.end)
  const DAY_WIDTH = 18 // pixels per day
  const totalWidth = totalDays * DAY_WIDTH
  const LANE_HEIGHT = 52
  const HEADER_HEIGHT = 52

  // Today marker position
  const today = new Date()
  const todayNormalized = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const todayOffset = daysBetween(timelineRange.start, todayNormalized) * DAY_WIDTH

  // Scroll to today on mount
  useEffect(() => {
    if (scrollRef.current && !isMobile) {
      const scrollTo = todayOffset - scrollRef.current.clientWidth / 3
      scrollRef.current.scrollLeft = Math.max(0, scrollTo)
    }
  }, [todayOffset, isMobile])

  // Tooltip handler
  const handleCampaignHover = useCallback((campaign, e) => {
    if (!campaign) {
      setHoveredCampaign(null)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltipPos({
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
    })
    setHoveredCampaign(campaign)
  }, [])

  // Campaign click handler
  const handleCampaignClick = useCallback((campaign) => {
    if (onFilterByCampaign) {
      onFilterByCampaign(campaign.name)
    }
  }, [onFilterByCampaign])

  // Stats summary
  const totalStats = useMemo(() => {
    const total = campaignData.reduce((s, c) => s + c.total, 0)
    const done = campaignData.reduce((s, c) => s + c.done, 0)
    const inProg = campaignData.reduce((s, c) => s + c.inProgress, 0)
    return { total, done, inProg, campaigns: campaignData.length }
  }, [campaignData])

  // ---- Mobile List View ----
  if (isMobile) {
    return (
      <div className="h-full flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="px-4 py-3 border-b border-dark-500 bg-dark-800/50 shrink-0">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-gray-200">Campaign Timeline</h2>
            <span className="text-[10px] text-gray-500">{totalStats.campaigns} campaigns</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5 text-[10px]">
            <span className="text-gray-500">{totalStats.total} tasks</span>
            <span className="text-green-400">{totalStats.done} done</span>
            <span className="text-amber-400">{totalStats.inProg} active</span>
          </div>
        </div>

        {/* Mobile Campaign List */}
        <div className="flex-1 overflow-auto p-3 space-y-2">
          {campaignData.map((campaign) => (
            <button
              key={campaign.name}
              onClick={() => handleCampaignClick(campaign)}
              className="w-full text-left bg-dark-700/50 border border-dark-500 rounded-lg p-3 hover:bg-dark-600/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: campaign.color }} />
                  <span className="text-xs font-semibold text-gray-200 truncate">{campaign.name}</span>
                </div>
                <span className="text-[10px] text-gray-500">{campaign.total} tasks</span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-dark-500 rounded-full overflow-hidden mb-2">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${campaign.progress}%`, backgroundColor: campaign.color }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-green-400">{campaign.done} done</span>
                  <span className="text-amber-400">{campaign.inProgress} active</span>
                  <span className="text-gray-500">{campaign.inbox} pending</span>
                </div>
                <span className="text-[9px] text-gray-600">
                  {formatShortDate(campaign.startDate)} - {formatShortDate(campaign.endDate)}
                </span>
              </div>

              {/* Task status dots */}
              <div className="flex items-center gap-0.5 mt-2 flex-wrap">
                {campaign.tasks.slice(0, 12).map(t => (
                  <div
                    key={t.id}
                    className={`w-2 h-2 rounded-full ${
                      t.status === 'Done' ? 'bg-accent-green' :
                      t.status === 'In Progress' || t.status === 'Review' ? 'bg-amber-400' :
                      'bg-gray-600'
                    }`}
                    title={t.name}
                  />
                ))}
                {campaign.tasks.length > 12 && (
                  <span className="text-[8px] text-gray-600 ml-1">+{campaign.tasks.length - 12}</span>
                )}
              </div>
            </button>
          ))}

          {campaignData.length === 0 && (
            <div className="text-center py-12 text-gray-600 text-sm">
              No campaigns found. Tasks need a <code className="text-gray-500">campaign</code> field.
            </div>
          )}
        </div>
      </div>
    )
  }

  // ---- Desktop Gantt Timeline View ----
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header bar */}
      <div className="px-4 py-3 border-b border-dark-500 flex items-center justify-between shrink-0 bg-dark-800/50">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-bold text-gray-200">Campaign Timeline</h2>
          <button
            onClick={() => {
              if (scrollRef.current) {
                const scrollTo = todayOffset - scrollRef.current.clientWidth / 3
                scrollRef.current.scrollLeft = Math.max(0, scrollTo)
              }
            }}
            className="text-[10px] px-2 py-1 bg-dark-600 text-gray-400 rounded hover:text-gray-200 transition-colors"
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="text-gray-500">{totalStats.campaigns} campaigns</span>
          <span className="text-gray-500">{totalStats.total} tasks</span>
          <span className="text-green-400">{totalStats.done} done</span>
          <span className="text-amber-400">{totalStats.inProg} active</span>
        </div>
      </div>

      {/* Timeline area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left sidebar — campaign labels */}
        <div className="w-[180px] shrink-0 border-r border-dark-500 bg-dark-800/30 overflow-hidden">
          {/* Spacer for header row */}
          <div className="h-[52px] border-b border-dark-500 flex items-end px-3 pb-2">
            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Campaign</span>
          </div>

          {/* Campaign labels */}
          <div className="overflow-y-auto" style={{ height: `calc(100% - 52px)` }}>
            {campaignData.map((campaign) => (
              <button
                key={campaign.name}
                onClick={() => handleCampaignClick(campaign)}
                className="w-full flex items-center gap-2 px-3 border-b border-dark-500/50 hover:bg-dark-600/50 transition-colors group"
                style={{ height: `${LANE_HEIGHT}px` }}
              >
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: campaign.color }} />
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-[11px] font-medium text-gray-300 truncate group-hover:text-gray-100 transition-colors">
                    {campaign.name}
                  </div>
                  <div className="text-[9px] text-gray-600">
                    {campaign.total} tasks &middot; {campaign.progress}%
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Right scrollable timeline grid */}
        <div ref={scrollRef} className="flex-1 overflow-auto relative">
          <div style={{ width: `${totalWidth}px`, minHeight: '100%' }} className="relative">

            {/* Month header row */}
            <div className="sticky top-0 z-20 h-[26px] bg-dark-800/95 border-b border-dark-500/50 flex">
              {monthMarkers.map((month, i) => {
                const left = daysBetween(timelineRange.start, month.start) * DAY_WIDTH
                const width = daysBetween(month.start, month.end) * DAY_WIDTH
                return (
                  <div
                    key={i}
                    className="absolute top-0 h-full flex items-center border-r border-dark-500/30"
                    style={{ left: `${left}px`, width: `${width}px` }}
                  >
                    <span className="text-[10px] font-semibold text-gray-400 px-2 truncate">{month.label}</span>
                  </div>
                )
              })}
            </div>

            {/* Week header row */}
            <div className="sticky top-[26px] z-20 h-[26px] bg-dark-800/90 border-b border-dark-500 flex">
              {weekMarkers.map((week, i) => {
                const left = daysBetween(timelineRange.start, week) * DAY_WIDTH
                return (
                  <div
                    key={i}
                    className="absolute top-0 h-full flex items-center"
                    style={{ left: `${left}px`, width: `${7 * DAY_WIDTH}px` }}
                  >
                    <span className="text-[9px] text-gray-600 px-1.5">{formatShortDate(week)}</span>
                  </div>
                )
              })}
            </div>

            {/* Vertical week grid lines */}
            {weekMarkers.map((week, i) => {
              const left = daysBetween(timelineRange.start, week) * DAY_WIDTH
              return (
                <div
                  key={`grid-${i}`}
                  className="absolute top-0 bottom-0 border-l border-dark-500/20"
                  style={{ left: `${left}px` }}
                />
              )
            })}

            {/* Today marker */}
            {todayOffset >= 0 && todayOffset <= totalWidth && (
              <div
                className="absolute top-0 bottom-0 z-30 pointer-events-none"
                style={{ left: `${todayOffset}px` }}
              >
                <div className="w-px h-full bg-red-500/60" />
                <div className="absolute top-[52px] -translate-x-1/2 bg-red-500 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-b whitespace-nowrap">
                  TODAY
                </div>
              </div>
            )}

            {/* Campaign swimlanes */}
            <div style={{ paddingTop: `${HEADER_HEIGHT}px` }}>
              {campaignData.map((campaign, idx) => {
                const barLeft = daysBetween(timelineRange.start, campaign.startDate) * DAY_WIDTH
                const barWidth = Math.max(daysBetween(campaign.startDate, campaign.endDate) * DAY_WIDTH, 60)

                return (
                  <div
                    key={campaign.name}
                    className="relative border-b border-dark-500/30"
                    style={{ height: `${LANE_HEIGHT}px` }}
                  >
                    {/* Alternating lane background */}
                    {idx % 2 === 0 && (
                      <div className="absolute inset-0 bg-dark-700/10" />
                    )}

                    {/* Campaign bar */}
                    <div
                      className="absolute top-2 cursor-pointer group/bar transition-all hover:brightness-110"
                      style={{
                        left: `${barLeft}px`,
                        width: `${barWidth}px`,
                        height: `${LANE_HEIGHT - 16}px`,
                      }}
                      onMouseEnter={(e) => handleCampaignHover(campaign, e)}
                      onMouseLeave={() => handleCampaignHover(null)}
                      onClick={() => handleCampaignClick(campaign)}
                    >
                      {/* Bar background */}
                      <div
                        className="absolute inset-0 rounded-md opacity-20"
                        style={{ backgroundColor: campaign.color }}
                      />
                      {/* Bar border */}
                      <div
                        className="absolute inset-0 rounded-md border group-hover/bar:border-opacity-80 transition-all"
                        style={{ borderColor: campaign.color, borderOpacity: 0.4 }}
                      />
                      {/* Progress fill */}
                      <div
                        className="absolute top-0 left-0 bottom-0 rounded-l-md opacity-30"
                        style={{
                          width: `${campaign.progress}%`,
                          backgroundColor: campaign.color,
                          borderRadius: campaign.progress >= 100 ? '0.375rem' : '0.375rem 0 0 0.375rem',
                        }}
                      />

                      {/* Bar content */}
                      <div className="relative h-full flex items-center px-2 gap-1.5 overflow-hidden">
                        {/* Task status dots */}
                        <div className="flex items-center gap-[3px] shrink-0">
                          {campaign.tasks.slice(0, 8).map(t => (
                            <div
                              key={t.id}
                              className={`w-[6px] h-[6px] rounded-full transition-colors ${
                                t.status === 'Done' ? 'bg-accent-green' :
                                t.status === 'In Progress' || t.status === 'Review' ? 'bg-amber-400' :
                                'bg-gray-500'
                              }`}
                            />
                          ))}
                          {campaign.tasks.length > 8 && (
                            <span className="text-[7px] text-gray-500">+{campaign.tasks.length - 8}</span>
                          )}
                        </div>

                        {/* Campaign name on bar (if enough space) */}
                        {barWidth > 120 && (
                          <span
                            className="text-[9px] font-medium truncate opacity-80"
                            style={{ color: campaign.color }}
                          >
                            {campaign.name}
                          </span>
                        )}

                        {/* Percentage at right */}
                        {barWidth > 80 && (
                          <span
                            className="text-[8px] font-bold ml-auto shrink-0 opacity-60"
                            style={{ color: campaign.color }}
                          >
                            {campaign.progress}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}

              {/* Empty state */}
              {campaignData.length === 0 && (
                <div className="flex items-center justify-center py-20 text-gray-600 text-sm">
                  No campaigns found. Tasks need a <code className="text-gray-500 bg-dark-600 px-1 rounded">campaign</code> field to appear here.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredCampaign && (
        <div
          className="fixed z-50 pointer-events-none"
          style={{
            left: `${tooltipPos.x}px`,
            top: `${tooltipPos.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-dark-700 border border-dark-500 rounded-lg shadow-xl px-3 py-2.5 min-w-[200px]">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: hoveredCampaign.color }} />
              <span className="text-xs font-bold text-gray-200">{hoveredCampaign.name}</span>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className="text-center">
                <div className="text-sm font-bold text-green-400">{hoveredCampaign.done}</div>
                <div className="text-[8px] text-gray-500 uppercase">Done</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-amber-400">{hoveredCampaign.inProgress}</div>
                <div className="text-[8px] text-gray-500 uppercase">Active</div>
              </div>
              <div className="text-center">
                <div className="text-sm font-bold text-gray-400">{hoveredCampaign.inbox}</div>
                <div className="text-[8px] text-gray-500 uppercase">Pending</div>
              </div>
            </div>

            {/* Progress bar in tooltip */}
            <div className="w-full h-1.5 bg-dark-500 rounded-full overflow-hidden mb-1.5">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${hoveredCampaign.progress}%`, backgroundColor: hoveredCampaign.color }}
              />
            </div>

            <div className="flex items-center justify-between text-[9px] text-gray-500">
              <span>{hoveredCampaign.total} tasks &middot; {hoveredCampaign.progress}% complete</span>
            </div>

            <div className="text-[9px] text-gray-600 mt-1">
              {formatShortDate(hoveredCampaign.startDate)} &mdash; {formatShortDate(hoveredCampaign.endDate)}
            </div>

            {/* Task dots breakdown */}
            <div className="flex items-center gap-0.5 mt-2 flex-wrap">
              {hoveredCampaign.tasks.map(t => (
                <div
                  key={t.id}
                  className={`w-2 h-2 rounded-full ${
                    t.status === 'Done' ? 'bg-accent-green' :
                    t.status === 'In Progress' || t.status === 'Review' ? 'bg-amber-400' :
                    'bg-gray-600'
                  }`}
                  title={`${t.name} (${t.status})`}
                />
              ))}
            </div>

            {/* Arrow */}
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-dark-700 border-r border-b border-dark-500 transform rotate-45" />
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="px-4 py-2 border-t border-dark-500 bg-dark-800/50 flex items-center gap-4 shrink-0">
        <span className="text-[9px] text-gray-600 uppercase tracking-wider font-semibold">Legend:</span>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-accent-green" />
          <span className="text-[9px] text-gray-500">Done</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-[9px] text-gray-500">In Progress / Review</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-gray-500" />
          <span className="text-[9px] text-gray-500">Inbox / Assigned</span>
        </div>
        <div className="flex items-center gap-1.5 ml-4">
          <div className="w-3 h-px bg-red-500" />
          <span className="text-[9px] text-gray-500">Today</span>
        </div>
        <span className="text-[9px] text-gray-600 ml-auto">Click a campaign to filter the board</span>
      </div>
    </div>
  )
}
