'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'

// ── AGENT PIXEL CONFIG ──────────────────────────────
// Each agent has unique visual identity: colors, hair, accessories
const AGENT_CONFIG = {
  CMO:   { color: '#F59E0B', accent: '#D97706', role: 'Chief Marketing Officer', emoji: '👑', hair: '#2D1B0E', hairStyle: 'slick',   accessory: 'crown',  skinTone: '#FBBF7D' },
  CHIEF: { color: '#EF4444', accent: '#DC2626', role: 'Quality Chief',           emoji: '⚖️', hair: '#1a1a2e', hairStyle: 'short',   accessory: 'badge',  skinTone: '#E8A87C' },
  MUSE:  { color: '#A855F7', accent: '#9333EA', role: 'Creative Director',       emoji: '🎨', hair: '#7C3AED', hairStyle: 'long',    accessory: 'beret',  skinTone: '#FBBF7D' },
  HOOK:  { color: '#F97316', accent: '#EA580C', role: 'Ad Copy Writer',          emoji: '🎯', hair: '#92400E', hairStyle: 'spiky',   accessory: 'pen',    skinTone: '#D4A574' },
  PULSE: { color: '#3B82F6', accent: '#2563EB', role: 'Social Media Maven',      emoji: '📱', hair: '#1E3A5F', hairStyle: 'fade',    accessory: 'phone',  skinTone: '#C68642' },
  LENS:  { color: '#06B6D4', accent: '#0891B2', role: 'Video Director',          emoji: '🎬', hair: '#374151', hairStyle: 'ponytail', accessory: 'camera', skinTone: '#FBBF7D' },
  STORY: { color: '#10B981', accent: '#059669', role: 'Storyteller',             emoji: '📖', hair: '#4B3621', hairStyle: 'curly',   accessory: 'book',   skinTone: '#E8A87C' },
  SCOUT: { color: '#8B5CF6', accent: '#7C3AED', role: 'Trend Hunter',            emoji: '🔍', hair: '#581C87', hairStyle: 'mohawk',  accessory: 'radar',  skinTone: '#D4A574' },
  FLOW:  { color: '#14B8A6', accent: '#0D9488', role: 'SEO Architect',           emoji: '🌊', hair: '#134E4A', hairStyle: 'neat',    accessory: 'chart',  skinTone: '#FBBF7D' },
  PIXEL: { color: '#EC4899', accent: '#DB2777', role: 'Visual Designer',         emoji: '🖼️', hair: '#DB2777', hairStyle: 'pigtails', accessory: 'palette', skinTone: '#C68642' },
}

// ── STATUS ANIMATIONS ──────────────────────────────
const STATUS_ANIMATIONS = {
  working:  { speed: 300, label: 'Working...' },
  idle:     { speed: 800, label: 'Idle' },
  review:   { speed: 600, label: 'Reviewing' },
  done:     { speed: 400, label: 'Done!' },
  error:    { speed: 500, label: 'Error' },
  sleeping: { speed: 1200, label: 'Sleeping' },
}

