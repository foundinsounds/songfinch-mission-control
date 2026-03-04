'use client'

import { AGENTS } from '../lib/agents'

const PRIORITY_COLORS = {
  High: 'bg-red-500/10 text-red-400 border-red-500/20',
  Medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  Low: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

const STATUS_COLORS = {
  'Inbox': 'bg-gray-500/10 text-gray-400',
  'Assigned': 'bg-yellow-500/10 text-yellow-400',
  'In Progress': 'bg-blue-500/10 text-blue-400',
  'Review': 'bg-orange-500/10 text-orange-400',
  'Done': 'bg-green-500/10 text-green-400',
}

function DriveIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 12h-6l-2 3H9l-2-3H1" />
      <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  )
}

function CanvaIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  )
}

function ExternalLinkIcon({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  )
}

export default function TaskModal({ task, agent, onClose }) {
  const hasDriveLink = task.driveLink && task.driveLink.length > 0
  const hasCanvaLink = task.canvaLink && task.canvaLink.length > 0
  const isDone = task.status === 'Done'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-dark-700 border border-dark-500 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-500 flex items-start justify-between">
          <div className="flex-1 pr-4">
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${STATUS_COLORS[task.status]}`}>
                {task.status === 'Done' ? 'Done \u2705' : task.status}
              </span>
              <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${PRIORITY_COLORS[task.priority]}`}>
                {task.priority} Priority
              </span>
              {task.contentType && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-dark-600 text-gray-400">
                  {task.contentType}
                </span>
              )}
            </div>
            <h2 className="text-lg font-bold text-gray-100">{task.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-white transition-colors p-1"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto max-h-[60vh]">
          {/* Google Drive Link - Prominent */}
          {hasDriveLink && (
            <a
              href={task.driveLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 mb-5 p-3 bg-blue-500/5 rounded-lg border border-blue-500/20 hover:bg-blue-500/10 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-blue-500/15 text-blue-400">
                <DriveIcon size={20} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-blue-400">Google Drive</div>
                <div className="text-xs text-gray-500 truncate">{task.driveLink}</div>
              </div>
              <div className="text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLinkIcon size={16} />
              </div>
            </a>
          )}

          {/* Canva Link - Prominent */}
          {hasCanvaLink && (
            <a
              href={task.canvaLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 mb-5 p-3 bg-purple-500/5 rounded-lg border border-purple-500/20 hover:bg-purple-500/10 transition-colors group"
            >
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-purple-500/15 text-purple-400">
                <CanvaIcon size={20} />
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-purple-400">Canva Design</div>
                <div className="text-xs text-gray-500 truncate">{task.canvaLink}</div>
              </div>
              <div className="text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLinkIcon size={16} />
              </div>
            </a>
          )}

          {/* Agent Assignment */}
          {agent && (
            <div className="flex items-center gap-3 mb-5 p-3 bg-dark-600 rounded-lg">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-xl"
                style={{
                  background: `${agent.color}15`,
                  border: `2px solid ${agent.color}`,
                }}
              >
                {agent.emoji}
              </div>
              <div>
                <div className="text-sm font-semibold">{agent.emoji} {agent.name}</div>
                <div className="text-xs text-gray-500">{agent.role}</div>
              </div>
            </div>
          )}

          {/* Description */}
          <div className="mb-5">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Description</h3>
            <p className="text-sm text-gray-300 leading-relaxed">{task.description}</p>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Content Type</h3>
              <span className="text-sm text-gray-200">{task.contentType}</span>
            </div>
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Campaign</h3>
              <span className="text-sm text-gray-200">{task.campaign || 'General'}</span>
            </div>
          </div>

          {/* Platforms */}
          {task.platform && task.platform.length > 0 && (
            <div className="mb-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Platforms</h3>
              <div className="flex gap-2 flex-wrap">
                {task.platform.map((p) => (
                  <span key={p} className="text-xs px-3 py-1 rounded-full bg-dark-600 text-gray-300 border border-dark-500">
                    {p}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="mb-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Emotional Pillars</h3>
              <div className="flex gap-2 flex-wrap">
                {task.tags.map((tag) => (
                  <span key={tag} className="text-xs px-3 py-1 rounded-full bg-dark-600 text-gray-400">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Output Preview */}
          {task.output && (
            <div className="mb-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Output Preview</h3>
              <div className="bg-dark-900 rounded-lg p-4 border border-dark-500">
                <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                  {task.output}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3 border-t border-dark-500 flex items-center justify-between bg-dark-800">
          <div className="text-[10px] text-gray-600">
            Created {new Date(task.createdAt).toLocaleDateString()}
          </div>
          <div className="flex gap-2">
            {(hasDriveLink || hasCanvaLink) && (
              <div className="flex gap-1 mr-2">
                {hasDriveLink && (
                  <a
                    href={task.driveLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors flex items-center gap-1"
                  >
                    <DriveIcon size={12} />
                    Drive
                  </a>
                )}
                {hasCanvaLink && (
                  <a
                    href={task.canvaLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs px-3 py-1.5 rounded-md bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors flex items-center gap-1"
                  >
                    <CanvaIcon size={12} />
                    Canva
                  </a>
                )}
              </div>
            )}
            <button className="text-xs px-4 py-1.5 rounded-md bg-dark-600 text-gray-400 hover:text-white transition-colors">
              Edit
            </button>
            {task.status === 'Review' && (
              <button className="text-xs px-4 py-1.5 rounded-md bg-accent-green/20 text-accent-green hover:bg-accent-green/30 transition-colors">
                Approve
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
