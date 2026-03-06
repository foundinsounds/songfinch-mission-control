'use client'

import { useState, useRef, useCallback, useEffect, memo } from 'react'
import { AGENTS } from '../lib/agents'
import { STATUS_STYLES } from '../lib/constants'
import { TaskTimeInline } from './TaskTimeTracker'
import { ContentPreviewInline } from './ContentPreview'
import { BlockedBadge, UnblocksBadge, DependencyChainBadge } from './TaskDependencies'

// Dot color classes derived from centralized STATUS_STYLES, with fallbacks for Error/Failed
const STATUS_DOT = Object.fromEntries(
  Object.entries(STATUS_STYLES).map(([k, v]) => [k, v.dot])
)
STATUS_DOT['Error'] = 'bg-red-500'
STATUS_DOT['Failed'] = 'bg-red-500'

function getStatusDotClass(status) {
  return STATUS_DOT[status] || 'bg-gray-500'
}

function timeAgo(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

// Age badge removed — relative time text alone is sufficient. No colored icons.

/**
 * useRelativeTime — Custom hook that returns a live-updating human-readable relative time.
 * Formats: "just now" (<1min), "Xm ago" (minutes), "Xh ago" (hours), "Xd ago" (days), "Xw ago" (weeks)
 * Updates every 60 seconds via setInterval.
 */
function useRelativeTime(dateStr) {
  const computeRelative = useCallback(() => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return null
    const diff = Date.now() - date.getTime()
    if (diff < 0) return 'just now'
    const seconds = Math.floor(diff / 1000)
    if (seconds < 60) return 'just now'
    const minutes = Math.floor(diff / 60000)
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(diff / 3600000)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(diff / 86400000)
    if (days < 7) return `${days}d ago`
    const weeks = Math.floor(days / 7)
    return `${weeks}w ago`
  }, [dateStr])

  const [relative, setRelative] = useState(computeRelative)

  useEffect(() => {
    if (!dateStr) return
    setRelative(computeRelative())
    const interval = setInterval(() => {
      setRelative(computeRelative())
    }, 60000)
    return () => clearInterval(interval)
  }, [dateStr, computeRelative])

  return relative
}

// Age dot color removed — was redundant with relative time display

/**
 * formatExactDate — Returns a human-readable exact date/time string for tooltip display.
 */
function formatExactDate(dateStr) {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * HighlightText — Wraps text and highlights matching search terms
 * Uses case-insensitive matching with an orange highlight background
 */
function HighlightText({ text, query }) {
  if (!text || !query || query.trim().length < 2) return text || null
  const q = query.trim()
  const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)
  if (parts.length === 1) return text
  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="bg-accent-orange/30 text-accent-orange rounded-sm px-0.5 -mx-0.5">{part}</mark>
      : part
  )
}

const PRIORITY_STYLES = {
  High: 'border-l-red-500 border-red-500/30',
  Medium: 'border-l-orange-500 border-orange-500/20',
  Low: 'border-l-blue-500 border-blue-500/20',
}

// Background tint removed — left border alone conveys priority. Cards use a uniform dark bg.

// Priority dot colors — 6px colored circle indicator beside task names
const PRIORITY_DOT_COLOR = {
  High: 'bg-red-500',
  Medium: 'bg-orange-500',
  Low: 'bg-blue-500',
}

// Priority dot ring removed — the dot color alone is sufficient

// Content type uses a single muted color — no rainbow per type
const CONTENT_TYPE_COLOR = 'text-gray-400'

// SVG icons for links
function DriveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-6l-2 3H9l-2-3H1" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  )
}

function CanvaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function HoverPreview({ task, agent, cardRef }) {
  const previewRef = useRef(null)
  const [placement, setPlacement] = useState({ side: 'right', verticalOffset: 0 })

  // Smart viewport-aware positioning
  useEffect(() => {
    if (!previewRef.current || !cardRef?.current) return
    const card = cardRef.current.getBoundingClientRect()
    const preview = previewRef.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const gap = 8

    // Horizontal: prefer right, flip to left if overflow
    const rightEdge = card.right + gap + preview.width
    const leftEdge = card.left - gap - preview.width
    const side = rightEdge > vw - 16 ? (leftEdge > 16 ? 'left' : 'right') : 'right'

    // Vertical: clamp so preview stays within viewport
    const previewBottom = card.top + preview.height
    let verticalOffset = 0
    if (previewBottom > vh - 16) {
      verticalOffset = -(previewBottom - vh + 24)
    }

    setPlacement({ side, verticalOffset })
  }, [cardRef])

  const positionClass = placement.side === 'left'
    ? 'right-full mr-2'
    : 'left-full ml-2'

  return (
    <div
      ref={previewRef}
      className={`absolute z-50 ${positionClass} w-64 bg-dark-700 border border-dark-400 rounded-lg shadow-2xl p-3 pointer-events-none animate-slide-down hover-preview-card`}
      style={{ maxHeight: 300, top: placement.verticalOffset || 0 }}
    >
      {/* Arrow indicator */}
      <div className={`absolute top-4 w-2 h-2 bg-dark-700 border-dark-400 rotate-45 ${
        placement.side === 'left'
          ? '-right-1 border-r border-t'
          : '-left-1 border-l border-b'
      }`} />

      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        {agent && (
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0"
            style={{ background: `${agent.color}20`, border: `1.5px solid ${agent.color}` }}
          >
            {agent.emoji}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-semibold text-gray-200 truncate">{task.name || 'Untitled Task'}</div>
          <div className="text-[9px] text-gray-500 flex items-center gap-1.5">
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${getStatusDotClass(task.status)}${task.status === 'In Progress' ? ' status-badge-pulse' : ''}`} />
            {task.status} · {task.priority || 'Normal'} priority
          </div>
        </div>
      </div>

      {/* Description */}
      {task.description && (
        <p className="text-[10px] text-gray-400 leading-relaxed mb-2 line-clamp-4">
          {task.description}
        </p>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap gap-1.5 mb-2">
        {task.contentType && (
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-sm bg-dark-600 ${CONTENT_TYPE_COLOR}`}>
            {task.contentType}
          </span>
        )}
        {task.campaign && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-sm bg-dark-600 text-gray-400">
            📢 {task.campaign}
          </span>
        )}
      </div>

      {/* Platforms */}
      {task.platform && task.platform.length > 0 && (
        <div className="flex gap-1">
          {task.platform.map(p => (
            <span key={p} className="text-[8px] px-1.5 py-0.5 rounded bg-dark-600 text-gray-500">{p}</span>
          ))}
        </div>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {task.tags.map(tag => (
            <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">#{tag}</span>
          ))}
        </div>
      )}

      {/* Blocked indicator */}
      {task.blockedBy && task.blockedBy.length > 0 && (
        <div className="mt-2 text-[9px] text-red-400 flex items-center gap-1">
          🚫 Blocked by {task.blockedBy.length} task{task.blockedBy.length > 1 ? 's' : ''}
        </div>
      )}

      {/* Time tracking */}
      {task.timeSpent > 0 && (
        <div className="mt-1.5 text-[9px] text-gray-500 flex items-center gap-1">
          ⏱ {Math.round(task.timeSpent / 60)}m tracked
        </div>
      )}

      {/* Created time + hint */}
      <div className="mt-2 pt-1.5 border-t border-dark-500 flex items-center justify-between">
        {task.created ? (
          <span className="text-[8px] text-gray-600">Created {timeAgo(task.created)}</span>
        ) : (
          <span />
        )}
        <span className="text-[8px] text-accent-orange/60 font-medium">Click to open ›</span>
      </div>
    </div>
  )
}

// Status hover glow classes removed — cards hover to a uniform subtle brightness instead of colored glows

// Density configuration — controls what's visible at each density level
const DENSITY_CONFIG = {
  comfortable: {
    card: 'p-3',
    title: 'text-[13px]',
    showPreview: true,
    showBadges: true,
    showAge: true,
    showTime: true,
    showTags: true,
    showDescription: true,
    showLinks: true,
    showPlatforms: true,
    showActions: true,
    spacing: 'gap-2 mb-1.5',
    bottomSpacing: 'mb-3',
  },
  compact: {
    card: 'p-2',
    title: 'text-[12px]',
    showPreview: false,
    showBadges: true,
    showAge: true,
    showTime: false,
    showTags: false,
    showDescription: false,
    showLinks: true,
    showPlatforms: false,
    showActions: true,
    spacing: 'gap-1.5 mb-1',
    bottomSpacing: 'mb-1.5',
  },
  dense: {
    card: 'px-2 py-1.5',
    title: 'text-[11px]',
    showPreview: false,
    showBadges: false,
    showAge: false,
    showTime: false,
    showTags: false,
    showDescription: false,
    showLinks: false,
    showPlatforms: false,
    showActions: false,
    spacing: 'gap-1 mb-0.5',
    bottomSpacing: 'mb-0',
  },
}