// ── UNIQUE PIXEL CHARACTER RENDERER ──────────────────────────────
// Each agent now has a unique look based on hair style, skin tone, and accessories
function PixelCharacter({ agent, status, frame, size = 4, onClick }) {
  const config = AGENT_CONFIG[agent] || AGENT_CONFIG.MUSE
  const animState = STATUS_ANIMATIONS[status] || STATUS_ANIMATIONS.idle

  // Generate unique character grids per agent
  // 0=transparent, 1=skin, 2=primary, 3=accent, 4=hair, 5=white, 6=dark, 7=accessory
  const getFrame = () => {
    const isFrame2 = (frame % 2) === 1
    const isFrame3 = (frame % 3)

    // Hair variations per style
    const hairRows = {
      slick:    [[0,0,4,4,4,4,0,0], [0,4,4,1,1,4,4,0]],
      short:    [[0,0,4,4,4,4,0,0], [0,4,1,1,1,1,4,0]],
      long:     [[0,4,4,4,4,4,4,0], [0,4,1,1,1,1,4,0]],
      spiky:    [[0,4,0,4,4,0,4,0], [0,4,1,1,1,1,4,0]],
      fade:     [[0,0,4,4,4,4,0,0], [0,0,1,1,1,1,0,0]],
      ponytail: [[0,0,4,4,4,4,4,0], [0,4,1,1,1,1,4,0]],
      curly:    [[0,4,4,4,4,4,4,0], [4,4,1,1,1,1,4,4]],
      mohawk:   [[0,0,0,4,4,0,0,0], [0,0,4,4,4,4,0,0]],
      neat:     [[0,0,4,4,4,4,0,0], [0,4,1,1,1,1,4,0]],
      pigtails: [[4,0,4,4,4,4,0,4], [4,4,1,1,1,1,4,4]],
    }

    const hair = hairRows[config.hairStyle] || hairRows.short

    if (status === 'working') {
      // Typing animation — arms move
      const arms = isFrame3 === 0 ? [0,1,2,2,2,2,1,0] :
                   isFrame3 === 1 ? [1,0,2,2,2,2,0,1] :
                                    [0,1,2,2,2,2,1,0]
      return [
        hair[0],
        hair[1],
        [0,1,6,1,1,6,1,0],
        [0,1,1,isFrame2 ? 1 : 5,isFrame2 ? 5 : 1,1,1,0], // mouth animate
        [0,0,2,2,2,2,0,0],
        arms,
        [0,0,1,0,0,1,0,0],
        [0,0,6,0,0,6,0,0],
      ]
    }

    if (status === 'review') {
      // Reading — holds document (5=white), eyes move
      return [
        hair[0],
        hair[1],
        [0,1,isFrame2?6:1,1,1,isFrame2?1:6,1,0], // eyes shift
        [0,1,1,1,1,1,1,0],
        [0,0,2,2,2,2,0,0],
        [0,2,2,5,5,2,2,0],
        [0,0,1,5,5,1,0,0],
        [0,0,6,0,0,6,0,0],
      ]
    }

    if (status === 'done') {
      // Celebrating — arms up, smile
      const armUp = isFrame3 === 0 ? [1,0,2,2,2,2,0,1] :
                    isFrame3 === 1 ? [0,0,2,2,2,2,0,0] :
                                     [1,0,2,2,2,2,0,1]
      return [
        isFrame2 ? [0,1,4,4,4,4,1,0] : hair[0],
        hair[1],
        [0,1,isFrame2?5:6,1,1,isFrame2?5:6,1,0], // sparkle eyes
        [0,1,1,5,5,1,1,0], // smile
        armUp,
        [0,0,2,2,2,2,0,0],
        [0,isFrame2?1:0,0,0,0,0,isFrame2?1:0,0],
        [0,isFrame2?0:6,6,0,0,6,isFrame2?0:6,0],
      ]
    }

    if (status === 'sleeping') {
      return [
        hair[0],
        hair[1],
        [0,1,6,6,6,6,1,0], // closed eyes
        [0,1,1,1,1,1,1,0],
        [0,0,2,2,2,2,0,0],
        [0,2,2,2,2,2,2,0],
        [0,0,1,0,0,1,0,0],
        [0,0,6,0,0,6,0,0],
      ]
    }

    // Idle — gentle bob
    return [
      hair[0],
      hair[1],
      [0,1,6,1,1,6,1,0],
      [0,1,1,1,1,1,1,0],
      [0,0,2,2,2,2,0,0],
      [0,2,2,2,2,2,2,0],
      [0,0,1,0,0,1,0,0],
      [0,isFrame2?6:0,isFrame2?0:6,0,0,isFrame2?0:6,isFrame2?6:0,0],
    ]
  }

  const grid = getFrame()
  const colorMap = {
    0: 'transparent',
    1: config.skinTone,
    2: config.color,
    3: config.accent,
    4: config.hair,
    5: '#FFFFFF',
    6: '#1a1a2e',
    7: config.accent,
  }

  return (
    <div
      className={`inline-block ${onClick ? 'cursor-pointer hover:brightness-125 transition-all' : ''}`}
      style={{ imageRendering: 'pixelated' }}
      onClick={onClick}
    >
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

// ── DESK + MONITOR (with screen glow) ──────────────────────────────
function PixelDesk({ status, agentColor, size = 3 }) {
  const screenColor = status === 'working' ? '#22c55e' :
                      status === 'review'  ? '#eab308' :
                      status === 'done'    ? '#3b82f6' :
                      status === 'error'   ? '#ef4444' : '#374151'

  const desk = [
    [0,0,0,5,5,5,5,5,5,0,0,0],
    [0,0,0,5,8,8,8,8,5,0,0,0],
    [0,0,0,5,8,8,8,8,5,0,0,0],
    [0,0,0,0,0,6,6,0,0,0,0,0],
    [0,0,0,0,6,6,6,6,0,0,0,0],
    [6,6,6,6,6,6,6,6,6,6,6,6],
    [6,0,0,0,0,0,0,0,0,0,0,6],
  ]
  const colorMap = { 0: 'transparent', 5: '#374151', 6: '#1F2937', 8: screenColor }
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

// ── OFFICE DECORATION ITEMS ──────────────────────────────
function OfficePlant({ x, y }) {
  return (
    <div className="absolute" style={{ left: x, top: y, imageRendering: 'pixelated' }}>
      {[
        [0,0,0,1,0,0,0],
        [0,0,1,1,1,0,0],
        [0,1,1,1,1,1,0],
        [0,0,1,1,1,0,0],
        [0,0,0,2,0,0,0],
        [0,0,0,2,0,0,0],
        [0,0,3,3,3,0,0],
      ].map((row, ry) => (
        <div key={ry} className="flex">
          {row.map((cell, rx) => (
            <div key={rx} style={{
              width: 3, height: 3,
              backgroundColor: cell === 0 ? 'transparent' : cell === 1 ? '#22c55e' : cell === 2 ? '#92400E' : '#78716C',
            }} />
          ))}
        </div>
      ))}
    </div>
  )
}

function CoffeeMachine({ x, y }) {
  const [steam, setSteam] = useState(0)
  useEffect(() => {
    const i = setInterval(() => setSteam(s => (s + 1) % 3), 600)
    return () => clearInterval(i)
  }, [])
  return (
    <div className="absolute" style={{ left: x, top: y }}>
      <div className="relative">
        <div className="text-[10px] leading-none opacity-70">☕</div>
        {steam > 0 && (
          <div className="absolute -top-2 left-1 text-[7px] text-gray-500 animate-pulse" style={{ opacity: steam === 1 ? 0.4 : 0.7 }}>
            ~
          </div>
        )}
      </div>
    </div>
  )
}

function WaterCooler({ x, y }) {
  return (
    <div className="absolute text-[10px] opacity-50" style={{ left: x, top: y }}>🚰</div>
  )
}

// ── FLOATING PARTICLES ──────────────────────────────
function Particles({ status, color }) {
  const [particles, setParticles] = useState([])

  useEffect(() => {
    if (status !== 'done' && status !== 'working') {
      setParticles([])
      return
    }
    const interval = setInterval(() => {
      setParticles(prev => {
        const next = prev.filter(p => p.life > 0).map(p => ({ ...p, life: p.life - 1, y: p.y - 0.5, opacity: p.life / p.maxLife }))
        if (next.length < 4 && Math.random() > 0.5) {
          const maxLife = status === 'done' ? 20 : 12
          next.push({
            id: Date.now() + Math.random(),
            x: -8 + Math.random() * 16,
            y: 0,
            life: maxLife,
            maxLife,
            opacity: 1,
            char: status === 'done' ? ['✨', '⭐', '🎉'][Math.floor(Math.random() * 3)] : ['·', '•', '○'][Math.floor(Math.random() * 3)],
          })
        }
        return next
      })
    }, 150)
    return () => clearInterval(interval)
  }, [status])

  if (particles.length === 0) return null
  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-20">
      {particles.map(p => (
        <div
          key={p.id}
          className="absolute text-[8px] transition-none"
          style={{
            left: `calc(50% + ${p.x}px)`,
            top: `${p.y}px`,
            opacity: p.opacity,
            color: status === 'done' ? '#FFD700' : color,
          }}
        >
          {p.char}
        </div>
      ))}
    </div>
  )
}

// ── SPEECH BUBBLE (improved) ──────────────────────────────
function SpeechBubble({ text, visible, color }) {
  if (!visible) return null
  return (
    <div
      className="absolute -top-9 left-1/2 -translate-x-1/2 text-[9px] text-gray-100 px-2 py-1 rounded-md whitespace-nowrap font-mono shadow-lg z-30 animate-bounce-subtle border"
      style={{ backgroundColor: '#1a1a2e', borderColor: color + '40' }}
    >
      {text}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45" style={{ backgroundColor: '#1a1a2e' }} />
    </div>
  )
}

// ── MINI PROGRESS RING ──────────────────────────────
function ProgressRing({ progress, color, size = 18 }) {
  const r = (size - 4) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (progress / 100) * circ
  return (
    <svg width={size} height={size} className="absolute -top-1 -right-1 z-10">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#374151" strokeWidth="2" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="2"
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`}
        className="transition-all duration-1000"
      />
    </svg>
  )
}

// ── AGENT WORKSTATION (major upgrade) ──────────────────────────────
function AgentStation({ agent, tasks, agentData, onAgentClick }) {
  const [frame, setFrame] = useState(0)
  const [showBubble, setShowBubble] = useState(false)
  const [hovered, setHovered] = useState(false)
  const config = AGENT_CONFIG[agent]

  // Determine agent's current activity from tasks
  const agentTasks = tasks.filter(t => t.agent === agent)
  const inProgress = agentTasks.filter(t => t.status === 'In Progress')
  const inReview = agentTasks.filter(t => t.status === 'Review')
  const assigned = agentTasks.filter(t => t.status === 'Assigned')
  const done = agentTasks.filter(t => t.status === 'Done')
  const activeTasks = agentTasks.filter(t => t.status !== 'Done')

  let status = 'idle'
  let bubbleText = '💤 zzz'

  if (inProgress.length > 0) {
    status = 'working'
    const taskName = inProgress[0].name?.substring(0, 22) || 'task'
    bubbleText = `✍️ ${taskName}...`
  } else if (inReview.length > 0) {
    status = 'review'
    bubbleText = `📋 Reviewing (${inReview.length})`
  } else if (assigned.length > 0) {
    status = 'working'
    bubbleText = `📝 Queued (${assigned.length})`
  } else if (done.length > 0 && activeTasks.length === 0) {
    status = 'done'
    bubbleText = `✅ ${done.length} complete!`
  }

  // Calculate completion progress
  const totalTasks = agentTasks.length || 1
  const progress = Math.round((done.length / totalTasks) * 100)

  const animConfig = STATUS_ANIMATIONS[status]

  useEffect(() => {
    const interval = setInterval(() => setFrame(f => f + 1), animConfig.speed)
    return () => clearInterval(interval)
  }, [animConfig.speed])

  // Speech bubbles appear randomly
  useEffect(() => {
    const show = () => {
      setShowBubble(true)
      setTimeout(() => setShowBubble(false), 3500)
    }
    const timeout = setTimeout(show, 2000 + Math.random() * 5000)
    const interval = setInterval(show, 10000 + Math.random() * 15000)
    return () => { clearTimeout(timeout); clearInterval(interval) }
  }, [])

  const statusColor = {
    working: '#22c55e',
    idle: '#6b7280',
    review: '#eab308',
    done: '#3b82f6',
    error: '#ef4444',
    sleeping: '#4b5563',
  }[status]

  const handleClick = useCallback(() => {
    if (onAgentClick && agentData) {
      onAgentClick(agentData)
    }
  }, [onAgentClick, agentData])

  return (
    <div
      className={`relative flex flex-col items-center gap-1 group transition-transform duration-200 ${hovered ? 'scale-110 -translate-y-1' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Floating particles */}
      <Particles status={status} color={config.color} />

      {/* Speech bubble */}
      <SpeechBubble text={bubbleText} visible={showBubble || hovered} color={config.color} />

      {/* Status indicator with progress ring */}
      <div className="relative">
        <div
          className="w-2.5 h-2.5 rounded-full animate-pulse"
          style={{ backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}` }}
        />
        {activeTasks.length > 0 && (
          <ProgressRing progress={progress} color={config.color} size={16} />
        )}
      </div>

      {/* Character (clickable) */}
      <div className="relative cursor-pointer" onClick={handleClick}>
        <PixelCharacter agent={agent} status={status} frame={frame} size={4} />
        {/* Click hint on hover */}
        {hovered && (
          <div className="absolute -right-1 -top-1 w-3 h-3 bg-white/20 rounded-full flex items-center justify-center animate-ping pointer-events-none">
            <div className="w-1.5 h-1.5 bg-white rounded-full" />
          </div>
        )}
      </div>

      {/* Desk with colored screen */}
      <div className="-mt-1">
        <PixelDesk status={status} agentColor={config.color} size={3} />
      </div>

      {/* Agent name plate */}
      <div
        className="mt-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider cursor-pointer hover:brightness-125 transition-all"
        style={{ backgroundColor: config.color + '25', color: config.color, borderBottom: `2px solid ${config.color}40` }}
        onClick={handleClick}
      >
        {config.emoji} {agent}
      </div>

      {/* Task stats bar */}
      <div className="flex items-center gap-1 mt-0.5">
        {inProgress.length > 0 && <span className="text-[8px] px-1 py-px rounded bg-green-500/20 text-green-400 font-mono">{inProgress.length} active</span>}
        {inReview.length > 0 && <span className="text-[8px] px-1 py-px rounded bg-yellow-500/20 text-yellow-400 font-mono">{inReview.length} review</span>}
        {activeTasks.length === 0 && done.length > 0 && <span className="text-[8px] px-1 py-px rounded bg-blue-500/20 text-blue-400 font-mono">✓ {done.length}</span>}
        {agentTasks.length === 0 && <span className="text-[8px] text-gray-600 font-mono">standby</span>}
      </div>

      {/* Expanded hover card */}
      {hovered && (
        <div
          className="absolute -bottom-24 left-1/2 -translate-x-1/2 bg-gray-800/95 backdrop-blur text-white text-[10px] px-3 py-2 rounded-lg z-40 whitespace-nowrap pointer-events-none border"
          style={{ borderColor: config.color + '30' }}
        >
          <div className="font-bold mb-1" style={{ color: config.color }}>{config.role}</div>
          <div className="flex gap-3 text-gray-400">
            <span>📝 {assigned.length}</span>
            <span>⚡ {inProgress.length}</span>
            <span>📋 {inReview.length}</span>
            <span>✅ {done.length}</span>
          </div>
          <div className="text-[9px] text-gray-500 mt-1">Click to configure</div>
        </div>
      )}
    </div>
  )
}

// ── COLLABORATION LINES ──────────────────────────────
// Draw glowing SVG lines between agents that share content types
function CollaborationLines({ tasks, agentPositions }) {
  const lines = useMemo(() => {
    // Find agents working on related tasks (same content type or campaign)
    const activeAgents = {}
    tasks.forEach(t => {
      if (t.agent && (t.status === 'In Progress' || t.status === 'Review')) {
        if (!activeAgents[t.agent]) activeAgents[t.agent] = []
        activeAgents[t.agent].push(t)
      }
    })

    const connections = []
    const agentNames = Object.keys(activeAgents)

    for (let i = 0; i < agentNames.length; i++) {
      for (let j = i + 1; j < agentNames.length; j++) {
        const a = agentNames[i]
        const b = agentNames[j]
        // Check if agents share a content type or campaign
        const aTypes = new Set(activeAgents[a].map(t => t.contentType || t.type).filter(Boolean))
        const bTypes = new Set(activeAgents[b].map(t => t.contentType || t.type).filter(Boolean))
        const shared = [...aTypes].filter(t => bTypes.has(t))

        if (shared.length > 0 && agentPositions[a] && agentPositions[b]) {
          connections.push({
            from: a, to: b,
            fromPos: agentPositions[a],
            toPos: agentPositions[b],
            color: AGENT_CONFIG[a]?.color || '#666',
          })
        }
      }
    }
    return connections
  }, [tasks, agentPositions])

  if (lines.length === 0) return null

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0" style={{ overflow: 'visible' }}>
      <defs>
        {lines.map((line, i) => (
          <linearGradient key={i} id={`collab-${i}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={AGENT_CONFIG[line.from]?.color || '#666'} stopOpacity="0.3" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.15" />
            <stop offset="100%" stopColor={AGENT_CONFIG[line.to]?.color || '#666'} stopOpacity="0.3" />
          </linearGradient>
        ))}
      </defs>
      {lines.map((line, i) => (
        <line
          key={i}
          x1={line.fromPos.x} y1={line.fromPos.y}
          x2={line.toPos.x} y2={line.toPos.y}
          stroke={`url(#collab-${i})`}
          strokeWidth="1.5"
          strokeDasharray="4 4"
          className="animate-pulse"
        />
      ))}
    </svg>
  )
}

