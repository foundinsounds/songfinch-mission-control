'use client'

import { useMemo, useState } from 'react'

// ═══════════════════════════════════════════════════════════
// AgentWorkflowLive — Real-time agent workflow visualization
// Shows the live flow of tasks through the AI agent pipeline.
// ═══════════════════════════════════════════════════════════

// ── CONSTANTS ─────────────────────────────────────────────

const SQUADS = [
  { name: 'Content',      agents: ['STORY', 'HOOK'],  emoji: '✍️',
    cls: { border: 'border-amber-500/40', bg: 'bg-amber-500/5', shadow: 'shadow-md shadow-amber-500/5', line: 'bg-amber-400/60', text: 'text-amber-400/70', tagBg: 'bg-amber-500/10', borderStatic: 'border-amber-500/30' } },
  { name: 'Distribution', agents: ['PULSE', 'FLOW'],  emoji: '📡',
    cls: { border: 'border-cyan-500/40', bg: 'bg-cyan-500/5', shadow: 'shadow-md shadow-cyan-500/5', line: 'bg-cyan-400/60', text: 'text-cyan-400/70', tagBg: 'bg-cyan-500/10', borderStatic: 'border-cyan-500/30' } },
  { name: 'Research',     agents: ['SCOUT'],           emoji: '🔍',
    cls: { border: 'border-emerald-500/40', bg: 'bg-emerald-500/5', shadow: 'shadow-md shadow-emerald-500/5', line: 'bg-emerald-400/60', text: 'text-emerald-400/70', tagBg: 'bg-emerald-500/10', borderStatic: 'border-emerald-500/30' } },
  { name: 'Visual',       agents: ['LENS', 'PIXEL'],  emoji: '🎨',
    cls: { border: 'border-violet-500/40', bg: 'bg-violet-500/5', shadow: 'shadow-md shadow-violet-500/5', line: 'bg-violet-400/60', text: 'text-violet-400/70', tagBg: 'bg-violet-500/10', borderStatic: 'border-violet-500/30' } },
]

const STAGE_CONFIG = {
  Planned:       { icon: '📋', border: 'border-blue-500/30',   bg: 'bg-blue-500/5',   bgHover: 'bg-blue-500/10',   badge: 'bg-blue-500/15 text-blue-400',   barOn: 'bg-blue-500/60',   barOff: 'bg-blue-500/20',   bar: 'bg-blue-400' },
  Assigned:      { icon: '📨', border: 'border-purple-500/30', bg: 'bg-purple-500/5', bgHover: 'bg-purple-500/10', badge: 'bg-purple-500/15 text-purple-400', barOn: 'bg-purple-500/60', barOff: 'bg-purple-500/20', bar: 'bg-purple-400' },
  'In Progress': { icon: '🔨', border: 'border-orange-500/30', bg: 'bg-orange-500/5', bgHover: 'bg-orange-500/10', badge: 'bg-orange-500/15 text-orange-400', barOn: 'bg-orange-500/60', barOff: 'bg-orange-500/20', bar: 'bg-orange-400' },
  Review:        { icon: '🔍', border: 'border-amber-500/30',  bg: 'bg-amber-500/5',  bgHover: 'bg-amber-500/10',  badge: 'bg-amber-500/15 text-amber-400',  barOn: 'bg-amber-500/60',  barOff: 'bg-amber-500/20',  bar: 'bg-amber-400' },
  Done:          { icon: '✅', border: 'border-green-500/30',  bg: 'bg-green-500/5',  bgHover: 'bg-green-500/10',  badge: 'bg-green-500/15 text-green-400',  barOn: 'bg-green-500/60',  barOff: 'bg-green-500/20',  bar: 'bg-green-400' },
}

const STATUS_DOT = {
  Working:  'bg-green-400 animate-pulse',
  Active:   'bg-green-400',
  Idle:     'bg-gray-500',
  Paused:   'bg-amber-500',
  Error:    'bg-red-500 animate-pulse',
  Offline:  'bg-gray-700',
}

const HANDOFF_COLORS = {
  assigned:  'border-purple-500/40 text-purple-400',
  started:   'border-orange-500/40 text-orange-400',
  completed: 'border-green-500/40 text-green-400',
  reviewed:  'border-amber-500/40 text-amber-400',
  generated: 'border-cyan-500/40 text-cyan-400',
}