function TaskCard({ task, onClick, onContextMenu, onQuickApprove, onRequestChanges, onRetry, compact, density = 'comfortable', isSelected, onToggleSelect, allTasks = [], isFocused, searchQuery = '', animationIndex = 0 }) {
  const agent = task.agent ? AGENTS.find(a => a.name === task.agent) : null
  const isDone = task.status === 'Done'
  const isReview = task.status === 'Review'
  const isFailed = task.status === 'Error' || task.status === 'Failed'
  const isInProgress = task.status === 'In Progress'
  const isHighPriority = task.priority === 'High' && !isDone
  const hasDriveLink = task.driveLink && task.driveLink.length > 0
  const hasCanvaLink = task.canvaLink && task.canvaLink.length > 0
  // statusHoverClass removed — uniform hover instead of per-status colored glow

  // Density-aware rendering config
  const d = DENSITY_CONFIG[density] || DENSITY_CONFIG.comfortable

  // Track checkbox animation
  const [checkboxAnimating, setCheckboxAnimating] = useState(false)

  // Keyboard focus scroll-into-view
  const cardRef = useRef(null)
  useEffect(() => {
    if (isFocused && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [isFocused])

  // Staggered entrance delay
  const entranceDelay = Math.min(animationIndex * 40, 300)

  // Relative time display — live-updating via useRelativeTime hook
  const relativeTime = useRelativeTime(task.createdAt || task.created)
  const exactDateTooltip = formatExactDate(task.createdAt || task.created)
  // ageDotColor removed — relative time text is sufficient

  // Hover preview state
  const [showPreview, setShowPreview] = useState(false)
  const hoverTimer = useRef(null)

  const handleMouseEnter = useCallback(() => {
    const delay = density === 'dense' ? 250 : compact ? 300 : 500
    hoverTimer.current = setTimeout(() => setShowPreview(true), delay)
  }, [compact, density])

  const handleMouseLeave = useCallback(() => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setShowPreview(false)
  }, [])

  // Dense mode — minimal single-line: task name + status dot + agent emoji only
  if (density === 'dense') {
    return (
      <div
        ref={cardRef}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        tabIndex={0}
        role="button"
        aria-label={`${task.name}${task.priority ? `, ${task.priority}` : ''}, ${task.status}`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }}
        className={`relative group flex items-center gap-1.5 px-2 py-1 rounded-md border border-dark-500/70 border-l-[4px] ${PRIORITY_STYLES[task.priority] || 'border-l-gray-600'} compact-card-hover cursor-pointer ${
          isSelected ? 'bg-accent-orange/10 border-accent-orange/30' : 'bg-dark-700/80 hover:bg-dark-600'
        } ${isDone ? 'opacity-70' : ''} ${isFocused ? 'ring-2 ring-accent-blue/60 bg-accent-blue/5' : ''} animate-card-enter-compact`}
        style={{ animationDelay: `${entranceDelay}ms`, animationFillMode: 'backwards' }}
      >
        {/* Status dot */}
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${getStatusDotClass(task.status)}${isInProgress ? ' status-badge-pulse' : ''}`} />

        {/* Task name */}
        <span className={`text-[11px] font-medium truncate flex-1 ${isDone ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
          <HighlightText text={task.name || 'Untitled Task'} query={searchQuery} />
        </span>

        {/* Agent emoji */}
        {agent && (
          <span className="text-[10px] shrink-0" title={agent.name}>{agent.emoji}</span>
        )}

        {/* Priority dot */}
        {task.priority && PRIORITY_DOT_COLOR[task.priority] && (
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT_COLOR[task.priority]}`} title={`${task.priority} priority`} />
        )}

        {/* Done check */}
        {isDone && (
          <span className="text-accent-green text-[10px]"><CheckIcon /></span>
        )}

        {/* Relative time stamp */}
        {relativeTime && (
          <span className="text-[8px] text-gray-600 font-mono tabular-nums shrink-0" title={exactDateTooltip}>
            {relativeTime}
          </span>
        )}

        {/* Hover preview tooltip */}
        {showPreview && <HoverPreview task={task} agent={agent} cardRef={cardRef} />}
      </div>
    )
  }

  // Compact mode renders a minimal single-line card
  if (compact) {
    return (
      <div
        ref={cardRef}
        onClick={onClick}
        onContextMenu={onContextMenu}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        tabIndex={0}
        role="button"
        aria-label={`${task.name}${task.priority ? `, ${task.priority}` : ''}, ${task.status}${agent ? `, ${agent.name}` : ''}`}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }}
        className={`relative group flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-dark-500 border-l-[4px] ${PRIORITY_STYLES[task.priority] || 'border-l-gray-600'} compact-card-hover cursor-pointer ${
          isSelected ? 'bg-accent-orange/10 border-accent-orange/30' : 'bg-dark-700 hover:bg-dark-600'
        } ${isDone ? 'opacity-75' : ''} ${isFocused ? 'ring-2 ring-accent-blue/60 bg-accent-blue/5' : ''} animate-card-enter-compact`}
        style={{ animationDelay: `${entranceDelay}ms`, animationFillMode: 'backwards' }}
      >
        {/* Select checkbox */}
        {onToggleSelect && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              setCheckboxAnimating(true)
              setTimeout(() => setCheckboxAnimating(false), 250)
              onToggleSelect(task.id)
            }}
            className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
              isSelected
                ? 'bg-accent-orange border-accent-orange text-white'
                : 'border-dark-400 hover:border-gray-400'
            } ${checkboxAnimating ? 'animate-checkbox-pop' : ''}`}
          >
            {isSelected && <CheckIcon />}
          </button>
        )}

        {/* Content type dot */}
        {task.contentType && (
          <span className={`text-[8px] ${CONTENT_TYPE_COLOR}`}>●</span>
        )}

        {/* Task name */}
        <span className={`text-[11px] font-medium truncate flex-1 ${isDone ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
          <HighlightText text={task.name || 'Untitled Task'} query={searchQuery} />
        </span>

        {/* Blocked indicator */}
        {allTasks.length > 0 && <BlockedBadge task={task} allTasks={allTasks} />}

        {/* Agent */}
        {agent && (
          <span className="text-[10px] shrink-0" title={agent.name}>{agent.emoji}</span>
        )}

        {/* Comment count (compact) */}
        {task.commentCount > 0 && (
          <span className="text-[8px] text-gray-500 shrink-0 font-mono flex items-center gap-0.5" title={`${task.commentCount} comment${task.commentCount !== 1 ? 's' : ''}`}>
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="shrink-0"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            {task.commentCount}
          </span>
        )}

        {/* Age indicator removed — relative time text is sufficient */}

        {/* Priority dot */}
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORITY_DOT_COLOR[task.priority] || 'bg-gray-600'}`} title={task.priority ? `${task.priority} priority` : undefined} />

        {/* Done check */}
        {isDone && (
          <span className="text-accent-green text-[10px]"><CheckIcon /></span>
        )}

        {/* Relative time stamp */}
        {relativeTime && (
          <span className="text-[8px] text-gray-600 font-mono tabular-nums shrink-0" title={exactDateTooltip}>
            {relativeTime}
          </span>
        )}

        {/* Hover preview tooltip for compact cards */}
        {showPreview && <HoverPreview task={task} agent={agent} cardRef={cardRef} />}
      </div>
    )
  }

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      tabIndex={0}
      role="button"
      aria-label={`Task: ${task.name}${task.priority ? `, ${task.priority} priority` : ''}${task.status ? `, ${task.status}` : ''}${agent ? `, assigned to ${agent.name}` : ', unassigned'}`}
      className={`group task-card bg-dark-700 rounded-lg border border-dark-500 border-l-[4px] ${PRIORITY_STYLES[task.priority] || 'border-l-gray-600'} p-3 relative ${isDone ? 'opacity-85' : ''} ${isSelected ? 'ring-1 ring-accent-orange/40 bg-accent-orange/5' : ''} ${isFocused ? 'ring-2 ring-accent-blue/60 bg-accent-blue/5 shadow-lg shadow-accent-blue/10' : ''} animate-card-enter`}
      style={{ animationDelay: `${entranceDelay}ms`, animationFillMode: 'backwards' }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }}
    >
      {/* Hover Preview Popover */}
      {showPreview && <HoverPreview task={task} agent={agent} cardRef={cardRef} />}
      {/* Drag handle grip — visible on hover */}
      <div className="absolute top-1/2 -translate-y-1/2 left-0 w-3 flex flex-col items-center gap-[2px] opacity-0 group-hover:opacity-40 hover:!opacity-80 transition-opacity cursor-grab active:cursor-grabbing z-10" title="Drag to reorder">
        <div className="flex gap-[2px]"><div className="w-[3px] h-[3px] rounded-full bg-gray-400"/><div className="w-[3px] h-[3px] rounded-full bg-gray-400"/></div>
        <div className="flex gap-[2px]"><div className="w-[3px] h-[3px] rounded-full bg-gray-400"/><div className="w-[3px] h-[3px] rounded-full bg-gray-400"/></div>
        <div className="flex gap-[2px]"><div className="w-[3px] h-[3px] rounded-full bg-gray-400"/><div className="w-[3px] h-[3px] rounded-full bg-gray-400"/></div>
      </div>

      {/* Selection checkbox */}
      {onToggleSelect && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            setCheckboxAnimating(true)
            setTimeout(() => setCheckboxAnimating(false), 250)
            onToggleSelect(task.id)
          }}
          className={`absolute top-2 left-2 w-4.5 h-4.5 rounded border flex items-center justify-center transition-all z-10 ${
            isSelected
              ? 'bg-accent-orange border-accent-orange text-white'
              : 'border-dark-400 bg-dark-700 opacity-0 group-hover:opacity-100 hover:border-gray-400'
          } ${checkboxAnimating ? 'animate-checkbox-pop' : ''}`}
          style={{ width: 18, height: 18 }}
        >
          {isSelected && <CheckIcon />}
        </button>
      )}

      {/* Done checkmark overlay — animated entrance */}
      {isDone && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent-green/20 border border-accent-green/40 flex items-center justify-center text-accent-green animate-done-check">
          <CheckIcon />
        </div>
      )}

      {/* Content Type Badge + Dependency Badges + Escalation */}
      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
        {task.contentType && (
          <span className={`content-type-badge text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${CONTENT_TYPE_COLOR}`}>
            {task.contentType}
          </span>
        )}
        {task._escalated && (
          <span
            className="text-[8px] px-1.5 py-0.5 rounded border bg-amber-500/10 text-amber-400 border-amber-500/20 font-bold uppercase tracking-wider"
            title={`Escalated: ${task._escalated.rule} (${task._escalated.ageHours}h old)`}
          >
            ⬆ Escalated
          </span>
        )}
        {allTasks.length > 0 && <BlockedBadge task={task} allTasks={allTasks} />}
        {allTasks.length > 0 && <UnblocksBadge task={task} allTasks={allTasks} />}
        {allTasks.length > 0 && <DependencyChainBadge task={task} allTasks={allTasks} />}
      </div>

      {/* Task Name with priority dot */}
      <h3 className={`text-[13px] font-semibold leading-tight mb-1.5 flex items-center gap-1.5 ${isDone ? 'text-gray-400' : 'text-gray-100'}`}>
        {task.priority && PRIORITY_DOT_COLOR[task.priority] && (
          <span
            className={`w-[6px] h-[6px] rounded-full shrink-0 ${PRIORITY_DOT_COLOR[task.priority]}`}
            title={`${task.priority} priority`}
          />
        )}
        <span className="truncate">
          <HighlightText text={task.name || 'Untitled Task'} query={searchQuery} />
        </span>
      </h3>

      {/* Description Preview */}
      <p className="text-[11px] text-gray-500 leading-relaxed mb-3 line-clamp-2">
        <HighlightText text={task.description} query={searchQuery} />
      </p>

      {/* Content Preview Thumbnail */}
      {task.contentType && task.output && (
        <div className="mb-2">
          <ContentPreviewInline task={task} />
        </div>
      )}

      {/* Tags — with hover micro-interaction */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="tag tag-interactive">{tag}</span>
          ))}
          {task.tags.length > 3 && (
            <span className="tag tag-interactive">+{task.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Bottom Row: Agent + Time */}
      <div className="flex items-center justify-between">
        {agent ? (
          <div className="flex items-center gap-1.5">
            <div className="relative">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] relative z-10"
                style={{
                  background: `${agent.color}20`,
                  border: `1.5px solid ${agent.color}`,
                }}
              >
                {agent.emoji}
              </div>
              {/* Subtle activity indicator — static ring instead of pulsing animation */}
              {isInProgress && (
                <div
                  className="absolute inset-[-2px] rounded-full border border-current opacity-30"
                  style={{ color: agent.color }}
                />
              )}
            </div>
            <span className="text-[11px] text-gray-400 font-medium">{agent.name}</span>
          </div>
        ) : (
          <span className="text-[11px] text-gray-600 italic">Unassigned</span>
        )}

        <div className="flex items-center gap-2">
          {/* Comment count badge */}
          {task.commentCount > 0 && (
            <span
              className="flex items-center gap-0.5 text-[9px] text-gray-500 hover:text-gray-300 transition-colors"
              title={`${task.commentCount} comment${task.commentCount !== 1 ? 's' : ''}`}
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="font-mono">{task.commentCount}</span>
            </span>
          )}
          {/* Age badge removed — relative time is sufficient */}
          <TaskTimeInline task={task} />
          {/* Relative time (full density) */}
          {relativeTime && (
            <span className="text-[8px] text-gray-600 font-mono tabular-nums shrink-0" title={exactDateTooltip}>
              {relativeTime}
            </span>
          )}
        </div>
      </div>

      {/* Link icons for Drive/Canva (especially visible on Done tasks) */}
      {(hasDriveLink || hasCanvaLink) && (
        <div className="flex gap-2 mt-2 pt-2 border-t border-dark-500">
          {hasDriveLink && (
            <a
              href={task.driveLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="link-btn flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20"
              title="Open in Google Drive"
            >
              <DriveIcon />
              <span>Drive</span>
            </a>
          )}
          {hasCanvaLink && (
            <a
              href={task.canvaLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="link-btn flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 border border-purple-500/20"
              title="Open in Canva"
            >
              <CanvaIcon />
              <span>Canva</span>
            </a>
          )}
        </div>
      )}

      {/* Platform indicators (only show if no link row) */}
      {task.platform && task.platform.length > 0 && !hasDriveLink && !hasCanvaLink && (
        <div className="flex gap-1 mt-2 pt-2 border-t border-dark-500">
          {task.platform.map((p) => (
            <span key={p} className="text-[9px] px-1.5 py-0.5 rounded bg-dark-600 text-gray-500">
              {p}
            </span>
          ))}
        </div>
      )}

      {/* Review Actions — quick approve/feedback buttons */}
      {isReview && (
        <div className="flex gap-2 mt-2 pt-2 border-t border-dark-500">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onQuickApprove && onQuickApprove(task)
            }}
            className="action-btn flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold px-2 py-1.5 rounded bg-accent-green/10 text-accent-green hover:bg-accent-green/20 border border-accent-green/20 hover:shadow-[0_0_12px_rgba(34,197,94,0.15)]"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Approve
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRequestChanges ? onRequestChanges(task) : onClick()
            }}
            className="action-btn flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold px-2 py-1.5 rounded bg-accent-orange/10 text-accent-orange hover:bg-accent-orange/20 border border-accent-orange/20 hover:shadow-[0_0_12px_rgba(249,115,22,0.15)]"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Feedback
          </button>
        </div>
      )}

      {/* Failed/Error — Retry button */}
      {isFailed && (
        <div className="flex gap-2 mt-2 pt-2 border-t border-dark-500">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRetry && onRetry(task)
            }}
            className="action-btn flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold px-2 py-1.5 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 hover:shadow-[0_0_12px_rgba(239,68,68,0.15)]"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Retry Task
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClick && onClick()
            }}
            className="action-btn flex items-center justify-center gap-1 text-[10px] px-2 py-1.5 rounded bg-dark-600 text-gray-400 hover:text-gray-200 hover:bg-dark-500 border border-dark-500"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            Details
          </button>
        </div>
      )}
    </div>
  )
}

export default memo(TaskCard)
