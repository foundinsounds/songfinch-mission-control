'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import TaskCard from './TaskCard'
import { SkeletonColumn } from './TaskCardSkeleton'
import { playDropSound } from '../lib/sounds'

/**
 * WipToast — Ephemeral warning toast that appears when a column exceeds
 * its WIP limit. Auto-dismisses after 4 seconds with a shrinking progress bar.
 */
function WipToast({ toast, onDismiss }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border shadow-xl animate-slide-in-right backdrop-blur-md"
      style={{
        background: toast.level === 'over' ? 'rgba(239, 68, 68, 0.12)' : 'rgba(234, 179, 8, 0.12)',
        borderColor: toast.level === 'over' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(234, 179, 8, 0.3)',
      }}
    >
      <span className="text-sm mt-0.5">{toast.level === 'over' ? '🚨' : '⚠️'}</span>
      <div className="flex-1 min-w-0">
        <div className={`text-[11px] font-semibold ${toast.level === 'over' ? 'text-red-400' : 'text-yellow-400'}`}>
          {toast.level === 'over' ? 'Over WIP Limit' : 'At WIP Limit'}
        </div>
        <div className="text-[10px] text-gray-400 mt-0.5">
          {toast.column} has {toast.count}/{toast.limit} tasks
        </div>
        {/* Shrinking progress bar */}
        <div className="mt-1.5 h-[2px] rounded-full overflow-hidden bg-dark-600">
          <div
            className={`h-full rounded-full ${toast.level === 'over' ? 'bg-red-500' : 'bg-yellow-500'}`}
            style={{ animation: 'wip-toast-shrink 4s linear forwards' }}
          />
        </div>
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-gray-600 hover:text-gray-400 transition-colors mt-0.5 shrink-0"
        aria-label="Dismiss WIP warning"
      >
        <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  )
}

/**
 * ColumnContextMenu — Kebab "⋯" dropdown with column-level actions:
 * sort options, select all, collapse, and move-all-to sub-menu.
 * Closes on outside click via a useEffect listener.
 */
