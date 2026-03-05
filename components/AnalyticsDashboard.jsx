'use client'

import { useState, useEffect, useMemo } from 'react'
import { MODEL_OPTIONS, MODEL_LEGACY_MAP } from '../lib/constants'

function resolveModel(m) {
  const resolved = MODEL_LEGACY_MAP[m] || m || 'claude-sonnet-4-6'
  const found = MODEL_OPTIONS.find(o => o.value === resolved)
  return found ? found.label : resolved
}

// ── TERRITORY COLORS ──────────────────────────────
const TERRITORY_COLORS = {
  Celebration: { bg: 'bg-amber-500/20', border: 'border-amber-500/40', text: 'text-amber-400', bar: 'bg-amber-500', emoji: '\u{1F389}' },
  Gratitude:   { bg: 'bg-emerald-500/20', border: 'border-emerald-500/40', text: 'text-emerald-400', bar: 'bg-emerald-500', emoji: '\u{1F49A}' },
  Memory:      { bg: 'bg-violet-500/20', border: 'border-violet-500/40', text: 'text-violet-400', bar: 'bg-violet-500', emoji: '\u{1F4AD}' },
  Identity:    { bg: 'bg-cyan-500/20', border: 'border-cyan-500/40', text: 'text-cyan-400', bar: 'bg-cyan-500', emoji: '\u{2728}' },
  Tribute:     { bg: 'bg-rose-500/20', border: 'border-rose-500/40', text: 'text-rose-400', bar: 'bg-rose-500', emoji: '\u{1F54A}\uFE0F' },
}

// ── SMALL COMPONENTS ──────────────────────────────

