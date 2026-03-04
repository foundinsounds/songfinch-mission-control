'use client'

import { useState, useMemo } from 'react'

function priorityScore(task) {
  let score = 0
  if (task.status === 'Review') score += 30
  if (task.status === 'Inbox') score += 20
  if (task.status === 'Assigned') score += 10
  if (task.priority === 'high' || task.priority === 'urgent') score += 25
  if (task.type === 'ad_copy' || task.type === 'landing_page') score += 10
  // Older tasks get slight priority boost
  if (task.createdAt) {
    const age = (Date.now() - new Date(task.createdAt).getTime()) / (1000 * 60 * 60)
    if (age > 24) score += 15
    else if (age > 12) score += 5
  }
  return score
}

function getTimeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function SmartInbox({ tasks, agents, onTaskClick }) {
  const [filter, setFilter] = useState('all') // all, needs-review, new, stale
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return new Set()
    const saved = localStorage.getItem('roundtable-inbox-dismissed')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })

  const dismiss = (taskId) => {
    const next = new Set(dismissed)
    next.add(taskId)
    setDismissed(next)
    localStorage.setItem('roundtable-inbox-dismissed', JSON.stringify([...next]))
  }

  const clearDismissed = () => {
    setDismissed(new Set())
    localStorage.removeItem('roundtable-inbox-dismissed')
  }

  const inboxItems = useMemo(() => {
    // Only show actionable tasks (not Done, not dismissed)
    return tasks
      .filter(t => t.status !== 'Done' && !dismissed.has(t.id))
      .map(t => ({
        ...t,
        score: priorityScore(t),
        timeAgo: getTimeAgo(t.createdAt),
        isStale: t.createdAt && (Date.now() - new Date(t.createdAt).getTime()) > 24 * 60 * 60 * 1000,
        needsReview: t.status === 'Review',
        isNew: t.status === 'Inbox',
      }))
      .filter(t => {
        if (filter === 'needs-review') return t.needsReview
        if (filter === 'new') return t.isNew
        if (filter === 'stale') return t.isStale
        return true
      })
      .sort((a, b) => b.score - a.score)
  }, [tasks, dismissed, filter])

  const counts = useMemo(() => {
    const actionable = tasks.filter(t => t.status !== 'Done' && !dismissed.has(t.id))
    return {
      all: actionable.length,
      review: actionable.filter(t => t.status === 'Review').length,
      new: actionable.filter(t => t.status === 'Inbox').length,
      stale: actionable.filter(t => t.createdAt && (Date.now() - new Date(t.createdAt).getTime()) > 24 * 60 * 60 * 1000).length,
    }
  }, [tasks, dismissed])

  const filters = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'needs-review', label: 'Needs Review', count: counts.review },
    { key: 'new', label: 'New', count: counts.new },
    { key: 'stale', label: 'Stale', count: counts.stale },
  ]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-dark-500 flex items-center justify-between shrink-0 bg-dark-800/50">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-gray-200">Smart Inbox</h2>
          {counts.review > 0 && (
            <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">{counts.review}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dismissed.size > 0 && (
            <button onClick={clearDismissed}
              className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors">
              Restore {dismissed.size} dismissed
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-4 py-2 border-b border-dark-500 flex items-center gap-1 bg-dark-800/30">
        {filters.map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${
              filter === f.key
                ? 'bg-accent-orange/20 text-accent-orange'
                : 'text-gray-500 hover:text-gray-300 hover:bg-dark-600'
            }`}>
            {f.label}
            {f.count > 0 && <span className="ml-1 opacity-70">({f.count})</span>}
          </button>
        ))}
      </div>

      {/* Inbox Items */}
      <div className="flex-1 overflow-y-auto">
        {inboxItems.map(task => {
          const agent = agents.find(a => a.name === task.agent)
          return (
            <div key={task.id} className="px-4 py-3 border-b border-dark-500/50 hover:bg-dark-700/50 transition-colors group">
              <div className="flex items-start gap-3">
                {/* Priority indicator */}
                <div className={`w-1.5 h-8 rounded-full shrink-0 mt-0.5 ${
                  task.score >= 50 ? 'bg-red-500' :
                  task.score >= 30 ? 'bg-orange-500' :
                  task.score >= 15 ? 'bg-yellow-500' :
                  'bg-gray-600'
                }`} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <button onClick={() => onTaskClick(task)} className="text-xs font-semibold text-gray-200 hover:text-accent-orange truncate transition-colors">
                      {task.name}
                    </button>
                    {task.needsReview && (
                      <span className="text-[8px] px-1.5 py-0.5 bg-orange-500/20 text-orange-400 rounded-full shrink-0">REVIEW</span>
                    )}
                    {task.isNew && (
                      <span className="text-[8px] px-1.5 py-0.5 bg-blue-500/20 text-blue-400 rounded-full shrink-0">NEW</span>
                    )}
                    {task.isStale && (
                      <span className="text-[8px] px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-full shrink-0">STALE</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-gray-500">
                    {agent && <span>{agent.emoji} {agent.name}</span>}
                    <span>{task.type || 'Task'}</span>
                    <span>{task.status}</span>
                    {task.timeAgo && <span>{task.timeAgo}</span>}
                    <span className="text-gray-600">Priority: {task.score}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onTaskClick(task)}
                    className="text-[10px] px-2 py-1 bg-accent-orange/20 text-accent-orange rounded hover:bg-accent-orange/30 transition-colors">
                    Open
                  </button>
                  <button onClick={() => dismiss(task.id)}
                    className="text-[10px] px-2 py-1 text-gray-500 rounded hover:bg-dark-600 hover:text-gray-300 transition-colors">
                    Dismiss
                  </button>
                </div>
              </div>
            </div>
          )
        })}
        {inboxItems.length === 0 && (
          <div className="p-8 text-center">
            <div className="text-2xl mb-2">
              {filter === 'all' ? '0' : '0'}
            </div>
            <div className="text-sm text-gray-500">
              {filter === 'all' ? 'Inbox zero — all caught up!' : `No ${filter.replace('-', ' ')} items`}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
