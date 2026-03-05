'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { AGENTS } from '../lib/agents'

// ── HELPERS ──────────────────────────────────────────

function countWords(text) {
  if (!text) return 0
  return text.split(/\s+/).filter(Boolean).length
}

function computeAgentStats(agent, tasks) {
  const agentTasks = tasks.filter(t => t.agent === agent.name)
  const total = agentTasks.length
  const completed = agentTasks.filter(t => t.status === 'Done').length
  const inProgress = agentTasks.filter(t => t.status === 'In Progress').length
  const inReview = agentTasks.filter(t => t.status === 'Review').length
  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0

  // Word count
  let totalWords = 0
  let outputCount = 0
  agentTasks.forEach(t => {
    if (t.output) {
      totalWords += countWords(t.output)
      outputCount++
    }
  })
  const avgWords = outputCount > 0 ? Math.round(totalWords / outputCount) : 0

  // Content types
  const contentTypes = {}
  agentTasks.forEach(t => {
    if (t.contentType) {
      contentTypes[t.contentType] = (contentTypes[t.contentType] || 0) + 1
    }
  })

  // Platforms
  const platforms = {}
  agentTasks.forEach(t => {
    const p = Array.isArray(t.platform) ? t.platform : t.platform ? [t.platform] : []
    p.forEach(pl => { platforms[pl] = (platforms[pl] || 0) + 1 })
  })

  // Priority distribution
  const priorities = { High: 0, Medium: 0, Low: 0 }
  agentTasks.forEach(t => {
    if (t.priority && priorities[t.priority] !== undefined) {
      priorities[t.priority]++
    }
  })

  // Unique content types count (for diversity metric)
  const diversity = Object.keys(contentTypes).length + Object.keys(platforms).length

  return {
    agent,
    total,
    completed,
    inProgress,
    inReview,
    completionRate,
    avgWords,
    totalWords,
    contentTypes,
    platforms,
    priorities,
    diversity,
  }
}

// ── RADAR CHART (SVG) ────────────────────────────────

function RadarChart({ datasets, labels, size = 240 }) {
  const cx = size / 2
  const cy = size / 2
  const r = (size / 2) - 30
  const axes = labels.length
  const angleStep = (2 * Math.PI) / axes

  // Get point on radar axis
  const getPoint = (axisIndex, value) => {
    // value is 0-1 normalized
    const angle = angleStep * axisIndex - Math.PI / 2
    return {
      x: cx + r * value * Math.cos(angle),
      y: cy + r * value * Math.sin(angle),
    }
  }

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1.0]

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="mx-auto">
      {/* Grid rings */}
      {rings.map(ring => (
        <polygon
          key={ring}
          points={Array.from({ length: axes }, (_, i) => {
            const p = getPoint(i, ring)
            return `${p.x},${p.y}`
          }).join(' ')}
          fill="none"
          stroke="#2a2a3a"
          strokeWidth="1"
          opacity={0.6}
        />
      ))}

      {/* Axis lines */}
      {Array.from({ length: axes }, (_, i) => {
        const p = getPoint(i, 1)
        return (
          <line
            key={i}
            x1={cx} y1={cy}
            x2={p.x} y2={p.y}
            stroke="#2a2a3a"
            strokeWidth="1"
            opacity={0.4}
          />
        )
      })}

      {/* Data polygons */}
      {datasets.map((ds, di) => {
        const points = ds.values.map((v, i) => {
          const p = getPoint(i, v)
          return `${p.x},${p.y}`
        }).join(' ')
        return (
          <g key={di}>
            <polygon
              points={points}
              fill={ds.color}
              fillOpacity={0.12}
              stroke={ds.color}
              strokeWidth="2"
              strokeOpacity={0.8}
            />
            {/* Data points */}
            {ds.values.map((v, i) => {
              const p = getPoint(i, v)
              return (
                <circle
                  key={i}
                  cx={p.x} cy={p.y}
                  r={3}
                  fill={ds.color}
                  stroke="#0a0a0f"
                  strokeWidth="1.5"
                />
              )
            })}
          </g>
        )
      })}

      {/* Labels */}
      {labels.map((label, i) => {
        const p = getPoint(i, 1.18)
        return (
          <text
            key={i}
            x={p.x} y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-gray-400"
            fontSize="10"
            fontWeight="500"
          >
            {label}
          </text>
        )
      })}
    </svg>
  )
}

