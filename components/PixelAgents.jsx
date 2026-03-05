'use client'

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'

// ── AGENT PIXEL CONFIG ──────────────────────────────
const AGENT_CONFIG = {
  CMO:   { color: '#F59E0B', accent: '#D97706', role: 'Chief Marketing Officer', emoji: '👑', hair: '#2D1B0E', hairStyle: 'slick',   skinTone: '#FBBF7D' },
  CHIEF: { color: '#EF4444', accent: '#DC2626', role: 'Quality Chief',           emoji: '⚖️', hair: '#1a1a2e', hairStyle: 'short',   skinTone: '#E8A87C' },
  MUSE:  { color: '#A855F7', accent: '#9333EA', role: 'Creative Director',       emoji: '🎨', hair: '#7C3AED', hairStyle: 'long',    skinTone: '#FBBF7D' },
  HOOK:  { color: '#F97316', accent: '#EA580C', role: 'Ad Copy Writer',          emoji: '🎯', hair: '#92400E', hairStyle: 'spiky',   skinTone: '#D4A574' },
  PULSE: { color: '#3B82F6', accent: '#2563EB', role: 'Social Media Maven',      emoji: '📱', hair: '#1E3A5F', hairStyle: 'fade',    skinTone: '#C68642' },
  LENS:  { color: '#06B6D4', accent: '#0891B2', role: 'Video Director',          emoji: '🎬', hair: '#374151', hairStyle: 'ponytail', skinTone: '#FBBF7D' },
  STORY: { color: '#10B981', accent: '#059669', role: 'Storyteller',             emoji: '📖', hair: '#4B3621', hairStyle: 'curly',   skinTone: '#E8A87C' },
  SCOUT: { color: '#8B5CF6', accent: '#7C3AED', role: 'Trend Hunter',            emoji: '🔍', hair: '#581C87', hairStyle: 'mohawk',  skinTone: '#D4A574' },
  FLOW:  { color: '#14B8A6', accent: '#0D9488', role: 'SEO Architect',           emoji: '🌊', hair: '#134E4A', hairStyle: 'neat',    skinTone: '#FBBF7D' },
  PIXEL: { color: '#EC4899', accent: '#DB2777', role: 'Visual Designer',         emoji: '🖼️', hair: '#DB2777', hairStyle: 'pigtails', skinTone: '#C68642' },
}

const STATUS_ANIMATIONS = {
  working:  { speed: 300, label: 'Working...' },
  idle:     { speed: 800, label: 'Idle' },
  review:   { speed: 600, label: 'Reviewing' },
  done:     { speed: 400, label: 'Done!' },
  error:    { speed: 500, label: 'Error' },
  sleeping: { speed: 1200, label: 'Sleeping' },
}

// ── MOVEMENT DESTINATIONS ──────────────────────────────
// Absolute positions as percentages of the office floor
const DESTINATIONS = {
  roundtable:  { x: 50, y: 48, label: '💬 Meeting' },
  coffee:      { x: 7,  y: 48, label: '☕ Coffee' },
  waterCooler: { x: 93, y: 48, label: '🚰 Water' },
  whiteboard:  { x: 50, y: 8,  label: '📋 Planning' },
  lounge:      { x: 50, y: 90, label: '💭 Thinking' },
}

// ── DESK POSITIONS ──────────────────────────────
// Where each agent's desk lives (percentages of the office floor)
const AGENT_NAMES = Object.keys(AGENT_CONFIG)
const TOP_ROW = AGENT_NAMES.slice(0, 5)
const BOTTOM_ROW = AGENT_NAMES.slice(5, 10)

function getDeskPosition(agent) {
  const topIdx = TOP_ROW.indexOf(agent)
  if (topIdx !== -1) {
    // Top row: evenly spaced, y ~22%
    return { x: 12 + topIdx * 19.5, y: 22 }
  }
  const botIdx = BOTTOM_ROW.indexOf(agent)
  if (botIdx !== -1) {
    // Bottom row: evenly spaced, y ~78%
    return { x: 12 + botIdx * 19.5, y: 78 }
  }
  return { x: 50, y: 50 }
}

