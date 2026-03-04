'use client'

import { useState, useMemo, useEffect } from 'react'

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

const COUNCIL_ICONS = ['\u{1F3AF}', '\u{1F3DB}', '\u{1F680}', '\u{1F4A1}', '\u{1F4CA}', '\u{1F916}', '\u{1F3A8}', '\u{1F30D}', '\u{2697}\uFE0F', '\u{1F4E3}']
const COUNCIL_COLORS = ['#FF6B35', '#3B82F6', '#10B981', '#8B5CF6', '#EC4899', '#F59E0B', '#06B6D4', '#EF4444', '#6366F1', '#14B8A6']

export default function CouncilIntelligence({ agents, tasks, activity }) {
  const [activeTab, setActiveTab] = useState('intelligence')
  const [councils, setCouncils] = useState([])
  const [loadingCouncils, setLoadingCouncils] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newCouncil, setNewCouncil] = useState({
    name: '', org: '', description: '', icon: '\u{1F3DB}', color: '#3B82F6',
  })

  // Fetch councils
  useEffect(() => {
    async function fetchCouncils() {
      setLoadingCouncils(true)
      try {
        const res = await fetch('/api/councils')
        if (res.ok) {
          const data = await res.json()
          setCouncils(data.councils || [])
        }
      } catch (err) {
        console.warn('Failed to fetch councils:', err.message)
      }
      setLoadingCouncils(false)
    }
    fetchCouncils()
  }, [])

  // Create council
  async function handleCreateCouncil(e) {
    e.preventDefault()
    if (!newCouncil.name.trim()) return
    setCreating(true)
    try {
      const res = await fetch('/api/councils', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCouncil),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.council) {
          setCouncils(prev => [...prev, {
            id: data.council.id,
            name: newCouncil.name,
            org: newCouncil.org,
            description: newCouncil.description,
            icon: newCouncil.icon,
            color: newCouncil.color,
            isActive: true,
            agentCount: 0,
            taskCount: 0,
          }])
        }
        setNewCouncil({ name: '', org: '', description: '', icon: '\u{1F3DB}', color: '#3B82F6' })
        setShowCreateForm(false)
      }
    } catch (err) {
      console.error('Failed to create council:', err)
    }
    setCreating(false)
  }

  // Intelligence metrics
  const intelligence = useMemo(() => {
    const collabMatrix = {}
    agents.forEach(a => {
      collabMatrix[a.name] = {}
      agents.forEach(b => {
        if (a.name !== b.name) {
          const aTypes = new Set(tasks.filter(t => t.agent === a.name).map(t => t.type))
          const bTasks = tasks.filter(t => t.agent === b.name && aTypes.has(t.type))
          collabMatrix[a.name][b.name] = bTasks.length
        }
      })
    })

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

    const dailyActivity = Array.from({ length: 7 }, (_, i) => {
      const day = new Date()
      day.setDate(day.getDate() - (6 - i))
      const dayStr = day.toDateString()
      return activity.filter(a => new Date(a.timestamp).toDateString() === dayStr).length
    })

    const completedRecently = tasks.filter(t => {
      if (t.status !== 'Done' || !t.createdAt) return false
      const age = Date.now() - new Date(t.createdAt).getTime()
      return age < 7 * 24 * 60 * 60 * 1000
    }).length

    const typeCounts = {}
    tasks.forEach(t => {
      const type = t.type || 'other'
      typeCounts[type] = (typeCounts[type] || 0) + 1
    })
    const topTypes = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

    const statusCounts = {}
    tasks.forEach(t => { statusCounts[t.status] = (statusCounts[t.status] || 0) + 1 })

    const bottlenecks = []
    const reviewCount = tasks.filter(t => t.status === 'Review').length
    if (reviewCount > 3) bottlenecks.push({ type: 'review_backlog', message: `${reviewCount} tasks waiting for review`, severity: 'high' })
    const inboxCount = tasks.filter(t => t.status === 'Inbox').length
    if (inboxCount > 5) bottlenecks.push({ type: 'inbox_overflow', message: `${inboxCount} unassigned tasks in inbox`, severity: 'medium' })
    const overloaded = workload.filter(w => w.active > 5)
    overloaded.forEach(w => bottlenecks.push({ type: 'overloaded', message: `${w.agent.name} has ${w.active} active tasks`, severity: 'medium' }))

    const collabPairs = []
    Object.entries(collabMatrix).forEach(([a, partners]) => {
      Object.entries(partners).forEach(([b, count]) => {
        if (count > 0 && a < b) collabPairs.push({ a, b, count })
      })
    })
    collabPairs.sort((a, b) => b.count - a.count)

    return {
      workload, dailyActivity, completedRecently, topTypes, statusCounts,
      bottlenecks, collabPairs: collabPairs.slice(0, 5),
      totalTasks: tasks.length, totalActivity: activity.length,
    }
  }, [agents, tasks, activity])

  const statusColors = {
    Inbox: 'bg-gray-500', Assigned: 'bg-yellow-500',
    'In Progress': 'bg-blue-500', Review: 'bg-orange-500', Done: 'bg-green-500',
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header with tabs */}
      <div className="px-4 py-3 border-b border-dark-500 flex items-center justify-between shrink-0 bg-dark-800/50">
        <div className="flex items-center gap-4">
          <div className="flex bg-dark-600 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('intelligence')}
              className={`text-xs px-3 py-1.5 rounded-md transition-all font-medium ${
                activeTab === 'intelligence' ? 'bg-accent-orange text-dark-900' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Intelligence
            </button>
            <button
              onClick={() => setActiveTab('councils')}
              className={`text-xs px-3 py-1.5 rounded-md transition-all font-medium ${
                activeTab === 'councils' ? 'bg-accent-orange text-dark-900' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Councils
            </button>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[10px]">
          {activeTab === 'intelligence' && (
            <>
              <span className="text-gray-500">{intelligence.totalTasks} tasks</span>
              <span className="text-accent-green">{intelligence.completedRecently} completed this week</span>
            </>
          )}
          {activeTab === 'councils' && (
            <span className="text-gray-500">{councils.length} council{councils.length !== 1 ? 's' : ''}</span>
          )}
        </div>
      </div>

      {/* Intelligence Tab */}
      {activeTab === 'intelligence' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
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
            <div className="bg-dark-700 border border-dark-500 rounded-lg p-4">
              <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">7-Day Activity</h3>
              <MiniGraph data={intelligence.dailyActivity} width={200} height={40} />
              <div className="flex items-center justify-between mt-2 text-[10px] text-gray-500">
                <span>7 days ago</span><span>Today</span>
              </div>
            </div>

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

          <div className="bg-dark-700 border border-dark-500 rounded-lg p-4">
            <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">Agent Workload</h3>
            <div className="space-y-2">
              {intelligence.workload.map(w => (
                <div key={w.agent.id} className="flex items-center gap-3">
                  <span className="text-base w-6 text-center">{w.agent.emoji}</span>
                  <span className="text-[10px] text-gray-400 w-16 truncate">{w.agent.name}</span>
                  <div className="flex-1 h-3 bg-dark-600 rounded-full overflow-hidden flex">
                    {w.done > 0 && <div className="h-full bg-green-500" style={{ width: `${(w.done / Math.max(w.total, 1)) * 100}%` }} />}
                    {w.review > 0 && <div className="h-full bg-orange-500" style={{ width: `${(w.review / Math.max(w.total, 1)) * 100}%` }} />}
                    {(w.active - w.review) > 0 && <div className="h-full bg-blue-500" style={{ width: `${((w.active - w.review) / Math.max(w.total, 1)) * 100}%` }} />}
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
      )}

      {/* Councils Tab */}
      {activeTab === 'councils' && (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Create Council Button */}
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full p-4 border-2 border-dashed border-dark-400 rounded-lg text-gray-400 hover:text-accent-orange hover:border-accent-orange/50 transition-all flex items-center justify-center gap-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              <span className="text-sm font-medium">Create New Council</span>
            </button>
          )}

          {/* Create Council Form */}
          {showCreateForm && (
            <form onSubmit={handleCreateCouncil} className="bg-dark-700 border border-accent-orange/30 rounded-lg p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-gray-200">New Council</h3>
                <button type="button" onClick={() => setShowCreateForm(false)} className="text-gray-500 hover:text-gray-300">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Council Name *</label>
                <input
                  type="text"
                  value={newCouncil.name}
                  onChange={e => setNewCouncil(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Product Council, Sales Council..."
                  className="w-full bg-dark-600 border border-dark-400 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-accent-orange focus:outline-none"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Organization</label>
                <input
                  type="text"
                  value={newCouncil.org}
                  onChange={e => setNewCouncil(p => ({ ...p, org: e.target.value }))}
                  placeholder="e.g. Songfinch, Acme Corp..."
                  className="w-full bg-dark-600 border border-dark-400 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-accent-orange focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-1">Description</label>
                <textarea
                  value={newCouncil.description}
                  onChange={e => setNewCouncil(p => ({ ...p, description: e.target.value }))}
                  placeholder="What does this council do?"
                  rows={2}
                  className="w-full bg-dark-600 border border-dark-400 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:border-accent-orange focus:outline-none resize-none"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-2">Icon</label>
                  <div className="flex flex-wrap gap-1.5">
                    {COUNCIL_ICONS.map(icon => (
                      <button
                        key={icon}
                        type="button"
                        onClick={() => setNewCouncil(p => ({ ...p, icon }))}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-all ${
                          newCouncil.icon === icon ? 'bg-accent-orange/20 border border-accent-orange/50 scale-110' : 'bg-dark-600 border border-dark-400 hover:border-gray-400'
                        }`}
                      >
                        {icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider block mb-2">Color</label>
                  <div className="flex flex-wrap gap-1.5">
                    {COUNCIL_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewCouncil(p => ({ ...p, color }))}
                        className={`w-8 h-8 rounded-lg transition-all ${
                          newCouncil.color === color ? 'ring-2 ring-white/50 scale-110' : 'hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="bg-dark-600 rounded-lg p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                  style={{ backgroundColor: `${newCouncil.color}20`, border: `2px solid ${newCouncil.color}` }}>
                  {newCouncil.icon}
                </div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: newCouncil.color }}>
                    {newCouncil.name || 'Council Name'}
                  </div>
                  <div className="text-[10px] text-gray-500">{newCouncil.org || 'Organization'}</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating || !newCouncil.name.trim()}
                  className="flex-1 bg-accent-orange text-dark-900 font-semibold text-sm py-2 rounded-lg hover:bg-accent-orange/90 transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Council'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 bg-dark-600 text-gray-400 text-sm rounded-lg hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          {/* Council Cards */}
          {loadingCouncils ? (
            <div className="text-center py-8">
              <div className="text-2xl mb-2 animate-spin inline-block">&#9203;</div>
              <p className="text-[12px] text-gray-500">Loading councils...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {councils.map(council => (
                <div key={council.id} className="bg-dark-700 border border-dark-500 rounded-lg p-4 hover:border-dark-400 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl shrink-0"
                      style={{ backgroundColor: `${council.color}15`, border: `2px solid ${council.color}` }}>
                      {council.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold" style={{ color: council.color }}>{council.name}</h3>
                        {council.isActive && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-green-500/10 text-green-400 rounded-full font-semibold">ACTIVE</span>
                        )}
                        {council.id === 'default' && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-accent-orange/10 text-accent-orange rounded-full font-semibold">CURRENT</span>
                        )}
                      </div>
                      {council.org && <div className="text-[10px] text-gray-500 mt-0.5">{council.org}</div>}
                      {council.description && <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">{council.description}</p>}
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <div className="text-[10px] text-gray-500">{council.agentCount || agents.length} agents</div>
                      <div className="text-[10px] text-gray-600">{council.taskCount || tasks.length} tasks</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Council Features Info */}
          <div className="bg-dark-700/50 border border-dark-500 rounded-lg p-4 mt-4">
            <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Council Architecture</h3>
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-dark-600 rounded-lg p-3 text-center">
                <div className="text-lg mb-1">{'\u{1F916}'}</div>
                <div className="text-[10px] font-semibold text-gray-300">Agent Teams</div>
                <div className="text-[9px] text-gray-500 mt-0.5">Each council has its own set of AI agents</div>
              </div>
              <div className="bg-dark-600 rounded-lg p-3 text-center">
                <div className="text-lg mb-1">{'\u{1F4CB}'}</div>
                <div className="text-[10px] font-semibold text-gray-300">Task Pipelines</div>
                <div className="text-[9px] text-gray-500 mt-0.5">Separate task queues and workflows</div>
              </div>
              <div className="bg-dark-600 rounded-lg p-3 text-center">
                <div className="text-lg mb-1">{'\u{1F9E0}'}</div>
                <div className="text-[10px] font-semibold text-gray-300">Shared Memory</div>
                <div className="text-[9px] text-gray-500 mt-0.5">Cross-council learning and context</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