function ColumnContextMenu({ columnKey, columnLabel, onSort, onCollapse, onSelectAll, onMoveAll, taskCount, isCollapsed }) {
  const [isOpen, setIsOpen] = useState(false)
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false)
  const menuRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false)
        setShowMoveSubmenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setShowMoveSubmenu(false)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen])

  const moveTargets = COLUMNS.filter(c => c.key !== columnKey)

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen(!isOpen)
          setShowMoveSubmenu(false)
        }}
        className="text-gray-600 hover:text-gray-400 transition-colors p-0.5 rounded hover:bg-white/[0.05]"
        title={`${columnLabel} options`}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="12" cy="5" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="12" cy="19" r="2" />
        </svg>
      </button>

      {isOpen && (
        <div className="ctx-menu absolute right-0 top-full mt-1 w-48 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl py-1.5 z-50" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
          {/* Sort options */}
          <div className="px-3 py-1 text-[9px] text-gray-600 uppercase tracking-wider font-semibold">Sort by</div>
          <button className="ctx-menu-item w-full text-left" onClick={() => { onSort('priority'); setIsOpen(false) }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
            Priority
          </button>
          <button className="ctx-menu-item w-full text-left" onClick={() => { onSort('date'); setIsOpen(false) }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            Date created
          </button>
          <button className="ctx-menu-item w-full text-left" onClick={() => { onSort('name'); setIsOpen(false) }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="14" y2="15"/></svg>
            Name A → Z
          </button>
          <button className="ctx-menu-item w-full text-left" onClick={() => { onSort('agent'); setIsOpen(false) }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            Agent
          </button>

          <div className="ctx-menu-divider" />

          {/* Actions */}
          {taskCount > 0 && (
            <button className="ctx-menu-item w-full text-left" onClick={() => { onSelectAll(); setIsOpen(false) }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
              Select all ({taskCount})
            </button>
          )}

          <button className="ctx-menu-item w-full text-left" onClick={() => { onCollapse(); setIsOpen(false) }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {isCollapsed
                ? <><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></>
                : <><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></>
              }
            </svg>
            {isCollapsed ? 'Expand column' : 'Collapse column'}
          </button>

          {/* Move all sub-menu */}
          {taskCount > 0 && (
            <>
              <div className="ctx-menu-divider" />
              <div className="relative">
                <button
                  className="ctx-menu-item w-full text-left justify-between"
                  onClick={() => setShowMoveSubmenu(!showMoveSubmenu)}
                >
                  <span className="flex items-center gap-2.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"/><line x1="21" y1="3" x2="10" y2="14"/><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5"/></svg>
                    Move all to…
                  </span>
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="9 6 15 12 9 18"/></svg>
                </button>
                {showMoveSubmenu && (
                  <div className="ctx-menu ml-1 mt-0.5 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl py-1.5" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}>
                    {moveTargets.map(target => (
                      <button
                        key={target.key}
                        className="ctx-menu-item w-full text-left"
                        onClick={() => { onMoveAll(target.key); setIsOpen(false); setShowMoveSubmenu(false) }}
                      >
                        <span className={`w-2 h-2 rounded-full ${target.dotColor}`} />
                        {target.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const COLUMNS = [
  { key: 'Inbox', label: 'INBOX', dotColor: 'bg-gray-500', icon: '📥', barColor: '#6b7280', wipLimit: null },
  { key: 'Assigned', label: 'ASSIGNED', dotColor: 'bg-accent-yellow', icon: '📋', barColor: '#eab308', wipLimit: 5 },
  { key: 'In Progress', label: 'IN PROGRESS', dotColor: 'bg-accent-blue', icon: '⚡', barColor: '#3b82f6', wipLimit: 4 },
  { key: 'Review', label: 'REVIEW', dotColor: 'bg-accent-orange', icon: '🔍', barColor: '#f97316', wipLimit: 3 },
  { key: 'Done', label: 'DONE', dotColor: 'bg-accent-green', icon: '✅', barColor: '#22c55e', wipLimit: null },
  { key: 'Revisit', label: 'REVISIT', dotColor: 'bg-violet-500', icon: '🔄', barColor: '#8b5cf6', wipLimit: null, isParking: true },
]

const PRIORITY_SORT = { high: 0, medium: 1, low: 2 }

// Empty state config per column
const EMPTY_STATES = {
  Inbox: {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-gray-600">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
    ),
    title: 'Inbox clear',
    hint: 'New tasks will appear here',
  },
  Assigned: {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-gray-600">
        <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
      </svg>
    ),
    title: 'None assigned',
    hint: 'Assign agents to tasks',
  },
  'In Progress': {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-gray-600">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    title: 'All quiet',
    hint: 'Agents will pick up work soon',
  },
  Review: {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-gray-600">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    title: 'Nothing to review',
    hint: 'Completed work appears here',
  },
  Done: {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-gray-600">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    title: 'No completed tasks',
    hint: 'Approved work is archived here',
  },
  Revisit: {
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="text-gray-600">
        <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
      </svg>
    ),
    title: 'Parking lot empty',
    hint: 'Parked tasks — agents ignore these',
  },
}

/**
 * AnimatedCount — Bounces when the count changes.
 * Uses a key-based remount to trigger CSS animation on each value change.
 */
function AnimatedCount({ value, wipLimit }) {
  const [displayValue, setDisplayValue] = useState(value)
  const [animate, setAnimate] = useState(false)
  const prevRef = useRef(value)

  useEffect(() => {
    if (prevRef.current !== value) {
      setAnimate(true)
      setDisplayValue(value)
      prevRef.current = value
      const timer = setTimeout(() => setAnimate(false), 300)
      return () => clearTimeout(timer)
    }
  }, [value])

  return (
    <span
      className={`inline-flex items-center transition-transform duration-300 ${animate ? 'animate-count-bounce' : ''}`}
    >
      {displayValue}{wipLimit ? `/${wipLimit}` : ''}
    </span>
  )
}

/**
 * InlineQuickAdd — A compact inline input at the bottom of each column
 * for quickly adding tasks with a specific status.
 */
function InlineQuickAdd({ columnStatus, onCreateTask }) {
  const [isOpen, setIsOpen] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const handleSubmit = () => {
    const name = value.trim()
    if (!name) return
    onCreateTask({ name, status: columnStatus, priority: 'Medium' })
    setValue('')
    // Keep open for rapid entry
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape') {
      setValue('')
      setIsOpen(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-gray-600 hover:text-gray-400 hover:bg-dark-700/50 rounded-lg transition-colors group"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-50 group-hover:opacity-100 transition-opacity">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        <span>Add task</span>
      </button>
    )
  }

  return (
    <div className="px-2 pb-2">
      <div className="flex items-center gap-1.5 bg-dark-700/80 border border-dark-500/80 rounded-lg px-2 py-1 focus-within:border-accent-orange/40 focus-within:ring-1 focus-within:ring-accent-orange/20 transition-all">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-gray-600 shrink-0">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => { if (!value.trim()) setIsOpen(false) }}
          placeholder="Task name..."
          aria-label={`New task name for ${columnStatus} column`}
          className="flex-1 bg-transparent text-[11px] text-gray-200 placeholder-gray-600 outline-none py-0.5"
        />
        {value.trim() && (
          <button
            onClick={handleSubmit}
            className="text-accent-orange hover:text-accent-orange/80 transition-colors"
            aria-label="Add task"
          >
            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1 px-1">
        <span className="text-[9px] text-gray-700">Enter to add • Esc to cancel</span>
      </div>
    </div>
  )
}

export default function KanbanBoard({ tasks, agents = [], onTaskClick, onQuickApprove, onRequestChanges, onRetry, onStatusChange, selectedAgent, onNewTask, isTaskSelected, onToggleTaskSelect, allTasks = [], focusedTaskId, loading = false, onCreateTask, searchQuery = '', onReorderTasks, onTaskContextMenu }) {
  const [agentFilter, setAgentFilter] = useState(selectedAgent || null)
  const [sortByPriority, setSortByPriority] = useState(false)
  const [density, setDensity] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('roundtable-density') || 'comfortable'
    }
    return 'comfortable'
  })
  const [compactMode, setCompactMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('roundtable-density') || 'comfortable'
      return saved !== 'comfortable'
    }
    return false
  })
  const [draggedTaskId, setDraggedTaskId] = useState(null)
  const [draggedTaskSourceCol, setDraggedTaskSourceCol] = useState(null)
  const [dragOverColumn, setDragOverColumn] = useState(null)
  const [dragOverCardIndex, setDragOverCardIndex] = useState(null)
  const [dragOverCardColumn, setDragOverCardColumn] = useState(null)
  const [customOrder, setCustomOrder] = useState({})
  const [scrolledColumns, setScrolledColumns] = useState({})
  const [collapsedColumns, setCollapsedColumns] = useState(() => {
    try {
      const saved = localStorage.getItem('kanban-collapsed-columns')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  const [columnSorts, setColumnSorts] = useState({}) // per-column sort: { [colKey]: 'priority'|'date'|'name'|'agent' }
  const [wipToasts, setWipToasts] = useState([])
  // Per-column visible task limits — start at PAGE_SIZE, expand with "Show more"
  const COLUMN_PAGE_SIZE = 50
  const [columnLimits, setColumnLimits] = useState({})
  const scrollRefs = useRef({})
  const wipToastIdRef = useRef(0)

  // Column reorder state
  const [columnOrder, setColumnOrder] = useState(() => {
    try {
      const saved = localStorage.getItem('kanban-column-order')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Validate: ensure all COLUMNS keys are present
        const allKeys = COLUMNS.map(c => c.key)
        if (parsed.length === allKeys.length && allKeys.every(k => parsed.includes(k))) {
          return parsed
        }
      }
    } catch {}
    return COLUMNS.map(c => c.key)
  })
  const [draggedColumnKey, setDraggedColumnKey] = useState(null)
  const [columnDropTarget, setColumnDropTarget] = useState(null)

  // Save density to localStorage when changed
  useEffect(() => {
    localStorage.setItem('roundtable-density', density)
  }, [density])

  // Persist column order
  const saveColumnOrder = useCallback((newOrder) => {
    setColumnOrder(newOrder)
    try { localStorage.setItem('kanban-column-order', JSON.stringify(newOrder)) } catch {}
  }, [])

  // Column drag handlers
  const handleColumnDragStart = useCallback((e, columnKey) => {
    e.stopPropagation()
    setDraggedColumnKey(columnKey)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('application/x-column-drag', columnKey)
    // Fade the column being dragged
    setTimeout(() => {
      const el = e.target.closest('.kanban-column')
      if (el) el.style.opacity = '0.4'
    }, 0)
  }, [])

  const handleColumnDragEnd = useCallback((e) => {
    setDraggedColumnKey(null)
    setColumnDropTarget(null)
    const el = e.target.closest('.kanban-column')
    if (el) el.style.opacity = '1'
  }, [])

  const handleColumnDragOver = useCallback((e, columnKey) => {
    // Only handle column drags, not task drags
    if (!e.dataTransfer.types.includes('application/x-column-drag')) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    if (columnKey !== draggedColumnKey) {
      setColumnDropTarget(columnKey)
    }
  }, [draggedColumnKey])

  const handleColumnDrop = useCallback((e, columnKey) => {
    if (!e.dataTransfer.types.includes('application/x-column-drag')) return
    e.preventDefault()
    e.stopPropagation()
    const sourceKey = e.dataTransfer.getData('application/x-column-drag')
    if (!sourceKey || sourceKey === columnKey) {
      setColumnDropTarget(null)
      return
    }

    // Reorder: move sourceKey to the position of columnKey
    const newOrder = [...columnOrder]
    const fromIdx = newOrder.indexOf(sourceKey)
    const toIdx = newOrder.indexOf(columnKey)
    if (fromIdx === -1 || toIdx === -1) return
    newOrder.splice(fromIdx, 1)
    newOrder.splice(toIdx, 0, sourceKey)
    playDropSound()
    saveColumnOrder(newOrder)
    setDraggedColumnKey(null)
    setColumnDropTarget(null)
  }, [columnOrder, saveColumnOrder])

  // Reset column order to default
  const resetColumnOrder = useCallback(() => {
    saveColumnOrder(COLUMNS.map(c => c.key))
  }, [saveColumnOrder])

  // Ordered columns for rendering
  const orderedColumns = useMemo(() => {
    return columnOrder.map(key => COLUMNS.find(c => c.key === key)).filter(Boolean)
  }, [columnOrder])

  // Fire a WIP limit warning toast for a given column
  const fireWipToast = useCallback((columnKey, newCount) => {
    const col = COLUMNS.find(c => c.key === columnKey)
    if (!col?.wipLimit) return
    if (newCount < col.wipLimit) return
    const level = newCount > col.wipLimit ? 'over' : 'at'
    const id = ++wipToastIdRef.current
    setWipToasts(prev => [...prev.slice(-3), { id, column: col.label, count: newCount, limit: col.wipLimit, level }])
  }, [])

  const dismissWipToast = useCallback((toastId) => {
    setWipToasts(prev => prev.filter(t => t.id !== toastId))
  }, [])

  const toggleCollapse = useCallback((key) => {
    setCollapsedColumns(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem('kanban-collapsed-columns', JSON.stringify(next)) } catch {}
      return next
    })
  }, [])

  // Per-column sort toggle
  const setColumnSort = useCallback((colKey, sortType) => {
    setColumnSorts(prev => ({
      ...prev,
      [colKey]: prev[colKey] === sortType ? null : sortType
    }))
  }, [])

  // Select all tasks in a column
  const selectAllInColumn = useCallback((columnTasks) => {
    if (!onToggleTaskSelect) return
    columnTasks.forEach(task => {
      if (!isTaskSelected?.(task.id)) {
        onToggleTaskSelect(task.id)
      }
    })
  }, [onToggleTaskSelect, isTaskSelected])

  // Move all tasks in one column to another
  const moveAllTasks = useCallback((columnTasks, targetStatus) => {
    if (!onStatusChange) return
    const movingCount = columnTasks.filter(t => t.status !== targetStatus).length
    columnTasks.forEach(task => {
      if (task.status !== targetStatus) {
        onStatusChange(task, targetStatus)
      }
    })
    // Check WIP limit on the target column after batch move
    const currentTargetCount = tasks.filter(t => t.status === targetStatus).length
    fireWipToast(targetStatus, currentTargetCount + movingCount)
  }, [onStatusChange, tasks, fireWipToast])

  // Track which columns have been scrolled for sticky header shadow
  const handleColumnScroll = useCallback((columnKey, e) => {
    const scrollTop = e.target.scrollTop
    setScrolledColumns(prev => {
      const isScrolled = scrollTop > 4
      if (prev[columnKey] === isScrolled) return prev
      return { ...prev, [columnKey]: isScrolled }
    })
  }, [])

  // Load custom order from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('kanban-card-order')
      if (saved) setCustomOrder(JSON.parse(saved))
    } catch {}
  }, [])

  // Persist custom order
  const saveCustomOrder = useCallback((newOrder) => {
    setCustomOrder(newOrder)
    try { localStorage.setItem('kanban-card-order', JSON.stringify(newOrder)) } catch {}
  }, [])

  // Drag-and-drop handlers
  const handleDragStart = useCallback((e, task) => {
    setDraggedTaskId(task.id)
    setDraggedTaskSourceCol(task.status)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', task.id)
    e.dataTransfer.setData('application/x-source-column', task.status)
    if (e.target) {
      setTimeout(() => { e.target.style.opacity = '0.4' }, 0)
    }
  }, [])

  const handleDragEnd = useCallback((e) => {
    setDraggedTaskId(null)
    setDraggedTaskSourceCol(null)
    setDragOverColumn(null)
    setDragOverCardIndex(null)
    setDragOverCardColumn(null)
    if (e.target) e.target.style.opacity = '1'
  }, [])

  const handleDragOver = useCallback((e, columnKey) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnKey)
  }, [])

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null)
    setDragOverCardIndex(null)
    setDragOverCardColumn(null)
  }, [])

  // Card-level drag over for intra-column reorder
  const handleCardDragOver = useCallback((e, columnKey, index) => {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    setDragOverColumn(columnKey)

    // Determine top/bottom half of the card
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const insertIndex = e.clientY < midY ? index : index + 1
    setDragOverCardIndex(insertIndex)
    setDragOverCardColumn(columnKey)
  }, [])

  const handleDrop = useCallback((e, columnKey) => {
    e.preventDefault()
    setDragOverColumn(null)
    setDragOverCardIndex(null)
    setDragOverCardColumn(null)
    const taskId = e.dataTransfer.getData('text/plain')
    const sourceColumn = e.dataTransfer.getData('application/x-source-column')
    if (!taskId) return

    const task = tasks.find(t => t.id === taskId)
    if (!task) return

    // Same column → reorder
    if (task.status === columnKey && dragOverCardIndex !== null) {
      const columnTaskIds = (customOrder[columnKey] || []).slice()
      // Get current column task ids (fill in any missing)
      const currentColTasks = tasks.filter(t => t.status === columnKey)
      const orderedIds = columnTaskIds.length > 0
        ? [...columnTaskIds, ...currentColTasks.filter(t => !columnTaskIds.includes(t.id)).map(t => t.id)]
        : currentColTasks.map(t => t.id)

      // Remove the dragged task from current position
      const fromIdx = orderedIds.indexOf(taskId)
      if (fromIdx !== -1) orderedIds.splice(fromIdx, 1)

      // Insert at the new position
      const insertAt = Math.min(dragOverCardIndex, orderedIds.length)
      orderedIds.splice(insertAt > fromIdx ? insertAt - 1 : insertAt, 0, taskId)

      playDropSound()
      saveCustomOrder({ ...customOrder, [columnKey]: orderedIds })

      // Notify parent of reorder
      if (onReorderTasks) {
        onReorderTasks(columnKey, orderedIds)
      }
      return
    }

    // Different column → status change
    if (task.status !== columnKey && onStatusChange) {
      playDropSound()
      onStatusChange(task, columnKey)
      // Check WIP limit on the target column
      const targetCount = tasks.filter(t => t.status === columnKey).length + 1
      fireWipToast(columnKey, targetCount)
    }
  }, [tasks, onStatusChange, dragOverCardIndex, customOrder, saveCustomOrder, fireWipToast, onReorderTasks])

  const visibleTasks = agentFilter
    ? tasks.filter(t => t.agent === agentFilter)
    : tasks

  // Get unique agents from tasks
  const taskAgents = [...new Set(tasks.map(t => t.agent).filter(Boolean))].sort()

  // Pipeline progress calculation
  const pipelineStats = useMemo(() => {
    const total = visibleTasks.length || 1
    return COLUMNS.reduce((acc, col) => {
      const count = visibleTasks.filter(t => t.status === col.key).length
      acc[col.key] = { count, pct: Math.round((count / total) * 100) }
      return acc
    }, {})
  }, [visibleTasks])

  return (
    <div className="flex flex-col h-full">
      {/* Filter + Controls Bar */}
      <div className="px-4 py-2 border-b border-dark-500 flex items-center gap-1.5 shrink-0 bg-dark-800/30 overflow-x-auto">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mr-1 shrink-0">Agent:</span>
        <button
          onClick={() => setAgentFilter(null)}
          className={`text-[10px] px-2 py-1 rounded-md transition-all shrink-0 ${
            !agentFilter
              ? 'bg-white/10 text-white font-semibold'
              : 'text-gray-500 hover:text-gray-300 hover:bg-dark-600'
          }`}
        >
          All
        </button>
        {taskAgents.map(name => {
          const agent = agents.find(a => a.name === name)
          return (
            <button
              key={name}
              onClick={() => setAgentFilter(agentFilter === name ? null : name)}
              className={`text-[10px] px-2 py-1 rounded-md transition-all shrink-0 flex items-center gap-1 ${
                agentFilter === name
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-dark-600'
              }`}
            >
              {agent?.emoji && <span className="text-xs">{agent.emoji}</span>}
              {name}
            </button>
          )
        })}

        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setSortByPriority(!sortByPriority)}
            className={`text-[10px] px-2 py-1 rounded-md transition-all flex items-center gap-1 ${
              sortByPriority ? 'bg-accent-orange/15 text-accent-orange' : 'text-gray-600 hover:text-gray-400'
            }`}
            title="Sort by priority"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
            </svg>
            Priority
          </button>
          {/* Density Toggle */}
          <div className="flex items-center gap-0.5 bg-dark-700 rounded-lg p-0.5 border border-dark-500">
            {[
              { value: 'comfortable', title: 'Comfortable', icon: (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="1" y="1" width="14" height="4" rx="1" />
                  <rect x="1" y="7" width="14" height="4" rx="1" />
                  <rect x="1" y="13" width="14" height="2" rx="0.5" opacity="0.4" />
                </svg>
              )},
              { value: 'compact', title: 'Compact', icon: (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="1" y="1" width="14" height="3" rx="1" />
                  <rect x="1" y="6" width="14" height="3" rx="1" />
                  <rect x="1" y="11" width="14" height="3" rx="1" />
                </svg>
              )},
              { value: 'dense', title: 'Dense', icon: (
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="1" y1="2" x2="15" y2="2" />
                  <line x1="1" y1="5.5" x2="15" y2="5.5" />
                  <line x1="1" y1="9" x2="15" y2="9" />
                  <line x1="1" y1="12.5" x2="15" y2="12.5" />
                </svg>
              )},
            ].map(d => (
              <button
                key={d.value}
                onClick={() => {
                  setDensity(d.value)
                  setCompactMode(d.value !== 'comfortable')
                }}
                className={`px-1.5 py-1 rounded-md transition-all flex items-center justify-center ${
                  density === d.value
                    ? 'bg-accent-orange/20 text-accent-orange border border-accent-orange/30'
                    : 'text-gray-500 hover:text-gray-300 border border-transparent'
                }`}
                title={d.title}
              >
                {d.icon}
              </button>
            ))}
          </div>
          {/* Show reset column order button if columns have been reordered */}
          {columnOrder.join(',') !== COLUMNS.map(c => c.key).join(',') && (
            <button
              onClick={resetColumnOrder}
              className="text-[10px] px-2 py-1 rounded-md text-gray-600 hover:text-gray-400 hover:bg-dark-600 transition-all"
              title="Reset column order"
            >
              ↺
            </button>
          )}
          <span className="text-[10px] text-gray-600 font-mono">{visibleTasks.length} tasks</span>
        </div>
      </div>

      {/* Pipeline Progress Bar */}
      <div className="h-1 flex shrink-0">
        {COLUMNS.map(col => (
          <div
            key={col.key}
            style={{
              width: `${pipelineStats[col.key]?.pct || 0}%`,
              backgroundColor: col.barColor,
              transition: 'width 0.5s ease',
              minWidth: pipelineStats[col.key]?.count > 0 ? 4 : 0,
            }}
          />
        ))}
      </div>

      {/* Kanban columns */}
      <div className="flex gap-0 flex-1 overflow-hidden">
        {orderedColumns.map((col) => {
          let columnTasks = visibleTasks.filter(t => t.status === col.key)
          const isDoneColumn = col.key === 'Done'

          // Apply custom sort order if available (and not priority sort)
          if (!sortByPriority && customOrder[col.key] && customOrder[col.key].length > 0) {
            const order = customOrder[col.key]
            columnTasks = [...columnTasks].sort((a, b) => {
              const aIdx = order.indexOf(a.id)
              const bIdx = order.indexOf(b.id)
              if (aIdx === -1 && bIdx === -1) return 0
              if (aIdx === -1) return 1
              if (bIdx === -1) return -1
              return aIdx - bIdx
            })
          }

          // Sort by priority if enabled globally (overrides custom order)
          if (sortByPriority) {
            columnTasks = [...columnTasks].sort((a, b) =>
              (PRIORITY_SORT[a.priority] ?? 3) - (PRIORITY_SORT[b.priority] ?? 3)
            )
          }

          // Per-column sort (overrides global priority sort for this column)
          const colSort = columnSorts[col.key]
          if (colSort) {
            columnTasks = [...columnTasks].sort((a, b) => {
              switch (colSort) {
                case 'priority': return (PRIORITY_SORT[a.priority] ?? 3) - (PRIORITY_SORT[b.priority] ?? 3)
                case 'date': return (a.id || '').localeCompare(b.id || '') // Airtable IDs are chronological
                case 'name': return (a.name || '').localeCompare(b.name || '')
                case 'agent': return (a.agent || '').localeCompare(b.agent || '')
                default: return 0
              }
            })
          }

          const stats = pipelineStats[col.key]
          const isOverWip = col.wipLimit && columnTasks.length > col.wipLimit
          const isAtWip = col.wipLimit && columnTasks.length === col.wipLimit

          return (
            <div
              key={col.key}
              role="region"
              aria-label={`${col.label} column — ${columnTasks.length} task${columnTasks.length !== 1 ? 's' : ''}`}
              className={`kanban-column border-r border-dark-500 last:border-r-0 flex flex-col transition-all duration-300 ${
                collapsedColumns[col.key] ? 'min-w-[60px] max-w-[60px]' : 'flex-1 min-w-[240px]'
              } ${dragOverColumn === col.key && !draggedColumnKey ? 'kanban-dropzone-active ring-1 ring-inset ring-accent-orange/20' : ''
              } ${columnDropTarget === col.key ? 'ring-2 ring-inset ring-accent-blue/40 bg-accent-blue/5' : ''
              } ${draggedColumnKey === col.key ? 'opacity-40' : ''
              } ${isOverWip ? 'bg-red-500/[0.03]' : ''}`}
              onDragOver={(e) => {
                handleColumnDragOver(e, col.key)
                if (!e.dataTransfer.types.includes('application/x-column-drag')) {
                  handleDragOver(e, col.key)
                }
              }}
              onDragLeave={(e) => {
                if (!e.dataTransfer.types.includes('application/x-column-drag')) {
                  // Only clear if leaving the column entirely (not entering a child element)
                  const relatedTarget = e.relatedTarget
                  if (relatedTarget && e.currentTarget && e.currentTarget.contains(relatedTarget)) {
                    // Moving within the column, don't clear
                  } else {
                    setDragOverColumn(null)
                    setDragOverCardIndex(null)
                    setDragOverCardColumn(null)
                  }
                }
                setColumnDropTarget(null)
              }}
              onDrop={(e) => {
                if (e.dataTransfer.types.includes('application/x-column-drag')) {
                  handleColumnDrop(e, col.key)
                } else {
                  handleDrop(e, col.key)
                }
              }}
            >
              {/* Column Header — sticky with scroll shadow, draggable for reorder */}
              <div
                draggable
                onDragStart={(e) => handleColumnDragStart(e, col.key)}
                onDragEnd={handleColumnDragEnd}
                onDoubleClick={() => toggleCollapse(col.key)}
                className={`${collapsedColumns[col.key] ? 'px-2' : 'px-4'} py-3 border-b flex ${collapsedColumns[col.key] ? 'flex-col items-center gap-2' : 'items-center justify-between'} shrink-0 relative z-10 backdrop-blur-sm transition-shadow duration-200 cursor-grab active:cursor-grabbing select-none ${
                isOverWip ? 'bg-red-500/10 border-red-500/30' : isDoneColumn ? 'bg-accent-green/5 border-dark-500' : 'bg-dark-800/50 border-dark-500'
              } ${scrolledColumns[col.key] ? 'shadow-[0_4px_12px_rgba(0,0,0,0.3)]' : ''}`}>
                <div className={`flex items-center gap-2 ${collapsedColumns[col.key] ? 'flex-col' : ''}`}>
                  <div className={`w-2 h-2 rounded-full ${isOverWip ? 'bg-red-500 pulse-dot' : col.dotColor} ${col.key === 'In Progress' && !isOverWip ? 'pulse-dot' : ''}`}></div>
                  {!collapsedColumns[col.key] && (
                    <span className={`text-xs font-semibold tracking-wider ${isOverWip ? 'text-red-400' : isDoneColumn ? 'text-accent-green' : 'text-gray-300'}`}>
                      {col.label}
                    </span>
                  )}
                  {stats?.pct > 0 && (
                    <span className="text-[9px] text-gray-600 font-mono">{stats.pct}%</span>
                  )}
                  {isOverWip && (
                    <span className="text-[8px] text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20 font-semibold uppercase tracking-wider" title={`WIP limit: ${col.wipLimit}`}>
                      Over WIP
                    </span>
                  )}
                  {isAtWip && (
                    <span className="text-[8px] text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20 font-semibold uppercase tracking-wider" title={`WIP limit: ${col.wipLimit}`}>
                      At Limit
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                    isOverWip
                      ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                      : isDoneColumn
                        ? 'bg-accent-green/15 text-accent-green border border-accent-green/20'
                        : col.key === 'Review'
                          ? 'bg-accent-orange/15 text-accent-orange border border-accent-orange/20'
                          : col.key === 'In Progress'
                            ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/20'
                            : 'bg-dark-600 text-gray-500 border border-dark-500'
                  }`}>
                    <AnimatedCount value={columnTasks.length} wipLimit={col.wipLimit} />
                  </span>
                  {col.key === 'Inbox' && onNewTask && (
                    <button
                      onClick={onNewTask}
                      className="text-gray-600 hover:text-accent-orange transition-colors p-0.5"
                      title="Add new task"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={() => toggleCollapse(col.key)}
                    className="text-gray-600 hover:text-gray-400 transition-colors p-0.5"
                    title={collapsedColumns[col.key] ? 'Expand column' : 'Collapse column'}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform duration-200 ${collapsedColumns[col.key] ? '-rotate-90' : ''}`}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {!collapsedColumns[col.key] && (
                    <ColumnContextMenu
                      columnKey={col.key}
                      columnLabel={col.label}
                      taskCount={columnTasks.length}
                      isCollapsed={!!collapsedColumns[col.key]}
                      onSort={(type) => setColumnSort(col.key, type)}
                      onCollapse={() => toggleCollapse(col.key)}
                      onSelectAll={() => selectAllInColumn(columnTasks)}
                      onMoveAll={(target) => moveAllTasks(columnTasks, target)}
                    />
                  )}
                </div>
              </div>

              {/* Column fill bar — thin progress indicator under header */}
              {!collapsedColumns[col.key] && col.wipLimit && (
                <div className="h-[2px] w-full bg-dark-600/50 relative shrink-0">
                  <div
                    className="h-full rounded-r-full transition-all duration-500 ease-out"
                    style={{
                      width: `${Math.min(100, (columnTasks.length / col.wipLimit) * 100)}%`,
                      backgroundColor: columnTasks.length > col.wipLimit
                        ? '#ef4444'
                        : columnTasks.length === col.wipLimit
                          ? '#eab308'
                          : col.barColor,
                      opacity: columnTasks.length > 0 ? 0.7 : 0,
                    }}
                  />
                </div>
              )}

              {/* Collapsed body — vertical label */}
              {collapsedColumns[col.key] && (
                <div
                  className="flex-1 flex flex-col items-center justify-center cursor-pointer hover:bg-dark-700/30 transition-colors"
                  onClick={() => toggleCollapse(col.key)}
                  title={`Expand ${col.label} (${columnTasks.length} tasks)`}
                >
                  <span className="text-lg mb-2">{col.icon}</span>
                  <span className="text-[10px] text-gray-500 font-semibold tracking-wider" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                    {col.label}
                  </span>
                  <span className="mt-2 text-[10px] text-gray-600 font-mono">{columnTasks.length}</span>
                </div>
              )}

              {/* Task Cards — hidden when column is collapsed */}
              <div
                className={`flex-1 overflow-y-auto ${density === 'dense' ? 'p-1 space-y-0.5' : density === 'compact' ? 'p-1.5 space-y-1' : 'p-3 space-y-3'} ${isDoneColumn ? 'bg-accent-green/[0.02]' : ''} ${collapsedColumns[col.key] ? 'hidden' : ''}`}
                onScroll={(e) => handleColumnScroll(col.key, e)}
                ref={(el) => { scrollRefs.current[col.key] = el }}
              >
                {(() => {
                  // Progressive rendering: limit DOM nodes per column to prevent
                  // browser thrashing when Inbox has 700+ tasks. Show first PAGE_SIZE,
                  // then expand in increments with "Show more".
                  const limit = columnLimits[col.key] || COLUMN_PAGE_SIZE
                  const totalCount = columnTasks.length
                  const visibleColumnTasks = totalCount > limit ? columnTasks.slice(0, limit) : columnTasks
                  const hiddenCount = totalCount - visibleColumnTasks.length

                  return (<>
                {visibleColumnTasks.map((task, idx) => {
                  // Intra-column drag: determine if this card should shift to make room
                  const isSameColumnDrag = draggedTaskId && draggedTaskSourceCol === col.key && dragOverCardColumn === col.key
                  const isDraggedCard = draggedTaskId === task.id
                  const draggedIdx = isSameColumnDrag ? columnTasks.findIndex(t => t.id === draggedTaskId) : -1
                  const showIndicatorAbove = isSameColumnDrag && dragOverCardIndex === idx && !isDraggedCard
                  const showIndicatorBelow = isSameColumnDrag && dragOverCardIndex === idx + 1 && idx === columnTasks.length - 1 && !isDraggedCard

                  // Cross-column drag indicator (dragging from a different column)
                  const isCrossColumnDrag = draggedTaskId && draggedTaskSourceCol !== col.key && dragOverCardColumn === col.key
                  const showCrossIndicatorAbove = isCrossColumnDrag && dragOverCardIndex === idx
                  const showCrossIndicatorBelow = isCrossColumnDrag && dragOverCardIndex === idx + 1 && idx === columnTasks.length - 1

                  // Calculate shift transform for smooth card movement during same-column drag
                  let shiftStyle = {}
                  if (isSameColumnDrag && !isDraggedCard && dragOverCardIndex !== null && draggedIdx !== -1) {
                    const gapSize = density === 'dense' ? 2 : density === 'compact' ? 6 : 14
                    if (draggedIdx < dragOverCardIndex) {
                      // Dragging downward: cards between old and new pos shift up
                      if (idx > draggedIdx && idx < dragOverCardIndex) {
                        shiftStyle = { transform: `translateY(-${gapSize}px)` }
                      }
                    } else if (draggedIdx > dragOverCardIndex) {
                      // Dragging upward: cards between new and old pos shift down
                      if (idx >= dragOverCardIndex && idx < draggedIdx) {
                        shiftStyle = { transform: `translateY(${gapSize}px)` }
                      }
                    }
                  }

                  return (
                    <div
                      key={task.id}
                      className="relative"
                      style={{
                        transition: isSameColumnDrag && !isDraggedCard ? 'transform 200ms cubic-bezier(0.2, 0, 0, 1)' : 'none',
                        ...shiftStyle,
                      }}
                    >
                      {/* Drop indicator line — intra-column: shows above this card */}
                      {showIndicatorAbove && (
                        <div className="absolute -top-1.5 left-2 right-2 z-10 flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-accent-orange shadow-[0_0_6px_rgba(249,115,22,0.6)]" />
                          <div className="flex-1 h-[2px] bg-accent-orange rounded-full shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
                          <div className="w-1.5 h-1.5 rounded-full bg-accent-orange shadow-[0_0_6px_rgba(249,115,22,0.6)]" />
                        </div>
                      )}
                      {/* Drop indicator line — cross-column: shows above this card */}
                      {showCrossIndicatorAbove && (
                        <div className="absolute -top-1.5 left-2 right-2 z-10 flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-accent-orange shadow-[0_0_6px_rgba(249,115,22,0.6)]" />
                          <div className="flex-1 h-[2px] bg-accent-orange rounded-full shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
                          <div className="w-1.5 h-1.5 rounded-full bg-accent-orange shadow-[0_0_6px_rgba(249,115,22,0.6)]" />
                        </div>
                      )}
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, task)}
                        onDragEnd={handleDragEnd}
                        onDragOver={(e) => handleCardDragOver(e, col.key, idx)}
                        className={`transition-opacity duration-150 ${isDraggedCard ? 'opacity-30 scale-[0.97]' : 'opacity-100'}`}
                        style={isDraggedCard ? { transition: 'opacity 150ms ease, transform 150ms ease' } : undefined}
                      >
                        <TaskCard
                          task={task}
                          compact={compactMode}
                          density={density}
                          onClick={() => onTaskClick(task)}
                          onContextMenu={onTaskContextMenu ? (e) => { e.preventDefault(); onTaskContextMenu(e, task) } : undefined}
                          onQuickApprove={onQuickApprove}
                          onRequestChanges={onRequestChanges}
                          onRetry={onRetry}
                          isSelected={isTaskSelected?.(task.id)}
                          onToggleSelect={onToggleTaskSelect}
                          allTasks={allTasks.length > 0 ? allTasks : tasks}
                          isFocused={focusedTaskId === task.id}
                          searchQuery={searchQuery}
                          animationIndex={idx}
                        />
                      </div>
                      {/* Drop indicator line — intra-column: shows below the last card */}
                      {showIndicatorBelow && (
                        <div className="absolute -bottom-1.5 left-2 right-2 z-10 flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-accent-orange shadow-[0_0_6px_rgba(249,115,22,0.6)]" />
                          <div className="flex-1 h-[2px] bg-accent-orange rounded-full shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
                          <div className="w-1.5 h-1.5 rounded-full bg-accent-orange shadow-[0_0_6px_rgba(249,115,22,0.6)]" />
                        </div>
                      )}
                      {/* Drop indicator line — cross-column: shows below the last card */}
                      {showCrossIndicatorBelow && (
                        <div className="absolute -bottom-1.5 left-2 right-2 z-10 flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-accent-orange shadow-[0_0_6px_rgba(249,115,22,0.6)]" />
                          <div className="flex-1 h-[2px] bg-accent-orange rounded-full shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
                          <div className="w-1.5 h-1.5 rounded-full bg-accent-orange shadow-[0_0_6px_rgba(249,115,22,0.6)]" />
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* "Show more" button when column has more tasks than the visible limit */}
                {hiddenCount > 0 && (
                  <button
                    onClick={() => setColumnLimits(prev => ({
                      ...prev,
                      [col.key]: (prev[col.key] || COLUMN_PAGE_SIZE) + COLUMN_PAGE_SIZE,
                    }))}
                    className="w-full py-2 mt-1 text-[11px] font-medium text-gray-400 hover:text-gray-200 bg-dark-700/40 hover:bg-dark-600/60 rounded-lg border border-dark-500/50 hover:border-dark-400/50 transition-all"
                  >
                    Show {Math.min(hiddenCount, COLUMN_PAGE_SIZE)} more ({hiddenCount} remaining)
                  </button>
                )}
                  </>)
                })()}

                {/* Skeleton loading state */}
                {loading && columnTasks.length === 0 && (
                  <SkeletonColumn count={col.key === 'In Progress' ? 4 : col.key === 'Done' ? 2 : 3} compact={compactMode} />
                )}

                {!loading && columnTasks.length === 0 && (() => {
                  const empty = EMPTY_STATES[col.key] || EMPTY_STATES.Inbox
                  const isDragTarget = dragOverColumn === col.key
                  return (
                    <div className={`text-center py-8 rounded-lg border border-dashed transition-all flex flex-col items-center gap-2 ${
                      isDragTarget
                        ? 'border-accent-orange/40 text-accent-orange bg-accent-orange/5 scale-[1.02]'
                        : 'border-dark-500/50 text-gray-600'
                    }`}>
                      {isDragTarget ? (
                        <>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-orange animate-bounce">
                            <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                          </svg>
                          <span className="text-[11px] font-semibold">Drop here</span>
                        </>
                      ) : (
                        <>
                          <div className="opacity-40">{empty.icon}</div>
                          <span className="text-[11px] font-medium text-gray-500">{empty.title}</span>
                          <span className="text-[9px] text-gray-600">{empty.hint}</span>
                        </>
                      )}
                    </div>
                  )
                })()}

                {/* Inline quick-add at bottom of column */}
                {onCreateTask && col.key !== 'Done' && (
                  <InlineQuickAdd columnStatus={col.key} onCreateTask={onCreateTask} />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* WIP Limit Toast Container */}
      {wipToasts.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-auto" style={{ maxWidth: '280px' }}>
          {wipToasts.map(toast => (
            <WipToast key={toast.id} toast={toast} onDismiss={dismissWipToast} />
          ))}
        </div>
      )}
    </div>
  )
}