// ── PRIORITY BAR ─────────────────────────────────────

function PriorityBar({ high, medium, low, maxTotal }) {
  const total = high + medium + low
  if (total === 0) return <span className="text-[10px] text-gray-600">No tasks</span>
  const barW = maxTotal > 0 ? (total / maxTotal) * 100 : 0
  const hPct = (high / total) * 100
  const mPct = (medium / total) * 100
  const lPct = (low / total) * 100

  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-4 bg-dark-600 rounded-full overflow-hidden flex" style={{ maxWidth: `${Math.max(barW, 20)}%` }}>
        {hPct > 0 && (
          <div className="h-full bg-red-500 transition-all duration-500" style={{ width: `${hPct}%` }} title={`High: ${high}`} />
        )}
        {mPct > 0 && (
          <div className="h-full bg-yellow-500 transition-all duration-500" style={{ width: `${mPct}%` }} title={`Medium: ${medium}`} />
        )}
        {lPct > 0 && (
          <div className="h-full bg-gray-500 transition-all duration-500" style={{ width: `${lPct}%` }} title={`Low: ${low}`} />
        )}
      </div>
      <div className="flex items-center gap-1.5 text-[9px] shrink-0">
        <span className="text-red-400 font-bold">{high}</span>
        <span className="text-gray-600">/</span>
        <span className="text-yellow-400 font-bold">{medium}</span>
        <span className="text-gray-600">/</span>
        <span className="text-gray-400 font-bold">{low}</span>
      </div>
    </div>
  )
}

// ── MAIN COMPONENT ───────────────────────────────────

