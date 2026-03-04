'use client'

import { useState, useMemo } from 'react'
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

function getPlatformUrl(platform) {
  const urls = {
    'Instagram': 'https://business.instagram.com',
    'Facebook': 'https://business.facebook.com',
    'TikTok': 'https://www.tiktok.com/creator',
    'Twitter': 'https://twitter.com/compose/tweet',
    'LinkedIn': 'https://www.linkedin.com/feed/',
    'YouTube': 'https://studio.youtube.com',
    'Email': 'https://mail.google.com',
    'Pinterest': 'https://www.pinterest.com/pin-creation-tool/',
  }
  return urls[platform] || '#'
}

function getPlatformEmoji(platform) {
  const emojis = {
    'Instagram': '📸', 'Facebook': '👥', 'TikTok': '🎵',
    'Twitter': '🐦', 'LinkedIn': '💼', 'YouTube': '▶️',
    'Email': '📧', 'Pinterest': '📌',
  }
  return emojis[platform] || '🌐'
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

function CheckCircleIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

/**
 * Simple line-level diff between two strings
 * Returns array of { type: 'same' | 'added' | 'removed', text: string }
 */
function computeDiff(oldText, newText) {
  if (!oldText || !newText) return []
  const oldLines = oldText.split('\n')
  const newLines = newText.split('\n')
  const result = []

  // Build a simple LCS-based diff
  const m = oldLines.length
  const n = newLines.length

  // For performance, use a simpler approach for very long texts
  if (m + n > 2000) {
    // Fallback: show first 50 lines of each with markers
    const maxLines = 50
    for (let i = 0; i < Math.min(m, maxLines); i++) {
      result.push({ type: 'removed', text: oldLines[i] })
    }
    if (m > maxLines) result.push({ type: 'removed', text: `... (${m - maxLines} more lines)` })
    for (let i = 0; i < Math.min(n, maxLines); i++) {
      result.push({ type: 'added', text: newLines[i] })
    }
    if (n > maxLines) result.push({ type: 'added', text: `... (${n - maxLines} more lines)` })
    return result
  }

  // Build LCS table
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  // Backtrack to produce diff
  const diff = []
  let i = m, j = n
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.unshift({ type: 'same', text: oldLines[i - 1] })
      i--; j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: 'added', text: newLines[j - 1] })
      j--
    } else {
      diff.unshift({ type: 'removed', text: oldLines[i - 1] })
      i--
    }
  }

  return diff
}

/**
 * Parse the output field to extract current output, feedback history, and previous versions
 */
function parseOutput(raw) {
  if (!raw) return { currentOutput: '', revisions: [] }

  // Check if this is a revision-requested state
  if (raw.startsWith('[REVISION REQUESTED]')) {
    return { currentOutput: raw, revisions: [], isRevisionPending: true }
  }

  // Parse revision history from output
  const revisions = []
  const parts = raw.split(/---PREVIOUS OUTPUT \(v(\d+)\)---/)

  // First part is the current/latest output
  const currentOutput = parts[0].trim()

  // Extract previous versions (pairs of version number + content)
  for (let i = 1; i < parts.length; i += 2) {
    const version = parseInt(parts[i], 10)
    const content = parts[i + 1] || ''

    // Extract feedback if present
    const feedbackMatch = content.match(/^([\s\S]*?)(?=\n---PREVIOUS OUTPUT|$)/)
    const versionContent = feedbackMatch ? feedbackMatch[1].trim() : content.trim()

    // Look for feedback marker before this version
    const feedbackInCurrent = currentOutput.match(/Feedback: ([\s\S]*?)(?=\n\n---PREVIOUS OUTPUT|$)/)

    revisions.push({
      version,
      content: versionContent,
      feedback: feedbackInCurrent ? feedbackInCurrent[1].trim() : null,
    })
  }

  return { currentOutput, revisions }
}

/**
 * Get the clean latest output (strip any revision metadata)
 */
