'use client'

import { useState, useMemo, useRef, useEffect } from 'react'
import { AGENTS } from '../lib/agents'
import EmptyState from './EmptyState'
import TaskHoverPreview, { useHoverPreview } from './TaskHoverPreview'

const STATUS_COLORS = {
  'Inbox': 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  'Assigned': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'In Progress': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  'Review': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Done': 'bg-green-500/10 text-green-400 border-green-500/20',
}

const PRIORITY_DOT = {
  High: 'bg-red-500',
  Medium: 'bg-yellow-500',
  Low: 'bg-gray-500',
}

const SORT_OPTIONS = [
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'created', label: 'Created' },
  { key: 'name', label: 'Name' },
]

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

export default function ListView({ tasks, agents = [], onTaskClick, onQuickApprove, onRetry, selectedAgent }) {
  const [agentFilter, setAgentFilter] = useState(selectedAgent || null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState(null)
  const [priorityFilter, setPriorityFilter] = useState(null)
  const [typeFilter, setTypeFilter] = useState(null)
  const [sortBy, setSortBy] = useState('status')
  const [sortDir, setSortDir] = useState('asc')
  const searchRef = useRef(null)

  // Focus search on Ctrl/Cmd+F
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setSearchQuery('')
        searchRef.current?.blur()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Derive unique values for filter dropdowns
  const contentTypes = useMemo(() =>
    [...new Set(tasks.map(t => t.contentType).filter(Boolean))].sort(),
    [tasks]
  )

  // Apply all filters
  const filteredTasks = useMemo(() => {
    let result = tasks

    if (agentFilter) result = result.filter(t => t.agent === agentFilter)
    if (statusFilter) result = result.filter(t => t.status === statusFilter)
    if (priorityFilter) result = result.filter(t => t.priority === priorityFilter)
    if (typeFilter) result = result.filter(t => t.contentType === typeFilter)

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(t =>
        t.name?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.agent?.toLowerCase().includes(q) ||
        t.campaign?.toLowerCase().includes(q) ||
        t.contentType?.toLowerCase().includes(q)
      )
    }

    return result
  }, [tasks, agentFilter, statusFilter, priorityFilter, typeFilter, searchQuery])

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filteredTasks]
    const dir = sortDir === 'asc' ? 1 : -1

    arr.sort((a, b) => {
      switch (sortBy) {
        case 'status': {
          const order = { 'In Progress': 0, 'Review': 1, 'Assigned': 2, 'Inbox': 3, 'Done': 4 }
          return ((order[a.status] ?? 5) - (order[b.status] ?? 5)) * dir
        }
        case 'priority': {
          const pOrder = { 'High': 0, 'Medium': 1, 'Low': 2 }
          return ((pOrder[a.priority] ?? 3) - (pOrder[b.priority] ?? 3)) * dir
        }
        case 'created':
          return (new Date(b.createdAt) - new Date(a.createdAt)) * dir
        case 'name':
          return (a.name || '').localeCompare(b.name || '') * dir
        default:
          return 0
      }
    })

    return arr
  }, [filteredTasks, sortBy, sortDir])

  // Hover preview
  const { hoveredTask, anchorRect, handleMouseEnter, handleMouseLeave } = useHoverPreview(350)

  const activeFilterCount = [agentFilter, statusFilter, priorityFilter, typeFilter, searchQuery].filter(Boolean).length

  // Get unique agents from tasks
  const taskAgents = [...new Set(tasks.map(t => t.agent).filter(Boolean))].sort()

  return (
    <div className="h-full flex flex-col">
      {/* Search + Filter bar */}
      <div className="px-4 py-2 border-b border-dark-500 shrink-0 bg-dark-800/30 space-y-2">
        {/* Top row: Search + Sort */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search tasks... (Ctrl+F)"
              className="w-full pl-8 pr-8 py-1.5 bg-dark-700 border border-dark-500 rounded-md text-[11px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent-orange/40 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            )}
          </div>

          {/* Sort controls */}
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-[9px] text-gray-500 uppercase tracking-wider">Sort:</span>
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => {
                  if (sortBy === opt.key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
                  else { setSortBy(opt.key); setSortDir('asc') }
                }}
                className={`text-[10px] px-1.5 py-0.5 rounded transition-all ${
                  sortBy === opt.key
                    ? 'bg-accent-orange/15 text-accent-orange font-semibold'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {opt.label}
                {sortBy === opt.key && (
                  <span className="ml-0.5">{sortDir === 'asc' ? '\u2191' : '\u2193'}</span>
                )}
              </button>
            ))}
          </div>

          {/* Results count */}
          <div className="text-[10px] text-gray-500 tabular-nums shrink-0">
            {sorted.length}/{tasks.length}
          </div>
        </div>

        {/* Bottom row: Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mr-1 shrink-0">Filter:</span>

          {/* Agent filter */}
          <button
            onClick={() => setAgentFilter(null)}
            className={`text-[10px] px-2 py-1 rounded-md transition-all shrink-0 ${
              !agentFilter ? 'bg-white/10 text-white font-semibold' : 'text-gray-500 hover:text-gray-300 hover:bg-dark-600'
            }`}
          >
            All
          </button>
          {taskAgents.map(name => {
            const ag = agents.find(a => a.name === name)
            return (
              <button
                key={name}
                onClick={() => setAgentFilter(agentFilter === name ? null : name)}
                className={`text-[10px] px-2 py-1 rounded-md transition-all shrink-0 flex items-center gap-1 ${
                  agentFilter === name ? 'bg-white/10 text-white font-semibold' : 'text-gray-500 hover:text-gray-300 hover:bg-dark-600'
                }`}
              >
                {ag?.emoji && <span className="text-xs">{ag.emoji}</span>}
                {name}
              </button>
            )
          })}

          <div className="w-px h-4 bg-dark-500 mx-1 shrink-0" />

          {/* Status filter */}
          <select
            value={statusFilter || ''}
            onChange={(e) => setStatusFilter(e.target.value || null)}
            className="text-[10px] px-2 py-1 bg-dark-700 border border-dark-500 rounded-md text-gray-400 focus:outline-none cursor-pointer"
          >
            <option value="">All Status</option>
            {['Inbox', 'Assigned', 'In Progress', 'Review', 'Done'].map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Priority filter */}
          <select
            value={priorityFilter || ''}
            onChange={(e) => setPriorityFilter(e.target.value || null)}
            className="text-[10px] px-2 py-1 bg-dark-700 border border-dark-500 rounded-md text-gray-400 focus:outline-none cursor-pointer"
          >
            <option value="">All Priority</option>
            {['High', 'Medium', 'Low'].map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Content type filter */}
          {contentTypes.length > 0 && (
            <select
              value={typeFilter || ''}
              onChange={(e) => setTypeFilter(e.target.value || null)}
              className="text-[10px] px-2 py-1 bg-dark-700 border border-dark-500 rounded-md text-gray-400 focus:outline-none cursor-pointer"
            >
              <option value="">All Types</option>
              {contentTypes.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          )}

          {/* Clear all filters */}
          {activeFilterCount > 0 && (
            <button
              onClick={() => {
                setAgentFilter(null)
                setStatusFilter(null)
                setPriorityFilter(null)
                setTypeFilter(null)
                setSearchQuery('')
              }}
              className="text-[10px] px-2 py-1 rounded-md text-red-400 hover:bg-red-500/10 transition-all shrink-0"
            >
              Clear ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10">
            <tr className="bg-dark-800/90 backdrop-blur border-b border-dark-500 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              <th className="px-4 py-3 w-8"></th>
              <th className="px-4 py-3">Task</th>
              <th className="px-4 py-3 w-28">Status</th>
              <th className="px-4 py-3 w-32">Agent</th>
              <th className="px-4 py-3 w-28">Type</th>
              <th className="px-4 py-3 w-24">Priority</th>
              <th className="px-4 py-3 w-28">Created</th>
              <th className="px-4 py-3 w-28">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    variant={searchQuery || agentFilter || statusFilter || priorityFilter || typeFilter ? 'search' : 'list'}
                    message={searchQuery ? `No results for "${searchQuery}". Try adjusting your search or filters.` : undefined}
                    action={searchQuery || agentFilter || statusFilter || priorityFilter || typeFilter ? {
                      label: 'Clear all filters',
                      onClick: () => {
                        setSearchQuery('')
                        setAgentFilter(null)
                        setStatusFilter(null)
                        setPriorityFilter(null)
                        setTypeFilter(null)
                      }
                    } : undefined}
                  />
                </td>
              </tr>
            )}
            {sorted.map((task) => {
              const agent = task.agent ? AGENTS.find(a => a.name === task.agent) : null
              const isDone = task.status === 'Done'
              const isReview = task.status === 'Review'
              const isFailed = task.status === 'Error' || task.status === 'Failed'

              return (
                <tr
                  key={task.id}
                  onClick={() => onTaskClick(task)}
                  onMouseEnter={(e) => handleMouseEnter(task, e)}
                  onMouseLeave={handleMouseLeave}
                  className={`border-b border-dark-500/50 hover:bg-dark-700/50 transition-colors cursor-pointer ${isDone ? 'opacity-60' : ''}`}
                >
                  {/* Priority Dot */}
                  <td className="px-4 py-3">
                    <div className={`w-2.5 h-2.5 rounded-full ${PRIORITY_DOT[task.priority] || 'bg-gray-600'}`} />
                  </td>

                  {/* Task Name + Description */}
                  <td className="px-4 py-3">
                    <div className="text-[13px] font-semibold text-gray-100 leading-tight">
                      {task.name}
                    </div>
                    {task.description && (
                      <div className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
                        {task.description}
                      </div>
                    )}
                  </td>

                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded border ${STATUS_COLORS[task.status] || 'bg-dark-600 text-gray-400 border-dark-500'}`}>
                      {task.status}
                    </span>
                  </td>

                  {/* Agent */}
                  <td className="px-4 py-3">
                    {agent ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{agent.emoji}</span>
                        <span className="text-[11px] text-gray-300 font-medium">{agent.name}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-600 italic">Unassigned</span>
                    )}
                  </td>

                  {/* Content Type */}
                  <td className="px-4 py-3">
                    <span className="text-[11px] text-gray-400">{task.contentType || '\u2014'}</span>
                  </td>

                  {/* Priority */}
                  <td className="px-4 py-3">
                    <span className="text-[11px] text-gray-400">{task.priority}</span>
                  </td>

                  {/* Created */}
                  <td className="px-4 py-3">
                    <span className="text-[11px] text-gray-500">{timeAgo(task.createdAt)}</span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3">
                    {isReview && (
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onQuickApprove && onQuickApprove(task)
                          }}
                          className="text-[10px] font-semibold px-2 py-1 rounded bg-accent-green/10 text-accent-green hover:bg-accent-green/20 transition-colors border border-accent-green/20"
                        >
                          Approve
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onTaskClick(task)
                          }}
                          className="text-[10px] font-semibold px-2 py-1 rounded bg-accent-orange/10 text-accent-orange hover:bg-accent-orange/20 transition-colors border border-accent-orange/20"
                        >
                          Review
                        </button>
                      </div>
                    )}
                    {isFailed && (
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onRetry && onRetry(task)
                          }}
                          className="text-[10px] font-semibold px-2 py-1 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors border border-red-500/20"
                        >
                          Retry
                        </button>
                      </div>
                    )}
                    {isDone && (
                      <span className="text-[10px] text-accent-green">&#10003;</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Hover Preview */}
      {hoveredTask && anchorRect && (
        <TaskHoverPreview task={hoveredTask} anchorRect={anchorRect} />
      )}
    </div>
  )
}
