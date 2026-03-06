'use client'

import { useMemo } from 'react'
import { AGENTS } from '../lib/agents'
import { STATUS_STYLES } from '../lib/constants'

const STATUS_COLORS = Object.fromEntries(
  Object.entries(STATUS_STYLES).map(([k, v]) => [k, { bg: v.hex, label: k }])
)

const STATUS_ORDER = ['Inbox', 'Assigned', 'In Progress', 'Review', 'Done']

/**
 * Compute workload stats per agent across all status columns.
 */
function computeWorkload(tasks, agents) {
  const agentStats = agents.map(agent => {
    const agentTasks = tasks.filter(t => t.agent === agent.name)
    const byStatus = {}
    STATUS_ORDER.forEach(s => {
      byStatus[s] = agentTasks.filter(t => t.status === s).length
    })
    const active = (byStatus['Assigned'] || 0) + (byStatus['In Progress'] || 0) + (byStatus['Review'] || 0)
    const total = agentTasks.length
    const done = byStatus['Done'] || 0
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0

    return {
      agent,
      byStatus,
      active,
      total,
      done,
      completionRate,
      overloaded: active > 5,
      idle: active === 0 && total < 3,
    }
  })

  return agentStats.sort((a, b) => b.active - a.active)
}

/**
 * Horizontal stacked bar for a single agent's tasks by status.
 */