// ── ROUNDTABLE (interactive center) ──────────────────────────────
function Roundtable({ stats }) {
  const [pulse, setPulse] = useState(0)
  useEffect(() => {
    const i = setInterval(() => setPulse(p => (p + 1) % 60), 100)
    return () => clearInterval(i)
  }, [])

  const activity = Math.min((stats.inProgress + stats.review) / 10, 1)
  const glowIntensity = 0.05 + activity * 0.15

  return (
    <div className="relative w-56 h-14 rounded-full flex items-center justify-center">
      {/* Outer glow ring */}
      <div
        className="absolute inset-0 rounded-full transition-all duration-1000"
        style={{
          background: `radial-gradient(ellipse, rgba(245,158,11,${glowIntensity}) 0%, transparent 70%)`,
        }}
      />
      {/* Table surface */}
      <div className="relative w-48 h-12 rounded-full bg-gradient-to-br from-amber-900/40 to-amber-800/20 border border-amber-700/30 flex items-center justify-center shadow-lg shadow-amber-900/20 overflow-hidden">
        <div className="text-center">
          <span className="text-[9px] text-amber-500/80 font-bold tracking-[0.2em] uppercase block">Roundtable</span>
          <span className="text-[8px] text-amber-600/50 font-mono">{stats.inProgress + stats.review} tasks in flight</span>
        </div>
        {/* Animated glow sweep */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from ${pulse * 6}deg, transparent 0deg, rgba(245,158,11,0.08) 30deg, transparent 60deg)`,
          }}
        />
      </div>
    </div>
  )
}

// ── AMBIENT BACKGROUND ──────────────────────────────
function AmbientBackground() {
  const hour = new Date().getHours()
  // Subtle time-of-day tinting
  const ambient = hour >= 6 && hour < 12 ? 'from-blue-950/20 to-indigo-950/10' :
                  hour >= 12 && hour < 17 ? 'from-gray-900/10 to-gray-900/5' :
                  hour >= 17 && hour < 21 ? 'from-orange-950/15 to-purple-950/10' :
                  'from-indigo-950/30 to-blue-950/20'

  return (
    <>
      <div className={`absolute inset-0 bg-gradient-to-br ${ambient} pointer-events-none`} />
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none overflow-hidden" style={{ imageRendering: 'pixelated' }}>
        <div className="w-full h-full" style={{
          backgroundImage: `repeating-conic-gradient(#9CA3AF 0% 25%, transparent 0% 50%)`,
          backgroundSize: '16px 16px',
        }} />
      </div>
    </>
  )
}

