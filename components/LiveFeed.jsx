'use client'

import { AGENTS } from '../lib/agents'

function timeAgo(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

const TYPE_STYLES = {
  'Task Created': { dot: 'bg-blue-400', text: 'text-blue-400', icon: '\u{1F4CB}' },
  'Content Generated': { dot: 'bg-green-400', text: 'text-green-400', icon: '\u2705' },
  'Review Needed': { dot: 'bg-orange-400', text: 'text-orange-400', icon: '\u{1F50D}' },
  'Approved': { dot: 'bg-green-400', text: 'text-green-400', icon: '\u{1F389}' },
  'Comment': { dot: 'bg-gray-400', text: 'text-gray-400', icon: '\u{1F4AC}' },
}

const ACTION_LABELS = {
  'completed': { label: 'COMPLETED', color: 'text-accent-green bg-green-500/10' },
  'started': { label: 'STARTED', color: 'text-accent-blue bg-blue-500/10' },
  'assigned': { label: 'ASSIGNED', color: 'text-accent-yellow bg-yellow-500/10' },
  'submitted for review': { label: 'IN REVIEW', color: 'text-accent-orange bg-orange-500/10' },
  'completed research': { label: 'RESEARCH', color: 'text-accent-teal bg-teal-500/10' },
  'created campaign': { label: 'NEW CAMPAIGN', color: 'text-accent-purple bg-purple-500/10' },
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
          <span className="text-[10px] bg-dark-600 px-2 py-0.5 rounded-full text-gray-500 ml-auto">
            {activity.length} events
          </span>
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
        {activity.map((item, index) => {
          const agent = AGENTS.find(a => a.name === item.agent)
          const style = TYPE_STYLES[item.type] || TYPE_STYLES['Comment']
          const actionLabel = ACTION_LABELS[item.action]

          return (
            <div
              key={item.id}
              className="feed-item px-4 py-3 border-b border-dark-500/50 hover:bg-dark-700/50 transition-colors cursor-pointer"
            >
              {/* Agent + Action Header */}
              <div className="flex items-start gap-2.5 mb-1.5">
                {/* Agent Avatar mini */}
                {agent ? (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5"
                    style={{
                      background: `${agent.color}15`,
                      border: `1.5px solid ${agent.color}`,
                    }}
                  >
                    {agent.emoji}
                  </div>
                ) : (
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${style.dot}`}></div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {agent && (
                      <span
                        className="text-[11px] font-bold"
                        style={{ color: agent.color }}
                      >
                        {agent.name}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-500">{item.action}</span>
                    {actionLabel && (
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider ${actionLabel.color}`}>
                        {actionLabel.label}
                      </span>
                    )}
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

                  {/* Type Badge + Timestamp */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-[9px] font-semibold uppercase tracking-wider ${style.text}`}>
                      {style.icon} {item.type}
                    </span>
                    <span className="text-[10px] text-gray-600">
                      {timeAgo(item.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Feed Footer */}
      <div className="px-4 py-2 border-t border-dark-500 bg-dark-800">
        <div className="flex items-center justify-between text-[10px] text-gray-600">
          <span className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-green pulse-dot"></div>
            Auto-refreshing
          </span>
          <span>15s interval</span>
        </div>
      </div>
    </aside>
  )
}