function MetricCard({ label, value, sub, icon, color = 'text-white', trend }) {
  return (
    <div className="bg-dark-700 rounded-lg border border-dark-500 p-4 hover:border-dark-400 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
        {icon && <span className="text-sm opacity-60">{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className={`text-2xl font-bold tabular-nums ${color}`}>{value}</span>
        {trend !== undefined && (
          <span className={`text-[10px] font-medium mb-1 ${trend >= 0 ? 'text-accent-green' : 'text-red-400'}`}>
            {trend >= 0 ? '\u2191' : '\u2193'}{Math.abs(trend)}%
          </span>
        )}
      </div>
      {sub && <div className="text-[10px] text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

function MiniBar({ value, max, color = 'bg-accent-orange', height = 'h-2' }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  return (
    <div className={`w-full bg-dark-600 rounded-full ${height}`}>
      <div className={`${color} rounded-full ${height} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function ScoreRing({ score, max = 5, size = 48, label }) {
  const pct = max > 0 ? (score / max) * 100 : 0
  const radius = (size - 6) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference
  const color = score >= 4 ? '#4ade80' : score >= 3 ? '#f59e0b' : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size/2} cy={size/2} r={radius} stroke="#1f2937" strokeWidth="4" fill="none" />
        <circle
          cx={size/2} cy={size/2} r={radius}
          stroke={color} strokeWidth="4" fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-xs font-bold" style={{ color }}>{score}</span>
      </div>
      {label && <span className="text-[9px] text-gray-500 mt-0.5">{label}</span>}
    </div>
  )
}

function TerritoryCard({ territory }) {
  const colors = TERRITORY_COLORS[territory.name] || TERRITORY_COLORS.Celebration
  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3 flex-1 min-w-[140px]`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{colors.emoji}</span>
        <span className={`text-xs font-semibold ${colors.text}`}>{territory.name}</span>
      </div>
      <div className="flex items-end gap-2 mb-2">
        <span className={`text-xl font-bold ${colors.text}`}>{territory.total}</span>
        <span className="text-[10px] text-gray-500 mb-0.5">tasks</span>
      </div>
      <MiniBar value={territory.done} max={territory.total} color={colors.bar} height="h-1.5" />
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-gray-500">{territory.done} done</span>
        <span className="text-[9px] text-gray-500">{territory.percentage}% mix</span>
      </div>
    </div>
  )
}

// ── MAIN DASHBOARD ────────────────────────────────

export default function AnalyticsDashboard({ agents, tasks, activity }) {
  const [liveStats, setLiveStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview') // overview | agents | territories | quality

  // Fetch enhanced stats from API
  useEffect(() => {
    let cancelled = false
    async function fetchStats() {
      try {
        const res = await fetch('/api/stats')
        if (!res.ok) throw new Error('Stats API error')
        const data = await res.json()
        if (!cancelled) {
          setLiveStats(data)
          setLoading(false)
        }
      } catch (err) {
        console.warn('[Analytics] Stats fetch failed, using local data:', err.message)
        setLoading(false)
      }
    }
    fetchStats()
    const poller = setInterval(fetchStats, 30000) // refresh every 30s
    return () => { cancelled = true; clearInterval(poller) }
  }, [])

  // Fallback local stats when API hasn't loaded
  const localStats = useMemo(() => {
    const total = tasks.length
    const done = tasks.filter(t => t.status === 'Done').length
    return {
      totals: { tasks: total, done, agents: agents.length, agentsActive: agents.filter(a => a.status === 'Working' || a.status === 'Active').length },
      pipeline: {
        inbox: tasks.filter(t => t.status === 'Inbox').length,
        assigned: tasks.filter(t => t.status === 'Assigned').length,
        inProgress: tasks.filter(t => t.status === 'In Progress').length,
        review: tasks.filter(t => t.status === 'Review').length,
        done,
      },
      velocity: { perDay: 0, perWeek: 0, createdThisWeek: 0, completedThisWeek: 0, daysActive: 1 },
      quality: { avgScore: null, totalReviewed: 0, revisionRate: 0, scores: [] },
      territoryCoverage: [],
      agentPerformance: [],
      contentTypes: {},
      platforms: {},
      campaigns: {},
      activePipeline: 0,
    }
  }, [tasks, agents])

  const s = liveStats || localStats

  const TABS = [
    { key: 'overview', label: 'Overview', icon: '\u{1F4CA}' },
    { key: 'agents', label: 'Agent Performance', icon: '\u{1F916}' },
    { key: 'territories', label: 'Emotional Territories', icon: '\u{1F3AF}' },
    { key: 'quality', label: 'Quality & Pipeline', icon: '\u{2B50}' },
    { key: 'visuals', label: 'Visuals & Calendar', icon: '\u{1F3A8}' },
  ]

  return (
    <div className="p-6 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-gray-100">Mission Analytics</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Real-time council performance {loading ? '(loading...)' : `\u2022 ${s.velocity.daysActive} days active`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 text-[10px] px-3 py-1.5 rounded transition-colors ${
                tab === t.key
                  ? 'bg-accent-orange/15 text-accent-orange border border-accent-orange/25'
                  : 'text-gray-500 hover:text-gray-300 bg-dark-700 border border-dark-500'
              }`}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ═══ OVERVIEW TAB ═══ */}
      {tab === 'overview' && (
        <>
          {/* Velocity + Core Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
            <MetricCard
              label="Velocity"
              value={`${s.velocity.perDay}/d`}
              sub={`${s.velocity.perWeek}/week`}
              icon={'\u26A1'}
              color="text-accent-orange"
            />
            <MetricCard
              label="Total Output"
              value={s.totals.done}
              sub={`of ${s.totals.tasks} tasks`}
              icon={'\u{1F4E6}'}
              color="text-accent-green"
            />
            <MetricCard
              label="Active Pipeline"
              value={s.activePipeline || (s.pipeline.assigned + s.pipeline.inProgress + s.pipeline.review)}
              sub="in flight"
              icon={'\u{1F680}'}
              color="text-accent-blue"
            />
            <MetricCard
              label="Quality Score"
              value={s.quality.avgScore ? `${s.quality.avgScore}/5` : '--'}
              sub={s.quality.totalReviewed > 0 ? `${s.quality.totalReviewed} reviewed` : 'no reviews yet'}
              icon={'\u2B50'}
              color={s.quality.avgScore >= 4 ? 'text-accent-green' : s.quality.avgScore >= 3 ? 'text-amber-400' : 'text-gray-400'}
            />
            <MetricCard
              label="Revision Rate"
              value={`${s.quality.revisionRate}%`}
              sub="sent back"
              icon={'\u{1F504}'}
              color={s.quality.revisionRate > 50 ? 'text-red-400' : s.quality.revisionRate > 25 ? 'text-amber-400' : 'text-accent-green'}
            />
            <MetricCard
              label="Agents"
              value={`${s.totals.agentsActive}/${s.totals.agents}`}
              sub="online"
              icon={'\u{1F916}'}
              color="text-accent-purple"
            />
          </div>

          {/* This Week Snapshot */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-dark-700 rounded-lg border border-dark-500 p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">This Week</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold text-accent-green">{s.velocity.completedThisWeek}</div>
                  <div className="text-[10px] text-gray-500">completed</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-accent-blue">{s.velocity.createdThisWeek}</div>
                  <div className="text-[10px] text-gray-500">created</div>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-gray-500 mb-1">
                  <span>Throughput</span>
                  <span>{s.velocity.completedThisWeek > 0 && s.velocity.createdThisWeek > 0
                    ? `${Math.round((s.velocity.completedThisWeek / s.velocity.createdThisWeek) * 100)}%`
                    : '--'
                  }</span>
                </div>
                <MiniBar
                  value={s.velocity.completedThisWeek}
                  max={Math.max(s.velocity.createdThisWeek, s.velocity.completedThisWeek)}
                  color="bg-accent-green"
                />
              </div>
            </div>

            {/* Pipeline Funnel */}
            <div className="bg-dark-700 rounded-lg border border-dark-500 p-4">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pipeline</h3>
              <div className="flex items-end justify-between gap-2 h-24">
                {[
                  { label: 'Inbox', count: s.pipeline.inbox, color: 'bg-gray-500' },
                  { label: 'Assigned', count: s.pipeline.assigned, color: 'bg-yellow-500' },
                  { label: 'Active', count: s.pipeline.inProgress, color: 'bg-blue-500' },
                  { label: 'Review', count: s.pipeline.review, color: 'bg-orange-500' },
                  { label: 'Done', count: s.pipeline.done, color: 'bg-green-500' },
                ].map(stage => {
                  const maxCount = Math.max(s.pipeline.inbox, s.pipeline.assigned, s.pipeline.inProgress, s.pipeline.review, s.pipeline.done, 1)
                  const height = Math.max(8, (stage.count / maxCount) * 80)
                  return (
                    <div key={stage.label} className="flex-1 flex flex-col items-center">
                      <span className="text-xs font-bold text-gray-300 mb-1">{stage.count}</span>
                      <div
                        className={`w-full rounded-t ${stage.color} opacity-60 transition-all duration-500`}
                        style={{ height: `${height}px` }}
                      />
                      <span className="text-[8px] text-gray-600 mt-1 uppercase">{stage.label}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Territory Coverage Strip */}
          {s.territoryCoverage && s.territoryCoverage.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Emotional Territory Coverage</h3>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {s.territoryCoverage.map(t => (
                  <TerritoryCard key={t.name} territory={t} />
                ))}
              </div>
            </div>
          )}

          {/* Content Types + Platforms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Content Types */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Content Mix</h3>
              <div className="bg-dark-700 rounded-lg border border-dark-500 p-4 space-y-3">
                {Object.entries(s.contentTypes || {})
                  .sort(([,a], [,b]) => b.total - a.total)
                  .map(([type, data]) => (
                  <div key={type}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-gray-300">{type}</span>
                      <span className="text-[10px] text-gray-500">{data.done}/{data.total}</span>
                    </div>
                    <MiniBar value={data.done} max={data.total} color="bg-accent-blue" />
                  </div>
                ))}
                {Object.keys(s.contentTypes || {}).length === 0 && (
                  <div className="text-[11px] text-gray-600 text-center py-4">No content types yet</div>
                )}
              </div>
            </div>

            {/* Platforms */}
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Platforms</h3>
              <div className="bg-dark-700 rounded-lg border border-dark-500 p-4">
                <div className="flex flex-wrap gap-2">
                  {Object.entries(s.platforms || {})
                    .sort(([,a], [,b]) => b.total - a.total)
                    .map(([platform, data]) => (
                    <div key={platform} className="flex items-center gap-2 bg-dark-600 rounded-lg px-3 py-2">
                      <span className="text-sm">
                        {platform === 'Instagram' ? '\u{1F4F8}' : platform === 'Facebook' ? '\u{1F465}' : platform === 'TikTok' ? '\u{1F3B5}' :
                         platform === 'YouTube' ? '\u25B6\uFE0F' : platform === 'Email' ? '\u{1F4E7}' : platform === 'Blog' ? '\u{1F4DD}' : '\u{1F310}'}
                      </span>
                      <div>
                        <div className="text-[10px] font-semibold text-gray-200">{platform}</div>
                        <div className="text-[9px] text-gray-500">{data.done}/{data.total}</div>
                      </div>
                    </div>
                  ))}
                </div>
                {Object.keys(s.platforms || {}).length === 0 && (
                  <div className="text-[11px] text-gray-600 text-center py-4">No platforms yet</div>
                )}
              </div>
            </div>
          </div>

          {/* Campaign Health */}
          {Object.keys(s.campaigns || {}).length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Campaign Health</h3>
              <div className="bg-dark-700 rounded-lg border border-dark-500 p-4 space-y-3">
                {Object.entries(s.campaigns)
                  .sort(([,a], [,b]) => b.total - a.total)
                  .slice(0, 8)
                  .map(([name, data]) => (
                  <div key={name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] text-gray-300 truncate max-w-[200px]">{name}</span>
                      <div className="flex items-center gap-2">
                        {data.review > 0 && (
                          <span className="text-[9px] text-amber-400">{data.review} review</span>
                        )}
                        <span className="text-[10px] text-gray-500">{data.done}/{data.total}</span>
                      </div>
                    </div>
                    <MiniBar value={data.done} max={data.total} color="bg-accent-purple" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ AGENTS TAB ═══ */}
      {tab === 'agents' && (
        <>
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Agent Leaderboard</h3>
            <div className="bg-dark-700 rounded-lg border border-dark-500 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-dark-500 text-gray-500 text-[10px] uppercase tracking-wider">
                    <th className="text-left px-4 py-2.5">#</th>
                    <th className="text-left px-3 py-2.5">Agent</th>
                    <th className="text-center px-2 py-2.5">Status</th>
                    <th className="text-center px-2 py-2.5">Done</th>
                    <th className="text-center px-2 py-2.5">Active</th>
                    <th className="text-center px-2 py-2.5">Review</th>
                    <th className="text-center px-2 py-2.5">Rate</th>
                    <th className="text-center px-2 py-2.5">Quality</th>
                    <th className="text-left px-3 py-2.5 w-40">Progress</th>
                    <th className="text-left px-3 py-2.5">Model</th>
                  </tr>
                </thead>
                <tbody>
                  {(s.agentPerformance || []).map((agent, i) => (
                    <tr key={agent.name} className="border-b border-dark-600 hover:bg-dark-600/30">
                      <td className="px-4 py-2.5">
                        <span className={`text-xs font-bold ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-gray-300' : i === 2 ? 'text-amber-700' : 'text-gray-600'}`}>
                          {i + 1}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{agent.emoji}</span>
                          <div>
                            <div className="text-gray-200 font-medium">{agent.name}</div>
                            <div className="text-[9px] text-gray-600">{agent.role}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-center px-2 py-2.5">
                        <span className={`inline-block w-2 h-2 rounded-full ${
                          agent.status === 'Working' ? 'bg-green-400 animate-pulse' :
                          agent.status === 'Active' ? 'bg-blue-400' : 'bg-gray-600'
                        }`} />
                      </td>
                      <td className="text-center px-2 py-2.5 text-green-400 font-medium">{agent.completed}</td>
                      <td className="text-center px-2 py-2.5 text-blue-400">{agent.active}</td>
                      <td className="text-center px-2 py-2.5 text-orange-400">{agent.inReview}</td>
                      <td className="text-center px-2 py-2.5">
                        <span className={`font-medium ${
                          agent.completionRate >= 80 ? 'text-green-400' :
                          agent.completionRate >= 50 ? 'text-amber-400' : 'text-gray-500'
                        }`}>
                          {agent.completionRate}%
                        </span>
                      </td>
                      <td className="text-center px-2 py-2.5">
                        {agent.avgQualityScore ? (
                          <span className={`font-medium ${
                            parseFloat(agent.avgQualityScore) >= 4 ? 'text-green-400' :
                            parseFloat(agent.avgQualityScore) >= 3 ? 'text-amber-400' : 'text-red-400'
                          }`}>
                            {agent.avgQualityScore}
                          </span>
                        ) : (
                          <span className="text-gray-600">--</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <MiniBar
                          value={agent.completed}
                          max={agent.totalTasks}
                          color={agent.completed === agent.totalTasks && agent.totalTasks > 0 ? 'bg-accent-green' : 'bg-accent-orange'}
                        />
                      </td>
                      <td className="px-3 py-2.5 text-[9px] text-gray-500">{resolveModel(agent.model)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Agent Output Volume */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Output Volume (Characters)</h3>
            <div className="bg-dark-700 rounded-lg border border-dark-500 p-4">
              <div className="space-y-3">
                {(s.agentPerformance || [])
                  .filter(a => a.outputVolume > 0)
                  .sort((a, b) => b.outputVolume - a.outputVolume)
                  .map(agent => {
                    const maxVol = Math.max(...(s.agentPerformance || []).map(a => a.outputVolume))
                    return (
                      <div key={agent.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[11px] text-gray-300">
                            {agent.emoji} {agent.name}
                          </span>
                          <span className="text-[10px] text-gray-500 font-mono">
                            {agent.outputVolume > 1000 ? `${(agent.outputVolume / 1000).toFixed(1)}k` : agent.outputVolume} chars
                          </span>
                        </div>
                        <MiniBar value={agent.outputVolume} max={maxVol} color="bg-accent-purple" height="h-1.5" />
                      </div>
                    )
                  })}
              </div>
            </div>
          </div>

          {/* Content Type Specialization */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Agent Specializations</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {(s.agentPerformance || [])
                .filter(a => a.contentTypes && a.contentTypes.length > 0)
                .map(agent => (
                <div key={agent.name} className="bg-dark-700 rounded-lg border border-dark-500 p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <span>{agent.emoji}</span>
                    <span className="text-[11px] font-semibold text-gray-200">{agent.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {agent.contentTypes.map(ct => (
                      <span key={ct} className="text-[9px] bg-dark-600 text-gray-400 px-1.5 py-0.5 rounded">
                        {ct}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ═══ TERRITORIES TAB ═══ */}
      {tab === 'territories' && (
        <>
          {/* Territory Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            {(s.territoryCoverage || []).map(t => (
              <TerritoryCard key={t.name} territory={t} />
            ))}
            {(!s.territoryCoverage || s.territoryCoverage.length === 0) && (
              <div className="col-span-5 bg-dark-700 rounded-lg border border-dark-500 p-8 text-center">
                <div className="text-gray-500 text-sm">No territory data yet</div>
                <div className="text-[10px] text-gray-600 mt-1">Run the campaign planner to generate territory-tagged content</div>
              </div>
            )}
          </div>

          {/* Territory Balance */}
          {s.territoryCoverage && s.territoryCoverage.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Territory Balance</h3>
              <div className="bg-dark-700 rounded-lg border border-dark-500 p-4">
                <div className="flex items-end gap-1 h-32">
                  {s.territoryCoverage.map(t => {
                    const maxPct = Math.max(...s.territoryCoverage.map(x => x.percentage), 1)
                    const barHeight = Math.max(8, (t.percentage / maxPct) * 100)
                    const colors = TERRITORY_COLORS[t.name] || TERRITORY_COLORS.Celebration
                    return (
                      <div key={t.name} className="flex-1 flex flex-col items-center">
                        <span className={`text-xs font-bold mb-1 ${colors.text}`}>{t.percentage}%</span>
                        <div
                          className={`w-full rounded-t ${colors.bar} opacity-70 transition-all duration-500`}
                          style={{ height: `${barHeight}px` }}
                        />
                        <span className="text-[9px] text-gray-500 mt-2">{t.name}</span>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-dark-600">
                  <div className="text-[10px] text-gray-500 text-center">
                    {(() => {
                      const pcts = (s.territoryCoverage || []).map(t => t.percentage)
                      const idealPct = 20
                      const deviation = pcts.reduce((sum, p) => sum + Math.abs(p - idealPct), 0) / 5
                      if (deviation <= 5) return '\u2705 Excellent territory balance \u2014 well distributed'
                      if (deviation <= 10) return '\u26A0\uFE0F Moderate imbalance \u2014 some territories need more content'
                      return '\u{1F534} Significant imbalance \u2014 rotate territories in next planning cycle'
                    })()}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ QUALITY TAB ═══ */}
      {tab === 'quality' && (
        <>
          {/* Quality Overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <MetricCard
              label="Avg Quality"
              value={s.quality.avgScore ? `${s.quality.avgScore}` : '--'}
              sub="out of 5.0"
              icon={'\u2B50'}
              color={s.quality.avgScore >= 4 ? 'text-accent-green' : s.quality.avgScore >= 3 ? 'text-amber-400' : 'text-gray-400'}
            />
            <MetricCard
              label="Tasks Reviewed"
              value={s.quality.totalReviewed}
              sub="by CHIEF"
              icon={'\u{1F50D}'}
              color="text-accent-blue"
            />
            <MetricCard
              label="Revision Rate"
              value={`${s.quality.revisionRate}%`}
              sub="sent back for rework"
              icon={'\u{1F504}'}
              color={s.quality.revisionRate > 50 ? 'text-red-400' : 'text-accent-green'}
            />
            <MetricCard
              label="First-Pass Rate"
              value={`${Math.max(0, 100 - s.quality.revisionRate)}%`}
              sub="approved first try"
              icon={'\u2705'}
              color={100 - s.quality.revisionRate >= 70 ? 'text-accent-green' : 'text-amber-400'}
            />
          </div>

          {/* Recent Quality Scores */}
          {s.quality.scores && s.quality.scores.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Recent Review Scores</h3>
              <div className="bg-dark-700 rounded-lg border border-dark-500 p-4">
                <div className="space-y-2">
                  {s.quality.scores.slice(0, 10).map((score, i) => (
                    <div key={i} className="flex items-center gap-3 py-1.5 border-b border-dark-600 last:border-0">
                      <span className={`text-sm font-bold w-8 text-center ${
                        score.score >= 4 ? 'text-green-400' :
                        score.score >= 3 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {score.score}
                      </span>
                      <div className="flex-1">
                        <MiniBar value={score.score} max={5} color={
                          score.score >= 4 ? 'bg-green-500' : score.score >= 3 ? 'bg-amber-500' : 'bg-red-500'
                        } height="h-1.5" />
                      </div>
                      <span className="text-[10px] text-gray-400 truncate max-w-[200px]">{score.task}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Pipeline Health */}
          <div className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pipeline Flow</h3>
            <div className="bg-dark-700 rounded-lg border border-dark-500 p-4">
              <div className="flex items-center gap-2">
                {[
                  { label: 'Inbox', count: s.pipeline.inbox, color: 'bg-gray-500', textColor: 'text-gray-400' },
                  { label: 'Assigned', count: s.pipeline.assigned, color: 'bg-yellow-500', textColor: 'text-yellow-400' },
                  { label: 'In Progress', count: s.pipeline.inProgress, color: 'bg-blue-500', textColor: 'text-blue-400' },
                  { label: 'Review', count: s.pipeline.review, color: 'bg-orange-500', textColor: 'text-orange-400' },
                  { label: 'Done', count: s.pipeline.done, color: 'bg-green-500', textColor: 'text-green-400' },
                ].map((stage, i) => (
                  <div key={stage.label} className="flex-1 flex items-center">
                    <div className="flex-1 text-center">
                      <div className={`text-xl font-bold ${stage.textColor}`}>{stage.count}</div>
                      <div className="text-[9px] text-gray-500 uppercase tracking-wider mt-0.5">{stage.label}</div>
                      <div className={`h-1.5 ${stage.color} rounded-full mt-2 opacity-40`} style={{
                        width: `${s.totals.tasks > 0 ? Math.max(10, (stage.count / s.totals.tasks) * 100) : 10}%`,
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
        </>
      )}

      {/* ═══ VISUALS & CALENDAR TAB ═══ */}
      {tab === 'visuals' && (
        <>
          {/* Visual Asset Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <MetricCard
              label="Images Generated"
              value={s.visualAssets?.generated || 0}
              sub="DALL-E 3 visuals"
              icon="🎨"
              color="text-pink-400"
            />
            <MetricCard
              label="Image Tasks"
              value={s.visualAssets?.imageTasks || 0}
              sub={`${s.visualAssets?.imageTasksDone || 0} completed`}
              icon="🖼️"
              color="text-violet-400"
            />
            <MetricCard
              label="Visual Coverage"
              value={s.totals.done > 0 ? `${Math.round(((s.visualAssets?.generated || 0) / Math.max(1, s.totals.done)) * 100)}%` : '0%'}
              sub="of approved content has visuals"
              icon="📐"
              color="text-cyan-400"
            />
          </div>

          {/* Platform Visual Mix */}
          {s.platforms && Object.keys(s.platforms).length > 0 && (
            <div className="bg-dark-700 rounded-lg border border-dark-500 p-4 mb-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Platform Content Mix</h3>
              <div className="space-y-2">
                {Object.entries(s.platforms).map(([platform, data]) => (
                  <div key={platform} className="flex items-center gap-3">
                    <span className="text-xs text-gray-400 w-20 shrink-0">{platform}</span>
                    <MiniBar value={data.done} max={data.total} color="bg-accent-orange" />
                    <span className="text-[10px] text-gray-500 w-16 text-right">{data.done}/{data.total}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content Calendar */}
          <div className="bg-dark-700 rounded-lg border border-dark-500 p-4">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              📅 Content Calendar
              <span className="text-gray-600 font-normal ml-2">upcoming scheduled</span>
            </h3>
            {(!s.calendar || s.calendar.length === 0) ? (
              <p className="text-xs text-gray-600 text-center py-6">No scheduled content yet — CMO will plan the pipeline</p>
            ) : (
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {s.calendar.map((item, i) => {
                  const dateObj = new Date(item.date + 'T12:00:00')
                  const dayStr = dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                  const isToday = item.date === new Date().toISOString().split('T')[0]
                  const isPast = new Date(item.date) < new Date(new Date().toISOString().split('T')[0])

                  return (
                    <div key={i} className={`flex items-center gap-3 px-3 py-2 rounded text-xs ${
                      isToday ? 'bg-accent-orange/10 border border-accent-orange/20' :
                      isPast ? 'opacity-40' : 'hover:bg-dark-600'
                    }`}>
                      <span className={`w-24 shrink-0 font-mono text-[10px] ${isToday ? 'text-accent-orange font-bold' : 'text-gray-500'}`}>
                        {isToday ? '▶ TODAY' : dayStr}
                      </span>
                      <span className="text-gray-300 flex-1 truncate">{item.name}</span>
                      <span className="text-[9px] text-gray-600 uppercase">{item.contentType}</span>
                      {item.agent && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-dark-600 text-gray-500">{item.agent}</span>
                      )}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                        item.status === 'In Progress' ? 'bg-blue-500/20 text-blue-400' :
                        item.status === 'Review' ? 'bg-orange-500/20 text-orange-400' :
                        item.status === 'Assigned' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-dark-600 text-gray-500'
                      }`}>{item.status}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Content Type Breakdown */}
          {s.contentTypes && Object.keys(s.contentTypes).length > 0 && (
            <div className="bg-dark-700 rounded-lg border border-dark-500 p-4 mt-6">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Content Type Breakdown</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(s.contentTypes).map(([type, data]) => (
                  <div key={type} className="bg-dark-600 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-white">{data.total}</div>
                    <div className="text-[9px] text-gray-500 uppercase tracking-wider">{type}</div>
                    <div className="flex justify-center gap-2 mt-1">
                      <span className="text-[9px] text-green-400">{data.done} done</span>
                      {data.inProgress > 0 && <span className="text-[9px] text-blue-400">{data.inProgress} wip</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
