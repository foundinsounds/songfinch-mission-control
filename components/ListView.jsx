'use client'

import { AGENTS } from '../lib/agents'

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

export default function ListView({ tasks, onTaskClick, onQuickApprove }) {
  const sorted = [...tasks].sort((a, b) => {
    const order = { 'In Progress': 0, 'Review': 1, 'Assigned': 2, 'Inbox': 3, 'Done': 4 }
    return (order[a.status] ?? 5) - (order[b.status] ?? 5)
  })

  return (
    <div className="h-full overflow-y-auto">
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
          {sorted.map((task) => {
            const agent = task.agent ? AGENTS.find(a => a.name === task.agent) : null
            const isDone = task.status === 'Done'
            const isReview = task.status === 'Review'

            return (
              <tr
                key={task.id}
                onClick={() => onTaskClick(task)}
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
                  <span className="text-[11px] text-gray-400">{task.contentType || '—'}</span>
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
  )
}
