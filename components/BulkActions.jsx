'use client'

import { useState, useCallback, useEffect } from 'react'

const STATUS_COLORS = {
  Inbox: '#6b7280',
  Assigned: '#eab308',
  'In Progress': '#3b82f6',
  Review: '#f97316',
  Done: '#22c55e',
}

/**
 * Bulk Actions Toolbar — appears when tasks are selected
 * Provides batch operations: approve, status change, assign, priority, delete
 * Features mini status distribution bar and keyboard shortcut support
 */
export default function BulkActions({ selectedIds, tasks, onApproveAll, onStatusChange, onAssign, onDeselectAll, onPriorityChange, onExportToDrive, agents = [] }) {
  const [showAssign, setShowAssign] = useState(false)
  const [showStatus, setShowStatus] = useState(false)
  const [showPriority, setShowPriority] = useState(false)
  const count = selectedIds.size

  // Close all dropdowns
  const closeAll = useCallback(() => {
    setShowAssign(false)
    setShowStatus(false)
    setShowPriority(false)
  }, [])

  // Escape key to deselect all
  useEffect(() => {
    if (count === 0) return
    const handler = (e) => {
      if (e.key === 'Escape') {
        closeAll()
        onDeselectAll?.()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [count, onDeselectAll, closeAll])

  // Click outside to close dropdowns
  useEffect(() => {
    if (!showAssign && !showStatus && !showPriority) return
    const handler = () => closeAll()
    const timer = setTimeout(() => window.addEventListener('click', handler), 0)
    return () => { clearTimeout(timer); window.removeEventListener('click', handler) }
  }, [showAssign, showStatus, showPriority, closeAll])

  if (count === 0) return null

  const selectedTasks = tasks.filter(t => selectedIds.has(t.id))
  const reviewTasks = selectedTasks.filter(t => t.status === 'Review')

  // Status distribution for mini bar
  const statusDist = selectedTasks.reduce((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1
    return acc
  }, {})

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] animate-slide-up">
      <div className="flex items-center gap-2 bg-dark-800/95 border border-dark-500/80 rounded-2xl shadow-2xl px-4 py-2.5 backdrop-blur-xl"
        style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05) inset' }}
      >
        {/* Count + Mini Status Distribution */}
        <div className="flex items-center gap-2 pr-3 border-r border-dark-500">
          <div className="w-6 h-6 rounded-full bg-accent-orange/20 border border-accent-orange/40 flex items-center justify-center">
            <span className="text-[11px] font-bold text-accent-orange tabular-nums">{count}</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-400 leading-none">selected</span>
            {/* Mini status distribution bar */}
            <div className="flex h-1 w-16 rounded-full overflow-hidden bg-dark-600">
              {Object.entries(statusDist).map(([status, n]) => (
                <div
                  key={status}
                  style={{
                    width: `${(n / count) * 100}%`,
                    backgroundColor: STATUS_COLORS[status] || '#6b7280',
                  }}
                  title={`${status}: ${n}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Approve All (only if review tasks selected) */}
        {reviewTasks.length > 0 && onApproveAll && (
          <button
            onClick={() => { closeAll(); onApproveAll(reviewTasks.map(t => t.id)) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-accent-green/10 text-accent-green border border-accent-green/20 hover:bg-accent-green/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            Approve{reviewTasks.length > 1 ? ` (${reviewTasks.length})` : ''}
          </button>
        )}

        {/* Change Status */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => { setShowStatus(!showStatus); setShowAssign(false); setShowPriority(false) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all hover:scale-[1.02] active:scale-[0.98] ${
              showStatus ? 'bg-accent-blue/15 text-accent-blue border-accent-blue/30' : 'bg-dark-600 text-gray-300 border-dark-500 hover:bg-dark-500'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
              <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
            Status
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`transition-transform ${showStatus ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {showStatus && (
            <div className="absolute bottom-full mb-2 left-0 bg-dark-700/95 backdrop-blur-lg border border-dark-500 rounded-xl shadow-xl p-1 min-w-[140px] animate-slide-down">
              {['Inbox', 'Assigned', 'In Progress', 'Review', 'Done'].map(status => (
                <button
                  key={status}
                  onClick={() => { onStatusChange?.(Array.from(selectedIds), status); setShowStatus(false) }}
                  className="w-full text-left text-[11px] px-3 py-1.5 rounded-lg hover:bg-dark-600 text-gray-300 transition-colors flex items-center gap-2"
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[status] }} />
                  {status}
                  {statusDist[status] && (
                    <span className="ml-auto text-[9px] text-gray-600 tabular-nums">{statusDist[status]}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Priority Change */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => { setShowPriority(!showPriority); setShowAssign(false); setShowStatus(false) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all hover:scale-[1.02] active:scale-[0.98] ${
              showPriority ? 'bg-accent-orange/15 text-accent-orange border-accent-orange/30' : 'bg-dark-600 text-gray-300 border-dark-500 hover:bg-dark-500'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
              <line x1="4" y1="22" x2="4" y2="15"/>
            </svg>
            Priority
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`transition-transform ${showPriority ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {showPriority && (
            <div className="absolute bottom-full mb-2 left-0 bg-dark-700/95 backdrop-blur-lg border border-dark-500 rounded-xl shadow-xl p-1 min-w-[120px] animate-slide-down">
              {[
                { value: 'high', label: 'High', color: 'text-red-400', dot: 'bg-red-400' },
                { value: 'medium', label: 'Medium', color: 'text-yellow-400', dot: 'bg-yellow-400' },
                { value: 'low', label: 'Low', color: 'text-gray-400', dot: 'bg-gray-400' },
              ].map(p => (
                <button
                  key={p.value}
                  onClick={() => { onPriorityChange?.(Array.from(selectedIds), p.value); setShowPriority(false) }}
                  className={`w-full text-left text-[11px] px-3 py-1.5 rounded-lg hover:bg-dark-600 ${p.color} transition-colors flex items-center gap-2`}
                >
                  <div className={`w-2 h-2 rounded-full ${p.dot}`} />
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Assign Agent */}
        <div className="relative" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => { setShowAssign(!showAssign); setShowStatus(false); setShowPriority(false) }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold border transition-all hover:scale-[1.02] active:scale-[0.98] ${
              showAssign ? 'bg-accent-purple/15 text-accent-purple border-accent-purple/30' : 'bg-dark-600 text-gray-300 border-dark-500 hover:bg-dark-500'
            }`}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
            Assign
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`transition-transform ${showAssign ? 'rotate-180' : ''}`}>
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
          {showAssign && (
            <div className="absolute bottom-full mb-2 left-0 bg-dark-700/95 backdrop-blur-lg border border-dark-500 rounded-xl shadow-xl p-1 min-w-[160px] max-h-[200px] overflow-y-auto animate-slide-down">
              {agents.map(agent => (
                <button
                  key={agent.name}
                  onClick={() => { onAssign?.(Array.from(selectedIds), agent.name); setShowAssign(false) }}
                  className="w-full text-left text-[11px] px-3 py-1.5 rounded-lg hover:bg-dark-600 text-gray-300 transition-colors flex items-center gap-2"
                >
                  <span>{agent.emoji}</span>
                  <span>{agent.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Export to Drive (only tasks with output) */}
        {onExportToDrive && selectedTasks.some(t => t.output) && (
          <button
            onClick={() => { closeAll(); onExportToDrive(selectedTasks.filter(t => t.output).map(t => t.id)) }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-dark-600 text-gray-300 border border-dark-500 hover:bg-dark-500 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="17 8 12 3 7 8"/>
              <line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            Drive
            <span className="text-[9px] text-gray-500">({selectedTasks.filter(t => t.output).length})</span>
          </button>
        )}

        {/* Divider + Deselect */}
        <div className="w-px h-5 bg-dark-500" />
        <button
          onClick={() => { closeAll(); onDeselectAll?.() }}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-semibold text-gray-500 hover:text-gray-300 hover:bg-dark-600/50 transition-all"
          title="Deselect all (Esc)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          <span className="hidden sm:inline">Clear</span>
          <kbd className="hidden lg:inline text-[8px] px-1 py-0.5 rounded bg-dark-600 text-gray-600 font-mono border border-dark-500">esc</kbd>
        </button>
      </div>
    </div>
  )
}

/**
 * Hook for managing task selection state
 * @returns {{ selectedIds, toggleSelect, selectAll, deselectAll, isSelected }}
 */
export function useTaskSelection() {
  const [selectedIds, setSelectedIds] = useState(new Set())

  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const selectAll = useCallback((ids) => {
    setSelectedIds(new Set(ids))
  }, [])

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  const isSelected = useCallback((id) => {
    return selectedIds.has(id)
  }, [selectedIds])

  return { selectedIds, toggleSelect, selectAll, deselectAll, isSelected }
}
