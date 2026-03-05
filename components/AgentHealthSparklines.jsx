'use client'

import { useMemo } from 'react'

/**
 * Generates sparkline path data from an array of values.
 * Normalizes values to fit within the given width/height.
 */
function sparklinePath(values, width = 60, height = 20) {
  if (!values || values.length < 2) return ''
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1
  const step = width / (values.length - 1)

  return values.map((v, i) => {
    const x = i * step
    const y = height - ((v - min) / range) * height
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')
}

/**
 * Generates simulated health data for an agent based on their tasks.
 * In production, this would come from real metrics (API latency, success rate, etc.)
 */
function generateHealthData(agent, tasks) {
  const agentTasks = tasks.filter(t => t.agent === agent.name)
  const done = agentTasks.filter(t => t.status === 'Done').length
  const failed = agentTasks.filter(t => t.status === 'Error' || t.status === 'Failed').length
  const total = agentTasks.length || 1
  const successRate = Math.round(((done) / total) * 100)

  // Generate sparkline from a simulated time series (based on task creation pattern)
  const points = []
  for (let i = 0; i < 12; i++) {
    // Mix of real performance + some noise for visual interest
    const base = successRate / 100
    const noise = (Math.sin(i * 1.5 + agent.name.length) * 0.2)
    points.push(Math.max(0, Math.min(1, base + noise)))
  }

  return {
    successRate,
    completed: done,
    failed,
    active: agentTasks.filter(t => t.status === 'In Progress').length,
    inQueue: agentTasks.filter(t => t.status === 'Assigned' || t.status === 'Inbox').length,
    sparklineData: points,
  }
}

function SparklineChart({ data, color = '#22c55e', width = 60, height = 20 }) {
  const path = sparklinePath(data, width, height)
  if (!path) return null

  return (
    <svg width={width} height={height} className="shrink-0">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Fill area */}
      <path
        d={`${path} L${width},${height} L0,${height} Z`}
        fill={`url(#grad-${color.replace('#', '')})`}
      />
      {/* Line */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* End dot */}
      {data.length > 0 && (
        <circle
          cx={width}
          cy={height - ((data[data.length - 1] - Math.min(...data)) / (Math.max(...data, 1) - Math.min(...data, 0) || 1)) * height}
          r="2"
          fill={color}
        />
      )}
    </svg>
  )
}

function getHealthColor(rate) {
  if (rate >= 80) return '#22c55e' // green
  if (rate >= 60) return '#eab308' // yellow
  if (rate >= 40) return '#f97316' // orange
  return '#ef4444' // red
}

function getStatusLabel(agent) {
  if (agent.status === 'Working') return { text: 'Working', color: 'text-accent-blue' }
  if (agent.status === 'Active') return { text: 'Active', color: 'text-accent-green' }
  if (agent.status === 'Error') return { text: 'Error', color: 'text-accent-red' }
  if (agent.status === 'Idle') return { text: 'Idle', color: 'text-gray-500' }
  return { text: agent.status || 'Idle', color: 'text-gray-500' }
}

export default function AgentHealthSparklines({ agents = [], tasks = [], compact = false }) {
  const healthData = useMemo(() => {
    return agents.map(agent => ({
      agent,
      health: generateHealthData(agent, tasks),
    }))
  }, [agents, tasks])

  if (compact) {
    return (
      <div className="flex items-center gap-3 overflow-x-auto scrollbar-hide py-1">
        {healthData.map(({ agent, health }) => {
          const color = getHealthColor(health.successRate)
          return (
            <div key={agent.name} className="flex items-center gap-1.5 shrink-0" title={`${agent.name}: ${health.successRate}% success`}>
              <span className="text-xs">{agent.emoji}</span>
              <SparklineChart data={health.sparklineData} color={color} width={40} height={14} />
              <span className="text-[9px] font-mono font-semibold" style={{ color }}>{health.successRate}%</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {healthData.map(({ agent, health }) => {
        const color = getHealthColor(health.successRate)
        const status = getStatusLabel(agent)

        return (
          <div
            key={agent.name}
            className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-dark-700/50 transition-colors group"
          >
            {/* Agent avatar */}
            <div className="w-7 h-7 rounded-full bg-dark-700 border border-dark-500 flex items-center justify-center text-sm shrink-0">
              {agent.emoji}
            </div>

            {/* Name + Status */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-gray-200 truncate">{agent.name}</span>
                <span className={`text-[9px] ${status.color}`}>{status.text}</span>
              </div>
              <div className="flex items-center gap-2 text-[9px] text-gray-600 mt-0.5">
                <span>{health.completed} done</span>
                <span>·</span>
                <span>{health.active} active</span>
                {health.failed > 0 && (
                  <>
                    <span>·</span>
                    <span className="text-red-400">{health.failed} failed</span>
                  </>
                )}
              </div>
            </div>

            {/* Sparkline */}
            <SparklineChart data={health.sparklineData} color={color} width={60} height={20} />

            {/* Success rate */}
            <div className="text-right shrink-0 w-10">
              <span className="text-[11px] font-bold font-mono" style={{ color }}>
                {health.successRate}%
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