// ── HELPERS ───────────────────────────────────────────────

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - new Date(ts).getTime()
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`
  return `${Math.round(diff / 86400000)}d ago`
}

function truncate(str, len = 40) {
  if (!str) return ''
  return str.length > len ? str.substring(0, len) + '...' : str
}

function buildActiveConnections(tasks) {
  const connections = new Map()
  const agentWorkload = {}

  tasks.forEach(t => {
    if (!t.agent || t.status === 'Inbox' || t.status === 'Done') return

    agentWorkload[t.agent] = (agentWorkload[t.agent] || 0) + 1

    let key = null
    let type = null

    if (t.status === 'Planned') {
      key = 'CMO→CHIEF'
      type = 'brief'
    } else if (t.status === 'Assigned') {
      key = `MUSE→${t.agent}`
      type = 'assign'
    } else if (t.status === 'In Progress') {
      key = `MUSE→${t.agent}`
      type = 'execute'
    } else if (t.status === 'Review') {
      key = `${t.agent}→CHIEF`
      type = 'review'
    }

    if (key) {
      if (!connections.has(key)) connections.set(key, { count: 0, tasks: [], type })
      const conn = connections.get(key)
      conn.count++
      conn.tasks.push(t)
    }
  })

  return { connections, agentWorkload }
}

// ── FLOW NODE ─────────────────────────────────────────────

function FlowNode({ agent, workload, isActive, onClick, size = 'normal' }) {
  const dotClass = STATUS_DOT[agent?.status] || STATUS_DOT.Idle
  const isLarge = size === 'large'
  const hasWork = workload > 0
  const isWorking = agent?.status === 'Working' || agent?.status === 'Active'

  return (
    <button
      onClick={() => onClick?.(agent)}
      className={`group relative flex flex-col items-center gap-0.5 rounded-xl border transition-all duration-300 cursor-pointer ${
        isLarge ? 'px-5 py-3 min-w-[120px]' : 'px-3 py-2 min-w-[90px]'
      } ${
        isWorking && hasWork
          ? 'border-green-500/40 bg-green-500/5 shadow-lg shadow-green-500/10'
          : hasWork
            ? 'border-accent-orange/30 bg-dark-700/80 shadow-md shadow-accent-orange/5'
            : 'border-dark-400 bg-dark-700/60'
      } hover:scale-105 hover:shadow-lg hover:shadow-black/30`}
    >
      {/* Status dot */}
      <div className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${dotClass} ring-2 ring-dark-800`} />

      {/* Workload badge */}
      {hasWork && (
        <div className="absolute -top-1 -left-1 min-w-[16px] h-4 rounded-full bg-accent-orange text-[8px] text-black font-bold flex items-center justify-center px-1">
          {workload}
        </div>
      )}

      {/* Emoji */}
      <span className={isLarge ? 'text-xl' : 'text-lg'}>{agent?.emoji || '🤖'}</span>

      {/* Name */}
      <span className={`font-bold ${isLarge ? 'text-xs text-accent-orange' : 'text-[10px] text-gray-200'}`}>
        {agent?.name || '??'}
      </span>

      {/* Status text */}
      <span className={`text-[8px] ${isWorking ? 'text-green-400' : 'text-gray-600'}`}>
        {agent?.status || 'Idle'}
      </span>
    </button>
  )
}

// ── ANIMATED CONNECTOR ────────────────────────────────────

