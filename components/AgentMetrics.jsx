'use client'

import { useState, useMemo } from 'react'
import { AGENTS } from '../lib/agents'

const STATUS_COLORS = {
  Inbox: '#6b7280',
  Assigned: '#eab308',
  'In Progress': '#3b82f6',
  Review: '#f97316',
  Done: '#22c55e',
}

const PRIORITY_COLORS = {
  High: '#ef4444',
  Medium: '#eab308',
  Low: '#6b7280',
}

const TYPE_COLORS = {
  EXEC: '#d4af37',
  OPS: '#3b82f6',
  LEAD: '#a855f7',
  SPC: '#22c55e',
  INT: '#f97316',
}

/**
 * AgentMetrics — performance analytics panel
 * Computes all metrics client-side from task/activity data
 * Renders: leaderboard, per-agent cards, distribution charts, workload bars
 */
export default function AgentMetrics({ tasks = [], agents = [], activity = [], onClose }) {
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [sortMetric, setSortMetric] = useState('completed')

  // Compute per-agent stats
  const agentStats = useMemo(() => {
    const agentMap = {}

    // Initialize from AGENTS config
    AGENTS.forEach(a => {
      agentMap[a.name] = {
        ...a,
        totalTasks: 0,
        completed: 0,
        inProgress: 0,
        review: 0,
        inbox: 0,
        assigned: 0,
        failed: 0,
        outputWords: 0,
        contentTypes: {},
        platforms: {},
        priorities: { High: 0, Medium: 0, Low: 0 },
        campaigns: new Set(),
        hasDriveExport: 0,
        avgOutputLength: 0,
        tasks: [],
      }
    })

    // Count from real tasks
    tasks.forEach(task => {
      const agentName = task.agent
      if (!agentName || !agentMap[agentName]) return

      const stats = agentMap[agentName]
      stats.totalTasks++
      stats.tasks.push(task)

      // Status counts
      switch (task.status) {
        case 'Done': stats.completed++; break
        case 'In Progress': stats.inProgress++; break
        case 'Review': stats.review++; break
        case 'Inbox': stats.inbox++; break
        case 'Assigned': stats.assigned++; break
        case 'Error': case 'Failed': stats.failed++; break
      }

      // Output word count
      if (task.output) {
        const words = task.output.split(/\s+/).filter(Boolean).length
        stats.outputWords += words
      }

      // Content type distribution
      if (task.contentType) {
        stats.contentTypes[task.contentType] = (stats.contentTypes[task.contentType] || 0) + 1
      }

      // Platform distribution
      const platforms = Array.isArray(task.platform) ? task.platform : task.platform ? [task.platform] : []
      platforms.forEach(p => {
        stats.platforms[p] = (stats.platforms[p] || 0) + 1
      })

      // Priority
      if (task.priority) {
        stats.priorities[task.priority] = (stats.priorities[task.priority] || 0) + 1
      }

      // Campaigns
      if (task.campaign) stats.campaigns.add(task.campaign)

      // Drive exports
      if (task.driveLink) stats.hasDriveExport++
    })

    // Compute averages
    Object.values(agentMap).forEach(stats => {
      stats.completionRate = stats.totalTasks > 0
        ? Math.round((stats.completed / stats.totalTasks) * 100)
        : 0
      stats.avgOutputLength = stats.completed > 0
        ? Math.round(stats.outputWords / stats.completed)
        : 0
      stats.campaignCount = stats.campaigns.size
    })

    return agentMap
  }, [tasks])

  // Sort agents for leaderboard
  const sortedAgents = useMemo(() => {
    const arr = Object.values(agentStats).filter(a => a.totalTasks > 0)
    arr.sort((a, b) => {
      switch (sortMetric) {
        case 'completed': return b.completed - a.completed
        case 'rate': return b.completionRate - a.completionRate
        case 'words': return b.outputWords - a.outputWords
        case 'total': return b.totalTasks - a.totalTasks
        case 'review': return b.review - a.review
        default: return b.completed - a.completed
      }
    })
    return arr
  }, [agentStats, sortMetric])

  // Global stats
  const globalStats = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter(t => t.status === 'Done').length
    const review = tasks.filter(t => t.status === 'Review').length
    const inProgress = tasks.filter(t => t.status === 'In Progress').length
    const totalWords = tasks.reduce((sum, t) => sum + (t.output ? t.output.split(/\s+/).filter(Boolean).length : 0), 0)
    const withOutput = tasks.filter(t => t.output).length
    const exported = tasks.filter(t => t.driveLink).length
    const uniqueCampaigns = new Set(tasks.map(t => t.campaign).filter(Boolean)).size

    return { total, done, review, inProgress, totalWords, withOutput, exported, uniqueCampaigns }
  }, [tasks])

  const selectedStats = selectedAgent ? agentStats[selectedAgent] : null

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-dark-800 border border-dark-500/80 rounded-2xl shadow-2xl w-[900px] max-w-[95vw] max-h-[85vh] overflow-hidden flex flex-col"
        style={{ boxShadow: '0 20px 60px rgba(0,0,0,0.6)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-dark-500">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent-purple/15 border border-accent-purple/30 flex items-center justify-center text-lg">
              📊
            </div>
            <div>
              <h2 className="text-[14px] font-bold text-gray-100">Agent Performance</h2>
              <p className="text-[10px] text-gray-500">{sortedAgents.length} active agents &middot; {globalStats.total} total tasks</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 transition-colors p-1.5 rounded-lg hover:bg-dark-600">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Global Summary Cards */}
        <div className="px-5 py-3 border-b border-dark-500/50 bg-dark-700/20">
          <div className="grid grid-cols-4 gap-3">
            <SummaryCard label="Completed" value={globalStats.done} total={globalStats.total} color="#22c55e" icon="✅" />
            <SummaryCard label="In Review" value={globalStats.review} total={globalStats.total} color="#f97316" icon="👀" />
            <SummaryCard label="Total Output" value={formatNumber(globalStats.totalWords)} suffix="words" color="#3b82f6" icon="📝" />
            <SummaryCard label="Exported" value={globalStats.exported} suffix="to Drive" color="#a855f7" icon="📂" />
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="flex">
            {/* Leaderboard (Left) */}
            <div className="w-[340px] border-r border-dark-500/50 shrink-0">
              <div className="px-4 py-2 border-b border-dark-500/30 flex items-center justify-between">
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Leaderboard</span>
                <div className="flex gap-1">
                  {[
                    { key: 'completed', label: 'Done' },
                    { key: 'rate', label: 'Rate' },
                    { key: 'words', label: 'Words' },
                    { key: 'total', label: 'Total' },
                  ].map(s => (
                    <button
                      key={s.key}
                      onClick={() => setSortMetric(s.key)}
                      className={`text-[9px] px-1.5 py-0.5 rounded transition-all ${
                        sortMetric === s.key
                          ? 'bg-accent-orange/15 text-accent-orange font-semibold'
                          : 'text-gray-600 hover:text-gray-400'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-2 space-y-1">
                {sortedAgents.map((agent, idx) => (
                  <button
                    key={agent.name}
                    onClick={() => setSelectedAgent(selectedAgent === agent.name ? null : agent.name)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                      selectedAgent === agent.name
                        ? 'bg-dark-600 border border-dark-400'
                        : 'hover:bg-dark-700 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {/* Rank */}
                      <span className={`text-[10px] font-bold tabular-nums w-4 text-center ${
                        idx === 0 ? 'text-yellow-400' :
                        idx === 1 ? 'text-gray-300' :
                        idx === 2 ? 'text-orange-400' : 'text-gray-600'
                      }`}>
                        {idx + 1}
                      </span>
                      {/* Agent info */}
                      <span className="text-sm">{agent.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-semibold text-gray-200 truncate">{agent.name}</span>
                          <span className="text-[8px] px-1 py-0.5 rounded font-bold" style={{ backgroundColor: `${TYPE_COLORS[agent.type]}20`, color: TYPE_COLORS[agent.type] }}>
                            {agent.type}
                          </span>
                        </div>
                        <div className="text-[9px] text-gray-500 truncate">{agent.role}</div>
                      </div>
                      {/* Metric value */}
                      <div className="text-right shrink-0">
                        <div className="text-[12px] font-bold text-gray-200 tabular-nums">
                          {sortMetric === 'completed' && agent.completed}
                          {sortMetric === 'rate' && `${agent.completionRate}%`}
                          {sortMetric === 'words' && formatNumber(agent.outputWords)}
                          {sortMetric === 'total' && agent.totalTasks}
                          {sortMetric === 'review' && agent.review}
                        </div>
                        {/* Mini progress bar */}
                        <div className="w-16 h-1 rounded-full bg-dark-600 mt-0.5 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${agent.completionRate}%`,
                              backgroundColor: agent.completionRate >= 80 ? '#22c55e' : agent.completionRate >= 50 ? '#eab308' : '#ef4444',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                ))}

                {sortedAgents.length === 0 && (
                  <div className="text-[11px] text-gray-600 text-center py-6">
                    No agent data yet
                  </div>
                )}
              </div>
            </div>

            {/* Detail Panel (Right) */}
            <div className="flex-1 p-4">
              {selectedStats ? (
                <AgentDetailPanel stats={selectedStats} />
              ) : (
                <TeamOverview agents={sortedAgents} globalStats={globalStats} tasks={tasks} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Summary card at the top */
function SummaryCard({ label, value, total, suffix, color, icon }) {
  return (
    <div className="bg-dark-700/50 rounded-lg px-3 py-2 border border-dark-500/30">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-sm">{icon}</span>
        <span className="text-[9px] text-gray-500 uppercase tracking-wider font-semibold">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-[18px] font-bold tabular-nums" style={{ color }}>{value}</span>
        {total && <span className="text-[10px] text-gray-600">/ {total}</span>}
        {suffix && <span className="text-[10px] text-gray-600">{suffix}</span>}
      </div>
    </div>
  )
}

/** Per-agent detail view */
function AgentDetailPanel({ stats }) {
  return (
    <div className="space-y-4">
      {/* Agent Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl" style={{ backgroundColor: `${stats.color}15`, border: `1px solid ${stats.color}30` }}>
          {stats.emoji}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-bold text-gray-100">{stats.name}</span>
            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ backgroundColor: `${TYPE_COLORS[stats.type]}20`, color: TYPE_COLORS[stats.type] }}>
              {stats.type}
            </span>
          </div>
          <div className="text-[11px] text-gray-500">{stats.role}</div>
        </div>
      </div>

      {/* Key Metrics Grid */}
      <div className="grid grid-cols-3 gap-2">
        <MetricBox label="Completed" value={stats.completed} color="#22c55e" />
        <MetricBox label="Completion %" value={`${stats.completionRate}%`} color={stats.completionRate >= 80 ? '#22c55e' : stats.completionRate >= 50 ? '#eab308' : '#ef4444'} />
        <MetricBox label="In Review" value={stats.review} color="#f97316" />
        <MetricBox label="In Progress" value={stats.inProgress} color="#3b82f6" />
        <MetricBox label="Total Output" value={`${formatNumber(stats.outputWords)}w`} color="#a855f7" />
        <MetricBox label="Avg Words" value={formatNumber(stats.avgOutputLength)} color="#6366f1" />
      </div>

      {/* Status Distribution Bar */}
      <div>
        <div className="text-[10px] text-gray-500 font-semibold mb-1.5">Task Status Distribution</div>
        <div className="flex h-3 rounded-full overflow-hidden bg-dark-600">
          {stats.totalTasks > 0 && (
            <>
              {stats.completed > 0 && <div style={{ width: `${(stats.completed/stats.totalTasks)*100}%`, backgroundColor: STATUS_COLORS.Done }} title={`Done: ${stats.completed}`} />}
              {stats.review > 0 && <div style={{ width: `${(stats.review/stats.totalTasks)*100}%`, backgroundColor: STATUS_COLORS.Review }} title={`Review: ${stats.review}`} />}
              {stats.inProgress > 0 && <div style={{ width: `${(stats.inProgress/stats.totalTasks)*100}%`, backgroundColor: STATUS_COLORS['In Progress'] }} title={`In Progress: ${stats.inProgress}`} />}
              {stats.assigned > 0 && <div style={{ width: `${(stats.assigned/stats.totalTasks)*100}%`, backgroundColor: STATUS_COLORS.Assigned }} title={`Assigned: ${stats.assigned}`} />}
              {stats.inbox > 0 && <div style={{ width: `${(stats.inbox/stats.totalTasks)*100}%`, backgroundColor: STATUS_COLORS.Inbox }} title={`Inbox: ${stats.inbox}`} />}
            </>
          )}
        </div>
        <div className="flex gap-3 mt-1">
          {Object.entries(STATUS_COLORS).map(([status, color]) => {
            const count = status === 'Done' ? stats.completed : status === 'Review' ? stats.review : status === 'In Progress' ? stats.inProgress : status === 'Assigned' ? stats.assigned : stats.inbox
            if (!count) return null
            return (
              <div key={status} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[9px] text-gray-500">{status}: {count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Content Types */}
      {Object.keys(stats.contentTypes).length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 font-semibold mb-1.5">Content Types</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(stats.contentTypes)
              .sort((a, b) => b[1] - a[1])
              .map(([type, count]) => (
                <span key={type} className="text-[9px] px-2 py-1 rounded-md bg-dark-600 text-gray-300 border border-dark-500">
                  {type} <span className="text-gray-500">({count})</span>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Platforms */}
      {Object.keys(stats.platforms).length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 font-semibold mb-1.5">Platforms</div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(stats.platforms)
              .sort((a, b) => b[1] - a[1])
              .map(([platform, count]) => (
                <span key={platform} className="text-[9px] px-2 py-1 rounded-md bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
                  {platform} <span className="text-accent-blue/50">({count})</span>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Priority Mix */}
      <div>
        <div className="text-[10px] text-gray-500 font-semibold mb-1.5">Priority Mix</div>
        <div className="flex gap-2">
          {Object.entries(stats.priorities).map(([p, count]) => (
            count > 0 && (
              <div key={p} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[p] }} />
                <span className="text-[10px] text-gray-400">{p}: <span className="font-semibold text-gray-300">{count}</span></span>
              </div>
            )
          ))}
        </div>
      </div>

      {/* Quick Stats Footer */}
      <div className="flex items-center gap-3 pt-2 border-t border-dark-500/30">
        <span className="text-[9px] text-gray-600">{stats.campaignCount} campaign{stats.campaignCount !== 1 ? 's' : ''}</span>
        <span className="text-[9px] text-gray-600">&middot;</span>
        <span className="text-[9px] text-gray-600">{stats.hasDriveExport} exported to Drive</span>
        <span className="text-[9px] text-gray-600">&middot;</span>
        <span className="text-[9px] text-gray-600">{stats.failed} failed</span>
      </div>
    </div>
  )
}

/** Team overview when no agent is selected */
function TeamOverview({ agents, globalStats, tasks }) {
  // Compute team-wide distributions
  const statusDist = useMemo(() => {
    const dist = {}
    tasks.forEach(t => {
      dist[t.status] = (dist[t.status] || 0) + 1
    })
    return dist
  }, [tasks])

  const contentDist = useMemo(() => {
    const dist = {}
    tasks.forEach(t => {
      if (t.contentType) dist[t.contentType] = (dist[t.contentType] || 0) + 1
    })
    return Object.entries(dist).sort((a, b) => b[1] - a[1])
  }, [tasks])

  const platformDist = useMemo(() => {
    const dist = {}
    tasks.forEach(t => {
      const platforms = Array.isArray(t.platform) ? t.platform : t.platform ? [t.platform] : []
      platforms.forEach(p => { dist[p] = (dist[p] || 0) + 1 })
    })
    return Object.entries(dist).sort((a, b) => b[1] - a[1])
  }, [tasks])

  const maxTasks = Math.max(...agents.map(a => a.totalTasks), 1)

  return (
    <div className="space-y-4">
      <div className="text-[12px] font-semibold text-gray-300">Team Overview</div>
      <p className="text-[10px] text-gray-500">Select an agent from the leaderboard to see detailed performance metrics.</p>

      {/* Workload Distribution */}
      <div>
        <div className="text-[10px] text-gray-500 font-semibold mb-2">Workload Distribution</div>
        <div className="space-y-1.5">
          {agents.slice(0, 8).map(agent => (
            <div key={agent.name} className="flex items-center gap-2">
              <span className="text-sm w-5 text-center">{agent.emoji}</span>
              <span className="text-[10px] text-gray-400 w-14 truncate">{agent.name}</span>
              <div className="flex-1 h-2.5 rounded-full bg-dark-600 overflow-hidden">
                <div className="h-full rounded-full flex overflow-hidden" style={{ width: `${(agent.totalTasks / maxTasks) * 100}%` }}>
                  {agent.completed > 0 && <div style={{ width: `${(agent.completed / agent.totalTasks) * 100}%`, backgroundColor: '#22c55e' }} />}
                  {agent.review > 0 && <div style={{ width: `${(agent.review / agent.totalTasks) * 100}%`, backgroundColor: '#f97316' }} />}
                  {agent.inProgress > 0 && <div style={{ width: `${(agent.inProgress / agent.totalTasks) * 100}%`, backgroundColor: '#3b82f6' }} />}
                  {(agent.inbox + agent.assigned) > 0 && <div style={{ width: `${((agent.inbox + agent.assigned) / agent.totalTasks) * 100}%`, backgroundColor: '#6b7280' }} />}
                </div>
              </div>
              <span className="text-[10px] text-gray-500 tabular-nums w-6 text-right">{agent.totalTasks}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Content Type Breakdown */}
      {contentDist.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 font-semibold mb-1.5">Content Types</div>
          <div className="flex flex-wrap gap-1">
            {contentDist.slice(0, 8).map(([type, count]) => (
              <span key={type} className="text-[9px] px-2 py-1 rounded-md bg-dark-600 text-gray-300 border border-dark-500/50">
                {type} <span className="text-gray-500">({count})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Platform Breakdown */}
      {platformDist.length > 0 && (
        <div>
          <div className="text-[10px] text-gray-500 font-semibold mb-1.5">Target Platforms</div>
          <div className="flex flex-wrap gap-1">
            {platformDist.slice(0, 8).map(([platform, count]) => (
              <span key={platform} className="text-[9px] px-2 py-1 rounded-md bg-accent-blue/10 text-accent-blue border border-accent-blue/20">
                {platform} <span className="text-accent-blue/50">({count})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Status Overview */}
      <div>
        <div className="text-[10px] text-gray-500 font-semibold mb-1.5">Pipeline Status</div>
        <div className="flex h-4 rounded-lg overflow-hidden bg-dark-600">
          {Object.entries(STATUS_COLORS).map(([status, color]) => {
            const count = statusDist[status] || 0
            if (count === 0) return null
            return (
              <div
                key={status}
                style={{ width: `${(count / globalStats.total) * 100}%`, backgroundColor: color }}
                title={`${status}: ${count}`}
                className="transition-all"
              />
            )
          })}
        </div>
        <div className="flex gap-3 mt-1">
          {Object.entries(STATUS_COLORS).map(([status, color]) => {
            const count = statusDist[status] || 0
            if (!count) return null
            return (
              <div key={status} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-[9px] text-gray-500">{status}: {count}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/** Small metric box */
function MetricBox({ label, value, color }) {
  return (
    <div className="bg-dark-700/50 rounded-lg px-2.5 py-2 border border-dark-500/30 text-center">
      <div className="text-[16px] font-bold tabular-nums" style={{ color }}>{value}</div>
      <div className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  )
}

/** Format numbers with K suffix */
function formatNumber(n) {
  if (n >= 10000) return `${(n / 1000).toFixed(1)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