function WorkloadBar({ stats, maxTotal }) {
  const barWidth = maxTotal > 0 ? (stats.total / maxTotal) * 100 : 0

  return (
    <div className="flex items-center gap-3 group">
      {/* Agent avatar + name */}
      <div className="flex items-center gap-2 w-28 shrink-0">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
          style={{
            background: `${stats.agent.color}15`,
            border: `2px solid ${stats.agent.color}`,
          }}
        >
          {stats.agent.emoji}
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-gray-200 truncate">{stats.agent.name}</div>
          <div className="text-[9px] text-gray-500 truncate">{stats.agent.role}</div>
        </div>
      </div>

      {/* Stacked bar */}
      <div className="flex-1 relative">
        <div className="h-6 bg-dark-800 rounded overflow-hidden flex" style={{ width: `${Math.max(barWidth, 8)}%` }}>
          {STATUS_ORDER.map(status => {
            const count = stats.byStatus[status] || 0
            if (count === 0) return null
            const pct = stats.total > 0 ? (count / stats.total) * 100 : 0
            return (
              <div
                key={status}
                className="h-full transition-all duration-500 relative group/seg"
                style={{
                  width: `${pct}%`,
                  backgroundColor: STATUS_COLORS[status].bg,
                  minWidth: count > 0 ? 4 : 0,
                }}
                title={`${STATUS_COLORS[status].label}: ${count}`}
              >
                {pct > 12 && (
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-white/80">
                    {count}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 shrink-0 w-36">
        <span className={`text-xs font-mono font-bold ${
          stats.overloaded ? 'text-red-400' : stats.idle ? 'text-gray-600' : 'text-gray-300'
        }`}>
          {stats.active} active
        </span>
        <span className="text-[10px] text-gray-600">/ {stats.total} total</span>
        {stats.overloaded && (
          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/25">
            Heavy
          </span>
        )}
        {stats.idle && stats.total > 0 && (
          <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-500/15 text-gray-500 border border-gray-500/25">
            Free
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Summary stats cards at the top.
 */
function WorkloadSummary({ stats, tasks }) {
  const unassigned = tasks.filter(t => !t.agent).length
  const totalActive = stats.reduce((sum, s) => sum + s.active, 0)
  const avgActive = stats.length > 0 ? (totalActive / stats.length).toFixed(1) : '0'
  const overloaded = stats.filter(s => s.overloaded).length
  const idle = stats.filter(s => s.idle).length

  const cards = [
    { label: 'Total Tasks', value: tasks.length, color: 'text-gray-200' },
    { label: 'Unassigned', value: unassigned, color: unassigned > 0 ? 'text-yellow-400' : 'text-gray-500' },
    { label: 'Avg Active/Agent', value: avgActive, color: 'text-accent-blue' },
    { label: 'Overloaded', value: overloaded, color: overloaded > 0 ? 'text-red-400' : 'text-accent-green' },
    { label: 'Free Agents', value: idle, color: idle > 0 ? 'text-yellow-400' : 'text-gray-500' },
  ]

  return (
    <div className="grid grid-cols-5 gap-2">
      {cards.map(card => (
        <div key={card.label} className="bg-dark-700 rounded-lg p-3 border border-dark-500 text-center">
          <div className={`text-lg font-bold font-mono ${card.color}`}>{card.value}</div>
          <div className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold mt-0.5">{card.label}</div>
        </div>
      ))}
    </div>
  )
}

/**
 * Rebalancing suggestions based on workload analysis.
 */
function RebalanceSuggestions({ stats, tasks }) {
  const suggestions = useMemo(() => {
    const tips = []
    const overloaded = stats.filter(s => s.overloaded)
    const freeAgents = stats.filter(s => s.idle && s.agent.type !== 'EXEC')
    const unassigned = tasks.filter(t => !t.agent)

    if (overloaded.length > 0 && freeAgents.length > 0) {
      tips.push({
        type: 'rebalance',
        icon: '⚖️',
        text: `${overloaded.map(s => s.agent.name).join(', ')} ${overloaded.length > 1 ? 'are' : 'is'} overloaded. Consider moving tasks to ${freeAgents.map(s => s.agent.name).join(', ')}.`,
      })
    }

    if (unassigned.length > 3) {
      tips.push({
        type: 'assign',
        icon: '📥',
        text: `${unassigned.length} tasks are unassigned in the inbox. Use auto-assign to distribute them.`,
      })
    }

    const reviewPile = stats.filter(s => (s.byStatus['Review'] || 0) > 3)
    if (reviewPile.length > 0) {
      tips.push({
        type: 'bottleneck',
        icon: '🔍',
        text: `Review bottleneck: ${reviewPile.map(s => `${s.agent.name} (${s.byStatus['Review']})`).join(', ')}. Clear reviews to unblock the pipeline.`,
      })
    }

    const highPerformers = stats.filter(s => s.completionRate > 70 && s.total > 5)
    if (highPerformers.length > 0) {
      tips.push({
        type: 'success',
        icon: '🏆',
        text: `Top performers: ${highPerformers.map(s => `${s.agent.name} (${s.completionRate}% done)`).join(', ')}.`,
      })
    }

    return tips
  }, [stats, tasks])

  if (suggestions.length === 0) return null

  return (
    <div className="space-y-1.5">
      <h4 className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold">Suggestions</h4>
      {suggestions.map((tip, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 p-2.5 rounded-lg border text-[11px] leading-relaxed ${
            tip.type === 'rebalance' ? 'bg-yellow-500/5 border-yellow-500/20 text-yellow-300' :
            tip.type === 'bottleneck' ? 'bg-orange-500/5 border-orange-500/20 text-orange-300' :
            tip.type === 'success' ? 'bg-green-500/5 border-green-500/20 text-green-300' :
            'bg-dark-600 border-dark-500 text-gray-300'
          }`}
        >
          <span className="text-sm shrink-0">{tip.icon}</span>
          <span>{tip.text}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * Agent Workload Balancer — visual workload distribution chart + suggestions.
 */
export default function AgentWorkloadBalancer({ tasks = [], agents = AGENTS }) {
  const stats = useMemo(() => computeWorkload(tasks, agents), [tasks, agents])
  const maxTotal = Math.max(...stats.map(s => s.total), 1)

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-y-auto">
      {/* Summary cards */}
      <WorkloadSummary stats={stats} tasks={tasks} />

      {/* Legend */}
      <div className="flex items-center gap-3 px-1">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mr-1">Status:</span>
        {STATUS_ORDER.map(status => (
          <div key={status} className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: STATUS_COLORS[status].bg }} />
            <span className="text-[10px] text-gray-400">{STATUS_COLORS[status].label}</span>
          </div>
        ))}
      </div>

      {/* Workload bars */}
      <div className="space-y-2">
        {stats.map(s => (
          <WorkloadBar key={s.agent.id} stats={s} maxTotal={maxTotal} />
        ))}
      </div>

      {/* Rebalancing suggestions */}
      <RebalanceSuggestions stats={stats} tasks={tasks} />
    </div>
  )
}