export default function AgentComparison({ agents: propAgents, tasks = [], onClose }) {
  const agents = propAgents || AGENTS
  const [selected, setSelected] = useState([])

  // ESC to close
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Toggle agent selection
  const toggleAgent = useCallback((agentName) => {
    setSelected(prev => {
      if (prev.includes(agentName)) {
        return prev.filter(n => n !== agentName)
      }
      if (prev.length >= 3) return prev // Max 3
      return [...prev, agentName]
    })
  }, [])

  // Compute stats for selected agents
  const statsMap = useMemo(() => {
    const map = {}
    selected.forEach(name => {
      const agent = agents.find(a => a.name === name)
      if (agent) {
        map[name] = computeAgentStats(agent, tasks)
      }
    })
    return map
  }, [selected, agents, tasks])

  const selectedStats = selected.map(n => statsMap[n]).filter(Boolean)

  // Determine winners for each metric
  const winners = useMemo(() => {
    if (selectedStats.length < 2) return {}
    const metrics = ['total', 'completed', 'completionRate', 'avgWords', 'inReview', 'inProgress']
    const result = {}
    metrics.forEach(m => {
      let best = -1
      let bestAgent = null
      selectedStats.forEach(s => {
        if (s[m] > best) {
          best = s[m]
          bestAgent = s.agent.name
        }
      })
      // Only highlight winner if there's a clear winner (not all tied at 0)
      if (best > 0) {
        result[m] = bestAgent
      }
    })
    return result
  }, [selectedStats])

  // Prepare radar chart data
  const radarData = useMemo(() => {
    if (selectedStats.length < 2) return { datasets: [], labels: [] }

    // Find max for normalization
    const maxCompletion = Math.max(...selectedStats.map(s => s.completionRate), 1)
    const maxTotal = Math.max(...selectedStats.map(s => s.total), 1)
    const maxWords = Math.max(...selectedStats.map(s => s.avgWords), 1)
    const maxCompleted = Math.max(...selectedStats.map(s => s.completed), 1)
    const maxDiversity = Math.max(...selectedStats.map(s => s.diversity), 1)

    const datasets = selectedStats.map(s => ({
      color: s.agent.color,
      label: s.agent.name,
      values: [
        s.completionRate / maxCompletion,  // Completion Rate
        s.total / maxTotal,                // Volume
        s.avgWords / maxWords,             // Word Count
        s.completed / maxCompleted,        // Speed (completed)
        s.diversity / maxDiversity,        // Diversity
      ].map(v => Math.max(v, 0.05)), // min 5% so points are visible
    }))

    return {
      datasets,
      labels: ['Completion', 'Volume', 'Words', 'Speed', 'Diversity'],
    }
  }, [selectedStats])

  // Max total for priority bar scaling
  const maxPriorityTotal = useMemo(() => {
    return Math.max(...selectedStats.map(s => s.priorities.High + s.priorities.Medium + s.priorities.Low), 1)
  }, [selectedStats])

  // Winning cell style helper
  const isWinner = (metric, agentName) => winners[metric] === agentName

  const cellClass = (metric, agentName, baseClass = '') => {
    const win = isWinner(metric, agentName)
    return `${baseClass} ${win ? 'text-accent-green font-bold' : 'text-gray-200'}`
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative w-full h-full bg-dark-900/[0.98] overflow-y-auto animate-fade-in">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-dark-900/95 backdrop-blur-md border-b border-dark-500 px-6 py-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-accent-purple/15 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div>
                <h2 className="text-sm font-bold text-gray-100">Agent Comparison</h2>
                <p className="text-[10px] text-gray-500">
                  Select 2-3 agents to compare side-by-side
                  {selected.length > 0 && (
                    <span className="ml-1.5 text-accent-purple font-medium">
                      ({selected.length}/3 selected)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-300 p-2 rounded-lg hover:bg-dark-700 transition-colors"
              title="Close (ESC)"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 py-5 space-y-6">

          {/* ── Agent Selector ── */}
          <div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-2.5">
              Choose Agents
            </div>
            <div className="flex flex-wrap gap-2">
              {agents.map(agent => {
                const isSelected = selected.includes(agent.name)
                const isDisabled = !isSelected && selected.length >= 3
                return (
                  <button
                    key={agent.id}
                    onClick={() => !isDisabled && toggleAgent(agent.name)}
                    disabled={isDisabled}
                    className={`
                      flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200
                      ${isSelected
                        ? 'border-opacity-60 bg-opacity-10 scale-[1.02]'
                        : isDisabled
                          ? 'border-dark-500 bg-dark-800/30 opacity-40 cursor-not-allowed'
                          : 'border-dark-500 bg-dark-800/50 hover:bg-dark-700/50 hover:border-dark-400 cursor-pointer'
                      }
                    `}
                    style={isSelected ? {
                      borderColor: agent.color,
                      backgroundColor: `${agent.color}12`,
                      boxShadow: `0 0 12px ${agent.color}20`,
                    } : {}}
                  >
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
                      style={{
                        background: `${agent.color}15`,
                        border: `2px solid ${isSelected ? agent.color : '#2a2a3a'}`,
                      }}
                    >
                      {agent.emoji}
                    </div>
                    <div className="text-left">
                      <div className={`text-[11px] font-bold ${isSelected ? 'text-gray-100' : 'text-gray-300'}`}>
                        {agent.name}
                      </div>
                      <div className="text-[9px] text-gray-500 truncate max-w-[100px]">{agent.role}</div>
                    </div>
                    {isSelected && (
                      <div className="ml-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={agent.color} strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Empty state ── */}
          {selected.length < 2 && (
            <div className="text-center py-16">
              <div className="text-4xl mb-4 animate-empty-state-float">
                {selected.length === 0 ? '\u2696\uFE0F' : '\u261D\uFE0F'}
              </div>
              <div className="text-sm text-gray-400 font-medium">
                {selected.length === 0
                  ? 'Select at least 2 agents to compare'
                  : 'Select 1 more agent to start comparing'
                }
              </div>
              <div className="text-[10px] text-gray-600 mt-1">
                Click the agent cards above to select them
              </div>
            </div>
          )}

          {/* ── Comparison Table ── */}
          {selected.length >= 2 && (
            <div className="space-y-6">

              {/* Radar Chart */}
              {radarData.datasets.length >= 2 && (
                <div className="bg-dark-800/50 border border-dark-500 rounded-xl p-5">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 font-bold mb-3">
                    Performance Radar
                  </div>
                  <RadarChart
                    datasets={radarData.datasets}
                    labels={radarData.labels}
                    size={260}
                  />
                  {/* Legend */}
                  <div className="flex items-center justify-center gap-4 mt-3">
                    {selectedStats.map(s => (
                      <div key={s.agent.name} className="flex items-center gap-1.5">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: s.agent.color }}
                        />
                        <span className="text-[10px] text-gray-400 font-medium">{s.agent.emoji} {s.agent.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comparison Grid */}
              <div className="bg-dark-800/50 border border-dark-500 rounded-xl overflow-hidden">
                {/* Column headers */}
                <div className="grid border-b border-dark-500" style={{ gridTemplateColumns: `180px repeat(${selected.length}, 1fr)` }}>
                  <div className="px-4 py-3 text-[10px] uppercase tracking-wider text-gray-500 font-bold">
                    Metric
                  </div>
                  {selectedStats.map((s, i) => (
                    <div
                      key={s.agent.name}
                      className={`px-4 py-3 text-center ${i > 0 ? 'border-l border-dark-500' : ''}`}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center text-sm"
                          style={{
                            background: `${s.agent.color}15`,
                            border: `2px solid ${s.agent.color}`,
                          }}
                        >
                          {s.agent.emoji}
                        </div>
                        <div>
                          <div className="text-[11px] font-bold text-gray-200">{s.agent.name}</div>
                          <div className="text-[9px] text-gray-500">{s.agent.role}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Comparison Rows ── */}
                {[
                  {
                    label: 'Total Tasks',
                    metric: 'total',
                    icon: '\u{1F4CB}',
                    render: (s) => s.total,
                  },
                  {
                    label: 'Completed',
                    metric: 'completed',
                    icon: '\u2705',
                    render: (s) => s.completed,
                  },
                  {
                    label: 'Completion Rate',
                    metric: 'completionRate',
                    icon: '\u{1F4C8}',
                    render: (s) => `${s.completionRate}%`,
                    renderExtra: (s) => (
                      <div className="w-full mt-1.5 h-1.5 bg-dark-600 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${s.completionRate}%`,
                            backgroundColor: s.agent.color,
                          }}
                        />
                      </div>
                    ),
                  },
                  {
                    label: 'Avg. Word Count',
                    metric: 'avgWords',
                    icon: '\u{1F4DD}',
                    render: (s) => s.avgWords.toLocaleString(),
                  },
                  {
                    label: 'In Progress',
                    metric: 'inProgress',
                    icon: '\u{1F504}',
                    render: (s) => s.inProgress,
                  },
                  {
                    label: 'In Review',
                    metric: 'inReview',
                    icon: '\u{1F50D}',
                    render: (s) => s.inReview,
                  },
                ].map((row, rowIdx) => (
                  <div
                    key={row.metric}
                    className={`grid ${rowIdx % 2 === 0 ? 'bg-dark-800/50' : 'bg-dark-700/30'}`}
                    style={{ gridTemplateColumns: `180px repeat(${selected.length}, 1fr)` }}
                  >
                    <div className="px-4 py-3 flex items-center gap-2">
                      <span className="text-sm">{row.icon}</span>
                      <span className="text-[11px] text-gray-400 font-medium">{row.label}</span>
                    </div>
                    {selectedStats.map((s, i) => {
                      const win = isWinner(row.metric, s.agent.name)
                      return (
                        <div
                          key={s.agent.name}
                          className={`px-4 py-3 text-center flex flex-col items-center justify-center ${i > 0 ? 'border-l border-dark-500' : ''} ${win ? 'bg-accent-green/[0.04]' : ''}`}
                        >
                          <div className="flex items-center gap-1.5">
                            {win && <span className="text-sm">{'\u{1F451}'}</span>}
                            <span className={`text-[14px] font-bold tabular-nums ${win ? 'text-accent-green' : 'text-gray-200'}`}>
                              {row.render(s)}
                            </span>
                          </div>
                          {row.renderExtra && row.renderExtra(s)}
                        </div>
                      )
                    })}
                  </div>
                ))}

                {/* Content Types Row */}
                <div
                  className="grid bg-dark-800/50"
                  style={{ gridTemplateColumns: `180px repeat(${selected.length}, 1fr)` }}
                >
                  <div className="px-4 py-3 flex items-center gap-2">
                    <span className="text-sm">{'\u{1F3AF}'}</span>
                    <span className="text-[11px] text-gray-400 font-medium">Content Types</span>
                  </div>
                  {selectedStats.map((s, i) => {
                    const types = Object.keys(s.contentTypes)
                    return (
                      <div
                        key={s.agent.name}
                        className={`px-4 py-3 ${i > 0 ? 'border-l border-dark-500' : ''}`}
                      >
                        <div className="flex flex-wrap justify-center gap-1">
                          {types.length > 0 ? types.map(type => (
                            <span
                              key={type}
                              className="text-[9px] px-1.5 py-0.5 rounded bg-dark-600 text-gray-300 border border-dark-500"
                            >
                              {type}
                              <span className="ml-0.5 text-gray-500">({s.contentTypes[type]})</span>
                            </span>
                          )) : (
                            <span className="text-[10px] text-gray-600">None yet</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Platforms Row */}
                <div
                  className="grid bg-dark-700/30"
                  style={{ gridTemplateColumns: `180px repeat(${selected.length}, 1fr)` }}
                >
                  <div className="px-4 py-3 flex items-center gap-2">
                    <span className="text-sm">{'\u{1F4F1}'}</span>
                    <span className="text-[11px] text-gray-400 font-medium">Platforms</span>
                  </div>
                  {selectedStats.map((s, i) => {
                    const plats = Object.keys(s.platforms)
                    return (
                      <div
                        key={s.agent.name}
                        className={`px-4 py-3 ${i > 0 ? 'border-l border-dark-500' : ''}`}
                      >
                        <div className="flex flex-wrap justify-center gap-1">
                          {plats.length > 0 ? plats.map(p => (
                            <span
                              key={p}
                              className="text-[9px] px-1.5 py-0.5 rounded border border-dark-500 text-gray-300"
                              style={{ backgroundColor: `${s.agent.color}10`, borderColor: `${s.agent.color}30` }}
                            >
                              {p}
                            </span>
                          )) : (
                            <span className="text-[10px] text-gray-600">None yet</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Priority Distribution Row */}
                <div
                  className="grid bg-dark-800/50"
                  style={{ gridTemplateColumns: `180px repeat(${selected.length}, 1fr)` }}
                >
                  <div className="px-4 py-3 flex items-center gap-2">
                    <span className="text-sm">{'\u{1F525}'}</span>
                    <span className="text-[11px] text-gray-400 font-medium">Priority Split</span>
                    <div className="flex gap-1 ml-auto mr-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" title="High" />
                      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" title="Medium" />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-500" title="Low" />
                    </div>
                  </div>
                  {selectedStats.map((s, i) => (
                    <div
                      key={s.agent.name}
                      className={`px-4 py-3 flex items-center ${i > 0 ? 'border-l border-dark-500' : ''}`}
                    >
                      <PriorityBar
                        high={s.priorities.High}
                        medium={s.priorities.Medium}
                        low={s.priorities.Low}
                        maxTotal={maxPriorityTotal}
                      />
                    </div>
                  ))}
                </div>

              </div>

              {/* Summary Footer */}
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <span>{'\u{1F451}'}</span>
                  <span>= best in category</span>
                </div>
                <div className="text-[10px] text-gray-600">
                  Computed from {tasks.length} total tasks
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-dark-900/95 backdrop-blur-md border-t border-dark-500 px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span className="text-[9px] text-gray-600">
              Press <kbd className="px-1 py-0.5 bg-dark-700 rounded text-[9px] text-gray-400 font-mono">ESC</kbd> to close
            </span>
            <div className="flex items-center gap-2">
              {selected.length > 0 && (
                <button
                  onClick={() => setSelected([])}
                  className="text-[10px] px-3 py-1.5 rounded-md bg-dark-700 text-gray-400 hover:text-gray-200 hover:bg-dark-600 transition-colors"
                >
                  Clear Selection
                </button>
              )}
              <button
                onClick={onClose}
                className="text-[10px] px-4 py-1.5 rounded-md bg-accent-purple/20 text-accent-purple hover:bg-accent-purple/30 transition-colors font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
