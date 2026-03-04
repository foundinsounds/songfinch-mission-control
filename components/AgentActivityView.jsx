'use client'

import { useMemo } from 'react'
import { MODEL_OPTIONS, MODEL_LEGACY_MAP } from '../lib/constants'

function getModelLabel(model) {
  const resolved = MODEL_LEGACY_MAP[model] || model
  return MODEL_OPTIONS.find(m => m.value === resolved)?.label || model || 'Unknown'
}

function getStatusColor(status) {
  switch (status) {
    case 'Working': return { dot: 'bg-green-400', text: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' }
    case 'Active': return { dot: 'bg-blue-400', text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' }
    default: return { dot: 'bg-gray-500', text: 'text-gray-500', bg: 'bg-gray-500/5', border: 'border-dark-500' }
  }
}

export default function AgentActivityView({ agents, tasks, activity, onAgentClick }) {
  // Map agents to their current tasks and recent activity
  const agentData = useMemo(() => {
    return agents.map(agent => {
      const agentTasks = tasks.filter(t => t.agent === agent.name)
      const currentTask = agentTasks.find(t => t.status === 'In Progress')
      const assignedTasks = agentTasks.filter(t => t.status === 'Assigned')
      const reviewTasks = agentTasks.filter(t => t.status === 'Review')
      const doneTasks = agentTasks.filter(t => t.status === 'Done')
      const recentActivity = activity
        .filter(a => a.agent === agent.name)
        .slice(0, 3)

      return {
        ...agent,
        currentTask,
        assignedTasks,
        reviewTasks,
        doneTasks,
        allTasks: agentTasks,
        recentActivity,
      }
    })
  }, [agents, tasks, activity])

  return (
    <div className="p-5 overflow-auto h-full">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-sm font-bold text-gray-200 uppercase tracking-wider">Agent Activity Overview</h2>
        <div className="flex items-center gap-4 text-[10px] text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-400 inline-block"></span> Working</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block"></span> Active</span>
          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-gray-500 inline-block"></span> Idle</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agentData.map((agent) => {
          const sc = getStatusColor(agent.status)
          return (
            <div
              key={agent.id}
              className={`rounded-xl border ${sc.border} ${sc.bg} p-4 hover:border-accent-orange/30 transition-all cursor-pointer`}
              onClick={() => onAgentClick?.(agent)}
            >
              {/* Agent Header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center text-xl"
                  style={{ background: `${agent.color}20`, border: `1.5px solid ${agent.color}` }}
                >
                  {agent.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-gray-200 truncate">{agent.name}</span>
                    <span className={`w-2 h-2 rounded-full ${sc.dot} ${agent.status === 'Working' ? 'pulse-dot' : ''}`}></span>
                  </div>
                  <div className="text-[10px] text-gray-500 truncate">{agent.role}</div>
                </div>
                <div className="text-right">
                  <div className={`text-[10px] font-semibold uppercase tracking-wider ${sc.text}`}>
                    {agent.status}
                  </div>
                  <div className="text-[9px] text-gray-600 font-mono">{getModelLabel(agent.model).split(' ').slice(0, 2).join(' ')}</div>
                </div>
              </div>

              {/* Current Task */}
              {agent.currentTask ? (
                <div className="bg-dark-800/50 rounded-lg p-3 mb-3 border border-dark-500/50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse"></div>
                    <span className="text-[9px] text-accent-green uppercase tracking-wider font-semibold">Working On</span>
                  </div>
                  <p className="text-xs text-gray-300 font-medium truncate">{agent.currentTask.name}</p>
                  {agent.currentTask.contentType && (
                    <span className="text-[9px] text-gray-500 mt-1 inline-block">{agent.currentTask.contentType}</span>
                  )}
                </div>
              ) : agent.assignedTasks.length > 0 ? (
                <div className="bg-dark-800/50 rounded-lg p-3 mb-3 border border-dark-500/50">
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-yellow"></div>
                    <span className="text-[9px] text-accent-yellow uppercase tracking-wider font-semibold">Next Up</span>
                  </div>
                  <p className="text-xs text-gray-300 font-medium truncate">{agent.assignedTasks[0].name}</p>
                </div>
              ) : (
                <div className="bg-dark-800/50 rounded-lg p-3 mb-3 border border-dark-500/50">
                  <p className="text-[10px] text-gray-600 italic">No tasks assigned</p>
                </div>
              )}

              {/* Task Stats Bar */}
              <div className="flex items-center gap-3 text-[10px]">
                <div className="flex items-center gap-1">
                  <span className="text-accent-yellow font-bold">{agent.assignedTasks.length}</span>
                  <span className="text-gray-600">queued</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-accent-orange font-bold">{agent.reviewTasks.length}</span>
                  <span className="text-gray-600">review</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-accent-green font-bold">{agent.doneTasks.length}</span>
                  <span className="text-gray-600">done</span>
                </div>
                <div className="ml-auto text-gray-600 font-mono">
                  {agent.tasksCompleted} total
                </div>
              </div>

              {/* Recent Activity */}
              {agent.recentActivity.length > 0 && (
                <div className="mt-3 pt-3 border-t border-dark-500/50">
                  <div className="text-[9px] text-gray-600 uppercase tracking-wider mb-1.5">Recent</div>
                  {agent.recentActivity.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] text-gray-500 py-0.5">
                      <span className={`w-1 h-1 rounded-full ${
                        a.action === 'completed' ? 'bg-accent-green' :
                        a.action === 'started' ? 'bg-accent-blue' :
                        a.action === 'error' ? 'bg-accent-red' :
                        'bg-gray-600'
                      }`}></span>
                      <span className="truncate">{a.action} {a.task ? `"${a.task}"` : ''}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
