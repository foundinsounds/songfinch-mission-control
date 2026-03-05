'use client'

import { useMemo } from 'react'

// ── HIERARCHY DEFINITION ─────────────────────────
// Mirrors lib/agents.js type field: EXEC > OPS > LEAD > SPC/INT
const HIERARCHY = {
  CMO:   { tier: 0, label: 'EXEC',  children: ['CHIEF'] },
  CHIEF: { tier: 1, label: 'OPS',   children: ['MUSE'] },
  MUSE:  { tier: 2, label: 'LEAD',  children: ['HOOK', 'STORY', 'PULSE', 'LENS', 'FLOW', 'SCOUT', 'PIXEL'] },
}

const SQUADS = [
  { name: 'Content Squad', agents: ['STORY', 'HOOK'], color: 'border-amber-500/30', bg: 'bg-amber-500/5' },
  { name: 'Distribution Squad', agents: ['PULSE', 'FLOW'], color: 'border-cyan-500/30', bg: 'bg-cyan-500/5' },
  { name: 'Research', agents: ['SCOUT'], color: 'border-emerald-500/30', bg: 'bg-emerald-500/5' },
  { name: 'Visual Squad', agents: ['LENS', 'PIXEL'], color: 'border-violet-500/30', bg: 'bg-violet-500/5' },
]

const FLOW_STEPS = [
  { from: 'CMO', to: 'CHIEF', label: 'Strategic Brief' },
  { from: 'CHIEF', to: 'MUSE', label: 'Task Assignment' },
  { from: 'MUSE', to: 'Specialists', label: 'Creative Direction' },
]

const STATUS_DOTS = {
  Working:  'bg-accent-green animate-pulse',
  Active:   'bg-accent-green',
  Idle:     'bg-gray-500',
  Paused:   'bg-amber-500',
  Error:    'bg-red-500',
  Offline:  'bg-gray-700',
}

