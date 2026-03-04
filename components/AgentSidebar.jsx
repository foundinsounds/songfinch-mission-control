'use client'

export default function AgentSidebar({ agents, selectedAgent, onSelectAgent, tasks }) {
  const getAgentTaskCount = (agentName) => {
    return tasks.filter(t => t.agent === agentName && t.status !== 'Done').length
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

  return (
    <aside className="w-64 bg-dark-800 border-r border-dark-500 flex flex-col shrink-0 overflow-hidden">
      {/* Sidebar Header */}
      <div className="px-4 py-3 border-b border-dark-500 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-green pulse-dot"></div>
          <span className="text-sm font-semibold">AGENTS</span>
        </div>
        <span className="text-xs bg-dark-600 px-2 py-0.5 rounded-full text-gray-400">
          {agents.length}
        </span>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto py-1">
        {agents.map((agent) => {
          const typeBadge = getTypeBadge(agent.type)
          const taskCount = getAgentTaskCount(agent.name)
          const isSelected = selectedAgent === agent.name

          return (
            <button
              key={agent.id}
              onClick={() => onSelectAgent(agent.name)}
              className={`agent-item w-full px-4 py-2.5 flex items-center gap-3 text-left border-l-2 transition-all ${
                isSelected
                  ? 'border-l-white bg-dark-600'
                  : 'border-l-transparent hover:bg-dark-700'
              }`}
            >
              {/* Agent Avatar */}
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center text-lg shrink-0"
                style={{
                  background: `${agent.color}15`,
                  border: `2px solid ${agent.color}`,
                }}
              >
                {agent.emoji}
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
              </div>

              {/* Status */}
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className={`status-badge px-1.5 py-0.5 rounded border ${getStatusBadgeStyle(agent.status)}`}>
                  {agent.status}
                </span>
                {taskCount > 0 && (
                  <span className="text-[10px] text-gray-500">{taskCount} tasks</span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Sidebar Footer */}
      <div className="px-4 py-3 border-t border-dark-500">
        <div className="flex items-center justify-between text-[11px] text-gray-500">
          <span>Total Completed</span>
          <span className="text-accent-green font-semibold">
            {agents.reduce((sum, a) => sum + a.tasksCompleted, 0)}
          </span>
        </div>
      </div>
    </aside>
  )
}
