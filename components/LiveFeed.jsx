'use client'

import { AGENTS } from '../lib/agents'

function timeAgo(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)

  if (minutes < 60) return `about ${minutes} minutes ago`
  if (hours < 24) return `about ${hours} hours ago`
  return `about ${Math.floor(diff / 86400000)} days ago`
}

const TYPE_STYLES = {
  'Task Created': { dot: 'bg-blue-400', text: 'text-blue-400' },
  'Content Generated': { dot: 'bg-green-400', text: 'text-green-400' },
  'Review Needed': { dot: 'bg-orange-400', text: 'text-orange-400' },
  'Approved': { dot: 'bg-green-400', text: 'text-green-400' },
  'Comment': { dot: 'bg-gray-400', text: 'text-gray-400' },
}

const FILTERS = ['All', 'Tasks', 'Comments', 'Docs', 'Status']

export default function LiveFeed({ activity, filter, onFilterChange }) {
  return (
    <aside className="w-80 bg-dark-800 border-l border-dark-500 flex flex-col shrink-0 overflow-hidden">
      {/* Feed Header */}
      <div className="px-4 py-3 border-b border-dark-500">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-accent-green pulse-dot"></div>
          <span className="text-sm font-semibold">LIVE FEED</span>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`text-[11px] px-2.5 py-1 rounded-full transition-all ${
                filter === f
                  ? 'bg-accent-orange/20 text-accent-orange border border-accent-orange/30'
                  : 'bg-dark-600 text-gray-500 border border-transparent hover:text-gray-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Items */}
      <div className="flex-1 overflow-y-auto">
        {activity.map((item) => {
          const agent = AGENTS.find(a => a.name === item.agent)
          const style = TYPE_STYLES[item.type] || TYPE_STYLES['Comment']

          return (
            <div
              key={item.id}
              className="feed-item px-4 py-3 border-b border-dark-500/50 hover:bg-dark-700/50 transition-colors cursor-pointer"
            >
              {/* Agent + Action Header */}
              <div className="flex items-start gap-2 mb-1.5">
                <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${style.dot}`}></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {agent && (
                      <span
                        className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                        style={{
                          background: `${agent.color}15`,
                          color: agent.color,
                        }}
                      >
                        {agent.name}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-500">{item.action}</span>
                  </div>

                  {/* Task Name */}
                  <p className="text-[12px] font-medium text-gray-200 mt-1 leading-tight">
                    &ldquo;{item.task}&rdquo;
                  </p>

                  {/* Details */}
                  {item.details && (
                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed line-clamp-2">
                      {item.details}
                    </p>
                  )}

                  {/* Timestamp */}
                  <span className="text-[10px] text-gray-600 mt-1.5 block">
                    {timeAgo(item.timestamp)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Feed Footer */}
      <div className="px-4 py-2 border-t border-dark-500 bg-dark-800">
        <div className="flex items-center justify-between text-[10px] text-gray-600">
          <span>{activity.length} events</span>
          <span>Auto-refreshing</span>
        </div>
      </div>
    </aside>
  )
}
