'use client'

import { useMemo } from 'react'

function MiniGraph({ data, color = '#F97316', height = 32, width = 120 }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data)
  const min = Math.min(...data)
  const range = max - min || 1
  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`
  ).join(' ')

  return (
    <svg width={width} height={height} className="opacity-80">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function CouncilIntelligence({ agents, tasks, activity }) {
  // Generate cross-council intelligence metrics
  const intelligence = useMemo(() => {
    // Agent collaboration matrix — who works on related tasks
    const collabMatrix = {}
    agents.forEach(a => {
      collabMatrix[a.name] = {}
      agents.forEach(b => {
        if (a.name !== b.name) {
          // Count tasks where both agents worked on same type
          const aTypes = new Set(tasks.filter(t => t.agent === a.name).map(t => t.type))
          const bTasks = tasks.filter(t => t.agent === b.name && aTypes.has(t.type))
          collabMatrix[a.name][b.name] = bTasks.length
        }
      })
    })

    // Workload distribution
    const workload = agents.map(a => {
      const agentTasks = tasks.filter(t => t.agent === a.name)
      return {
        agent: a,
        total: agentTasks.length,
        active: agentTasks.filter(t => t.status !== 'Done').length,
        done: agentTasks.filter(t => t.status === 'Done').length,
        review: agentTasks.filter(t => t.status === 'Review').length,
      }
    }).sort((a, b) => b.active - a.active)

    // Activity over time (last 7 days)
    const dailyActivity = Array.from({ length: 7 }, (_, i) => {
      const day = new Date()
      day.setDate(day.getDate() - (6 - i))
      const dayStr = day.toDateString()
      return activity.filter(a => new Date(a.timestamp).toDateString() === dayStr).length
    })

    // Task completion velocity
    const completedRecently = tasks.filter(t => {
      if (t.status !== 'Done' || !t.createdAt) return false
      const age = Date.now() - new Date(t.createdAt).getTime()
      return age < 7 * 24 * 60 * 60 * 1000
    }).length

    // Type distribution
    const typeCounts = {}
    tasks.forEach(t => {
      const type = t.type || 'other'
      typeCounts[type] = (typeCounts[type] || 0) + 1
    })
    const topTypes = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)

    // Status distribution
    const statusCounts = {}
    tasks.forEach(t => {
      statusCounts[t.status] = (statusCounts[t.status] || 0) + 1
    })

    // Bottleneck detection
    const bottlenecks = []
    const reviewCount = tasks.filter(t => t.status === 'Review').length
    if (reviewCount > 3) bottlenecks.push({ type: 'review_backlog', message: `${reviewCount} tasks waiting for review`, severity: 'high' })
    const inboxCount = tasks.filter(t => t.status === 'Inbox').length
    if (inboxCount > 5) bottlenecks.push({ type: 'inbox_overflow', message: `${inboxCount} unassigned tasks in inbox`, severity: 'medium' })
    const overloaded = workload.filter(w => w.active > 5)
    overloaded.forEach(w => bottlenecks.push({ type: 'overloaded', message: `${w.agent.name} has ${w.active} active tasks`, severity: 'medium' }))

    // Top collaborators
    const collabPairs = []
    Object.entries(collabMatrix).forEach(([a, partners]) => {
      Object.entries(partners).forEach(([b, count]) => {
        if (count > 0 && a < b) collabPairs.push({ a, b, count })
      })
    })
    collabPairs.sort((a, b) => b.count - a.count)

    return {
      workload,
      dailyActivity,
      completedRecently,
      topTypes,
      statusCounts,
      bottlenecks,
      collabPairs: collabPairs.slice(0, 5),
      totalTasks: tasks.length,
      totalActivity: activity.length,
    }
  }, [agents, tasks, activity])

  const statusColors = {
    Inbox: 'bg-gray-500',
    Assigned: 'bg-yellow-500',
    'In Progress': 'bg-blue-500',
    Review: 'bg-orange-500',
    Done: 'bg-green-500',
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-dark-500 flex items-center justify-between shrink-0 bg-dark-800/50">
        <h2 className="text-sm font-bold text-gray-200">Council Intelligence</h2>
        <div className="flex items-center gap-4 text-[10px]">
          <span className="text-gray-500">{intelligence.totalTasks} tasks</span>
          <span className="text-accent-green">{intelligence.completedRecently} completed this week</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Bottleneck Alerts */}
        {intelligence.bottlenecks.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Alerts</h3>
            {intelligence.bottlenecks.map((b, i) => (
              <div key={i} className={`p-3 rounded-lg border flex items-center gap-3 ${
                b.severity === 'high' ? 'bg-red-500/10 border-red-500/30' : 'bg-yellow-500/10 border-yellow-500/30'
              }`}>
                <span className={`text-lg ${b.severity === 'high' ? 'text-red-400' : 'text-yellow-400'}`}>
                  {b.severity === 'high' ? '!' : '?'}
                </span>
                <span className="text-xs">{b.message}</span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          {/* Activity Trend */}
          <div className="bg-dark-700 border border-dark-500 rounded-lg p-4">
            <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">7-Day Activity</h3>
            <MiniGraph data={intelligence.dailyActivity} width={200} height={40} />
            <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500">
              <span>7 days ago</span>
              <span>Today</span>
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="bg-dark-700 border border-dark-500 rounded-lg p-4">
            <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Pipeline Status</h3>
            <div className="space-y-2">
              {Object.entries(intelligence.statusCounts).map(([status, count]) => (
                <div key={status} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusColors[status] || 'bg-gray-500'}`} />
                  <span className="text-[10px] text-gray-400 w-20">{status}</span>
                  <div className="flex-1 h-1.5 bg-dark-600 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${statusColors[status] || 'bg-gray-500'}`}
                      style={{ width: `${(count / intelligence.totalTasks) * 100}%` }} />
                  </div>
                  <span className="text-[10px] text-gray-500 w-6 text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Workload Distribution */}
        <div className="bg-dark-700 border border-dark-500 rounded-lg p-4">
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Agent Workload</h3>
          <div className="space-y-2">
            {intelligence.workload.map(w => (
              <div key={w.agent.id} className="flex items-center gap-3">
                <span className="text-base w-6 text-center">{w.agent.emoji}</span>
                <span className="text-[10px] text-gray-400 w-16 truncate">{w.agent.name}</span>
                <div className="flex-1 h-3 bg-dark-600 rounded-full overflow-hidden flex">
                  {w.done > 0 && (
                    <div className="h-full bg-green-500" style={{ width: `${(w.done / Math.max(w.total, 1)) * 100}%` }} />
                  )}
                  {w.review > 0 && (
                    <div className="h-full bg-orange-500" style={{ width: `${(w.review / Math.max(w.total, 1)) * 100}%` }} />
                  )}
                  {(w.active - w.review) > 0 && (
                    <div className="h-full bg-blue-500" style={{ width: `${((w.active - w.review) / Math.max(w.total, 1)) * 100}%` }} />
                  )}
                </div>
                <span className="text-[10px] text-gray-500 w-12 text-right">{w.active}/{w.total}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[9px] text-gray-600">
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-green-500 rounded-full inline-block" /> Done</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-500 rounded-full inline-block" /> Review</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full inline-block" /> Active</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Content Type Mix */}
          <div className="bg-dark-700 border border-dark-500 rounded-lg p-4">
            <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Content Types</h3>
            <div className="space-y-2">
              {intelligence.topTypes.map(([type, count]) => (
                <div key={type} className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 capitalize">{type.replace(/_/g, ' ')}</span>
                  <span className="text-[10px] text-gray-500 font-semibold">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Collaboration Pairs */}
          <div className="bg-dark-700 border border-dark-500 rounded-lg p-4">
            <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Agent Synergies</h3>
            {intelligence.collabPairs.length > 0 ? (
              <div className="space-y-2">
                {intelligence.collabPairs.map((pair, i) => {
                  const agentA = agents.find(a => a.name === pair.a)
                  const agentB = agents.find(a => a.name === pair.b)
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm">{agentA?.emoji}</span>
                      <span className="text-[10px] text-gray-600">&harr;</span>
                      <span className="text-sm">{agentB?.emoji}</span>
                      <span className="text-[10px] text-gray-400 flex-1">{pair.a} + {pair.b}</span>
                      <span className="text-[10px] text-accent-orange font-semibold">{pair.count}</span>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-[10px] text-gray-600">No cross-agent patterns detected yet</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