function getLatestOutput(raw) {
  if (!raw) return ''
  // If it starts with [REVISION REQUESTED], there's no current output yet
  if (raw.startsWith('[REVISION REQUESTED]')) return ''

  // Get everything before the first ---PREVIOUS OUTPUT--- marker
  const idx = raw.indexOf('---PREVIOUS OUTPUT')
  return idx >= 0 ? raw.substring(0, idx).trim() : raw.trim()
}

export default function TaskModal({ task, agent, onClose, onApprove, onUpdateStatus, onFeedback }) {
  const [approving, setApproving] = useState(false)
  const [approveStatus, setApproveStatus] = useState(null) // 'success' | 'error' | null
  const [feedbackText, setFeedbackText] = useState('')
  const [submittingFeedback, setSubmittingFeedback] = useState(false)
  const [feedbackStatus, setFeedbackStatus] = useState(null) // 'success' | 'error' | null
  const [showFeedbackForm, setShowFeedbackForm] = useState(false)
  const [showRevisionHistory, setShowRevisionHistory] = useState(false)
  const [diffViewMode, setDiffViewMode] = useState('inline') // 'inline' | 'side-by-side' | 'raw'
  const [diffVersionIndex, setDiffVersionIndex] = useState(0) // which revision to compare against latest

  const hasDriveLink = task.driveLink && task.driveLink.length > 0
  const hasCanvaLink = task.canvaLink && task.canvaLink.length > 0
  const isDone = task.status === 'Done'
  const isReview = task.status === 'Review'

  const { currentOutput, revisions } = parseOutput(task.output)
  const latestOutput = getLatestOutput(task.output)
  const hasRevisions = revisions.length > 0
  const currentVersion = hasRevisions ? revisions.length + 1 : 1

  // Compute diff between selected old version and latest
  const diffResult = useMemo(() => {
    if (!hasRevisions || !latestOutput) return []
    const oldVersion = revisions[diffVersionIndex]
    if (!oldVersion) return []
    return computeDiff(oldVersion.content, latestOutput)
  }, [hasRevisions, latestOutput, revisions, diffVersionIndex])

  // Diff stats
  const diffStats = useMemo(() => {
    const added = diffResult.filter(d => d.type === 'added').length
    const removed = diffResult.filter(d => d.type === 'removed').length
    const same = diffResult.filter(d => d.type === 'same').length
    return { added, removed, same, total: added + removed + same }
  }, [diffResult])

  const handleApprove = async () => {
    if (!onApprove) return
    setApproving(true)
    setApproveStatus(null)

    try {
      const success = await onApprove(task)
      if (success) {
        setApproveStatus('success')
        setTimeout(() => onClose(), 1200)
      } else {
        setApproveStatus('error')
      }
    } catch (err) {
      console.error('Approve error:', err)
      setApproveStatus('error')
    } finally {
      setApproving(false)
    }
  }

  const handleSubmitFeedback = async () => {
    if (!feedbackText.trim()) return
    setSubmittingFeedback(true)
    setFeedbackStatus(null)

    try {
      const res = await fetch('/api/tasks/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: task.id,
          feedback: feedbackText.trim(),
          currentOutput: task.output || '',
          taskName: task.name,
          agentName: task.agent,
        }),
      })

      if (!res.ok) throw new Error('Failed to submit feedback')

      setFeedbackStatus('success')
      setFeedbackText('')
      setTimeout(() => onClose(), 1500)
    } catch (err) {
      console.error('Feedback error:', err)
      setFeedbackStatus('error')
    } finally {
      setSubmittingFeedback(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-dark-700 border border-dark-500 rounded-xl w-full max-w-2xl max-h-[85vh] overflow-hidden shadow-2xl">
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
              {hasRevisions && (
                <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  v{currentVersion}
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
          {/* Success Banner */}
          {approveStatus === 'success' && (
            <div className="mb-5 p-3 bg-green-500/10 rounded-lg border border-green-500/20 flex items-center gap-2 text-accent-green">
              <CheckCircleIcon size={20} />
              <span className="text-sm font-semibold">Task approved and moved to Done!</span>
            </div>
          )}

          {/* Error Banner */}
          {approveStatus === 'error' && (
            <div className="mb-5 p-3 bg-red-500/10 rounded-lg border border-red-500/20 flex items-center gap-2 text-red-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M15 9l-6 6M9 9l6 6" />
              </svg>
              <span className="text-sm font-semibold">Failed to approve. Check connection and try again.</span>
            </div>
          )}

          {/* Feedback Success Banner */}
          {feedbackStatus === 'success' && (
            <div className="mb-5 p-3 bg-purple-500/10 rounded-lg border border-purple-500/20 flex items-center gap-2 text-purple-400">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span className="text-sm font-semibold">Feedback submitted! Agent will revise on next run.</span>
            </div>
          )}

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

          {/* Output Destination Links */}
          {isDone && latestOutput && (
            <div className="mb-5">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Output Destinations</h3>
              <div className="grid grid-cols-2 gap-2">
                {(task.contentType === 'Blog Post' || task.contentType === 'Landing Page') && (
                  <a
                    href={task.driveLink || 'https://drive.google.com'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-green-500/5 border border-green-500/20 hover:bg-green-500/10 transition-colors"
                  >
                    <span className="text-sm">📝</span>
                    <div className="flex-1">
                      <div className="text-[11px] font-semibold text-green-400">Blog / Website</div>
                      <div className="text-[9px] text-gray-500">Ready to publish</div>
                    </div>
                    <ExternalLinkIcon size={10} />
                  </a>
                )}
                {(task.contentType === 'Social Post' || task.contentType === 'Ad Copy') && task.platform?.map((p) => (
                  <a
                    key={p}
                    href={getPlatformUrl(p)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 hover:bg-blue-500/10 transition-colors"
                  >
                    <span className="text-sm">{getPlatformEmoji(p)}</span>
                    <div className="flex-1">
                      <div className="text-[11px] font-semibold text-blue-400">{p}</div>
                      <div className="text-[9px] text-gray-500">Post ready</div>
                    </div>
                    <ExternalLinkIcon size={10} />
                  </a>
                ))}
                {task.contentType === 'Video Script' && (
                  <a
                    href="https://canva.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-purple-500/5 border border-purple-500/20 hover:bg-purple-500/10 transition-colors"
                  >
                    <span className="text-sm">🎬</span>
                    <div className="flex-1">
                      <div className="text-[11px] font-semibold text-purple-400">Video Production</div>
                      <div className="text-[9px] text-gray-500">Script ready</div>
                    </div>
                    <ExternalLinkIcon size={10} />
                  </a>
                )}
                <a
                  href={task.driveLink || 'https://drive.google.com'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-lg bg-yellow-500/5 border border-yellow-500/20 hover:bg-yellow-500/10 transition-colors"
                >
                  <span className="text-sm">📁</span>
                  <div className="flex-1">
                    <div className="text-[11px] font-semibold text-yellow-400">Google Drive</div>
                    <div className="text-[9px] text-gray-500">Archive copy</div>
                  </div>
                  <ExternalLinkIcon size={10} />
                </a>
              </div>
            </div>
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

          {/* Output Preview — Latest Version */}
          {latestOutput && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  Output {hasRevisions ? `(v${currentVersion} — Latest)` : 'Preview'}
                </h3>
                {hasRevisions && (
                  <button
                    onClick={() => setShowRevisionHistory(!showRevisionHistory)}
                    className="text-[10px] px-2 py-1 rounded bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 transition-colors border border-purple-500/20"
                  >
                    {showRevisionHistory ? 'Hide' : 'Show'} History ({revisions.length} revision{revisions.length > 1 ? 's' : ''})
                  </button>
                )}
              </div>
              <div className="bg-dark-900 rounded-lg p-4 border border-dark-500">
                <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                  {latestOutput}
                </pre>
              </div>
            </div>
          )}

          {/* Revision History & Diff View */}
          {showRevisionHistory && revisions.length > 0 && (
            <div className="mb-5 space-y-3">
              {/* Diff Controls */}
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-purple-400 uppercase tracking-wider">Revision History</h3>
                <div className="flex items-center gap-1">
                  {['inline', 'side-by-side', 'raw'].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setDiffViewMode(mode)}
                      className={`text-[9px] px-2 py-1 rounded transition-colors ${
                        diffViewMode === mode
                          ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                          : 'text-gray-500 hover:text-gray-300 bg-dark-600'
                      }`}
                    >
                      {mode === 'side-by-side' ? 'Side-by-Side' : mode.charAt(0).toUpperCase() + mode.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Version Selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500">Compare:</span>
                <select
                  value={diffVersionIndex}
                  onChange={(e) => setDiffVersionIndex(parseInt(e.target.value, 10))}
                  className="text-[10px] bg-dark-800 border border-dark-500 rounded px-2 py-1 text-gray-300 focus:outline-none focus:border-purple-500/40"
                >
                  {revisions.map((rev, i) => (
                    <option key={rev.version} value={i}>v{rev.version}</option>
                  ))}
                </select>
                <span className="text-[10px] text-gray-500">vs</span>
                <span className="text-[10px] text-purple-400 font-semibold">v{currentVersion} (Latest)</span>

                {/* Diff Stats */}
                {diffResult.length > 0 && (
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-[9px] text-green-400 font-mono">+{diffStats.added}</span>
                    <span className="text-[9px] text-red-400 font-mono">-{diffStats.removed}</span>
                    <span className="text-[9px] text-gray-500 font-mono">~{diffStats.same}</span>
                  </div>
                )}
              </div>

              {/* Feedback for selected version */}
              {revisions[diffVersionIndex]?.feedback && (
                <div className="px-3 py-2 bg-orange-500/5 rounded-lg border border-orange-500/20">
                  <span className="text-[10px] text-orange-400 font-semibold uppercase tracking-wider">Feedback on v{revisions[diffVersionIndex].version}:</span>
                  <p className="text-[11px] text-orange-300/80 mt-1">{revisions[diffVersionIndex].feedback}</p>
                </div>
              )}

              {/* Diff Display */}
              {diffViewMode === 'inline' && diffResult.length > 0 && (
                <div className="bg-dark-900 rounded-lg border border-dark-500 overflow-hidden max-h-64 overflow-y-auto">
                  <div className="font-mono text-[10px] leading-relaxed">
                    {diffResult.map((line, i) => (
                      <div
                        key={i}
                        className={`px-3 py-0.5 ${
                          line.type === 'added' ? 'bg-green-500/10 text-green-400' :
                          line.type === 'removed' ? 'bg-red-500/10 text-red-400 line-through opacity-70' :
                          'text-gray-400'
                        }`}
                      >
                        <span className="inline-block w-4 text-gray-600 select-none">
                          {line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' '}
                        </span>
                        {line.text || '\u00A0'}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {diffViewMode === 'side-by-side' && (
                <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                  <div className="bg-dark-900 rounded-lg border border-dark-500 overflow-hidden">
                    <div className="px-2 py-1 bg-red-500/10 border-b border-dark-500">
                      <span className="text-[9px] font-semibold text-red-400">v{revisions[diffVersionIndex]?.version} (Old)</span>
                    </div>
                    <pre className="px-3 py-2 text-[9px] text-gray-400 whitespace-pre-wrap font-mono leading-relaxed">
                      {(revisions[diffVersionIndex]?.content || '').substring(0, 3000)}
                    </pre>
                  </div>
                  <div className="bg-dark-900 rounded-lg border border-dark-500 overflow-hidden">
                    <div className="px-2 py-1 bg-green-500/10 border-b border-dark-500">
                      <span className="text-[9px] font-semibold text-green-400">v{currentVersion} (Latest)</span>
                    </div>
                    <pre className="px-3 py-2 text-[9px] text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                      {(latestOutput || '').substring(0, 3000)}
                    </pre>
                  </div>
                </div>
              )}

              {diffViewMode === 'raw' && (
                <div className="space-y-2">
                  {revisions.map((rev) => (
                    <div key={rev.version} className="rounded-lg border border-dark-500 overflow-hidden">
                      <div className="px-3 py-2 bg-dark-800 flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-gray-400">Version {rev.version}</span>
                        {rev.feedback && (
                          <span className="text-[10px] text-orange-400 flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            Feedback given
                          </span>
                        )}
                      </div>
                      {rev.feedback && (
                        <div className="px-3 py-2 bg-orange-500/5 border-b border-dark-500">
                          <span className="text-[10px] text-orange-400 font-semibold uppercase tracking-wider">Feedback:</span>
                          <p className="text-[11px] text-orange-300/80 mt-1">{rev.feedback}</p>
                        </div>
                      )}
                      <div className="px-3 py-2 bg-dark-900 max-h-32 overflow-y-auto">
                        <pre className="text-[10px] text-gray-500 whitespace-pre-wrap font-mono leading-relaxed">
                          {rev.content.substring(0, 1000)}{rev.content.length > 1000 ? '...' : ''}
                        </pre>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Feedback Form — only for Review tasks */}
          {isReview && !approveStatus && !feedbackStatus && (
            <div className="mb-5">
              {!showFeedbackForm ? (
                <button
                  onClick={() => setShowFeedbackForm(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-dashed border-orange-500/30 text-orange-400 hover:bg-orange-500/5 hover:border-orange-500/50 transition-all text-sm"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  Give Feedback &amp; Request Revision
                </button>
              ) : (
                <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-400">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    <h3 className="text-xs font-semibold text-orange-400 uppercase tracking-wider">
                      Request Revision {hasRevisions ? `(currently v${currentVersion})` : ''}
                    </h3>
                  </div>
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="What changes would you like? Be specific about what to improve, add, remove, or approach differently..."
                    className="w-full bg-dark-900 border border-dark-500 rounded-lg p-3 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-orange-500/40 focus:ring-1 focus:ring-orange-500/20"
                    rows={4}
                    autoFocus
                  />
                  <div className="flex items-center justify-between mt-3">
                    <button
                      onClick={() => { setShowFeedbackForm(false); setFeedbackText('') }}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmitFeedback}
                      disabled={!feedbackText.trim() || submittingFeedback}
                      className="text-xs px-4 py-2 rounded-md bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors border border-orange-500/30 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed font-semibold"
                    >
                      {submittingFeedback ? (
                        <>
                          <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                          </svg>
                          Submitting...
                        </>
                      ) : (
                        <>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10" />
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                          </svg>
                          Send for Revision
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3 border-t border-dark-500 flex items-center justify-between bg-dark-800">
          <div className="text-[10px] text-gray-600">
            Created {new Date(task.createdAt).toLocaleDateString()}
            {hasRevisions && (
              <span className="ml-2 text-purple-500">
                &middot; {revisions.length} revision{revisions.length > 1 ? 's' : ''}
              </span>
            )}
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
            {isReview && !approveStatus && !feedbackStatus && (
              <button
                onClick={handleApprove}
                disabled={approving}
                className="text-xs px-4 py-1.5 rounded-md bg-accent-green/20 text-accent-green hover:bg-accent-green/30 transition-colors border border-accent-green/30 flex items-center gap-1.5 disabled:opacity-50"
              >
                {approving ? (
                  <>
                    <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon size={12} />
                    Approve {hasRevisions ? `v${currentVersion}` : ''}
                  </>
                )}
              </button>
            )}
            {approveStatus === 'success' && (
              <span className="text-xs px-4 py-1.5 rounded-md bg-accent-green/20 text-accent-green flex items-center gap-1.5">
                <CheckCircleIcon size={12} />
                Approved!
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
