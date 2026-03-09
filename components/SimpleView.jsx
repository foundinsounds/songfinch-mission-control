'use client'

import { useMemo, useState } from 'react'

// ── Helpers ────────────────────────────────────────────
function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const STATUS_DOT = {
  Working: 'bg-emerald-400 shadow-emerald-400/40 shadow-sm',
  Active:  'bg-blue-400 shadow-blue-400/40 shadow-sm',
  Idle:    'bg-gray-500',
}

const TYPE_COLORS = {
  EXEC: 'text-yellow-400',
  OPS:  'text-indigo-400',
  LEAD: 'text-orange-400',
  SPC:  'text-blue-400',
  INT:  'text-teal-400',
}

// ── Agent Tile ─────────────────────────────────────────
function AgentTile({ agent, currentTasks, recentDone, onAgentClick, onTaskClick }) {
  const working = currentTasks.filter(t => t.status === 'In Progress')
  const reviewing = currentTasks.filter(t => t.status === 'Review')
  const queued = currentTasks.filter(t => t.status === 'Assigned' || t.status === 'Inbox')
  const isActive = agent.status === 'Working' || agent.status === 'Active'

  return (
    <div
      className={`
        group rounded-2xl border transition-all duration-300 cursor-pointer
        ${isActive
          ? 'bg-dark-700/60 border-dark-400/60 hover:border-dark-300/80 hover:bg-dark-700/80'
          : 'bg-dark-800/40 border-dark-600/40 hover:border-dark-500/60 hover:bg-dark-700/40 opacity-75 hover:opacity-100'
        }
      `}
      onClick={() => onAgentClick?.(agent)}
    >
      {/* Agent Header */}
      <div className="px-5 pt-5 pb-3 flex items-start justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="relative flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-dark-600 flex items-center justify-center text-lg">
              {agent.avatar || agent.name.charAt(0)}
            </div>
            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-dark-700 ${STATUS_DOT[agent.status] || STATUS_DOT.Idle}`} />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-[15px] text-gray-100 truncate">{agent.name}</h3>
            <p className="text-xs text-gray-500">{agent.role}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className={`text-[10px] font-bold tracking-wider ${TYPE_COLORS[agent.type] || 'text-gray-500'}`}>
            {agent.type}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
            isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-500'
          }`}>
            {agent.status}
          </span>
        </div>
      </div>

      {/* Current Work */}
      <div className="px-5 pb-4 space-y-2.5">
        {working.length > 0 ? (
          working.slice(0, 2).map(task => (
            <div
              key={task.id}
              className="flex items-start gap-2.5 py-2 px-3 rounded-lg bg-dark-600/40 hover:bg-dark-600/60 transition-colors"
              onClick={(e) => { e.stopPropagation(); onTaskClick?.(task) }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-gray-200 leading-snug truncate">{task.name}</p>
                {task.contentType && (
                  <span className="text-[10px] text-gray-500 uppercase tracking-wider">{task.contentType}</span>
                )}
              </div>
            </div>
          ))
        ) : reviewing.length > 0 ? (
          reviewing.slice(0, 2).map(task => (
            <div
              key={task.id}
              className="flex items-start gap-2.5 py-2 px-3 rounded-lg bg-orange-500/5 hover:bg-orange-500/10 transition-colors"
              onClick={(e) => { e.stopPropagation(); onTaskClick?.(task) }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] text-gray-200 leading-snug truncate">{task.name}</p>
                <span className="text-[10px] text-orange-400 uppercase tracking-wider">Awaiting review</span>
              </div>
            </div>
          ))
        ) : (
          <div className="py-2 px-3 rounded-lg bg-dark-600/20 text-center">
            <p className="text-xs text-gray-600 italic">
              {queued.length > 0 ? `${queued.length} task${queued.length > 1 ? 's' : ''} queued` : 'No active tasks'}
            </p>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="px-5 py-2.5 border-t border-dark-600/40 flex items-center justify-between text-[11px] text-gray-500">
        <div className="flex items-center gap-3">
          {working.length > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{working.length} active</span>}
          {reviewing.length > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-orange-400" />{reviewing.length} review</span>}
          {queued.length > 0 && <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-500" />{queued.length} queued</span>}
        </div>
        <span className="text-gray-600">
          {recentDone} done
        </span>
      </div>
    </div>
  )
}

// ── Simple View ────────────────────────────────────────
export default function SimpleView({ agents, tasks, activity, onTaskClick, onAgentClick }) {
  const [filter, setFilter] = useState('all') // all | active | idle

  // Derive per-agent task groups
  const agentData = useMemo(() => {
    return agents.map(agent => {
      const agentTasks = tasks.filter(t => t.agent === agent.name)
      const current = agentTasks.filter(t => t.status !== 'Done' && t.status !== 'Archived')
      const recentDone = agentTasks.filter(t => t.status === 'Done').length
      return { agent, currentTasks: current, recentDone }
    })
  }, [agents, tasks])

  // Filter
  const filtered = useMemo(() => {
    if (filter === 'active') return agentData.filter(d => d.agent.status === 'Working' || d.agent.status === 'Active')
    if (filter === 'idle') return agentData.filter(d => d.agent.status !== 'Working' && d.agent.status !== 'Active')
    return agentData
  }, [agentData, filter])

  // Summary stats
  const summary = useMemo(() => {
    const active = agents.filter(a => a.status === 'Working' || a.status === 'Active').length
    const inProgress = tasks.filter(t => t.status === 'In Progress').length
    const inReview = tasks.filter(t => t.status === 'Review').length
    const done = tasks.filter(t => t.status === 'Done').length
    const total = tasks.length
    return { active, total: agents.length, inProgress, inReview, done, totalTasks: total }
  }, [agents, tasks])

  // Recent activity (last 10 entries)
  const recentActivity = useMemo(() => {
    return [...activity]
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, 8)
  }, [activity])

  return (
    <div className="h-full overflow-auto bg-dark-900/50">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">

        {/* Summary Strip */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-2xl font-bold text-gray-100">Mission Control</p>
              <p className="text-sm text-gray-500 mt-0.5">What your team is working on right now</p>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex items-center gap-5 text-sm">
            <div className="text-center">
              <p className="text-xl font-bold text-emerald-400">{summary.active}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Active</p>
            </div>
            <div className="w-px h-8 bg-dark-600" />
            <div className="text-center">
              <p className="text-xl font-bold text-blue-400">{summary.inProgress}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">In Progress</p>
            </div>
            <div className="w-px h-8 bg-dark-600" />
            <div className="text-center">
              <p className="text-xl font-bold text-orange-400">{summary.inReview}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Review</p>
            </div>
            <div className="w-px h-8 bg-dark-600" />
            <div className="text-center">
              <p className="text-xl font-bold text-gray-400">{summary.done}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Done</p>
            </div>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-dark-800/50 rounded-lg p-1 w-fit">
          {[
            { key: 'all', label: `All Agents (${agents.length})` },
            { key: 'active', label: `Active (${summary.active})` },
            { key: 'idle', label: `Idle (${agents.length - summary.active})` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                filter === tab.key
                  ? 'bg-dark-600 text-gray-100 shadow-sm'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-dark-700/50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Agent Grid — the canvas */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(({ agent, currentTasks, recentDone }) => (
            <AgentTile
              key={agent.id}
              agent={agent}
              currentTasks={currentTasks}
              recentDone={recentDone}
              onAgentClick={onAgentClick}
              onTaskClick={onTaskClick}
            />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-600">
            <p className="text-lg">No agents match this filter</p>
            <button onClick={() => setFilter('all')} className="mt-2 text-sm text-blue-400 hover:underline">Show all agents</button>
          </div>
        )}

        {/* Recent Activity — lightweight timeline */}
        {recentActivity.length > 0 && (
          <div className="mt-8">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Recent Activity</h3>
            <div className="space-y-1">
              {recentActivity.map((item, i) => (
                <div key={item.id || i} className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-dark-800/40 transition-colors text-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-dark-400 flex-shrink-0" />
                  <span className="text-gray-400 flex-1 truncate">
                    {item.agent && <span className="text-gray-300 font-medium">{item.agent}</span>}
                    {' '}
                    {item.action || item.message || 'Activity'}
                  </span>
                  <span className="text-[11px] text-gray-600 flex-shrink-0">{timeAgo(item.timestamp)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
