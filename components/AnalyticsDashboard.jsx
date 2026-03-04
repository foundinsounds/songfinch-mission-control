'use client'

import { useState, useMemo } from 'react'
import { MODEL_OPTIONS, MODEL_LEGACY_MAP } from '../lib/constants'

function resolveModel(m) {
  const resolved = MODEL_LEGACY_MAP[m] || m || 'claude-sonnet-4-6'
  const found = MODEL_OPTIONS.find(o => o.value === resolved)
  return found ? found.label : resolved
}

function StatCard({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-dark-700 rounded-lg border border-dark-500 p-4">
      <div className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-[10px] text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

function ProgressBar({ value, max, color = 'bg-accent-orange' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="w-full bg-dark-600 rounded-full h-2">
      <div className={`${color} rounded-full h-2 transition-all`} style={{ width: `${pct}%` }} />
    </div>
  )
}

export default function AnalyticsDashboard({ agents, tasks, activity }) {
  const [timeRange, setTimeRange] = useState('all') // 'today' | '7d' | '30d' | 'all'

  // Filter activity by time range
  const filteredActivity = useMemo(() => {
    if (timeRange === 'all') return activity
    const now = new Date()
    const cutoff = {
      'today': new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      '7d': new Date(now - 7 * 24 * 60 * 60 * 1000),
      '30d': new Date(now - 30 * 24 * 60 * 60 * 1000),
    }[timeRange]
    return activity.filter(a => new Date(a.timestamp) >= cutoff)
  }, [activity, timeRange])

  // Overview stats
  const stats = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter(t => t.status === 'Done').length
    const review = tasks.filter(t => t.status === 'Review').length
    const inProgress = tasks.filter(t => t.status === 'In Progress').length
    const assigned = tasks.filter(t => t.status === 'Assigned').length
    const inbox = tasks.filter(t => t.status === 'Inbox').length
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0

    // Agent stats
    const activeAgents = agents.filter(a => a.status === 'Working' || a.status === 'Active').length
    const idleAgents = agents.filter(a => a.status === 'Idle').length

    // Content type breakdown
    const byContentType = {}
    tasks.forEach(t => {
      const ct = t.contentType || 'General'
      if (!byContentType[ct]) byContentType[ct] = { total: 0, done: 0 }
      byContentType[ct].total++
      if (t.status === 'Done') byContentType[ct].done++
    })

    // Agent workload
    const byAgent = {}
    agents.forEach(a => {
      byAgent[a.name] = {
        emoji: a.emoji,
        total: 0,
        done: 0,
        review: 0,
        inProgress: 0,
        model: a.model,
        status: a.status,
      }
    })
    tasks.forEach(t => {
      if (t.agent && byAgent[t.agent]) {
        byAgent[t.agent].total++
        if (t.status === 'Done') byAgent[t.agent].done++
        if (t.status === 'Review') byAgent[t.agent].review++
        if (t.status === 'In Progress') byAgent[t.agent].inProgress++
      }
    })

    // Platform breakdown
    const byPlatform = {}
    tasks.forEach(t => {
      if (t.platform && t.platform.length > 0) {
        t.platform.forEach(p => {
          if (!byPlatform[p]) byPlatform[p] = 0
          byPlatform[p]++
        })
      }
    })

    // Campaign breakdown
    const byCampaign = {}
    tasks.forEach(t => {
      const c = t.campaign || 'Uncategorized'
      if (!byCampaign[c]) byCampaign[c] = { total: 0, done: 0 }
      byCampaign[c].total++
      if (t.status === 'Done') byCampaign[c].done++
    })

    // Recent completions from activity feed
    const completions = filteredActivity.filter(a =>
      a.action === 'completed' || a.type === 'Content Generated'
    )

    // Average output length from completed tasks
    const outputLengths = tasks.filter(t => t.output && t.status === 'Done').map(t => t.output.length)
    const avgOutputLength = outputLengths.length > 0
      ? Math.round(outputLengths.reduce((a, b) => a + b, 0) / outputLengths.length)
      : 0

    return {
      total, done, review, inProgress, assigned, inbox,
      completionRate, activeAgents, idleAgents,
      byContentType, byAgent, byPlatform, byCampaign,
      completions: completions.length,
      avgOutputLength,
    }
  }, [tasks, agents, filteredActivity])

  return (
    <div className="p-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-100">Performance Analytics</h2>
          <p className="text-xs text-gray-500 mt-0.5">Council productivity and output metrics</p>
        </div>
        <div className="flex items-center gap-1">
          {[
            { key: 'today', label: 'Today' },
            { key: '7d', label: '7 Days' },
            { key: '30d', label: '30 Days' },
            { key: 'all', label: 'All Time' },
          ].map(r => (
            <button
              key={r.key}
              onClick={() => setTimeRange(r.key)}
              className={`text-[10px] px-3 py-1.5 rounded transition-colors ${
                timeRange === r.key
                  ? 'bg-accent-orange/15 text-accent-orange border border-accent-orange/25'
                  : 'text-gray-500 hover:text-gray-300 bg-dark-700 border border-dark-500'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <StatCard label="Total Tasks" value={stats.total} color="text-white" />
        <StatCard label="Completed" value={stats.done} sub={`${stats.completionRate}% rate`} color="text-accent-green" />
        <StatCard label="In Review" value={stats.review} color="text-accent-orange" />
        <StatCard label="In Progress" value={stats.inProgress} color="text-accent-blue" />
        <StatCard label="Agents Active" value={`${stats.activeAgents}/${agents.length}`} color="text-accent-purple" />
        <StatCard label="Avg Output" value={stats.avgOutputLength > 0 ? `${Math.round(stats.avgOutputLength / 1000)}k` : '--'} sub="chars" color="text-gray-300" />
      </div>

      {/* Agent Workload */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Agent Workload</h3>
        <div className="bg-dark-700 rounded-lg border border-dark-500 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dark-500 text-gray-500 text-[10px] uppercase tracking-wider">
                <th className="text-left px-4 py-2">Agent</th>
                <th className="text-center px-2 py-2">Status</th>
                <th className="text-center px-2 py-2">Total</th>
                <th className="text-center px-2 py-2">Done</th>
                <th className="text-center px-2 py-2">Review</th>
                <th className="text-center px-2 py-2">Active</th>
                <th className="text-left px-4 py-2 w-32">Completion</th>
                <th className="text-left px-4 py-2">Model</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(stats.byAgent)
                .sort(([,a], [,b]) => b.total - a.total)
                .map(([name, data]) => (
                <tr key={name} className="border-b border-dark-600 hover:bg-dark-600/30">
                  <td className="px-4 py-2">
                    <span className="mr-1.5">{data.emoji}</span>
                    <span className="text-gray-200 font-medium">{name}</span>
                  </td>
                  <td className="text-center px-2 py-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${
                      data.status === 'Working' ? 'bg-green-400 animate-pulse' :
                      data.status === 'Active' ? 'bg-blue-400' : 'bg-gray-600'
                    }`} />
                  </td>
                  <td className="text-center px-2 py-2 text-gray-300">{data.total}</td>
                  <td className="text-center px-2 py-2 text-green-400">{data.done}</td>
                  <td className="text-center px-2 py-2 text-orange-400">{data.review}</td>
                  <td className="text-center px-2 py-2 text-blue-400">{data.inProgress}</td>
                  <td className="px-4 py-2">
                    <ProgressBar
                      value={data.done}
                      max={data.total}
                      color={data.done === data.total && data.total > 0 ? 'bg-accent-green' : 'bg-accent-orange'}
                    />
                  </td>
                  <td className="px-4 py-2 text-[9px] text-gray-500">{resolveModel(data.model)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Content Type & Campaign Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Content Type Breakdown */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Content Type Breakdown</h3>
          <div className="bg-dark-700 rounded-lg border border-dark-500 p-4 space-y-3">
            {Object.entries(stats.byContentType)
              .sort(([,a], [,b]) => b.total - a.total)
              .map(([type, data]) => (
              <div key={type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-gray-300">{type}</span>
                  <span className="text-[10px] text-gray-500">{data.done}/{data.total}</span>
                </div>
                <ProgressBar value={data.done} max={data.total} color="bg-accent-blue" />
              </div>
            ))}
            {Object.keys(stats.byContentType).length === 0 && (
              <div className="text-[11px] text-gray-600 text-center py-4">No content types yet</div>
            )}
          </div>
        </div>

        {/* Campaign Progress */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Campaign Progress</h3>
          <div className="bg-dark-700 rounded-lg border border-dark-500 p-4 space-y-3">
            {Object.entries(stats.byCampaign)
              .sort(([,a], [,b]) => b.total - a.total)
              .map(([campaign, data]) => (
              <div key={campaign}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-gray-300">{campaign}</span>
                  <span className="text-[10px] text-gray-500">{data.done}/{data.total}</span>
                </div>
                <ProgressBar value={data.done} max={data.total} color="bg-accent-purple" />
              </div>
            ))}
            {Object.keys(stats.byCampaign).length === 0 && (
              <div className="text-[11px] text-gray-600 text-center py-4">No campaigns yet</div>
            )}
          </div>
        </div>
      </div>

      {/* Platform Distribution */}
      {Object.keys(stats.byPlatform).length > 0 && (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Platform Distribution</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.byPlatform)
              .sort(([,a], [,b]) => b - a)
              .map(([platform, count]) => (
              <div key={platform} className="bg-dark-700 rounded-lg border border-dark-500 px-4 py-3 flex items-center gap-2">
                <span className="text-sm">
                  {platform === 'Instagram' ? '📸' : platform === 'Facebook' ? '👥' : platform === 'TikTok' ? '🎵' :
                   platform === 'Twitter' ? '🐦' : platform === 'LinkedIn' ? '💼' : platform === 'YouTube' ? '▶️' :
                   platform === 'Email' ? '📧' : '🌐'}
                </span>
                <div>
                  <div className="text-[11px] font-semibold text-gray-200">{platform}</div>
                  <div className="text-[10px] text-gray-500">{count} task{count !== 1 ? 's' : ''}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline Funnel */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Task Pipeline</h3>
        <div className="bg-dark-700 rounded-lg border border-dark-500 p-4">
          <div className="flex items-center gap-2">
            {[
              { label: 'Inbox', count: stats.inbox, color: 'bg-gray-500', textColor: 'text-gray-400' },
              { label: 'Assigned', count: stats.assigned, color: 'bg-yellow-500', textColor: 'text-yellow-400' },
              { label: 'In Progress', count: stats.inProgress, color: 'bg-blue-500', textColor: 'text-blue-400' },
              { label: 'Review', count: stats.review, color: 'bg-orange-500', textColor: 'text-orange-400' },
              { label: 'Done', count: stats.done, color: 'bg-green-500', textColor: 'text-green-400' },
            ].map((stage, i) => (
              <div key={stage.label} className="flex-1 flex items-center">
                <div className="flex-1 text-center">
                  <div className={`text-xl font-bold ${stage.textColor}`}>{stage.count}</div>
                  <div className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">{stage.label}</div>
                  <div className={`h-1.5 ${stage.color} rounded-full mt-2 opacity-40`} style={{
                    width: `${stats.total > 0 ? Math.max(10, (stage.count / stats.total) * 100) : 10}%`,
                    margin: '0 auto',
                  }} />
                </div>
                {i < 4 && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600 shrink-0 mx-1">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity Summary */}
      <div>
        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
          Recent Completions ({stats.completions} in period)
        </h3>
        <div className="bg-dark-700 rounded-lg border border-dark-500 p-4 max-h-48 overflow-y-auto space-y-2">
          {filteredActivity
            .filter(a => a.action === 'completed' || a.type === 'Content Generated')
            .slice(0, 15)
            .map((a, i) => (
            <div key={i} className="flex items-center gap-3 text-[11px] py-1.5 border-b border-dark-600 last:border-0">
              <span className="text-gray-500 font-medium shrink-0 w-20">{a.agent}</span>
              <span className="text-gray-300 flex-1 truncate">{a.task}</span>
              <span className="text-[9px] text-gray-600 shrink-0">
                {a.timestamp ? new Date(a.timestamp).toLocaleDateString() : '--'}
              </span>
            </div>
          ))}
          {filteredActivity.filter(a => a.action === 'completed' || a.type === 'Content Generated').length === 0 && (
            <div className="text-[11px] text-gray-600 text-center py-4">No completions in this period</div>
          )}
        </div>
      </div>
    </div>
  )
}
