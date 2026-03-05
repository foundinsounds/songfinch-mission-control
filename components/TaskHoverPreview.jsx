'use client'

import { useState, useRef, useEffect, useCallback } from 'react'

const PLATFORM_BADGES = {
  Instagram: { icon: '📸', color: 'bg-pink-500/15 text-pink-400 border-pink-500/20' },
  Facebook: { icon: '📘', color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  TikTok: { icon: '🎵', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20' },
  Twitter: { icon: '🐦', color: 'bg-sky-500/15 text-sky-400 border-sky-500/20' },
  LinkedIn: { icon: '💼', color: 'bg-blue-600/15 text-blue-300 border-blue-600/20' },
  YouTube: { icon: '🎬', color: 'bg-red-500/15 text-red-400 border-red-500/20' },
  Email: { icon: '📧', color: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
  Blog: { icon: '📝', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20' },
}

const STATUS_DOTS = {
  Inbox: '#6b7280',
  Assigned: '#eab308',
  'In Progress': '#3b82f6',
  Review: '#f97316',
  Done: '#22c55e',
}

/**
 * TaskHoverPreview — floating tooltip card for ListView rows
 * Shows: output snippet, platform badges, priority, agent, campaign
 * Appears after a short delay to avoid flickering during quick scrolls
 */
export default function TaskHoverPreview({ task, anchorRect, containerRef }) {
  const cardRef = useRef(null)
  const [pos, setPos] = useState({ top: 0, left: 0, arrowSide: 'left' })

  // Calculate position relative to viewport
  useEffect(() => {
    if (!anchorRect || !cardRef.current) return
    const card = cardRef.current.getBoundingClientRect()
    const viewportW = window.innerWidth
    const viewportH = window.innerHeight

    let top = anchorRect.top + anchorRect.height / 2 - card.height / 2
    let left = anchorRect.right + 12
    let arrowSide = 'left'

    // If overflows right, show on left side
    if (left + card.width > viewportW - 16) {
      left = anchorRect.left - card.width - 12
      arrowSide = 'right'
    }

    // Clamp vertical position
    if (top < 8) top = 8
    if (top + card.height > viewportH - 8) top = viewportH - card.height - 8

    setPos({ top, left, arrowSide })
  }, [anchorRect])

  if (!task) return null

  const output = task.output || ''
  const hasOutput = output.length > 0
  const snippet = hasOutput
    ? output.replace(/[#*_~`>\[\]]/g, '').slice(0, 200).trim()
    : null

  const platforms = Array.isArray(task.platform)
    ? task.platform
    : task.platform
      ? [task.platform]
      : []

  const wordCount = hasOutput ? output.split(/\s+/).filter(Boolean).length : 0
  const readingTime = Math.max(1, Math.ceil(wordCount / 200))

  return (
    <div
      ref={cardRef}
      className="fixed z-[200] pointer-events-none animate-fade-in"
      style={{ top: pos.top, left: pos.left }}
    >
      <div className="bg-dark-800/98 border border-dark-500/80 rounded-xl shadow-2xl backdrop-blur-xl w-[320px] overflow-hidden"
        style={{ boxShadow: '0 12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset' }}
      >
        {/* Header — status dot + name */}
        <div className="px-3 pt-3 pb-2 border-b border-dark-500/50">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: STATUS_DOTS[task.status] || '#6b7280' }} />
            <div className="text-[12px] font-semibold text-gray-100 line-clamp-1 leading-tight">
              {task.name}
            </div>
          </div>
          {task.campaign && (
            <div className="text-[10px] text-gray-500 mt-1 ml-4">
              {task.campaign}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="px-3 py-2 space-y-2">
          {/* Platform badges */}
          {platforms.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {platforms.map(p => {
                const badge = PLATFORM_BADGES[p]
                return (
                  <span key={p} className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${badge?.color || 'bg-dark-600 text-gray-400 border-dark-500'}`}>
                    {badge?.icon} {p}
                  </span>
                )
              })}
            </div>
          )}

          {/* Output snippet */}
          {snippet ? (
            <div className="bg-dark-700/50 rounded-lg p-2 border border-dark-500/30">
              <div className="text-[10px] text-gray-300 leading-relaxed line-clamp-4">
                {snippet}{output.length > 200 ? '...' : ''}
              </div>
              <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-dark-500/30">
                <span className="text-[9px] text-gray-500">{wordCount} words</span>
                <span className="text-[9px] text-gray-600">&middot;</span>
                <span className="text-[9px] text-gray-500">{readingTime} min read</span>
              </div>
            </div>
          ) : (
            <div className="text-[10px] text-gray-600 italic py-1">
              No output yet
            </div>
          )}

          {/* Metadata row */}
          <div className="flex items-center gap-2 flex-wrap">
            {task.contentType && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-dark-600 text-gray-400 border border-dark-500/50">
                {task.contentType}
              </span>
            )}
            {task.priority && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded border font-semibold ${
                task.priority === 'High' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                task.priority === 'Medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                'bg-gray-500/10 text-gray-400 border-gray-500/20'
              }`}>
                {task.priority}
              </span>
            )}
            {task.driveLink && (
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                📂 Drive
              </span>
            )}
          </div>
        </div>

        {/* Footer hint */}
        <div className="px-3 py-1.5 bg-dark-700/30 border-t border-dark-500/30">
          <span className="text-[9px] text-gray-600">Click to open full details</span>
        </div>
      </div>
    </div>
  )
}

/**
 * useHoverPreview — hook for managing hover preview state
 * Features: delay before showing (avoids flicker), immediate hide on leave
 */
export function useHoverPreview(delay = 400) {
  const [hoveredTask, setHoveredTask] = useState(null)
  const [anchorRect, setAnchorRect] = useState(null)
  const timerRef = useRef(null)
  const activeIdRef = useRef(null)

  const handleMouseEnter = useCallback((task, event) => {
    const id = task.id
    activeIdRef.current = id

    // Clear any pending hide/show
    if (timerRef.current) clearTimeout(timerRef.current)

    // Delay show to avoid flickering
    timerRef.current = setTimeout(() => {
      if (activeIdRef.current === id) {
        const row = event.currentTarget
        if (row) {
          setAnchorRect(row.getBoundingClientRect())
          setHoveredTask(task)
        }
      }
    }, delay)
  }, [delay])

  const handleMouseLeave = useCallback(() => {
    activeIdRef.current = null
    if (timerRef.current) clearTimeout(timerRef.current)
    setHoveredTask(null)
    setAnchorRect(null)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  return { hoveredTask, anchorRect, handleMouseEnter, handleMouseLeave }
}
