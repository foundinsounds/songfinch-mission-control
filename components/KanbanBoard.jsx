'use client'

import { useState } from 'react'
import TaskCard from './TaskCard'

const COLUMNS = [
  { key: 'Inbox', label: 'INBOX', dotColor: 'bg-gray-500', icon: '\u{1F4E5}' },
  { key: 'Assigned', label: 'ASSIGNED', dotColor: 'bg-accent-yellow', icon: '\u{1F4CB}' },
  { key: 'In Progress', label: 'IN PROGRESS', dotColor: 'bg-accent-blue', icon: '\u26A1' },
  { key: 'Review', label: 'REVIEW', dotColor: 'bg-accent-orange', icon: '\u{1F50D}' },
  { key: 'Done', label: 'DONE', dotColor: 'bg-accent-green', icon: '\u2705' },
]

export default function KanbanBoard({ tasks, agents = [], onTaskClick, onQuickApprove, onRequestChanges, selectedAgent }) {
  const [agentFilter, setAgentFilter] = useState(selectedAgent || null)

  const visibleTasks = agentFilter
    ? tasks.filter(t => t.agent === agentFilter)
    : tasks

  // Get unique agents from tasks
  const taskAgents = [...new Set(tasks.map(t => t.agent).filter(Boolean))].sort()

  return (
    <div className="flex flex-col h-full">
      {/* Agent filter bar */}
      <div className="px-4 py-2 border-b border-dark-500 flex items-center gap-1.5 shrink-0 bg-dark-800/30 overflow-x-auto">
        <span className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mr-1 shrink-0">Agent:</span>
        <button
          onClick={() => setAgentFilter(null)}
          className={`text-[10px] px-2 py-1 rounded-md transition-all shrink-0 ${
            !agentFilter
              ? 'bg-white/10 text-white font-semibold'
              : 'text-gray-500 hover:text-gray-300 hover:bg-dark-600'
          }`}
        >
          All
        </button>
        {taskAgents.map(name => {
          const agent = agents.find(a => a.name === name)
          return (
            <button
              key={name}
              onClick={() => setAgentFilter(agentFilter === name ? null : name)}
              className={`text-[10px] px-2 py-1 rounded-md transition-all shrink-0 flex items-center gap-1 ${
                agentFilter === name
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-dark-600'
              }`}
            >
              {agent?.emoji && <span className="text-xs">{agent.emoji}</span>}
              {name}
            </button>
          )
        })}
      </div>

      {/* Kanban columns */}
      <div className="flex gap-0 flex-1 overflow-hidden">
        {COLUMNS.map((col) => {
          const columnTasks = visibleTasks.filter(t => t.status === col.key)
          const isDoneColumn = col.key === 'Done'

          return (
            <div
              key={col.key}
              className="kanban-column flex-1 border-r border-dark-500 last:border-r-0 flex flex-col min-w-[240px]"
            >
              {/* Column Header */}
              <div className={`px-4 py-3 border-b border-dark-500 flex items-center justify-between shrink-0 ${
                isDoneColumn ? 'bg-accent-green/5' : 'bg-dark-800/50'
              }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${col.dotColor} ${col.key === 'In Progress' ? 'pulse-dot' : ''}`}></div>
                  <span className={`text-xs font-semibold tracking-wider ${isDoneColumn ? 'text-accent-green' : 'text-gray-300'}`}>
                    {col.label} {isDoneColumn ? '\u2705' : ''}
                  </span>
                </div>
                <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                  isDoneColumn
                    ? 'bg-accent-green/15 text-accent-green border border-accent-green/20'
                    : col.key === 'Review'
                      ? 'bg-accent-orange/15 text-accent-orange border border-accent-orange/20'
                      : col.key === 'In Progress'
                        ? 'bg-accent-blue/15 text-accent-blue border border-accent-blue/20'
                        : 'bg-dark-600 text-gray-500 border border-dark-500'
                }`}>
                  {columnTasks.length}
                </span>
              </div>

              {/* Task Cards */}
              <div className={`flex-1 overflow-y-auto p-3 space-y-3 ${isDoneColumn ? 'bg-accent-green/[0.02]' : ''}`}>
                {columnTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onClick={() => onTaskClick(task)}
                    onQuickApprove={onQuickApprove}
                    onRequestChanges={onRequestChanges}
                  />
                ))}

                {columnTasks.length === 0 && (
                  <div className="text-center py-8 text-gray-600 text-xs">
                    No tasks
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