// ── AGENT NODE ───────────────────────────────────
function AgentNode({ agent, taskCount, reviewCount, avgScore, onClick, size = 'normal' }) {
  const dotClass = STATUS_DOTS[agent.status] || STATUS_DOTS.Idle
  const isLarge = size === 'large'

  return (
    <button
      onClick={() => onClick?.(agent)}
      className={`group relative flex flex-col items-center gap-1 rounded-xl border transition-all duration-200 hover:scale-105 hover:shadow-lg hover:shadow-black/30 cursor-pointer ${
        isLarge
          ? 'border-accent-orange/30 bg-dark-700/80 px-6 py-4 min-w-[140px]'
          : 'border-dark-400 bg-dark-700/60 px-4 py-3 min-w-[110px]'
      }`}
    >
      {/* Status dot */}
      <div className={`absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full ${dotClass} ring-2 ring-dark-800`} />

      {/* Emoji avatar */}
      <span className={isLarge ? 'text-2xl' : 'text-xl'}>{agent.emoji || '🤖'}</span>

      {/* Name + role */}
      <span className={`font-bold ${isLarge ? 'text-sm text-accent-orange' : 'text-xs text-gray-200'}`}>
        {agent.name}
      </span>
      <span className="text-[9px] text-gray-500 -mt-0.5">{agent.role}</span>

      {/* Metrics row */}
      <div className="flex items-center gap-2 mt-1">
        {taskCount > 0 && (
          <span className="text-[9px] bg-dark-600 px-1.5 py-0.5 rounded text-gray-400">
            {taskCount} tasks
          </span>
        )}
        {reviewCount > 0 && (
          <span className="text-[9px] bg-amber-500/15 px-1.5 py-0.5 rounded text-amber-400">
            {reviewCount} review
          </span>
        )}
        {avgScore !== null && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
            avgScore >= 4 ? 'bg-accent-green/15 text-accent-green'
              : avgScore >= 3 ? 'bg-amber-500/15 text-amber-400'
              : 'bg-red-500/15 text-red-400'
          }`}>
            {avgScore}/5
          </span>
        )}
      </div>

      {/* Tier badge */}
      {HIERARCHY[agent.name] && (
        <span className="absolute -bottom-2 text-[8px] bg-dark-600 border border-dark-400 px-1.5 py-0 rounded-full text-gray-500">
          {HIERARCHY[agent.name].label}
        </span>
      )}
    </button>
  )
}

// ── CONNECTOR LINE (vertical) ────────────────────
function VConnector({ label }) {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="w-px h-6 bg-dark-400" />
      {label && (
        <span className="text-[8px] text-gray-600 bg-dark-800 px-2 py-0.5 rounded-full border border-dark-600 my-1 whitespace-nowrap">
          ↓ {label}
        </span>
      )}
      <div className="w-px h-6 bg-dark-400" />
    </div>
  )
}

// ── MAIN ORG CHART ───────────────────────────────
export default function AgentOrgChart({ agents = [], tasks = [], onAgentClick }) {
  // Build lookup maps
  const agentMap = useMemo(() => {
    const m = {}
    agents.forEach(a => { m[a.name] = a })
    return m
  }, [agents])

  const agentTaskCounts = useMemo(() => {
    const counts = {}
    const reviews = {}
    tasks.forEach(t => {
      if (!t.agent) return
      if (t.status === 'Review') {
        reviews[t.agent] = (reviews[t.agent] || 0) + 1
      } else if (['Assigned', 'In Progress', 'Done'].includes(t.status)) {
        counts[t.agent] = (counts[t.agent] || 0) + 1
      }
    })
    return { counts, reviews }
  }, [tasks])

  // Compute simple quality scores from Done tasks with scores in output
  const agentScores = useMemo(() => {
    const scores = {}
    tasks.forEach(t => {
      if (t.status === 'Done' && t.agent && t.output) {
        const match = t.output.match(/Score:\s*(\d+\.?\d*)\/5/i) ||
                      t.output.match(/(\d+\.?\d*)\/5/)
        if (match) {
          if (!scores[t.agent]) scores[t.agent] = []
          scores[t.agent].push(parseFloat(match[1]))
        }
      }
    })
    const avgs = {}
    Object.entries(scores).forEach(([agent, vals]) => {
      avgs[agent] = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10
    })
    return avgs
  }, [tasks])

  const getAgent = (name) => agentMap[name] || { name, role: name, emoji: '🤖', status: 'Idle' }

  const nodeProps = (name, size) => ({
    agent: getAgent(name),
    taskCount: agentTaskCounts.counts[name] || 0,
    reviewCount: agentTaskCounts.reviews[name] || 0,
    avgScore: agentScores[name] ?? null,
    onClick: onAgentClick,
    size,
  })

  // Pipeline flow summary
  const pipelineSummary = useMemo(() => {
    const planned = tasks.filter(t => t.status === 'Planned').length
    const assigned = tasks.filter(t => t.status === 'Assigned').length
    const inProgress = tasks.filter(t => t.status === 'In Progress').length
    const review = tasks.filter(t => t.status === 'Review').length
    const done = tasks.filter(t => t.status === 'Done').length
    return { planned, assigned, inProgress, review, done, total: tasks.length }
  }, [tasks])

  return (
    <div className="space-y-6">
      {/* Title + legend */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-100">Agent Organization Chart</h3>
          <p className="text-[10px] text-gray-500 mt-0.5">Hierarchy, squads, and workflow flow</p>
        </div>
        <div className="flex items-center gap-3">
          {Object.entries(STATUS_DOTS).slice(0, 4).map(([status, cls]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className={`w-2 h-2 rounded-full ${cls.replace(' animate-pulse', '')}`} />
              <span className="text-[9px] text-gray-500">{status}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── PIPELINE FLOW BAR ── */}
      <div className="bg-dark-700/50 rounded-lg border border-dark-500 p-3">
        <div className="flex items-center gap-1 text-[9px] text-gray-500 mb-2 font-semibold uppercase tracking-wider">
          <span>Pipeline Flow</span>
        </div>
        <div className="flex items-center gap-0.5">
          {[
            { label: 'Planned', count: pipelineSummary.planned, color: 'bg-blue-500' },
            { label: 'Assigned', count: pipelineSummary.assigned, color: 'bg-purple-500' },
            { label: 'In Progress', count: pipelineSummary.inProgress, color: 'bg-accent-orange' },
            { label: 'Review', count: pipelineSummary.review, color: 'bg-amber-500' },
            { label: 'Done', count: pipelineSummary.done, color: 'bg-accent-green' },
          ].map((step, i) => {
            const pct = pipelineSummary.total > 0 ? Math.max(2, (step.count / pipelineSummary.total) * 100) : 20
            return (
              <div key={step.label} className="flex flex-col items-center" style={{ width: `${pct}%` }}>
                <div className={`${step.color} h-2 w-full rounded-sm ${i === 0 ? 'rounded-l-full' : ''} ${i === 4 ? 'rounded-r-full' : ''}`} />
                <span className="text-[8px] text-gray-500 mt-1">{step.label}</span>
                <span className="text-[10px] font-bold text-gray-300">{step.count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── ORG CHART TREE ── */}
      <div className="bg-dark-700/30 rounded-xl border border-dark-500 p-6 overflow-x-auto">
        <div className="flex flex-col items-center min-w-[600px]">

          {/* TIER 0: CMO */}
          <AgentNode {...nodeProps('CMO', 'large')} />

          {/* Connector: CMO → CHIEF */}
          <VConnector label="Strategic Brief" />

          {/* TIER 1: CHIEF */}
          <AgentNode {...nodeProps('CHIEF', 'large')} />

          {/* Connector: CHIEF → MUSE */}
          <VConnector label="Task Assignment + Review" />

          {/* TIER 2: MUSE */}
          <AgentNode {...nodeProps('MUSE', 'large')} />

          {/* Connector: MUSE → Squads */}
          <VConnector label="Creative Direction" />

          {/* Branch connectors */}
          <div className="relative w-full max-w-[700px]">
            {/* Horizontal line across */}
            <div className="absolute top-0 left-[12.5%] right-[12.5%] h-px bg-dark-400" />
            {/* Vertical drops to each squad */}
            <div className="flex justify-between px-[10%]">
              {SQUADS.map((_, i) => (
                <div key={i} className="w-px h-4 bg-dark-400" />
              ))}
            </div>
          </div>

          {/* TIER 3: SPECIALIST SQUADS */}
          <div className="grid grid-cols-4 gap-4 w-full max-w-[750px] mt-2">
            {SQUADS.map(squad => (
              <div
                key={squad.name}
                className={`rounded-lg border ${squad.color} ${squad.bg} p-3 flex flex-col items-center gap-2`}
              >
                <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">
                  {squad.name}
                </span>
                {squad.agents.map(agentName => (
                  <AgentNode key={agentName} {...nodeProps(agentName)} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── WORKFLOW DESCRIPTION ── */}
      <div className="bg-dark-700/30 rounded-lg border border-dark-500 p-4">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Workflow Flow</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {
              step: '1',
              title: 'CMO Plans',
              desc: 'Creates strategic campaign briefs with emotional territories, audience targeting, and content requirements.',
              color: 'text-accent-orange border-accent-orange/30',
            },
            {
              step: '2',
              title: 'CHIEF Assigns → MUSE Directs',
              desc: 'CHIEF reviews and assigns to squads. MUSE adds creative direction (tone, hooks, visual style) before specialists begin.',
              color: 'text-violet-400 border-violet-500/30',
            },
            {
              step: '3',
              title: 'Specialists Execute → CHIEF Reviews',
              desc: 'Squad agents produce content. MUSE runs Creative QA first, then CHIEF scores final quality (1-5). Approved content ships.',
              color: 'text-accent-green border-accent-green/30',
            },
          ].map(item => (
            <div key={item.step} className={`rounded-lg border ${item.color.split(' ')[1]} bg-dark-700/50 p-3`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold ${item.color.split(' ')[0]} bg-dark-600 w-5 h-5 rounded-full flex items-center justify-center`}>
                  {item.step}
                </span>
                <span className={`text-xs font-semibold ${item.color.split(' ')[0]}`}>{item.title}</span>
              </div>
              <p className="text-[10px] text-gray-500 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
