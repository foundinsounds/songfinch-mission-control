'use client'

import { useState, useMemo } from 'react'

const WORKFLOW_STEPS = [
  { key: 'draft', label: 'Draft', icon: '\u270F\uFE0F', color: 'text-gray-400' },
  { key: 'review', label: 'Review', icon: '\u{1F50D}', color: 'text-orange-400' },
  { key: 'approve', label: 'Approved', icon: '\u2705', color: 'text-green-400' },
  { key: 'publish', label: 'Published', icon: '\u{1F680}', color: 'text-blue-400' },
]

const STATUS_MAP = {
  'Inbox': 'draft', 'Assigned': 'draft', 'In Progress': 'draft',
  'Review': 'review', 'Done': 'approve',
}

export default function ApprovalWorkflow({ tasks, agents, onTaskClick, onApprove }) {
  const [filter, setFilter] = useState('all')

  const reviewTasks = useMemo(() => {
    let list = tasks.filter(t => t.status === 'Review' || t.status === 'Done')
    if (filter === 'review') list = list.filter(t => t.status === 'Review')
    if (filter === 'approved') list = list.filter(t => t.status === 'Done')
    return list.sort((a, b) => {
      if (a.status === 'Review' && b.status !== 'Review') return -1
      if (a.status !== 'Review' && b.status === 'Review') return 1
      return 0
    })
  }, [tasks, filter])

  const stats = useMemo(() => ({
    pendingReview: tasks.filter(t => t.status === 'Review').length,
    approved: tasks.filter(t => t.status === 'Done').length,
    total: tasks.length,
  }), [tasks])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-dark-500 flex items-center justify-between shrink-0 bg-dark-800/50">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-bold text-gray-200">Approval Workflows</h2>
          {stats.pendingReview > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400 border border-orange-500/20 font-semibold animate-pulse">
              {stats.pendingReview} pending review
            </span>
          )}
        </div>
        <div className="flex gap-1">
          {[
            { key: 'all', label: 'All' },
            { key: 'review', label: 'Needs Review' },
            { key: 'approved', label: 'Approved' },
          ].map(f => (
            <button key={f.key} onClick={() => setFilter(f.key)}
              className={`text-[10px] px-2.5 py-1 rounded-md transition-all ${
                filter === f.key ? 'bg-accent-orange/15 text-accent-orange font-semibold' : 'text-gray-500 hover:text-gray-300'
              }`}
            >{f.label}</button>
          ))}
        </div>
      </div>

      {/* Workflow Pipeline Visualization */}
      <div className="px-4 py-4 border-b border-dark-500 bg-dark-800/30 shrink-0">
        <div className="flex items-center justify-between">
          {WORKFLOW_STEPS.map((step, i) => {
            const count = step.key === 'draft'
              ? tasks.filter(t => ['Inbox', 'Assigned', 'In Progress'].includes(t.status)).length
              : step.key === 'review'
                ? stats.pendingReview
                : step.key === 'approve'
                  ? stats.approved
                  : 0

            return (
              <div key={step.key} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 ${
                    count > 0 ? 'border-accent-orange/40 bg-dark-600' : 'border-dark-500 bg-dark-800'
                  }`}>
                    {step.icon}
                  </div>
                  <span className={`text-[10px] mt-1.5 font-semibold ${step.color}`}>{step.label}</span>
                  <span className="text-[9px] text-gray-600">{count} items</span>
                </div>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className="w-12 h-px bg-dark-500 shrink-0 mx-1" />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {reviewTasks.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-3xl mb-3">{'\u2705'}</div>
            <p className="text-sm text-gray-500">All caught up!</p>
            <p className="text-xs text-gray-600 mt-1">No items pending approval</p>
          </div>
        ) : (
          reviewTasks.map(task => {
            const agent = agents.find(a => a.name === task.agent)
            const isReview = task.status === 'Review'

            return (
              <div key={task.id} className={`bg-dark-700 rounded-lg border p-4 transition-colors cursor-pointer ${
                isReview ? 'border-orange-500/20 hover:border-orange-500/40' : 'border-dark-500 hover:border-dark-400'
              }`} onClick={() => onTaskClick(task)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {agent && (
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0"
                        style={{ background: `${agent.color}15`, border: `1.5px solid ${agent.color}` }}>
                        {agent.emoji}
                      </div>
                    )}
                    <div className="min-w-0">
                      <h4 className="text-sm font-semibold text-gray-100 truncate">{task.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-500">{task.contentType}</span>
                        {task.campaign && <span className="text-[10px] text-gray-600">/ {task.campaign}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isReview && (
                      <button
                        onClick={e => { e.stopPropagation(); onApprove(task) }}
                        className="text-[10px] px-3 py-1.5 bg-accent-green/20 text-accent-green rounded-md hover:bg-accent-green/30 transition-colors font-semibold flex items-center gap-1"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                        Approve
                      </button>
                    )}
                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded ${
                      isReview ? 'bg-orange-500/10 text-orange-400' : 'bg-green-500/10 text-green-400'
                    }`}>
                      {task.status}
                    </span>
                  </div>
                </div>
                {/* Output preview */}
                {task.output && (
                  <p className="text-[10px] text-gray-600 mt-2 line-clamp-2 leading-relaxed">
                    {task.output.substring(0, 150)}...
                  </p>
                )}
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