function FlowConnector({ label, active, count, direction = 'down' }) {
  const isHorizontal = direction === 'right'

  if (isHorizontal) {
    return (
      <div className="flex items-center px-1">
        <div className={`h-px w-8 transition-colors duration-500 ${
          active ? 'bg-gray-400/60' : 'bg-dark-400'
        }`} />
        {active && count > 0 && (
          <span className="text-[7px] text-gray-400 bg-dark-800 px-1 rounded-full border border-gray-500/20 mx-0.5 whitespace-nowrap">
            {count}
          </span>
        )}
        <div className={`h-px w-8 transition-colors duration-500 ${
          active ? 'bg-gray-400/60' : 'bg-dark-400'
        }`} />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center py-0.5">
      <div className={`w-px h-4 transition-colors duration-500 ${
        active ? 'bg-accent-orange/60' : 'bg-dark-400'
      }`} />
      {label && (
        <span className={`text-[7px] bg-dark-800 px-1.5 py-0.5 rounded-full border whitespace-nowrap my-0.5 transition-colors duration-500 ${
          active
            ? 'border-accent-orange/30 text-accent-orange/80'
            : 'border-dark-600 text-gray-600'
        }`}>
          {active ? '⚡' : '↓'} {label}
          {active && count > 0 ? ` (${count})` : ''}
        </span>
      )}
      <div className={`w-px h-4 transition-colors duration-500 ${
        active ? 'bg-accent-orange/60' : 'bg-dark-400'
      }`} />
    </div>
  )
}

// ── ACTIVE TASK CARD (compact) ────────────────────────────

function TaskFlowCard({ task, agent }) {
  const stageConfig = STAGE_CONFIG[task.status] || STAGE_CONFIG.Planned
  const stages = ['Planned', 'Assigned', 'In Progress', 'Review', 'Done']
  const currentIdx = stages.indexOf(task.status)

  return (
    <div className={`rounded-lg border ${stageConfig.border} ${stageConfig.bg} p-2.5 hover:${stageConfig.bgHover} transition-colors`}>
      {/* Task name + stage */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-semibold text-gray-200 leading-tight">
          {truncate(task.name, 50)}
        </span>
        <span className={`text-[8px] shrink-0 px-1.5 py-0.5 rounded-full ${stageConfig.badge} font-semibold`}>
          {stageConfig.icon} {task.status}
        </span>
      </div>

      {/* Agent + campaign */}
      <div className="flex items-center gap-2 mb-1.5">
        {task.agent && (
          <span className="text-[9px] bg-dark-600 px-1.5 py-0.5 rounded text-gray-300">
            {agent?.emoji || '🤖'} {task.agent}
          </span>
        )}
        {task.campaign && (
          <span className="text-[9px] text-gray-600 truncate">{task.campaign}</span>
        )}
        {task.priority === 'High' && (
          <span className="text-[8px] bg-red-500/15 text-red-400 px-1 py-0.5 rounded font-bold">HIGH</span>
        )}
      </div>

      {/* Mini progress bar — shows stage progression */}
      <div className="flex items-center gap-0.5">
        {stages.map((stage, i) => (
          <div
            key={stage}
            className={`h-1 flex-1 rounded-full transition-all duration-500 ${
              i <= currentIdx
                ? i === currentIdx
                  ? `${stageConfig.bar} ${task.status === 'In Progress' ? 'animate-pulse' : ''}`
                  : 'bg-gray-600'
                : 'bg-dark-500'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

// ── HANDOFF ENTRY ─────────────────────────────────────────

function HandoffEntry({ entry }) {
  const colorClass = HANDOFF_COLORS[entry.action] || 'border-gray-500/40 text-gray-400'
  const actionIcons = {
    assigned: '📨',
    started: '🔨',
    completed: '✅',
    reviewed: '⭐',
    generated: '✨',
  }

  return (
    <div className={`flex items-start gap-2 rounded-lg border ${colorClass.split(' ')[0]} bg-dark-700/40 p-2`}>
      <span className="text-sm shrink-0 mt-0.5">{actionIcons[entry.action] || '📌'}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold ${colorClass.split(' ')[1]}`}>
            {entry.agent}
          </span>
          <span className="text-[9px] text-gray-500">{entry.action}</span>
        </div>
        <p className="text-[9px] text-gray-400 truncate">{entry.task}</p>
      </div>
      <span className="text-[8px] text-gray-600 shrink-0">{timeAgo(entry.timestamp)}</span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════

export default function AgentWorkflowLive({ agents = [], tasks = [], activity = [], onAgentClick }) {
  const [view, setView] = useState('flow') // flow | hierarchy

  // Agent lookup
  const agentMap = useMemo(() => {
    const m = {}
    agents.forEach(a => { m[a.name] = a })
    return m
  }, [agents])

  const getAgent = (name) => agentMap[name] || { name, emoji: '🤖', status: 'Idle', role: name }

  // Active connections derived from task data
  const { connections, agentWorkload } = useMemo(
    () => buildActiveConnections(tasks),
    [tasks]
  )

  // Tasks in each stage (non-Done, non-Inbox)
  const activeTasks = useMemo(() => {
    return tasks
      .filter(t => t.status && t.status !== 'Inbox' && t.status !== 'Done')
      .sort((a, b) => {
        const order = ['In Progress', 'Review', 'Assigned', 'Planned']
        return order.indexOf(a.status) - order.indexOf(b.status)
      })
  }, [tasks])

  // Stage counts for pipeline bar
  const stageCounts = useMemo(() => {
    const counts = {}
    Object.keys(STAGE_CONFIG).forEach(s => { counts[s] = 0 })
    tasks.forEach(t => { if (counts[t.status] !== undefined) counts[t.status]++ })
    return counts
  }, [tasks])

  // Recent handoffs from activity
  const handoffs = useMemo(() => {
    return activity
      .filter(a => a.action && a.agent)
      .slice(0, 8)
  }, [activity])

  // Check if a connection is active
  const isConnectionActive = (from, to) => {
    return connections.has(`${from}→${to}`)
  }

  const getConnectionCount = (from, to) => {
    const conn = connections.get(`${from}→${to}`)
    return conn ? conn.count : 0
  }

  // Total active work
  const totalActive = activeTasks.length
  const totalDone = stageCounts.Done || 0

  return (
    <div className="space-y-4">

      {/* ── HEADER ──────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-100">
            {view === 'flow' ? 'Live Agent Workflow' : 'Agent Organization'}
          </h3>
          <p className="text-[10px] text-gray-500 mt-0.5">
            {view === 'flow'
              ? `${totalActive} active tasks in pipeline · ${totalDone} completed`
              : 'Hierarchy, squads, and roles'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-dark-700 rounded-lg border border-dark-500 p-0.5">
            <button
              onClick={() => setView('flow')}
              className={`text-[9px] px-2.5 py-1 rounded transition-colors ${
                view === 'flow'
                  ? 'bg-accent-orange/15 text-accent-orange border border-accent-orange/25'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              ⚡ Live Flow
            </button>
            <button
              onClick={() => setView('hierarchy')}
              className={`text-[9px] px-2.5 py-1 rounded transition-colors ${
                view === 'hierarchy'
                  ? 'bg-accent-orange/15 text-accent-orange border border-accent-orange/25'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              🏗️ Hierarchy
            </button>
          </div>

          {/* Status legend */}
          <div className="flex items-center gap-2">
            {[
              { label: 'Working', cls: 'bg-green-400' },
              { label: 'Idle', cls: 'bg-gray-500' },
              { label: 'Review', cls: 'bg-amber-500' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-1">
                <div className={`w-1.5 h-1.5 rounded-full ${s.cls}`} />
                <span className="text-[8px] text-gray-500">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {view === 'flow' ? (
        <>
          {/* ── PIPELINE OVERVIEW BAR ──────────────────── */}
          <div className="bg-dark-700/50 rounded-lg border border-dark-500 p-3">
            <div className="flex items-center gap-1">
              {Object.entries(STAGE_CONFIG).map(([stage, config], i, arr) => {
                const count = stageCounts[stage] || 0
                const total = tasks.length || 1
                const pct = Math.max(8, (count / total) * 100)
                const isActive = count > 0 && stage !== 'Done'

                return (
                  <div key={stage} className="flex items-center" style={{ width: `${pct}%` }}>
                    <div className="flex flex-col items-center w-full">
                      <div className={`w-full h-2 rounded-sm ${isActive ? config.barOn : config.barOff} ${
                        stage === 'In Progress' && isActive ? 'animate-pulse' : ''
                      } ${i === 0 ? 'rounded-l-full' : ''} ${i === arr.length - 1 ? 'rounded-r-full' : ''}`} />
                      <span className="text-[8px] text-gray-500 mt-1">{config.icon} {stage}</span>
                      <span className={`text-[10px] font-bold ${count > 0 ? 'text-gray-200' : 'text-gray-600'}`}>{count}</span>
                    </div>
                    {i < arr.length - 1 && (
                      <span className="text-[8px] text-gray-600 mx-1 shrink-0">→</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* ── AGENT FLOW NETWORK ─────────────────────── */}
          <div className="bg-dark-700/30 rounded-xl border border-dark-500 p-5 overflow-x-auto">
            <div className="flex flex-col items-center min-w-[600px]">

              {/* EXEC: CMO */}
              <FlowNode
                agent={getAgent('CMO')}
                workload={agentWorkload['CMO'] || 0}
                isActive={isConnectionActive('CMO', 'CHIEF')}
                onClick={onAgentClick}
                size="large"
              />

              {/* CMO → CHIEF connector */}
              <FlowConnector
                label="Strategic Brief"
                active={isConnectionActive('CMO', 'CHIEF')}
                count={getConnectionCount('CMO', 'CHIEF')}
              />

              {/* OPS: CHIEF */}
              <FlowNode
                agent={getAgent('CHIEF')}
                workload={agentWorkload['CHIEF'] || 0}
                isActive={
                  isConnectionActive('CMO', 'CHIEF') ||
                  [...connections.keys()].some(k => k.endsWith('→CHIEF'))
                }
                onClick={onAgentClick}
                size="large"
              />

              {/* CHIEF → MUSE connector */}
              <FlowConnector
                label="Task Assignment"
                active={
                  [...connections.keys()].some(k => k.startsWith('MUSE→'))
                }
                count={activeTasks.filter(t => ['Assigned', 'In Progress'].includes(t.status)).length}
              />

              {/* LEAD: MUSE */}
              <FlowNode
                agent={getAgent('MUSE')}
                workload={agentWorkload['MUSE'] || 0}
                isActive={[...connections.keys()].some(k => k.startsWith('MUSE→'))}
                onClick={onAgentClick}
                size="large"
              />

              {/* MUSE → Squads connector */}
              <FlowConnector
                label="Creative Direction"
                active={[...connections.keys()].some(k => k.startsWith('MUSE→'))}
                count={activeTasks.filter(t => t.agent && !['CMO', 'CHIEF', 'MUSE'].includes(t.agent)).length}
              />

              {/* Branch lines */}
              <div className="relative w-full max-w-[700px]">
                <div className={`absolute top-0 left-[12.5%] right-[12.5%] h-px transition-colors duration-500 ${
                  [...connections.keys()].some(k => k.startsWith('MUSE→'))
                    ? 'bg-accent-orange/40'
                    : 'bg-dark-400'
                }`} />
                <div className="flex justify-between px-[10%]">
                  {SQUADS.map((sq) => {
                    const hasActive = sq.agents.some(a =>
                      isConnectionActive('MUSE', a) || agentWorkload[a] > 0
                    )
                    return (
                      <div key={sq.name} className={`w-px h-4 transition-colors duration-500 ${
                        hasActive ? sq.cls.line : 'bg-dark-400'
                      }`} />
                    )
                  })}
                </div>
              </div>

              {/* SPECIALIST SQUADS */}
              <div className="grid grid-cols-4 gap-3 w-full max-w-[750px] mt-2">
                {SQUADS.map(squad => {
                  const squadActive = squad.agents.some(a => agentWorkload[a] > 0)
                  const squadTasks = activeTasks.filter(t => squad.agents.includes(t.agent))

                  return (
                    <div
                      key={squad.name}
                      className={`rounded-lg border p-3 flex flex-col items-center gap-2 transition-all duration-500 ${
                        squadActive
                          ? `${squad.cls.border} ${squad.cls.bg} ${squad.cls.shadow}`
                          : 'border-dark-400 bg-dark-700/30'
                      }`}
                    >
                      <span className="text-[8px] font-semibold text-gray-400 uppercase tracking-wider">
                        {squad.emoji} {squad.name}
                      </span>

                      {squad.agents.map(agentName => (
                        <FlowNode
                          key={agentName}
                          agent={getAgent(agentName)}
                          workload={agentWorkload[agentName] || 0}
                          isActive={agentWorkload[agentName] > 0}
                          onClick={onAgentClick}
                        />
                      ))}

                      {/* Active task names in this squad */}
                      {squadTasks.length > 0 && (
                        <div className="w-full space-y-1 mt-1">
                          {squadTasks.slice(0, 2).map(t => (
                            <div key={t.id} className={`text-[8px] ${squad.cls.text} ${squad.cls.tagBg} rounded px-1.5 py-0.5 truncate`}>
                              {STAGE_CONFIG[t.status]?.icon || '📄'} {truncate(t.name, 30)}
                            </div>
                          ))}
                          {squadTasks.length > 2 && (
                            <div className="text-[7px] text-gray-600 text-center">
                              +{squadTasks.length - 2} more
                            </div>
                          )}
                        </div>
                      )}

                      {/* Review flow indicator */}
                      {squad.agents.some(a => isConnectionActive(a, 'CHIEF')) && (
                        <div className="text-[7px] text-amber-400/80 bg-amber-500/10 rounded-full px-2 py-0.5">
                          ↑ Review → CHIEF
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* ── ACTIVE TASKS IN FLIGHT ─────────────────── */}
          {activeTasks.length > 0 && (
            <div>
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                ⚡ Tasks In Flight ({activeTasks.length})
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {activeTasks.slice(0, 9).map(task => (
                  <TaskFlowCard
                    key={task.id}
                    task={task}
                    agent={task.agent ? getAgent(task.agent) : null}
                  />
                ))}
              </div>
              {activeTasks.length > 9 && (
                <p className="text-[9px] text-gray-600 text-center mt-2">
                  +{activeTasks.length - 9} more tasks in pipeline
                </p>
              )}
            </div>
          )}

          {/* ── HANDOFF STREAM ─────────────────────────── */}
          {handoffs.length > 0 && (
            <div>
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                📡 Recent Agent Activity
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {handoffs.map(entry => (
                  <HandoffEntry key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        /* ── HIERARCHY VIEW (static org chart) ────────── */
        <HierarchyView
          agents={agents}
          tasks={tasks}
          agentMap={agentMap}
          agentWorkload={agentWorkload}
          getAgent={getAgent}
          onAgentClick={onAgentClick}
        />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════
// HIERARCHY VIEW — Static org chart (kept for reference)
// ═══════════════════════════════════════════════════════════

function HierarchyView({ agents, tasks, agentMap, agentWorkload, getAgent, onAgentClick }) {
  const agentTaskCounts = useMemo(() => {
    const counts = {}
    const reviews = {}
    tasks.forEach(t => {
      if (!t.agent) return
      if (t.status === 'Review') reviews[t.agent] = (reviews[t.agent] || 0) + 1
      else if (['Assigned', 'In Progress', 'Done'].includes(t.status)) counts[t.agent] = (counts[t.agent] || 0) + 1
    })
    return { counts, reviews }
  }, [tasks])

  const agentScores = useMemo(() => {
    const scores = {}
    tasks.forEach(t => {
      if (t.status === 'Done' && t.agent && t.output) {
        const match = t.output.match(/Score:\s*(\d+\.?\d*)\/5/i) || t.output.match(/(\d+\.?\d*)\/5/)
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

  function StaticNode({ name, size }) {
    const agent = getAgent(name)
    const dotClass = STATUS_DOT[agent.status] || STATUS_DOT.Idle
    const isLarge = size === 'large'
    const tc = agentTaskCounts.counts[name] || 0
    const rc = agentTaskCounts.reviews[name] || 0
    const score = agentScores[name] ?? null

    return (
      <button
        onClick={() => onAgentClick?.(agent)}
        className={`group relative flex flex-col items-center gap-1 rounded-xl border transition-all duration-200 hover:scale-105 cursor-pointer ${
          isLarge
            ? 'border-accent-orange/30 bg-dark-700/80 px-6 py-4 min-w-[140px]'
            : 'border-dark-400 bg-dark-700/60 px-4 py-3 min-w-[110px]'
        }`}
      >
        <div className={`absolute -top-1.5 -right-1.5 w-3 h-3 rounded-full ${dotClass} ring-2 ring-dark-800`} />
        <span className={isLarge ? 'text-2xl' : 'text-xl'}>{agent.emoji || '🤖'}</span>
        <span className={`font-bold ${isLarge ? 'text-sm text-accent-orange' : 'text-xs text-gray-200'}`}>
          {agent.name}
        </span>
        <span className="text-[9px] text-gray-500 -mt-0.5">{agent.role}</span>
        <div className="flex items-center gap-2 mt-1">
          {tc > 0 && <span className="text-[9px] bg-dark-600 px-1.5 py-0.5 rounded text-gray-400">{tc} tasks</span>}
          {rc > 0 && <span className="text-[9px] bg-amber-500/15 px-1.5 py-0.5 rounded text-amber-400">{rc} review</span>}
          {score !== null && (
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
              score >= 4 ? 'bg-green-500/15 text-green-400' : score >= 3 ? 'bg-amber-500/15 text-amber-400' : 'bg-red-500/15 text-red-400'
            }`}>{score}/5</span>
          )}
        </div>
      </button>
    )
  }

  return (
    <div className="space-y-4">
      {/* Pipeline flow bar */}
      <div className="bg-dark-700/50 rounded-lg border border-dark-500 p-3">
        <div className="text-[9px] text-gray-500 font-semibold uppercase tracking-wider mb-2">Pipeline Flow</div>
        <div className="flex items-center gap-0.5">
          {['Planned', 'Assigned', 'In Progress', 'Review', 'Done'].map((stage, i) => {
            const count = tasks.filter(t => t.status === stage).length
            const total = tasks.length || 1
            const pct = Math.max(2, (count / total) * 100)
            return (
              <div key={stage} className="flex flex-col items-center" style={{ width: `${pct}%` }}>
                <div className={`h-2 w-full rounded-sm ${
                  stage === 'Planned' ? 'bg-blue-500' :
                  stage === 'Assigned' ? 'bg-purple-500' :
                  stage === 'In Progress' ? 'bg-accent-orange' :
                  stage === 'Review' ? 'bg-amber-500' : 'bg-green-500'
                } ${i === 0 ? 'rounded-l-full' : ''} ${i === 4 ? 'rounded-r-full' : ''}`} />
                <span className="text-[8px] text-gray-500 mt-1">{stage}</span>
                <span className="text-[10px] font-bold text-gray-300">{count}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Org tree */}
      <div className="bg-dark-700/30 rounded-xl border border-dark-500 p-6 overflow-x-auto">
        <div className="flex flex-col items-center min-w-[600px]">
          <StaticNode name="CMO" size="large" />
          <div className="flex flex-col items-center py-1">
            <div className="w-px h-6 bg-dark-400" />
            <span className="text-[8px] text-gray-600 bg-dark-800 px-2 py-0.5 rounded-full border border-dark-600 my-1">↓ Strategic Brief</span>
            <div className="w-px h-6 bg-dark-400" />
          </div>
          <StaticNode name="CHIEF" size="large" />
          <div className="flex flex-col items-center py-1">
            <div className="w-px h-6 bg-dark-400" />
            <span className="text-[8px] text-gray-600 bg-dark-800 px-2 py-0.5 rounded-full border border-dark-600 my-1">↓ Task Assignment + Review</span>
            <div className="w-px h-6 bg-dark-400" />
          </div>
          <StaticNode name="MUSE" size="large" />
          <div className="flex flex-col items-center py-1">
            <div className="w-px h-6 bg-dark-400" />
            <span className="text-[8px] text-gray-600 bg-dark-800 px-2 py-0.5 rounded-full border border-dark-600 my-1">↓ Creative Direction</span>
            <div className="w-px h-6 bg-dark-400" />
          </div>

          <div className="relative w-full max-w-[700px]">
            <div className="absolute top-0 left-[12.5%] right-[12.5%] h-px bg-dark-400" />
            <div className="flex justify-between px-[10%]">
              {SQUADS.map((_, i) => <div key={i} className="w-px h-4 bg-dark-400" />)}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 w-full max-w-[750px] mt-2">
            {SQUADS.map(squad => (
              <div key={squad.name} className={`rounded-lg border ${squad.cls.borderStatic} ${squad.cls.bg} p-3 flex flex-col items-center gap-2`}>
                <span className="text-[9px] font-semibold text-gray-400 uppercase tracking-wider mb-1">{squad.name}</span>
                {squad.agents.map(name => <StaticNode key={name} name={name} />)}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Workflow steps */}
      <div className="bg-dark-700/30 rounded-lg border border-dark-500 p-4">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-3">Workflow Flow</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            { step: '1', title: 'CMO Plans', desc: 'Creates strategic campaign briefs with emotional territories, audience targeting, and content requirements.', color: 'text-accent-orange border-accent-orange/30' },
            { step: '2', title: 'CHIEF Assigns → MUSE Directs', desc: 'CHIEF reviews and assigns to squads. MUSE adds creative direction (tone, hooks, visual style) before specialists begin.', color: 'text-violet-400 border-violet-500/30' },
            { step: '3', title: 'Specialists Execute → CHIEF Reviews', desc: 'Squad agents produce content. MUSE runs Creative QA first, then CHIEF scores final quality (1-5). Approved content ships.', color: 'text-green-400 border-green-500/30' },
          ].map(item => (
            <div key={item.step} className={`rounded-lg border ${item.color.split(' ')[1]} bg-dark-700/50 p-3`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-xs font-bold ${item.color.split(' ')[0]} bg-dark-600 w-5 h-5 rounded-full flex items-center justify-center`}>{item.step}</span>
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
