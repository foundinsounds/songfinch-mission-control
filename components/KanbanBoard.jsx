'use client'

import TaskCard from './TaskCard'

const COLUMNS = [
  { key: 'Inbox', label: 'INBOX', dotColor: 'bg-gray-500', icon: '\u{1F4E5}' },
  { key: 'Assigned', label: 'ASSIGNED', dotColor: 'bg-accent-yellow', icon: '\u{1F4CB}' },
  { key: 'In Progress', label: 'IN PROGRESS', dotColor: 'bg-accent-blue', icon: '\u26A1' },
  { key: 'Review', label: 'REVIEW', dotColor: 'bg-accent-orange', icon: '\u{1F50D}' },
  { key: 'Done', label: 'DONE', dotColor: 'bg-accent-green', icon: '\u2705' },
]

export default function KanbanBoard({ tasks, onTaskClick }) {
  return (
    <div className="flex gap-0 h-full">
      {COLUMNS.map((col) => {
        const columnTasks = tasks.filter(t => t.status === col.key)
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
  )
}
