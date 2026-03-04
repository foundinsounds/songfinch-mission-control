'use client'

import { AGENTS } from '../lib/agents'

function timeAgo(dateStr) {
  const date = new Date(dateStr)
  const now = new Date()
  const diff = now - date
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(diff / 86400000)}d ago`
}

const TYPE_STYLES = {
  'Task Created': { dot: 'bg-blue-400', text: 'text-blue-400', icon: '\u{1F4CB}' },
  'Content Generated': { dot: 'bg-green-400', text: 'text-green-400', icon: '\u2705' },
  'Review Needed': { dot: 'bg-orange-400', text: 'text-orange-400', icon: '\u{1F50D}' },
  'Approved': { dot: 'bg-green-400', text: 'text-green-400', icon: '\u{1F389}' },
  'Comment': { dot: 'bg-gray-400', text: 'text-gray-400', icon: '\u{1F4AC}' },
  'Started': { dot: 'bg-blue-400', text: 'text-blue-400', icon: '\u26A1' },
  'System': { dot: 'bg-gray-400', text: 'text-gray-400', icon: '\u2699\uFE0F' },
  'Error': { dot: 'bg-red-400', text: 'text-red-400', icon: '\u274C' },
}

const ACTION_LABELS = {
  'completed': { label: 'COMPLETED', color: 'text-accent-green bg-green-500/10' },
  'started': { label: 'STARTED', color: 'text-accent-blue bg-blue-500/10' },
  'assigned': { label: 'ASSIGNED', color: 'text-accent-yellow bg-yellow-500/10' },
  'submitted for review': { label: 'IN REVIEW', color: 'text-accent-orange bg-orange-500/10' },
  'completed research': { label: 'RESEARCH', color: 'text-accent-teal bg-teal-500/10' },
  'created campaign': { label: 'NEW CAMPAIGN', color: 'text-accent-purple bg-purple-500/10' },
  'scanned': { label: 'SCAN', color: 'text-gray-400 bg-gray-500/10' },
  'completed run': { label: 'RUN DONE', color: 'text-accent-green bg-green-500/10' },
  'error': { label: 'ERROR', color: 'text-accent-red bg-red-500/10' },
}

const FILTERS = ['All', 'Tasks', 'Comments', 'Docs', 'Status']

/**
 * Extract links from activity details text
 * Looks for URLs or markdown-style links
 */
function extractLinks(text) {
  if (!text) return { cleanText: text, links: [] }

  const links = []
  // Match markdown links [text](url)
  let cleanText = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
    links.push({ label, url })
    return label
  })
  // Match standalone URLs
  cleanText = cleanText.replace(/(https?:\/\/[^\s,)]+)/g, (url) => {
    if (!links.find(l => l.url === url)) {
      links.push({ label: 'View', url })
    }
    return ''
  })

  return { cleanText: cleanText.trim(), links }
}

/**
 * Extract reasoning/impact sections from details
 * Agent runner formats details with WHY: and IMPACT: prefixes
 */
function parseDetails(details) {
  if (!details) return { summary: '', reasoning: '', impact: '', links: [] }

  const { cleanText, links } = extractLinks(details)

  // Try to split on WHY: / IMPACT: markers
  const whyMatch = cleanText.match(/(?:^|\n)\s*(?:WHY|Reasoning|Rationale):\s*(.+?)(?=\n\s*(?:IMPACT|Impact)|$)/is)
  const impactMatch = cleanText.match(/(?:^|\n)\s*(?:IMPACT|Impact|Result):\s*(.+?)$/is)

  if (whyMatch || impactMatch) {
    const summary = cleanText.replace(/(?:WHY|Reasoning|Rationale|IMPACT|Impact|Result):\s*.+/gis, '').trim()
    return {
      summary,
      reasoning: whyMatch ? whyMatch[1].trim() : '',
      impact: impactMatch ? impactMatch[1].trim() : '',
      links,
    }
  }

  return { summary: cleanText, reasoning: '', impact: '', links }
}

export default function LiveFeed({ activity, filter, onFilterChange }) {
  return (
    <aside className="w-80 bg-dark-800 border-l border-dark-500 flex flex-col shrink-0 overflow-hidden">
      {/* Feed Header */}
      <div className="px-4 py-3 border-b border-dark-500">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-2 h-2 rounded-full bg-accent-green pulse-dot"></div>
          <span className="text-sm font-semibold">LIVE FEED</span>
          <span className="text-[10px] bg-dark-600 px-2 py-0.5 rounded-full text-gray-500 ml-auto">
            {activity.length} events
          </span>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`text-[11px] px-2.5 py-1 rounded-full transition-all ${
                filter === f
                  ? 'bg-accent-orange/20 text-accent-orange border border-accent-orange/30'
                  : 'bg-dark-600 text-gray-500 border border-transparent hover:text-gray-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Activity Items */}
      <div className="flex-1 overflow-y-auto">
        {activity.length === 0 && (
          <div className="px-4 py-8 text-center">
            <div className="text-2xl mb-2">&#9203;</div>
            <p className="text-[12px] text-gray-500">Waiting for agent activity...</p>
            <p className="text-[10px] text-gray-600 mt-1">Click "Run Agents" to trigger agents</p>
          </div>
        )}
        {activity.map((item) => {
          const agent = AGENTS.find(a => a.name === item.agent)
          const style = TYPE_STYLES[item.type] || TYPE_STYLES['Comment']
          const actionLabel = ACTION_LABELS[item.action]
          const parsed = parseDetails(item.details)

          return (
            <div
              key={item.id}
              className="feed-item px-4 py-3 border-b border-dark-500/50 hover:bg-dark-700/50 transition-colors cursor-pointer"
            >
              {/* Agent + Action Header */}
              <div className="flex items-start gap-2.5 mb-1.5">
                {/* Agent Avatar mini */}
                {agent ? (
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-xs shrink-0 mt-0.5"
                    style={{
                      background: `${agent.color}15`,
                      border: `1.5px solid ${agent.color}`,
                    }}
                  >
                    {agent.emoji}
                  </div>
                ) : (
                  <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${style.dot}`}></div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {agent && (
                      <span
                        className="text-[11px] font-bold"
                        style={{ color: agent.color }}
                      >
                        {agent.name}
                      </span>
                    )}
                    {!agent && item.agent && (
                      <span className="text-[11px] font-bold text-gray-400">
                        {item.agent}
                      </span>
                    )}
                    <span className="text-[11px] text-gray-500">{item.action}</span>
                    {actionLabel && (
                      <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider ${actionLabel.color}`}>
                        {actionLabel.label}
                      </span>
                    )}
                  </div>

                  {/* Task Name */}
                  <p className="text-[12px] font-medium text-gray-200 mt-1 leading-tight">
                    &ldquo;{item.task}&rdquo;
                  </p>

                  {/* Summary / Details */}
                  {parsed.summary && (
                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed line-clamp-2">
                      {parsed.summary}
                    </p>
                  )}

                  {/* Reasoning (WHY) */}
                  {parsed.reasoning && (
                    <div className="mt-1.5 pl-2 border-l-2 border-accent-blue/30">
                      <p className="text-[10px] text-accent-blue/80 font-medium uppercase tracking-wider mb-0.5">Why</p>
                      <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">{parsed.reasoning}</p>
                    </div>
                  )}

                  {/* Impact */}
                  {parsed.impact && (
                    <div className="mt-1.5 pl-2 border-l-2 border-accent-green/30">
                      <p className="text-[10px] text-accent-green/80 font-medium uppercase tracking-wider mb-0.5">Impact</p>
                      <p className="text-[11px] text-gray-400 leading-relaxed line-clamp-2">{parsed.impact}</p>
                    </div>
                  )}

                  {/* Links */}
                  {parsed.links.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {parsed.links.map((link, i) => (
                        <a
                          key={i}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="feed-link text-[10px] font-medium text-accent-blue hover:underline flex items-center gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                            <polyline points="15 3 21 3 21 9"/>
                            <line x1="10" y1="14" x2="21" y2="3"/>
                          </svg>
                          {link.label}
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Type Badge + Timestamp */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className={`text-[9px] font-semibold uppercase tracking-wider ${style.text}`}>
                      {style.icon} {item.type}
                    </span>
                    <span className="text-[10px] text-gray-600">
                      {timeAgo(item.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Feed Footer */}
      <div className="px-4 py-2 border-t border-dark-500 bg-dark-800">
        <div className="flex items-center justify-between text-[10px] text-gray-600">
          <span className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-accent-green pulse-dot"></div>
            Auto-refreshing
          </span>
          <span>15s interval</span>
        </div>
      </div>
    </aside>
  )
}
