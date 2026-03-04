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
  High: 'border-l-red-500 border-red-500/30',
  Medium: 'border-l-yellow-500 border-amber-500/20',
  Low: 'border-l-gray-500 border-gray-500/20',
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

// SVG icons for links
function DriveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-6l-2 3H9l-2-3H1" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  )
}

function CanvaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

export default function TaskCard({ task, onClick, onQuickApprove, onRequestChanges }) {
  const agent = task.agent ? AGENTS.find(a => a.name === task.agent) : null
  const isDone = task.status === 'Done'
  const isReview = task.status === 'Review'
  const hasDriveLink = task.driveLink && task.driveLink.length > 0
  const hasCanvaLink = task.canvaLink && task.canvaLink.length > 0

  return (
    <div
      onClick={onClick}
      className={`task-card bg-dark-700 rounded-lg border border-dark-500 border-l-[3px] ${PRIORITY_STYLES[task.priority] || 'border-l-gray-600'} p-3 relative ${isDone ? 'opacity-85' : ''}`}
    >
      {/* Done checkmark overlay */}
      {isDone && (
        <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-accent-green/20 border border-accent-green/40 flex items-center justify-center text-accent-green">
          <CheckIcon />
        </div>
      )}

      {/* Content Type Badge */}
      {task.contentType && (
        <div className="mb-1.5">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${CONTENT_TYPE_COLORS[task.contentType] || 'text-gray-400'}`}>
            {task.contentType}
          </span>
        </div>
      )}

      {/* Task Name */}
      <h3 className={`text-[13px] font-semibold leading-tight mb-1.5 ${isDone ? 'text-gray-400' : 'text-gray-100'}`}>
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
            <span className="text-[11px] text-gray-400 font-medium">{agent.emoji} {agent.name}</span>
          </div>
        ) : (
          <span className="text-[11px] text-gray-600 italic">Unassigned</span>
        )}

        <span className="text-[10px] text-gray-600">{timeAgo(task.createdAt)}</span>
      </div>

      {/* Link icons for Drive/Canva (especially visible on Done tasks) */}
      {(hasDriveLink || hasCanvaLink) && (
        <div className="flex gap-2 mt-2 pt-2 border-t border-dark-500">
          {hasDriveLink && (
            <a
              href={task.driveLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors border border-blue-500/20"
              title="Open in Google Drive"
            >
              <DriveIcon />
              <span>Drive</span>
            </a>
          )}
          {hasCanvaLink && (
            <a
              href={task.canvaLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors border border-purple-500/20"
              title="Open in Canva"
            >
              <CanvaIcon />
              <span>Canva</span>
            </a>
          )}
        </div>
      )}

      {/* Platform indicators (only show if no link row) */}
      {task.platform && task.platform.length > 0 && !hasDriveLink && !hasCanvaLink && (
        <div className="flex gap-1 mt-2 pt-2 border-t border-dark-500">
          {task.platform.map((p) => (
            <span key={p} className="text-[9px] px-1.5 py-0.5 rounded bg-dark-600 text-gray-500">
              {p}
            </span>
          ))}
        </div>
      )}

      {/* Review Actions — quick approve/feedback buttons */}
      {isReview && (
        <div className="flex gap-2 mt-2 pt-2 border-t border-dark-500">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onQuickApprove && onQuickApprove(task)
            }}
            className="flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold px-2 py-1.5 rounded bg-accent-green/10 text-accent-green hover:bg-accent-green/20 transition-colors border border-accent-green/20"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Approve
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onRequestChanges ? onRequestChanges(task) : onClick()
            }}
            className="flex-1 flex items-center justify-center gap-1 text-[10px] font-semibold px-2 py-1.5 rounded bg-accent-orange/10 text-accent-orange hover:bg-accent-orange/20 transition-colors border border-accent-orange/20"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Feedback
          </button>
        </div>
      )}
    </div>
  )
}
