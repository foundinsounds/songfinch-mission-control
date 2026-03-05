'use client'

import { useState, useEffect, useRef, useMemo } from 'react'

// ── AGENT PIXEL AVATARS ──────────────────────────────
// Each agent gets a unique pixel art character defined as a tiny grid
// Colors are derived from their role personality

const AGENT_CONFIG = {
  CMO:   { color: '#F59E0B', accent: '#D97706', role: 'Strategist',     emoji: '👑', desk: 0 },
  CHIEF: { color: '#EF4444', accent: '#DC2626', role: 'Quality Chief',  emoji: '⚖️', desk: 1 },
  MUSE:  { color: '#A855F7', accent: '#9333EA', role: 'Creative Dir.',  emoji: '🎨', desk: 2 },
  HOOK:  { color: '#F97316', accent: '#EA580C', role: 'Ad Writer',      emoji: '🎯', desk: 3 },
  PULSE: { color: '#3B82F6', accent: '#2563EB', role: 'Social Maven',   emoji: '📱', desk: 4 },
  LENS:  { color: '#06B6D4', accent: '#0891B2', role: 'Video Director', emoji: '🎬', desk: 5 },
  STORY: { color: '#10B981', accent: '#059669', role: 'Storyteller',    emoji: '📖', desk: 6 },
  SCOUT: { color: '#8B5CF6', accent: '#7C3AED', role: 'Trend Hunter',  emoji: '🔍', desk: 7 },
  FLOW:  { color: '#14B8A6', accent: '#0D9488', role: 'SEO Architect', emoji: '🌊', desk: 8 },
  PIXEL: { color: '#EC4899', accent: '#DB2777', role: 'Visual Artist',  emoji: '🖼️', desk: 9 },
}

// Status → animation mapping
const STATUS_ANIMATIONS = {
  working: { frames: ['typing1', 'typing2', 'typing3'], speed: 300, label: 'Working...' },
  idle:    { frames: ['idle1', 'idle2'], speed: 800, label: 'Idle' },
  review:  { frames: ['reading1', 'reading2'], speed: 600, label: 'Reviewing' },
  done:    { frames: ['celebrate1', 'celebrate2', 'celebrate3'], speed: 250, label: 'Done!' },
  error:   { frames: ['error1', 'error2'], speed: 500, label: 'Error' },
}