// ── MOVEMENT HOOK (per-agent, called from parent) ──────────────────────
function useMovement(agent, status) {
  const [state, setState] = useState({
    phase: 'at_desk',        // at_desk | walking_to | at_destination | returning
    destination: null,
    progress: 0,             // 0→1 interpolation
    facingRight: true,
    walkFrame: 0,
  })

  useEffect(() => {
    // Wandering frequency depends on status
    const wanderChance = status === 'idle' ? 0.12 :
                         status === 'done' ? 0.10 :
                         status === 'review' ? 0.03 :
                         status === 'working' ? 0.015 : 0.04

    const tick = setInterval(() => {
      setState(prev => {
        if (prev.phase === 'at_desk') {
          if (Math.random() < wanderChance) {
            const destKeys = Object.keys(DESTINATIONS)
            const dest = destKeys[Math.floor(Math.random() * destKeys.length)]
            const deskPos = getDeskPosition(agent)
            return {
              phase: 'walking_to',
              destination: dest,
              progress: 0,
              facingRight: DESTINATIONS[dest].x > deskPos.x,
              walkFrame: 0,
            }
          }
          return prev
        }

        if (prev.phase === 'walking_to') {
          const np = prev.progress + 0.05 + Math.random() * 0.02
          if (np >= 1) return { ...prev, phase: 'at_destination', progress: 1, walkFrame: 0 }
          return { ...prev, progress: np, walkFrame: prev.walkFrame + 1 }
        }

        if (prev.phase === 'at_destination') {
          if (Math.random() < 0.06) {
            const deskPos = getDeskPosition(agent)
            const dest = DESTINATIONS[prev.destination]
            return { ...prev, phase: 'returning', progress: 1, facingRight: deskPos.x > (dest?.x || 50), walkFrame: 0 }
          }
          return prev
        }

        if (prev.phase === 'returning') {
          const np = prev.progress - 0.05 - Math.random() * 0.02
          if (np <= 0) return { phase: 'at_desk', destination: null, progress: 0, facingRight: true, walkFrame: 0 }
          return { ...prev, progress: np, walkFrame: prev.walkFrame + 1 }
        }

        return prev
      })
    }, 500)

    return () => clearInterval(tick)
  }, [agent, status])

  // Calculate actual pixel position (interpolate desk ↔ destination)
  const deskPos = getDeskPosition(agent)
  const dest = state.destination ? DESTINATIONS[state.destination] : null
  const t = state.progress

  let posX = deskPos.x
  let posY = deskPos.y
  if (dest) {
    posX = deskPos.x + (dest.x - deskPos.x) * t
    posY = deskPos.y + (dest.y - deskPos.y) * t
  }

  return {
    ...state,
    isAway: state.phase !== 'at_desk',
    isWalking: state.phase === 'walking_to' || state.phase === 'returning',
    posX,
    posY,
    destLabel: state.phase === 'at_destination' && dest ? dest.label : null,
  }
}

