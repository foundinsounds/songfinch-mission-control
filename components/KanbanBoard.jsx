'use client'

import TaskCard from './TaskCard'

const COLUMNS = [
  { key: 'Inbox', label: 'INBOX', dotColor: 'bg-gray-500' },
  { key: 'Assigned', label: 'ASSIGNED', dotColor: 'bg-accent-yellow' },
  { key: 'In Progress', label: 'IN PROGRESS', dotColor: 'bg-accent-blue' },
  { key: 'Review', label: 'REVIEW', dotColor: 'bg-accent-orange' },
  { key: 'Done', label: 'DONE', dotColor: 'bg-accent-green' },
]

export default function KanbanBoard({ tasks, onTaskClick }) {
  return (
    <div className="flex gap-0 h-full">
      {COLUMNS.map((col) => {
        const columnTasks = tasks.filter(t => t.status === col.key)

        return (
          <div
            key={col.key}
            className="kanban-column flex-1 border-r border-dark-500 last:border-r-0 flex flex-col min-w-[240px]"
          >
            {/* Column Header */}
            <div className="px-4 py-3 border-b border-dark-500 flex items-center justify-between shrink-0 bg-dark-800/50">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${col.dotColor}`}></div>
                <span className="text-xs font-semibold tracking-wider text-gray-300">{col.label}</span>
              </div>
              <span className="text-xs bg-dark-600 px-2 py-0.5 rounded-full text-gray-500 font-medium">
                {columnTasks.length}
              </span>
            </div>

            {/* Task Cards */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
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