// ── PIXEL CHARACTER RENDERER ──────────────────────────────
// 8x8 pixel grid characters with animation frames
function PixelCharacter({ agent, status, frame, size = 4 }) {
  const config = AGENT_CONFIG[agent] || AGENT_CONFIG.MUSE
  const animState = STATUS_ANIMATIONS[status] || STATUS_ANIMATIONS.idle
  const currentFrame = animState.frames[frame % animState.frames.length]

  // 8x8 pixel grids for each animation frame
  // 0=transparent, 1=skin, 2=primary color, 3=accent, 4=hair, 5=white, 6=dark
  const FRAMES = {
    // Standing idle - slight bob
    idle1: [
      [0,0,4,4,4,4,0,0],
      [0,4,1,1,1,1,4,0],
      [0,1,6,1,1,6,1,0],
      [0,1,1,1,1,1,1,0],
      [0,0,2,2,2,2,0,0],
      [0,2,2,2,2,2,2,0],
      [0,0,1,0,0,1,0,0],
      [0,0,6,0,0,6,0,0],
    ],
    idle2: [
      [0,0,4,4,4,4,0,0],
      [0,4,1,1,1,1,4,0],
      [0,1,6,1,1,6,1,0],
      [0,1,1,1,1,1,1,0],
      [0,0,2,2,2,2,0,0],
      [0,2,2,2,2,2,2,0],
      [0,0,1,0,0,1,0,0],
      [0,6,0,0,0,0,6,0],
    ],
    // Typing at desk
    typing1: [
      [0,0,4,4,4,4,0,0],
      [0,4,1,1,1,1,4,0],
      [0,1,6,1,1,6,1,0],
      [0,1,1,1,1,1,1,0],
      [0,0,2,2,2,2,0,0],
      [0,1,2,2,2,2,1,0],
      [0,0,1,0,0,1,0,0],
      [0,0,6,0,0,6,0,0],
    ],
    typing2: [
      [0,0,4,4,4,4,0,0],
      [0,4,1,1,1,1,4,0],
      [0,1,6,1,1,6,1,0],
      [0,1,1,1,1,1,1,0],
      [0,0,2,2,2,2,0,0],
      [1,0,2,2,2,2,0,1],
      [0,0,1,0,0,1,0,0],
      [0,0,6,0,0,6,0,0],
    ],
    typing3: [
      [0,0,4,4,4,4,0,0],
      [0,4,1,1,1,1,4,0],
      [0,1,6,1,1,6,1,0],
      [0,1,1,1,1,1,1,0],
      [0,0,2,2,2,2,0,0],
      [0,1,2,2,2,2,1,0],
      [0,0,1,0,0,1,0,0],
      [0,0,6,0,0,6,0,0],
    ],
    // Reading/reviewing
    reading1: [
      [0,0,4,4,4,4,0,0],
      [0,4,1,1,1,1,4,0],
      [0,1,6,1,1,6,1,0],
      [0,1,1,1,1,1,1,0],
      [0,0,2,2,2,2,0,0],
      [0,2,2,5,5,2,2,0],
      [0,0,1,5,5,1,0,0],
      [0,0,6,0,0,6,0,0],
    ],
    reading2: [
      [0,0,4,4,4,4,0,0],
      [0,4,1,1,1,1,4,0],
      [0,1,1,6,6,1,1,0],
      [0,1,1,1,1,1,1,0],
      [0,0,2,2,2,2,0,0],
      [0,2,2,5,5,2,2,0],
      [0,0,1,5,5,1,0,0],
      [0,0,6,0,0,6,0,0],
    ],
    // Celebrating
    celebrate1: [
      [0,0,4,4,4,4,0,0],
      [0,4,1,1,1,1,4,0],
      [0,1,6,1,1,6,1,0],
      [0,1,1,5,5,1,1,0],
      [1,0,2,2,2,2,0,1],
      [0,0,2,2,2,2,0,0],
      [0,0,1,0,0,1,0,0],
      [0,6,0,0,0,0,6,0],
    ],
    celebrate2: [
      [0,0,4,4,4,4,0,0],
      [0,4,1,1,1,1,4,0],
      [0,1,6,1,1,6,1,0],
      [0,1,1,5,5,1,1,0],
      [0,0,2,2,2,2,0,0],
      [1,0,2,2,2,2,0,1],
      [0,0,1,0,0,1,0,0],
      [0,0,6,0,0,6,0,0],
    ],
    celebrate3: [
      [0,1,4,4,4,4,1,0],
      [0,4,1,1,1,1,4,0],
      [0,1,5,1,1,5,1,0],
      [0,1,1,5,5,1,1,0],
      [0,0,2,2,2,2,0,0],
      [0,0,2,2,2,2,0,0],
      [0,1,0,0,0,0,1,0],
      [0,6,0,0,0,0,6,0],
    ],
    // Error
    error1: [
      [0,0,4,4,4,4,0,0],
      [0,4,1,1,1,1,4,0],
      [0,1,6,1,1,6,1,0],
      [0,1,1,1,1,1,1,0],
      [0,0,2,2,2,2,0,0],
      [0,2,2,2,2,2,2,0],
      [0,0,1,0,0,1,0,0],
      [0,0,6,0,0,6,0,0],
    ],
    error2: [
      [0,0,4,4,4,4,0,0],
      [0,4,1,1,1,1,4,0],
      [0,1,1,6,6,1,1,0],
      [0,1,1,1,1,1,1,0],
      [0,0,2,2,2,2,0,0],
      [0,2,2,2,2,2,2,0],
      [0,0,1,0,0,1,0,0],
      [0,0,6,0,0,6,0,0],
    ],
  }

  const grid = FRAMES[currentFrame] || FRAMES.idle1
  const colorMap = {
    0: 'transparent',
    1: '#FBBF7D', // skin
    2: config.color, // primary
    3: config.accent, // accent
    4: '#4A3728', // hair
    5: '#FFFFFF', // white
    6: '#1a1a2e', // dark
  }

  return (
    <div className="inline-block" style={{ imageRendering: 'pixelated' }}>
      {grid.map((row, y) => (
        <div key={y} className="flex">
          {row.map((cell, x) => (
            <div
              key={x}
              style={{
                width: size,
                height: size,
                backgroundColor: colorMap[cell],
              }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── DESK + MONITOR ──────────────────────────────
function PixelDesk({ size = 4 }) {
  // Simple desk with monitor
  const desk = [
    [0,0,0,5,5,5,5,5,5,0,0,0],
    [0,0,0,5,6,6,6,6,5,0,0,0],
    [0,0,0,5,6,6,6,6,5,0,0,0],
    [0,0,0,0,0,6,6,0,0,0,0,0],
    [0,0,0,0,6,6,6,6,0,0,0,0],
    [6,6,6,6,6,6,6,6,6,6,6,6],
    [6,0,0,0,0,0,0,0,0,0,0,6],
  ]
  const colorMap = { 0: 'transparent', 5: '#374151', 6: '#1F2937' }
  return (
    <div style={{ imageRendering: 'pixelated' }}>
      {desk.map((row, y) => (
        <div key={y} className="flex">
          {row.map((cell, x) => (
            <div
              key={x}
              style={{ width: size, height: size, backgroundColor: colorMap[cell] }}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── SPEECH BUBBLE ──────────────────────────────
function SpeechBubble({ text, visible }) {
  if (!visible) return null
  return (
    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-white text-[9px] text-gray-900 px-1.5 py-0.5 rounded whitespace-nowrap font-mono shadow-lg z-10 animate-bounce-subtle">
      {text}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rotate-45" />
    </div>
  )
}

// ── AGENT WORKSTATION ──────────────────────────────
function AgentStation({ agent, tasks, agentData }) {
  const [frame, setFrame] = useState(0)
  const [showBubble, setShowBubble] = useState(false)
  const config = AGENT_CONFIG[agent]

  // Determine agent's current activity from tasks
  const agentTasks = tasks.filter(t => t.agent === agent)
  const inProgress = agentTasks.filter(t => t.status === 'In Progress')
  const inReview = agentTasks.filter(t => t.status === 'Review')
  const assigned = agentTasks.filter(t => t.status === 'Assigned')
  const done = agentTasks.filter(t => t.status === 'Done')

  let status = 'idle'
  let bubbleText = '💤 zzz'

  if (inProgress.length > 0) {
    status = 'working'
    const taskName = inProgress[0].name?.substring(0, 20) || 'task'
    bubbleText = `✍️ ${taskName}...`
  } else if (inReview.length > 0) {
    status = 'review'
    bubbleText = `📋 Reviewing (${inReview.length})`
  } else if (assigned.length > 0) {
    status = 'working'
    bubbleText = `📝 Queued (${assigned.length})`
  } else if (done.length > 0) {
    status = 'done'
    bubbleText = `✅ ${done.length} done!`
  }

  const animConfig = STATUS_ANIMATIONS[status]

  useEffect(() => {
    const interval = setInterval(() => {
      setFrame(f => f + 1)
    }, animConfig.speed)
    return () => clearInterval(interval)
  }, [animConfig.speed])

  // Random speech bubble appearances
  useEffect(() => {
    const showInterval = setInterval(() => {
      setShowBubble(true)
      setTimeout(() => setShowBubble(false), 3000)
    }, 8000 + Math.random() * 12000) // Random 8-20s interval
    return () => clearInterval(showInterval)
  }, [])

  const statusColor = {
    working: 'bg-green-500',
    idle: 'bg-gray-500',
    review: 'bg-yellow-500',
    done: 'bg-blue-500',
    error: 'bg-red-500',
  }[status]

  return (
    <div className="relative flex flex-col items-center gap-1 group">
      {/* Speech bubble */}
      <SpeechBubble text={bubbleText} visible={showBubble} />

      {/* Status indicator */}
      <div className={`w-2 h-2 rounded-full ${statusColor} animate-pulse`} />

      {/* Character */}
      <div className="relative">
        <PixelCharacter agent={agent} status={status} frame={frame} size={4} />
      </div>

      {/* Desk */}
      <div className="-mt-1">
        <PixelDesk size={3} />
      </div>

      {/* Agent name plate */}
      <div
        className="mt-1 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider"
        style={{ backgroundColor: config.color + '30', color: config.color }}
      >
        {config.emoji} {agent}
      </div>

      {/* Task count badge */}
      {agentTasks.length > 0 && (
        <div className="text-[9px] text-gray-500">
          {agentTasks.filter(t => t.status !== 'Done').length} active
        </div>
      )}

      {/* Hover tooltip */}
      <div className="absolute -bottom-16 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-20 pointer-events-none">
        <div className="font-bold">{config.role}</div>
        <div>📝 {assigned.length} queued • ⚡ {inProgress.length} active • 📋 {inReview.length} review</div>
      </div>
    </div>
  )
}

// ── FLOOR TILE ──────────────────────────────
function FloorPattern() {
  return (
    <div className="absolute inset-0 opacity-5 pointer-events-none overflow-hidden" style={{ imageRendering: 'pixelated' }}>
      <div className="w-full h-full" style={{
        backgroundImage: `repeating-conic-gradient(#9CA3AF 0% 25%, transparent 0% 50%)`,
        backgroundSize: '16px 16px',
      }} />
    </div>
  )
}

// ── MAIN COMPONENT ──────────────────────────────
export default function PixelAgents({ tasks = [], agents = [] }) {
  const [clock, setClock] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Pipeline stats
  const stats = useMemo(() => {
    const active = tasks.filter(t => t.status !== 'Done')
    return {
      total: tasks.length,
      inbox: tasks.filter(t => t.status === 'Inbox').length,
      assigned: tasks.filter(t => t.status === 'Assigned').length,
      inProgress: tasks.filter(t => t.status === 'In Progress').length,
      review: tasks.filter(t => t.status === 'Review').length,
      done: tasks.filter(t => t.status === 'Done').length,
      activeAgents: new Set(active.map(t => t.agent).filter(Boolean)).size,
    }
  }, [tasks])

  const agentNames = Object.keys(AGENT_CONFIG)

  // Split agents into two rows for layout
  const topRow = agentNames.slice(0, 5)
  const bottomRow = agentNames.slice(5, 10)

  return (
    <div className="relative bg-gray-900/50 border border-gray-700/50 rounded-xl overflow-hidden">
      {/* Floor pattern */}
      <FloorPattern />

      {/* Header bar */}
      <div className="relative flex items-center justify-between px-4 py-2 border-b border-gray-700/50 bg-gray-800/50">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏢</span>
          <span className="text-sm font-bold text-gray-300">The Roundtable — Agent Office</span>
          <span className="text-[10px] text-gray-500 font-mono ml-2">
            {clock.toLocaleTimeString()}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-400">
          <span>🟢 {stats.activeAgents}/10 agents active</span>
          <span>📝 {stats.assigned + stats.inProgress} working</span>
          <span>📋 {stats.review} in review</span>
          <span>✅ {stats.done} complete</span>
        </div>
      </div>

      {/* Office floor */}
      <div className="relative p-6">
        {/* Top row of agents */}
        <div className="flex justify-around items-end mb-8">
          {topRow.map(name => (
            <AgentStation
              key={name}
              agent={name}
              tasks={tasks}
              agentData={agents.find(a => a.name === name)}
            />
          ))}
        </div>

        {/* Center roundtable */}
        <div className="flex justify-center my-4">
          <div className="relative w-48 h-12 rounded-full bg-gradient-to-br from-amber-900/40 to-amber-800/20 border border-amber-700/30 flex items-center justify-center shadow-lg shadow-amber-900/20">
            <span className="text-[10px] text-amber-500/60 font-bold tracking-widest uppercase">Roundtable</span>
            {/* Glow */}
            <div className="absolute inset-0 rounded-full bg-amber-500/5 animate-pulse" />
          </div>
        </div>

        {/* Bottom row of agents */}
        <div className="flex justify-around items-start mt-8">
          {bottomRow.map(name => (
            <AgentStation
              key={name}
              agent={name}
              tasks={tasks}
              agentData={agents.find(a => a.name === name)}
            />
          ))}
        </div>
      </div>

      {/* Activity ticker */}
      <ActivityTicker tasks={tasks} />
    </div>
  )
}

// ── SCROLLING ACTIVITY TICKER ──────────────────────────────
function ActivityTicker({ tasks }) {
  const recentTasks = tasks
    .filter(t => t.status === 'In Progress' || t.status === 'Review')
    .slice(0, 8)

  if (recentTasks.length === 0) return null

  return (
    <div className="relative border-t border-gray-700/50 bg-gray-800/30 overflow-hidden">
      <div className="flex animate-scroll-x gap-8 py-1.5 px-4">
        {[...recentTasks, ...recentTasks].map((task, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px] text-gray-400 whitespace-nowrap shrink-0">
            <span className={task.status === 'In Progress' ? 'text-green-400' : 'text-yellow-400'}>●</span>
            <span className="font-bold text-gray-300">{task.agent}</span>
            <span className="text-gray-500">→</span>
            <span>{task.name?.substring(0, 35)}{task.name?.length > 35 ? '…' : ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
