'use client'

import { useMemo } from 'react'

const STATUS_CONFIGS = {
  Working: {
    color: '#22c55e',
    bgClass: 'bg-green-500/10',
    textClass: 'text-accent-green',
    borderClass: 'border-green-500/30',
    pulseClass: 'agent-pulse-online',
    icon: '⚡',
    label: 'Working',
  },
  Active: {
    color: '#3b82f6',
    bgClass: 'bg-blue-500/10',
    textClass: 'text-accent-blue',
    borderClass: 'border-blue-500/30',
    pulseClass: '',
    icon: '●',
    label: 'Active',
  },
  Idle: {
    color: '#6b7280',
    bgClass: 'bg-gray-500/10',
    textClass: 'text-gray-500',
    borderClass: 'border-gray-500/30',
    pulseClass: '',
    icon: '○',
    label: 'Idle',
  },
  Error: {
    color: '#ef4444',
    bgClass: 'bg-red-500/10',
    textClass: 'text-accent-red',
    borderClass: 'border-red-500/30',
    pulseClass: 'badge-pulse',
    icon: '⚠',
    label: 'Error',
  },
  Offline: {
    color: '#374151',
    bgClass: 'bg-gray-800/50',
    textClass: 'text-gray-600',
    borderClass: 'border-gray-700/30',
    pulseClass: '',
    icon: '⊘',
    label: 'Offline',
  },
}

function StatusDot({ status, size = 'sm' }) {
  const config = STATUS_CONFIGS[status] || STATUS_CONFIGS.Idle
  const sizeClasses = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
  }

  return (
    <div
      className={`rounded-full ${sizeClasses[size]} ${config.pulseClass}`}
      style={{ backgroundColor: config.color }}
    />
  )
}

function StatusBadge({ status, showIcon = true, size = 'sm' }) {
  const config = STATUS_CONFIGS[status] || STATUS_CONFIGS.Idle
  const sizeClasses = {
    sm: 'text-[9px] px-1.5 py-0.5',
    md: 'text-[10px] px-2 py-0.5',
    lg: 'text-[11px] px-2.5 py-1',
  }

  return (
    <span className={`inline-flex items-center gap-1 rounded border font-semibold uppercase tracking-wider ${config.bgClass} ${config.textClass} ${config.borderClass} ${sizeClasses[size]}`}>
      {showIcon && <span className="text-[8px]">{config.icon}</span>}
      {config.label}
    </span>
  )
}

function AgentAvatar({ agent, size = 'md', showStatus = true }) {
  const config = STATUS_CONFIGS[agent.status] || STATUS_CONFIGS.Idle
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-9 h-9 text-lg',
    lg: 'w-12 h-12 text-xl',
    xl: 'w-16 h-16 text-2xl',
  }
  const dotSizes = { sm: 'xs', md: 'sm', lg: 'md', xl: 'lg' }
  const dotPositions = {
    sm: '-bottom-0 -right-0',
    md: '-bottom-0.5 -right-0.5',
    lg: '-bottom-0.5 -right-0.5',
    xl: '-bottom-1 -right-1',
  }

  return (
    <div className="relative inline-flex">
      <div
        className={`rounded-full flex items-center justify-center shrink-0 ${sizeClasses[size]} ${config.pulseClass}`}
        style={{
          background: `${agent.color}15`,
          border: `2px solid ${agent.color}`,
        }}
      >
        {agent.emoji}
      </div>
      {showStatus && (
        <div className={`absolute ${dotPositions[size]} border-2 border-dark-800 rounded-full`}>
          <StatusDot status={agent.status} size={dotSizes[size]} />
        </div>
      )}
    </div>
  )
}

function AgentStatusRow({ agents }) {
  const statusCounts = useMemo(() => {
    const counts = { Working: 0, Active: 0, Idle: 0, Error: 0, Offline: 0 }
    agents.forEach(a => {
      const status = a.status || 'Idle'
      if (counts[status] !== undefined) counts[status]++
      else counts.Idle++
    })
    return counts
  }, [agents])

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {Object.entries(statusCounts)
        .filter(([, count]) => count > 0)
        .map(([status, count]) => {
          const config = STATUS_CONFIGS[status]
          return (
            <div key={status} className="flex items-center gap-1">
              <StatusDot status={status} size="xs" />
              <span className={`text-[10px] font-mono ${config.textClass}`}>
                {count} {config.label.toLowerCase()}
              </span>
            </div>
          )
        })}
    </div>
  )
}

export { StatusDot, StatusBadge, AgentAvatar, AgentStatusRow, STATUS_CONFIGS }
export default AgentAvatar