// ── PIPELINE MINI-STATUS ──────────────────────────────
function PipelineStatus({ stats }) {
  const stages = [
    { label: 'Inbox', count: stats.inbox, color: '#6b7280', icon: '📥' },
    { label: 'Assigned', count: stats.assigned, color: '#f59e0b', icon: '📋' },
    { label: 'Working', count: stats.inProgress, color: '#22c55e', icon: '⚡' },
    { label: 'Review', count: stats.review, color: '#eab308', icon: '👀' },
    { label: 'Done', count: stats.done, color: '#3b82f6', icon: '✅' },
  ]
  return (
    <div className="flex items-center gap-1">
      {stages.map((s, i) => (
        <div key={s.label} className="flex items-center">
          <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded" style={{ backgroundColor: s.color + '15' }}>
            <span className="text-[8px]">{s.icon}</span>
            <span className="text-[9px] font-bold font-mono" style={{ color: s.color }}>{s.count}</span>
          </div>
          {i < stages.length - 1 && <span className="text-gray-700 text-[8px] mx-0.5">→</span>}
        </div>
      ))}
    </div>
  )
}

// ── MAIN COMPONENT ──────────────────────────────
export default function PixelAgents({ tasks = [], agents = [], onAgentClick }) {
  const [clock, setClock] = useState(new Date())
  const officeRef = useRef(null)

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
  const topRow = agentNames.slice(0, 5)
  const bottomRow = agentNames.slice(5, 10)

  // Rough positions for collaboration lines
  const agentPositions = useMemo(() => {
    const pos = {}
    const w = officeRef.current?.offsetWidth || 900
    topRow.forEach((name, i) => {
      pos[name] = { x: (w / 6) * (i + 1), y: 100 }
    })
    bottomRow.forEach((name, i) => {
      pos[name] = { x: (w / 6) * (i + 1), y: 300 }
    })
    return pos
  }, [officeRef.current?.offsetWidth])

  return (
    <div className="relative bg-gray-900/60 border border-gray-700/50 rounded-xl overflow-hidden">
      {/* Ambient background */}
      <AmbientBackground />

      {/* Header bar */}
      <div className="relative flex items-center justify-between px-4 py-2.5 border-b border-gray-700/50 bg-gray-800/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏢</span>
          <span className="text-sm font-bold text-gray-300">The Roundtable — Agent Office</span>
          <span className="text-[10px] text-gray-500 font-mono ml-2">
            {clock.toLocaleTimeString()}
          </span>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-gray-400">
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span>{stats.activeAgents}/10 active</span>
          </div>
          <PipelineStatus stats={stats} />
        </div>
      </div>

      {/* Office floor */}
      <div className="relative p-6 min-h-[340px]" ref={officeRef}>
        {/* Collaboration lines */}
        <CollaborationLines tasks={tasks} agentPositions={agentPositions} />

        {/* Office decorations */}
        <OfficePlant x={20} y={30} />
        <OfficePlant x="calc(100% - 40px)" y={30} />
        <CoffeeMachine x={50} y={180} />
        <WaterCooler x="calc(100% - 60px)" y={180} />

        {/* Top row of agents */}
        <div className="relative z-10 flex justify-around items-end mb-6">
          {topRow.map(name => (
            <AgentStation
              key={name}
              agent={name}
              tasks={tasks}
              agentData={agents.find(a => a.name === name)}
              onAgentClick={onAgentClick}
            />
          ))}
        </div>

        {/* Center roundtable */}
        <div className="relative z-10 flex justify-center my-2">
          <Roundtable stats={stats} />
        </div>

        {/* Bottom row of agents */}
        <div className="relative z-10 flex justify-around items-start mt-6">
          {bottomRow.map(name => (
            <AgentStation
              key={name}
              agent={name}
              tasks={tasks}
              agentData={agents.find(a => a.name === name)}
              onAgentClick={onAgentClick}
            />
          ))}
        </div>
      </div>

      {/* Activity ticker */}
      <ActivityTicker tasks={tasks} />
    </div>
  )
}