// ── PIXEL CHARACTER RENDERER ──────────────────────────────
function PixelCharacter({ agent, status, frame, size = 4, onClick, facingRight = true, isWalking = false }) {
  const config = AGENT_CONFIG[agent] || AGENT_CONFIG.MUSE

  const getFrame = () => {
    const isFrame2 = (frame % 2) === 1
    const isFrame3 = (frame % 3)

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

    // Walking animation — legs and arms move
    if (isWalking) {
      const legFrame = frame % 4
      const legs = legFrame === 0 ? [0,0,1,0,0,1,0,0] :
                   legFrame === 1 ? [0,1,0,0,0,0,1,0] :
                   legFrame === 2 ? [0,0,1,0,0,1,0,0] :
                                    [0,0,0,1,1,0,0,0]
      const feet = legFrame === 0 ? [0,0,6,0,0,6,0,0] :
                   legFrame === 1 ? [0,6,0,0,0,0,6,0] :
                   legFrame === 2 ? [0,0,6,0,0,6,0,0] :
                                    [0,0,0,6,6,0,0,0]
      const arms = legFrame % 2 === 0 ? [0,1,2,2,2,2,0,0] : [0,0,2,2,2,2,1,0]
      return [hair[0], hair[1], [0,1,6,1,1,6,1,0], [0,1,1,1,1,1,1,0], [0,0,2,2,2,2,0,0], arms, legs, feet]
    }

    if (status === 'working') {
      const arms = isFrame3 === 0 ? [0,1,2,2,2,2,1,0] : isFrame3 === 1 ? [1,0,2,2,2,2,0,1] : [0,1,2,2,2,2,1,0]
      return [hair[0], hair[1], [0,1,6,1,1,6,1,0], [0,1,1,isFrame2?1:5,isFrame2?5:1,1,1,0], [0,0,2,2,2,2,0,0], arms, [0,0,1,0,0,1,0,0], [0,0,6,0,0,6,0,0]]
    }
    if (status === 'review') {
      return [hair[0], hair[1], [0,1,isFrame2?6:1,1,1,isFrame2?1:6,1,0], [0,1,1,1,1,1,1,0], [0,0,2,2,2,2,0,0], [0,2,2,5,5,2,2,0], [0,0,1,5,5,1,0,0], [0,0,6,0,0,6,0,0]]
    }
    if (status === 'done') {
      const armUp = isFrame3 === 0 ? [1,0,2,2,2,2,0,1] : isFrame3 === 1 ? [0,0,2,2,2,2,0,0] : [1,0,2,2,2,2,0,1]
      return [isFrame2?[0,1,4,4,4,4,1,0]:hair[0], hair[1], [0,1,isFrame2?5:6,1,1,isFrame2?5:6,1,0], [0,1,1,5,5,1,1,0], armUp, [0,0,2,2,2,2,0,0], [0,isFrame2?1:0,0,0,0,0,isFrame2?1:0,0], [0,isFrame2?0:6,6,0,0,6,isFrame2?0:6,0]]
    }
    if (status === 'sleeping') {
      return [hair[0], hair[1], [0,1,6,6,6,6,1,0], [0,1,1,1,1,1,1,0], [0,0,2,2,2,2,0,0], [0,2,2,2,2,2,2,0], [0,0,1,0,0,1,0,0], [0,0,6,0,0,6,0,0]]
    }
    // Idle
    return [hair[0], hair[1], [0,1,6,1,1,6,1,0], [0,1,1,1,1,1,1,0], [0,0,2,2,2,2,0,0], [0,2,2,2,2,2,2,0], [0,0,1,0,0,1,0,0], [0,isFrame2?6:0,isFrame2?0:6,0,0,isFrame2?0:6,isFrame2?6:0,0]]
  }

  let grid = getFrame()
  if (!facingRight) grid = grid.map(row => [...row].reverse())

  const colorMap = { 0: 'transparent', 1: config.skinTone, 2: config.color, 3: config.accent, 4: config.hair, 5: '#FFFFFF', 6: '#1a1a2e', 7: config.accent }

  return (
    <div className={`inline-block ${onClick ? 'cursor-pointer hover:brightness-125 transition-all' : ''}`} style={{ imageRendering: 'pixelated' }} onClick={onClick}>
      {grid.map((row, y) => (
        <div key={y} className="flex">
          {row.map((cell, x) => (
            <div key={x} style={{ width: size, height: size, backgroundColor: colorMap[cell] }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── DESK + MONITOR ──────────────────────────────
function PixelDesk({ status, size = 3 }) {
  const screenColor = status === 'working' ? '#22c55e' : status === 'review' ? '#eab308' : status === 'done' ? '#3b82f6' : status === 'error' ? '#ef4444' : '#374151'
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
            <div key={x} style={{ width: size, height: size, backgroundColor: colorMap[cell] }} />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── DECORATIONS ──────────────────────────────
function OfficePlant({ x, y }) {
  return (
    <div className="absolute" style={{ left: x, top: y, imageRendering: 'pixelated' }}>
      {[[0,0,0,1,0,0,0],[0,0,1,1,1,0,0],[0,1,1,1,1,1,0],[0,0,1,1,1,0,0],[0,0,0,2,0,0,0],[0,0,0,2,0,0,0],[0,0,3,3,3,0,0]].map((row, ry) => (
        <div key={ry} className="flex">
          {row.map((cell, rx) => (
            <div key={rx} style={{ width: 3, height: 3, backgroundColor: cell === 0 ? 'transparent' : cell === 1 ? '#22c55e' : cell === 2 ? '#92400E' : '#78716C' }} />
          ))}
        </div>
      ))}
    </div>
  )
}

function CoffeeMachine({ x, y }) {
  const [steam, setSteam] = useState(0)
  useEffect(() => { const i = setInterval(() => setSteam(s => (s + 1) % 3), 600); return () => clearInterval(i) }, [])
  return (
    <div className="absolute" style={{ left: x, top: y }}>
      <div className="relative">
        <div className="text-[10px] leading-none opacity-70">☕</div>
        {steam > 0 && <div className="absolute -top-2 left-1 text-[7px] text-gray-500 animate-pulse" style={{ opacity: steam === 1 ? 0.4 : 0.7 }}>~</div>}
      </div>
    </div>
  )
}

function WaterCooler({ x, y }) {
  return <div className="absolute text-[10px] opacity-50" style={{ left: x, top: y }}>🚰</div>
}

// ── PARTICLES ──────────────────────────────
function Particles({ status, color }) {
  const [particles, setParticles] = useState([])
  useEffect(() => {
    if (status !== 'done' && status !== 'working') { setParticles([]); return }
    const interval = setInterval(() => {
      setParticles(prev => {
        const next = prev.filter(p => p.life > 0).map(p => ({ ...p, life: p.life - 1, y: p.y - 0.5, opacity: p.life / p.maxLife }))
        if (next.length < 4 && Math.random() > 0.5) {
          const maxLife = status === 'done' ? 20 : 12
          next.push({ id: Date.now() + Math.random(), x: -8 + Math.random() * 16, y: 0, life: maxLife, maxLife, opacity: 1, char: status === 'done' ? ['✨','⭐','🎉'][Math.floor(Math.random()*3)] : ['·','•','○'][Math.floor(Math.random()*3)] })
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
        <div key={p.id} className="absolute text-[8px]" style={{ left: `calc(50% + ${p.x}px)`, top: `${p.y}px`, opacity: p.opacity, color: status === 'done' ? '#FFD700' : color }}>{p.char}</div>
      ))}
    </div>
  )
}

// ── SPEECH BUBBLE ──────────────────────────────
function SpeechBubble({ text, visible, color }) {
  if (!visible) return null
  return (
    <div className="absolute -top-9 left-1/2 -translate-x-1/2 text-[9px] text-gray-100 px-2 py-1 rounded-md whitespace-nowrap font-mono shadow-lg z-30 animate-bounce-subtle border" style={{ backgroundColor: '#1a1a2e', borderColor: color + '40' }}>
      {text}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45" style={{ backgroundColor: '#1a1a2e' }} />
    </div>
  )
}

// ── PROGRESS RING ──────────────────────────────
function ProgressRing({ progress, color, size = 18 }) {
  const r = (size - 4) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (progress / 100) * circ
  return (
    <svg width={size} height={size} className="absolute -top-1 -right-1 z-10">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#374151" strokeWidth="2" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="2" strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform={`rotate(-90 ${size/2} ${size/2})`} className="transition-all duration-1000" />
    </svg>
  )
}

// ── AGENT DESK STATION (static — no walking sprites) ──────────────────────────────
function AgentStation({ agent, tasks, agentData, onAgentClick, isAway }) {
  const [frame, setFrame] = useState(0)
  const [showBubble, setShowBubble] = useState(false)
  const [hovered, setHovered] = useState(false)
  const config = AGENT_CONFIG[agent]

  const agentTasks = tasks.filter(t => t.agent === agent)
  const inProgress = agentTasks.filter(t => t.status === 'In Progress')
  const inReview = agentTasks.filter(t => t.status === 'Review')
  const assigned = agentTasks.filter(t => t.status === 'Assigned')
  const done = agentTasks.filter(t => t.status === 'Done')
  const activeTasks = agentTasks.filter(t => t.status !== 'Done')

  let status = 'idle'
  let bubbleText = '💤 zzz'
  if (inProgress.length > 0) { status = 'working'; bubbleText = `✍️ ${(inProgress[0].name || 'task').substring(0, 22)}...` }
  else if (inReview.length > 0) { status = 'review'; bubbleText = `📋 Reviewing (${inReview.length})` }
  else if (assigned.length > 0) { status = 'working'; bubbleText = `📝 Queued (${assigned.length})` }
  else if (done.length > 0 && activeTasks.length === 0) { status = 'done'; bubbleText = `✅ ${done.length} complete!` }

  const totalTasks = agentTasks.length || 1
  const progress = Math.round((done.length / totalTasks) * 100)
  const animConfig = STATUS_ANIMATIONS[status]

  useEffect(() => { const i = setInterval(() => setFrame(f => f + 1), animConfig.speed); return () => clearInterval(i) }, [animConfig.speed])

  useEffect(() => {
    const show = () => { setShowBubble(true); setTimeout(() => setShowBubble(false), 3500) }
    const t = setTimeout(show, 2000 + Math.random() * 5000)
    const i = setInterval(show, 10000 + Math.random() * 15000)
    return () => { clearTimeout(t); clearInterval(i) }
  }, [])

  const statusColor = { working: '#22c55e', idle: '#6b7280', review: '#eab308', done: '#3b82f6', error: '#ef4444', sleeping: '#4b5563' }[status]

  const handleClick = useCallback(() => { if (onAgentClick && agentData) onAgentClick(agentData) }, [onAgentClick, agentData])

  return (
    <div
      className={`relative flex flex-col items-center gap-1 group transition-all duration-200 ${hovered ? 'scale-110 -translate-y-1' : ''} ${isAway ? 'opacity-50' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Particles + speech bubble (only at desk) */}
      {!isAway && <Particles status={status} color={config.color} />}
      {!isAway && <SpeechBubble text={bubbleText} visible={showBubble || hovered} color={config.color} />}

      {/* Status dot + progress ring */}
      <div className="relative">
        <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ backgroundColor: statusColor, boxShadow: `0 0 6px ${statusColor}` }} />
        {activeTasks.length > 0 && <ProgressRing progress={progress} color={config.color} size={16} />}
      </div>

      {/* Character or empty chair */}
      {!isAway ? (
        <div className="relative cursor-pointer" onClick={handleClick}>
          <PixelCharacter agent={agent} status={status} frame={frame} size={4} />
          {hovered && <div className="absolute -right-1 -top-1 w-3 h-3 bg-white/20 rounded-full flex items-center justify-center animate-ping pointer-events-none"><div className="w-1.5 h-1.5 bg-white rounded-full" /></div>}
        </div>
      ) : (
        <div className="w-8 h-8 flex items-center justify-center cursor-pointer" onClick={handleClick}>
          <div className="text-[12px] opacity-40">💺</div>
        </div>
      )}

      {/* Desk */}
      <div className="-mt-1">
        <PixelDesk status={isAway ? 'idle' : status} size={3} />
      </div>

      {/* Name plate */}
      <div className="mt-1 px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider cursor-pointer hover:brightness-125 transition-all" style={{ backgroundColor: config.color + '25', color: config.color, borderBottom: `2px solid ${config.color}40` }} onClick={handleClick}>
        {config.emoji} {agent}
      </div>

      {/* Task stats */}
      <div className="flex items-center gap-1 mt-0.5">
        {inProgress.length > 0 && <span className="text-[8px] px-1 py-px rounded bg-green-500/20 text-green-400 font-mono">{inProgress.length} active</span>}
        {inReview.length > 0 && <span className="text-[8px] px-1 py-px rounded bg-yellow-500/20 text-yellow-400 font-mono">{inReview.length} review</span>}
        {activeTasks.length === 0 && done.length > 0 && <span className="text-[8px] px-1 py-px rounded bg-blue-500/20 text-blue-400 font-mono">✓ {done.length}</span>}
        {agentTasks.length === 0 && <span className="text-[8px] text-gray-600 font-mono">standby</span>}
      </div>

      {/* Away tag */}
      {isAway && <div className="text-[8px] text-gray-500 font-mono animate-pulse mt-0.5">🚶 away</div>}

      {/* Hover card */}
      {hovered && (
        <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 bg-gray-800/95 backdrop-blur text-white text-[10px] px-3 py-2 rounded-lg z-40 whitespace-nowrap pointer-events-none border" style={{ borderColor: config.color + '30' }}>
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

// ── WALKING SPRITE (rendered at office floor level) ──────────────────────────────
function WalkingSprite({ agent, movement, onAgentClick, agentData }) {
  const config = AGENT_CONFIG[agent]
  const [frame, setFrame] = useState(0)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    const speed = movement.isWalking ? 200 : 600
    const i = setInterval(() => setFrame(f => f + 1), speed)
    return () => clearInterval(i)
  }, [movement.isWalking])

  const handleClick = useCallback(() => { if (onAgentClick && agentData) onAgentClick(agentData) }, [onAgentClick, agentData])

  return (
    <div
      className="absolute z-30 flex flex-col items-center pointer-events-auto cursor-pointer"
      style={{
        left: `${movement.posX}%`,
        top: `${movement.posY}%`,
        transform: 'translate(-50%, -50%)',
        transition: 'left 0.45s ease-out, top 0.45s ease-out',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
    >
      {/* Destination label */}
      {movement.destLabel && (
        <div className="text-[8px] font-mono px-1.5 py-0.5 rounded mb-1 whitespace-nowrap animate-bounce-subtle" style={{ backgroundColor: config.color + '25', color: config.color }}>
          {movement.destLabel}
        </div>
      )}

      {/* Shadow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-1.5 rounded-full opacity-30" style={{ backgroundColor: config.color, filter: 'blur(2px)' }} />

      {/* Character with bounce */}
      <div className={`${movement.isWalking ? (frame % 2 === 0 ? '-translate-y-px' : 'translate-y-px') : ''}`}>
        <PixelCharacter agent={agent} status="idle" frame={frame} size={4} facingRight={movement.facingRight} isWalking={movement.isWalking} />
      </div>

      {/* Name tag */}
      <div className="mt-0.5 px-1.5 py-px rounded text-[8px] font-bold tracking-wider" style={{ backgroundColor: config.color + '30', color: config.color }}>
        {agent}
      </div>

      {/* Hover tooltip */}
      {hovered && (
        <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 bg-gray-800/95 backdrop-blur text-[9px] px-2 py-1 rounded-lg z-50 whitespace-nowrap border" style={{ borderColor: config.color + '30', color: config.color }}>
          {movement.destLabel || (movement.isWalking ? '🚶 Walking...' : '🚶 Returning...')}
        </div>
      )}
    </div>
  )
}

// ── COLLABORATION LINES ──────────────────────────────
function CollaborationLines({ tasks, agentPositions }) {
  const lines = useMemo(() => {
    const activeAgents = {}
    tasks.forEach(t => {
      if (t.agent && (t.status === 'In Progress' || t.status === 'Review')) {
        if (!activeAgents[t.agent]) activeAgents[t.agent] = []
        activeAgents[t.agent].push(t)
      }
    })
    const connections = []
    const names = Object.keys(activeAgents)
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = names[i], b = names[j]
        const aTypes = new Set(activeAgents[a].map(t => t.contentType || t.type).filter(Boolean))
        const bTypes = new Set(activeAgents[b].map(t => t.contentType || t.type).filter(Boolean))
        const shared = [...aTypes].filter(t => bTypes.has(t))
        if (shared.length > 0 && agentPositions[a] && agentPositions[b]) {
          connections.push({ from: a, to: b, fromPos: agentPositions[a], toPos: agentPositions[b] })
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
        <line key={i} x1={line.fromPos.x} y1={line.fromPos.y} x2={line.toPos.x} y2={line.toPos.y} stroke={`url(#collab-${i})`} strokeWidth="1.5" strokeDasharray="4 4" className="animate-pulse" />
      ))}
    </svg>
  )
}

// ── ROUNDTABLE ──────────────────────────────
function Roundtable({ stats }) {
  const [pulse, setPulse] = useState(0)
  useEffect(() => { const i = setInterval(() => setPulse(p => (p + 1) % 60), 100); return () => clearInterval(i) }, [])
  const activity = Math.min((stats.inProgress + stats.review) / 10, 1)
  const glowIntensity = 0.05 + activity * 0.15
  return (
    <div className="relative w-56 h-14 rounded-full flex items-center justify-center">
      <div className="absolute inset-0 rounded-full transition-all duration-1000" style={{ background: `radial-gradient(ellipse, rgba(245,158,11,${glowIntensity}) 0%, transparent 70%)` }} />
      <div className="relative w-48 h-12 rounded-full bg-gradient-to-br from-amber-900/40 to-amber-800/20 border border-amber-700/30 flex items-center justify-center shadow-lg shadow-amber-900/20 overflow-hidden">
        <div className="text-center">
          <span className="text-[9px] text-amber-500/80 font-bold tracking-[0.2em] uppercase block">Roundtable</span>
          <span className="text-[8px] text-amber-600/50 font-mono">{stats.inProgress + stats.review} tasks in flight</span>
        </div>
        <div className="absolute inset-0 rounded-full" style={{ background: `conic-gradient(from ${pulse * 6}deg, transparent 0deg, rgba(245,158,11,0.08) 30deg, transparent 60deg)` }} />
      </div>
    </div>
  )
}

// ── OFFICE BACKGROUND ──────────────────────────────
function OfficeBackground() {
  const hour = new Date().getHours()

  // Time-of-day window colors
  const isMorning = hour >= 6 && hour < 12
  const isAfternoon = hour >= 12 && hour < 17
  const isEvening = hour >= 17 && hour < 21
  const isNight = hour >= 21 || hour < 6

  const windowGlass = isMorning ? '#4A90D9' :
                      isAfternoon ? '#87CEEB' :
                      isEvening ? '#E8875A' :
                      '#1a1a3e'
  const windowGlow = isMorning ? 'rgba(74,144,217,0.15)' :
                     isAfternoon ? 'rgba(135,206,235,0.2)' :
                     isEvening ? 'rgba(232,135,90,0.15)' :
                     'rgba(26,26,62,0.05)'
  const skyGradient = isMorning ? 'linear-gradient(180deg, #3B6BA5 0%, #6BA3D6 60%, #A8D0F0 100%)' :
                      isAfternoon ? 'linear-gradient(180deg, #5BA0D9 0%, #87CEEB 50%, #B8E0F7 100%)' :
                      isEvening ? 'linear-gradient(180deg, #5C3D6E 0%, #C76A3A 50%, #E8A85A 100%)' :
                      'linear-gradient(180deg, #0a0a1e 0%, #141430 50%, #1a1a3e 100%)'
  const ambientOverlay = isMorning ? 'rgba(74,144,217,0.04)' :
                         isAfternoon ? 'rgba(200,220,240,0.03)' :
                         isEvening ? 'rgba(232,135,90,0.05)' :
                         'rgba(20,20,50,0.08)'

  // Wall colors
  const wallTop = '#1e2335'
  const wallBottom = '#232838'
  const floorBase = '#141820'
  const floorAlt = '#181d28'
  const baseboard = '#2a3040'
  const ceilingColor = '#161a26'

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ imageRendering: 'pixelated' }}>

      {/* === CEILING === */}
      <div className="absolute top-0 left-0 right-0" style={{ height: '6%', backgroundColor: ceilingColor }}>
        {/* Recessed lighting dots */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-around items-end px-12" style={{ height: '100%' }}>
          {[15, 30, 50, 70, 85].map((pos) => (
            <div key={pos} className="relative" style={{ left: `${pos - 50}%` }}>
              <div style={{
                width: 6, height: 3,
                backgroundColor: isNight ? '#2a2f3d' : '#3d4455',
                borderRadius: '0 0 3px 3px',
                boxShadow: isNight ? 'none' : `0 4px 12px ${windowGlow}, 0 2px 6px rgba(255,255,255,0.05)`,
              }} />
            </div>
          ))}
        </div>
        {/* Ceiling edge line */}
        <div className="absolute bottom-0 left-0 right-0" style={{ height: 2, backgroundColor: '#1a1f2e' }} />
      </div>

      {/* === BACK WALL === */}
      <div className="absolute left-0 right-0" style={{
        top: '6%', height: '34%',
        background: `linear-gradient(180deg, ${wallTop} 0%, ${wallBottom} 100%)`,
      }}>
        {/* Subtle wall texture — vertical panel lines */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `repeating-linear-gradient(90deg, transparent 0px, transparent 78px, #4a5568 78px, #4a5568 80px)`,
        }} />

        {/* === WINDOWS === */}
        {[18, 50, 82].map((xPos, wi) => (
          <div key={wi} className="absolute" style={{
            left: `${xPos}%`, top: '15%',
            transform: 'translateX(-50%)',
            width: 72, height: '70%',
          }}>
            {/* Window outer frame */}
            <div style={{
              width: '100%', height: '100%',
              backgroundColor: '#2a3040',
              padding: 3,
              boxShadow: `0 0 20px ${windowGlow}, inset 0 0 4px rgba(0,0,0,0.5)`,
            }}>
              {/* Window inner frame with sky */}
              <div style={{
                width: '100%', height: '100%',
                background: skyGradient,
                position: 'relative',
                overflow: 'hidden',
              }}>
                {/* Window cross bars */}
                <div className="absolute left-1/2 top-0 bottom-0" style={{ width: 2, backgroundColor: '#2a3040', transform: 'translateX(-50%)' }} />
                <div className="absolute top-1/2 left-0 right-0" style={{ height: 2, backgroundColor: '#2a3040', transform: 'translateY(-50%)' }} />

                {/* Night stars */}
                {isNight && (
                  <>
                    {[
                      { l: '15%', t: '20%' }, { l: '70%', t: '15%' }, { l: '40%', t: '35%' },
                      { l: '25%', t: '60%' }, { l: '65%', t: '55%' }, { l: '80%', t: '75%' },
                      { l: '10%', t: '80%' }, { l: '50%', t: '70%' },
                    ].map((s, si) => (
                      <div key={si} className="absolute" style={{
                        left: s.l, top: s.t,
                        width: 2, height: 2,
                        backgroundColor: '#e0e7ff',
                        opacity: 0.4 + (si % 3) * 0.2,
                      }} />
                    ))}
                  </>
                )}

                {/* Morning / afternoon clouds (pixel rectangles) */}
                {(isMorning || isAfternoon) && (
                  <>
                    <div className="absolute" style={{ left: '10%', top: '25%', width: 16, height: 4, backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 1 }} />
                    <div className="absolute" style={{ left: '60%', top: '20%', width: 12, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 1 }} />
                    <div className="absolute" style={{ left: '35%', top: '65%', width: 14, height: 4, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 1 }} />
                  </>
                )}

                {/* Evening sun glow */}
                {isEvening && (
                  <div className="absolute" style={{
                    left: '50%', bottom: '10%',
                    width: 20, height: 10,
                    transform: 'translateX(-50%)',
                    background: 'radial-gradient(ellipse, rgba(255,180,50,0.6) 0%, rgba(255,100,50,0.2) 60%, transparent 100%)',
                  }} />
                )}

                {/* Window sill reflection */}
                <div className="absolute bottom-0 left-0 right-0" style={{ height: 3, backgroundColor: 'rgba(255,255,255,0.06)' }} />
              </div>
            </div>
            {/* Window sill */}
            <div style={{
              width: 'calc(100% + 8px)', height: 4,
              backgroundColor: '#2a3040',
              marginLeft: -4,
              borderRadius: '0 0 1px 1px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
            }} />
          </div>
        ))}

        {/* === WALL DETAILS === */}

        {/* Whiteboard between left and center windows */}
        <div className="absolute" style={{
          left: '34%', top: '18%',
          transform: 'translateX(-50%)',
          width: 40, height: '55%',
        }}>
          {/* Board frame */}
          <div style={{
            width: '100%', height: '100%',
            backgroundColor: '#3a4050',
            padding: 2,
          }}>
            {/* Board surface */}
            <div style={{
              width: '100%', height: '100%',
              backgroundColor: '#e8e8e0',
              position: 'relative',
            }}>
              {/* Scribble lines (pixel art) */}
              <div className="absolute" style={{ left: 3, top: 4, width: 20, height: 2, backgroundColor: '#ef4444', opacity: 0.5 }} />
              <div className="absolute" style={{ left: 5, top: 10, width: 16, height: 2, backgroundColor: '#3b82f6', opacity: 0.4 }} />
              <div className="absolute" style={{ left: 3, top: 16, width: 22, height: 2, backgroundColor: '#22c55e', opacity: 0.4 }} />
              <div className="absolute" style={{ left: 8, top: 22, width: 14, height: 2, backgroundColor: '#6b7280', opacity: 0.3 }} />
            </div>
          </div>
          {/* Marker tray */}
          <div style={{ width: '90%', height: 3, backgroundColor: '#3a4050', margin: '0 auto', borderRadius: '0 0 1px 1px' }} />
        </div>

        {/* Clock between center and right windows */}
        <div className="absolute" style={{
          left: '66%', top: '22%',
          transform: 'translateX(-50%)',
          width: 18, height: 18,
        }}>
          {/* Clock face */}
          <div style={{
            width: '100%', height: '100%',
            backgroundColor: '#2a3040',
            borderRadius: '50%',
            border: '2px solid #3a4050',
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{
              width: 6, height: 6,
              backgroundColor: '#d4d4d4',
              borderRadius: '50%',
              position: 'relative',
            }}>
              {/* Hour hand */}
              <div className="absolute" style={{
                left: '50%', bottom: '50%',
                width: 1, height: 2,
                backgroundColor: '#e5e5e5',
                transformOrigin: 'bottom center',
                transform: `translateX(-50%) rotate(${(hour % 12) * 30}deg)`,
              }} />
            </div>
          </div>
        </div>

        {/* Songfinch logo placeholder — small amber diamond/note */}
        <div className="absolute" style={{
          left: '8%', top: '30%',
          width: 12, height: 14,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
        }}>
          {/* Music note shape */}
          <div style={{ width: 8, height: 8, backgroundColor: '#F59E0B', opacity: 0.25, transform: 'rotate(45deg)', borderRadius: 1 }} />
          <div style={{ width: 4, height: 2, backgroundColor: '#F59E0B', opacity: 0.15, borderRadius: 1 }} />
        </div>

        {/* Baseboard / wainscoting line */}
        <div className="absolute bottom-0 left-0 right-0" style={{ height: 4, backgroundColor: baseboard, boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
        {/* Wainscoting accent line */}
        <div className="absolute left-0 right-0" style={{ bottom: 4, height: 1, backgroundColor: '#323848' }} />
      </div>

      {/* === FLOOR === */}
      <div className="absolute left-0 right-0 bottom-0" style={{
        top: '40%',
        backgroundColor: floorBase,
      }}>
        {/* Tiled floor pattern — pixel grid with alternating dark tiles */}
        <div className="absolute inset-0 opacity-[0.6]" style={{
          backgroundImage: `
            repeating-conic-gradient(${floorAlt} 0% 25%, ${floorBase} 0% 50%)
          `,
          backgroundSize: '24px 24px',
        }} />

        {/* Floor grout lines for extra pixel feel */}
        <div className="absolute inset-0 opacity-[0.08]" style={{
          backgroundImage: `
            linear-gradient(90deg, #4a5568 0px, transparent 1px),
            linear-gradient(180deg, #4a5568 0px, transparent 1px)
          `,
          backgroundSize: '24px 24px',
        }} />

        {/* Perspective shadow from wall */}
        <div className="absolute top-0 left-0 right-0" style={{
          height: 20,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.25) 0%, transparent 100%)',
        }} />

        {/* Subtle floor reflection / shine strip */}
        <div className="absolute left-0 right-0" style={{
          top: '15%', height: 2,
          background: 'linear-gradient(90deg, transparent 10%, rgba(255,255,255,0.02) 30%, rgba(255,255,255,0.03) 50%, rgba(255,255,255,0.02) 70%, transparent 90%)',
        }} />
      </div>

      {/* === AMBIENT LIGHTING OVERLAY === */}
      {/* Window light pools on the floor */}
      {[18, 50, 82].map((xPos, i) => (
        <div key={`light-${i}`} className="absolute" style={{
          left: `${xPos}%`,
          top: '40%',
          width: 90,
          height: 60,
          transform: 'translateX(-50%)',
          background: `radial-gradient(ellipse at 50% 0%, ${windowGlow} 0%, transparent 70%)`,
          opacity: isNight ? 0.3 : 0.6,
        }} />
      ))}

      {/* Overall ambient tint */}
      <div className="absolute inset-0" style={{ backgroundColor: ambientOverlay }} />

      {/* Subtle vignette */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(ellipse at 50% 50%, transparent 50%, rgba(0,0,0,0.15) 100%)',
      }} />
    </div>
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

  useEffect(() => { const t = setInterval(() => setClock(new Date()), 1000); return () => clearInterval(t) }, [])

  // Compute status per agent (needed for movement hook)
  const agentStatuses = useMemo(() => {
    const statuses = {}
    AGENT_NAMES.forEach(name => {
      const agentTasks = tasks.filter(t => t.agent === name)
      const inProgress = agentTasks.filter(t => t.status === 'In Progress')
      const inReview = agentTasks.filter(t => t.status === 'Review')
      const assigned = agentTasks.filter(t => t.status === 'Assigned')
      const done = agentTasks.filter(t => t.status === 'Done')
      const active = agentTasks.filter(t => t.status !== 'Done')
      if (inProgress.length > 0 || assigned.length > 0) statuses[name] = 'working'
      else if (inReview.length > 0) statuses[name] = 'review'
      else if (done.length > 0 && active.length === 0) statuses[name] = 'done'
      else statuses[name] = 'idle'
    })
    return statuses
  }, [tasks])

  // Movement hooks for all 10 agents (called at top level — same order every render)
  const moveCMO = useMovement('CMO', agentStatuses.CMO || 'idle')
  const moveCHIEF = useMovement('CHIEF', agentStatuses.CHIEF || 'idle')
  const moveMUSE = useMovement('MUSE', agentStatuses.MUSE || 'idle')
  const moveHOOK = useMovement('HOOK', agentStatuses.HOOK || 'idle')
  const movePULSE = useMovement('PULSE', agentStatuses.PULSE || 'idle')
  const moveLENS = useMovement('LENS', agentStatuses.LENS || 'idle')
  const moveSTORY = useMovement('STORY', agentStatuses.STORY || 'idle')
  const moveSCOUT = useMovement('SCOUT', agentStatuses.SCOUT || 'idle')
  const moveFLOW = useMovement('FLOW', agentStatuses.FLOW || 'idle')
  const movePIXEL = useMovement('PIXEL', agentStatuses.PIXEL || 'idle')

  const movements = { CMO: moveCMO, CHIEF: moveCHIEF, MUSE: moveMUSE, HOOK: moveHOOK, PULSE: movePULSE, LENS: moveLENS, STORY: moveSTORY, SCOUT: moveSCOUT, FLOW: moveFLOW, PIXEL: movePIXEL }

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

  const agentPositions = useMemo(() => {
    const pos = {}
    const w = officeRef.current?.offsetWidth || 900
    TOP_ROW.forEach((name, i) => { pos[name] = { x: (w / 6) * (i + 1), y: 100 } })
    BOTTOM_ROW.forEach((name, i) => { pos[name] = { x: (w / 6) * (i + 1), y: 300 } })
    return pos
  }, [officeRef.current?.offsetWidth])

  return (
    <div className="relative bg-gray-900/60 border border-gray-700/50 rounded-xl overflow-hidden">
      <OfficeBackground />

      {/* Header */}
      <div className="relative flex items-center justify-between px-4 py-2.5 border-b border-gray-700/50 bg-gray-800/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏢</span>
          <span className="text-sm font-bold text-gray-300">The Roundtable — Agent Office</span>
          <span className="text-[10px] text-gray-500 font-mono ml-2">{clock.toLocaleTimeString()}</span>
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
      <div className="relative p-6 min-h-[380px]" ref={officeRef}>
        <CollaborationLines tasks={tasks} agentPositions={agentPositions} />

        {/* Decorations */}
        <OfficePlant x={20} y={30} />
        <OfficePlant x="calc(100% - 40px)" y={30} />
        <CoffeeMachine x={50} y={180} />
        <WaterCooler x="calc(100% - 60px)" y={180} />

        {/* Top row of desks */}
        <div className="relative z-10 flex justify-around items-end mb-6">
          {TOP_ROW.map(name => (
            <AgentStation key={name} agent={name} tasks={tasks} agentData={agents.find(a => a.name === name)} onAgentClick={onAgentClick} isAway={movements[name].isAway} />
          ))}
        </div>

        {/* Roundtable */}
        <div className="relative z-10 flex justify-center my-2">
          <Roundtable stats={stats} />
        </div>

        {/* Bottom row of desks */}
        <div className="relative z-10 flex justify-around items-start mt-6">
          {BOTTOM_ROW.map(name => (
            <AgentStation key={name} agent={name} tasks={tasks} agentData={agents.find(a => a.name === name)} onAgentClick={onAgentClick} isAway={movements[name].isAway} />
          ))}
        </div>

        {/* === WALKING AGENTS OVERLAY === */}
        {/* Rendered at office floor level so absolute positioning works correctly */}
        <div className="absolute inset-0 pointer-events-none z-20">
          {AGENT_NAMES.map(name => {
            const m = movements[name]
            if (!m.isAway) return null
            return (
              <WalkingSprite
                key={`walk-${name}`}
                agent={name}
                movement={m}
                onAgentClick={onAgentClick}
                agentData={agents.find(a => a.name === name)}
              />
            )
          })}
        </div>
      </div>

      <ActivityTicker tasks={tasks} />
    </div>
  )
}

// ── ACTIVITY TICKER ──────────────────────────────
function ActivityTicker({ tasks }) {
  const recentTasks = tasks.filter(t => t.status === 'In Progress' || t.status === 'Review' || t.status === 'Assigned').slice(0, 10)
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
