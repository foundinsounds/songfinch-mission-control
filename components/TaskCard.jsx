'use client'

import { AGENTS } from '../lib/agents'

function timeAgo(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

const PRIORITY_STYLES = {
  High: 'border-l-red-500',
  Medium: 'border-l-yellow-500',
  Low: 'border-l-gray-500',
}

const CONTENT_TYPE_COLORS = {
  'Ad Copy': 'text-purple-400',
  'Social Post': 'text-blue-400',
  'Video Script': 'text-red-400',
  'Blog Post': 'text-green-400',
  'Landing Page': 'text-yellow-400',
  'Artist Spotlight': 'text-orange-400',
  'SEO Content': 'text-teal-400',
}

export default function TaskCard({ task, onClick }) {
  const agent = task.agent ? AGENTS.find(a => a.name === task.agent) : null

  return (
    <div
      onClick={onClick}
      className={`task-card bg-dark-700 rounded-lg border border-dark-500 border-l-[3px] ${PRIORITY_STYLES[task.priority] || 'border-l-gray-600'} p-3`}
    >
      {/* Task Name */}
      <h3 className="text-[13px] font-semibold leading-tight mb-1.5 text-gray-100">
        {task.name}
      </h3>

      {/* Description Preview */}
      <p className="text-[11px] text-gray-500 leading-relaxed mb-3 line-clamp-2">
        {task.description}
      </p>

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
          {task.tags.length > 3 && (
            <span className="tag">+{task.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Bottom Row: Agent + Time */}
      <div className="flex items-center justify-between">
        {agent ? (
          <div className="flex items-center gap-1.5">
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px]"
              style={{
                background: `${agent.color}20`,
                border: `1.5px solid ${agent.color}`,
              }}
            >
              {agent.emoji}
            </div>
            <span className="text-[11px] text-gray-400 font-medium">{agent.name}</span>
          </div>
        ) : (
          <span className="text-[11px] text-gray-600 italic">Unassigned</span>
        )}

        <span className="text-[10px] text-gray-600">{timeAgo(task.createdAt)}</span>
      </div>

      {/* Platform indicators */}
      {task.platform && task.platform.length > 0 && (
        <div className="flex gap-1 mt-2 pt-2 border-t border-dark-500">
          {task.platform.map((p) => (
            <span key={p} className="text-[9px] px-1.5 py-0.5 rounded bg-dark-600 text-gray-500">
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