// ── SCROLLING ACTIVITY TICKER (enhanced) ──────────────────────────────
function ActivityTicker({ tasks }) {
  const recentTasks = tasks
    .filter(t => t.status === 'In Progress' || t.status === 'Review' || t.status === 'Assigned')
    .slice(0, 10)

  if (recentTasks.length === 0) return null

  const statusIcon = (s) => s === 'In Progress' ? '⚡' : s === 'Review' ? '👀' : '📋'
  const statusColor = (s) => s === 'In Progress' ? 'text-green-400' : s === 'Review' ? 'text-yellow-400' : 'text-gray-400'

  return (
    <div className="relative border-t border-gray-700/50 bg-gray-800/40 overflow-hidden backdrop-blur-sm">
      <div className="flex animate-scroll-x gap-8 py-2 px-4">
        {[...recentTasks, ...recentTasks].map((task, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px] text-gray-400 whitespace-nowrap shrink-0">
            <span className={statusColor(task.status)}>{statusIcon(task.status)}</span>
            <span className="font-bold" style={{ color: AGENT_CONFIG[task.agent]?.color || '#9CA3AF' }}>{task.agent}</span>
            <span className="text-gray-600">→</span>
            <span className="text-gray-300">{task.name?.substring(0, 40)}{task.name?.length > 40 ? '…' : ''}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
