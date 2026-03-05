'use client'

import { useState, useEffect } from 'react'

function getRunInterval() {
  if (typeof window === 'undefined') return 60
  try {
    const saved = localStorage.getItem('roundtable-settings')
    if (saved) {
      const settings = JSON.parse(saved)
      return settings.runInterval || 60
    }
  } catch {}
  return 60
}

function useNextRunCountdown() {
  const [timeLeft, setTimeLeft] = useState('')

  useEffect(() => {
    function calc() {
      const intervalMinutes = getRunInterval()
      const now = new Date()
      const next = new Date(now)
      next.setMinutes(next.getMinutes() - (next.getMinutes() % intervalMinutes) + intervalMinutes)
      next.setSeconds(0)
      next.setMilliseconds(0)

      const diff = next - now
      if (diff <= 0) return 'now'
      const mins = Math.floor(diff / 60000)
      const secs = Math.floor((diff % 60000) / 1000)
      return `${mins}m ${secs.toString().padStart(2, '0')}s`
    }

    setTimeLeft(calc())
    const interval = setInterval(() => setTimeLeft(calc()), 1000)
    return () => clearInterval(interval)
  }, [])

  return timeLeft
}

export default function AgentSidebar({ agents, selectedAgent, onSelectAgent, onConfigAgent, tasks }) {
  const nextRun = useNextRunCountdown()

  const getAgentTaskCount = (agentName) => {
    return tasks.filter(t => t.agent === agentName && t.status !== 'Done').length
  }

  const getAgentOutputStats = (agentName) => {
    const agentTasks = tasks.filter(t => t.agent === agentName)
    const done = agentTasks.filter(t => t.status === 'Done').length
    const totalChars = agentTasks
      .filter(t => t.output && t.status === 'Done')
      .reduce((sum, t) => sum + t.output.length, 0)
    return { done, totalChars }
  }

  const getAssignedCount = (agentName) => {
    return tasks.filter(t => t.agent === agentName && t.status === 'Assigned').length
  }

  const getAgentTaskBreakdown = (agentName) => {
    const agentTasks = tasks.filter(t => t.agent === agentName && t.status !== 'Done')
    return {
      total: agentTasks.length,
      inProgress: agentTasks.filter(t => t.status === 'In Progress').length,
      review: agentTasks.filter(t => t.status === 'Review').length,
      assigned: agentTasks.filter(t => t.status === 'Assigned').length,
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'Working': return 'bg-accent-green'
      case 'Active': return 'bg-accent-blue'
      case 'Idle': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'Working': return 'bg-green-500/10 text-accent-green border-green-500/20'
      case 'Active': return 'bg-blue-500/10 text-accent-blue border-blue-500/20'
      case 'Idle': return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  const getTypeBadge = (type) => {
    switch (type) {
      case 'EXEC': return { bg: 'bg-yellow-500/20', text: 'text-yellow-300', label: 'EXEC' }
      case 'OPS': return { bg: 'bg-indigo-500/15', text: 'text-indigo-400', label: 'OPS' }
      case 'LEAD': return { bg: 'bg-orange-500/15', text: 'text-orange-400', label: 'LEAD' }
      case 'SPC': return { bg: 'bg-blue-500/15', text: 'text-blue-400', label: 'SPC' }
      case 'INT': return { bg: 'bg-teal-500/15', text: 'text-teal-400', label: 'INT' }
      default: return { bg: 'bg-gray-500/15', text: 'text-gray-400', label: type }
    }
  }

  const onlineCount = agents.filter(a => a.status === 'Working' || a.status === 'Active').length

  return (
    <aside className="w-72 bg-dark-800 border-r border-dark-500 flex flex-col shrink-0 overflow-hidden">
      {/* Sidebar Header */}
      <div className="px-4 py-3 border-b border-dark-500 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-green pulse-dot"></div>
          <span className="text-sm font-semibold">AGENTS</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-accent-green flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green inline-block"></span>
            {onlineCount} online
          </span>
          <span className="text-xs bg-dark-600 px-2 py-0.5 rounded-full text-gray-400">
            {agents.length}
          </span>
        </div>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto py-1">
        {agents.map((agent) => {
          const typeBadge = getTypeBadge(agent.type)
          const taskCount = getAgentTaskCount(agent.name)
          const assignedCount = getAssignedCount(agent.name)
          const outputStats = getAgentOutputStats(agent.name)
          const taskBreakdown = getAgentTaskBreakdown(agent.name)
          const isSelected = selectedAgent === agent.name

          return (
            <div key={agent.id} className="relative group">
              <button
                onClick={() => onSelectAgent(agent.name)}
                onDoubleClick={() => onConfigAgent && onConfigAgent(agent)}
                className={`agent-item w-full px-4 py-2.5 flex items-center gap-3 text-left border-l-2 transition-all ${
                  isSelected
                    ? 'border-l-white bg-dark-600'
                    : 'border-l-transparent hover:bg-dark-700'
                }`}
                title={`${agent.name} - ${agent.role} (double-click to configure)`}
              >
                {/* Agent Avatar */}
                <div className="relative">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0 ${agent.status === 'Working' ? 'agent-avatar-active' : ''}`}
                    style={{
                      background: `${agent.color}15`,
                      border: `2px solid ${agent.color}`,
                    }}
                  >
                    {agent.emoji}
                  </div>
                  {/* Online indicator dot */}
                  <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-dark-800 ${getStatusColor(agent.status)} ${agent.status !== 'Idle' ? 'pulse-dot' : ''}`}></div>
                </div>

                {/* Agent Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold truncate">{agent.name}</span>
                    <span className={`status-badge px-1.5 py-0.5 rounded ${typeBadge.bg} ${typeBadge.text}`}>
                      {typeBadge.label}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">{agent.role}</div>
                  {/* Output stats row */}
                  <div className="flex items-center gap-2 mt-0.5">
                    {outputStats.done > 0 && (
                      <span className="text-[9px] text-green-500/70 font-mono">{outputStats.done} done</span>
                    )}
                    {outputStats.totalChars > 0 && (
                      <span className="text-[9px] text-gray-600 font-mono">{Math.round(outputStats.totalChars / 1000)}k chars</span>
                    )}
                    {assignedCount > 0 && (
                      <span className="text-[9px] text-yellow-500/70 font-mono">{assignedCount} queued</span>
                    )}
                  </div>
                </div>

                {/* Status + Task Count Badges */}
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className={`status-badge px-1.5 py-0.5 rounded border ${getStatusBadgeStyle(agent.status)} ${agent.status === 'Working' ? 'status-badge-pulse' : ''}`}>
                    {agent.status}
                  </span>
                  {taskBreakdown.total > 0 ? (
                    <div className="flex items-center gap-1">
                      {taskBreakdown.inProgress > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold bg-accent-blue/20 text-accent-blue border border-accent-blue/30" title={`${taskBreakdown.inProgress} in progress`}>
                          {taskBreakdown.inProgress}
                        </span>
                      )}
                      {taskBreakdown.review > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold bg-accent-orange/20 text-accent-orange border border-accent-orange/30" title={`${taskBreakdown.review} in review`}>
                          {taskBreakdown.review}
                        </span>
                      )}
                      {taskBreakdown.assigned > 0 && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[9px] font-bold bg-gray-500/20 text-gray-400 border border-gray-500/30" title={`${taskBreakdown.assigned} assigned`}>
                          {taskBreakdown.assigned}
                        </span>
                      )}
                      <span className="text-[9px] text-gray-600 ml-0.5">{taskBreakdown.total}</span>
                    </div>
                  ) : (
                    <span className="text-[9px] text-gray-600 italic">idle</span>
                  )}
                </div>
              </button>

              {/* Config gear icon on hover */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  onConfigAgent && onConfigAgent(agent)
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-dark-500 text-gray-600 hover:text-gray-300"
                title="Configure agent"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>

      {/* Status Legend */}
      <div className="px-4 py-2 border-t border-dark-500 space-y-1.5">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[9px] text-gray-600 uppercase tracking-wider font-semibold">Agent:</span>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-green pulse-dot" />
            <span className="text-[9px] text-gray-500">Working</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-blue" />
            <span className="text-[9px] text-gray-500">Active</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-gray-500" />
            <span className="text-[9px] text-gray-500">Idle</span>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-[9px] text-gray-600 uppercase tracking-wider font-semibold">Tasks:</span>
          <div className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-accent-blue/30 border border-accent-blue/50" />
            <span className="text-[9px] text-gray-500">In Progress</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-accent-orange/30 border border-accent-orange/50" />
            <span className="text-[9px] text-gray-500">Review</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-500/30 border border-gray-500/50" />
            <span className="text-[9px] text-gray-500">Assigned</span>
          </div>
        </div>
      </div>

      {/* Sidebar Footer */}
      <div className="px-4 py-3 border-t border-dark-500 space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span className="flex items-center gap-1.5">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent-orange">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Next Run
          </span>
          <span className="text-accent-orange font-semibold font-mono text-[10px]">{nextRun}</span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span>Total Completed</span>
          <span className="text-accent-green font-semibold">
            {agents.reduce((sum, a) => sum + a.tasksCompleted, 0)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span>Total Output</span>
          <span className="text-gray-400 font-semibold font-mono text-[10px]">
            {Math.round(tasks.filter(t => t.output && t.status === 'Done').reduce((s, t) => s + t.output.length, 0) / 1000)}k chars
          </span>
        </div>
      </div>
    </aside>
  )
}
