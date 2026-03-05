'use client'

import { useMemo, useState } from 'react'

const METRICS = [
  { key: 'completed', label: 'Completed', color: '#22c55e' },
  { key: 'inProgress', label: 'In Progress', color: '#3b82f6' },
  { key: 'review', label: 'In Review', color: '#f97316' },
  { key: 'total', label: 'Total Tasks', color: '#8b5cf6' },
  { key: 'highPriority', label: 'High Priority', color: '#ef4444' },
]

export default function AgentPerformanceChart({ tasks = [], agents = [] }) {
  const [metric, setMetric] = useState('completed')

  const agentStats = useMemo(() => {
    const stats = {}
    agents.forEach(a => {
      stats[a.name] = { name: a.name, emoji: a.emoji, color: a.color, completed: 0, inProgress: 0, review: 0, total: 0, highPriority: 0 }
    })

    tasks.forEach(t => {
      if (!t.agent || !stats[t.agent]) return
      stats[t.agent].total++
      if (t.status === 'Done') stats[t.agent].completed++
      if (t.status === 'In Progress') stats[t.agent].inProgress++
      if (t.status === 'Review') stats[t.agent].review++
      if (t.priority === 'High') stats[t.agent].highPriority++
    })

    return Object.values(stats)
      .filter(s => s.total > 0)
      .sort((a, b) => b[metric] - a[metric])
  }, [tasks, agents, metric])

  const maxValue = useMemo(() =>
    Math.max(1, ...agentStats.map(s => s[metric])),
    [agentStats, metric]
  )

  const metricInfo = METRICS.find(m => m.key === metric)

  if (agentStats.length === 0) {
    return (
      <div className="text-center py-8 text-gray-600 text-xs">
        No agent data to display
      </div>
    )
  }

  return (
    <div className="bg-dark-700 rounded-lg border border-dark-500 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-dark-500 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-2">
          📊 Agent Performance
        </h3>
        <div className="flex gap-1">
          {METRICS.map(m => (
            <button
              key={m.key}
              onClick={() => setMetric(m.key)}
              className={`text-[9px] px-2 py-1 rounded-md transition-all ${
                metric === m.key
                  ? 'text-white font-semibold'
                  : 'text-gray-600 hover:text-gray-400'
              }`}
              style={metric === m.key ? { backgroundColor: `${m.color}20`, color: m.color } : {}}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="p-4 space-y-3">
        {agentStats.map((agent, i) => {
          const pct = Math.round((agent[metric] / maxValue) * 100)
          return (
            <div key={agent.name} className="flex items-center gap-3">
              {/* Agent identity */}
              <div className="flex items-center gap-2 w-28 shrink-0">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs"
                  style={{ background: `${agent.color}20`, border: `1.5px solid ${agent.color}` }}
                >
                  {agent.emoji}
                </div>
                <span className="text-[11px] text-gray-400 font-medium truncate">{agent.name}</span>
              </div>

              {/* Bar */}
              <div className="flex-1 h-5 bg-dark-600 rounded-full overflow-hidden relative">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out flex items-center justify-end pr-2"
                  style={{
                    width: `${Math.max(pct, 4)}%`,
                    backgroundColor: metricInfo?.color || '#6b7280',
                    opacity: 0.7 + (0.3 * (1 - i / agentStats.length)),
                  }}
                >
                  {pct > 15 && (
                    <span className="text-[9px] font-bold text-white/90">{agent[metric]}</span>
                  )}
                </div>
                {pct <= 15 && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-bold text-gray-500">
                    {agent[metric]}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Summary footer */}
      <div className="px-4 py-2 border-t border-dark-500 bg-dark-800/30 flex items-center gap-4 text-[9px] text-gray-600">
        <span>{agentStats.length} agents active</span>
        <span>·</span>
        <span>{tasks.filter(t => t.agent).length} assigned tasks</span>
        <span>·</span>
        <span>{tasks.filter(t => t.status === 'Done').length} completed</span>
      </div>
    </div>
  )
}
