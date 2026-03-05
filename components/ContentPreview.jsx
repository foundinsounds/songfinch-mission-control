'use client'

import { useMemo } from 'react'

/**
 * Generate a deterministic pastel color from a string.
 */
function stringToColor(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash) % 360
  return `hsl(${h}, 45%, 25%)`
}

/**
 * Content type visual config — icons, gradients, patterns
 */
const CONTENT_VISUALS = {
  'Social Post': {
    icon: '📱',
    gradient: 'from-blue-600/20 to-purple-600/20',
    pattern: 'social',
    label: 'Social',
  },
  'Blog Post': {
    icon: '📝',
    gradient: 'from-green-600/20 to-emerald-600/20',
    pattern: 'blog',
    label: 'Blog',
  },
  'Ad Copy': {
    icon: '📢',
    gradient: 'from-purple-600/20 to-pink-600/20',
    pattern: 'ad',
    label: 'Ad',
  },
  'Video Script': {
    icon: '🎬',
    gradient: 'from-red-600/20 to-orange-600/20',
    pattern: 'video',
    label: 'Video',
  },
  'Landing Page': {
    icon: '🌐',
    gradient: 'from-yellow-600/20 to-amber-600/20',
    pattern: 'landing',
    label: 'Landing',
  },
  'Artist Spotlight': {
    icon: '🎤',
    gradient: 'from-orange-600/20 to-red-600/20',
    pattern: 'artist',
    label: 'Artist',
  },
  'SEO Content': {
    icon: '🔍',
    gradient: 'from-teal-600/20 to-cyan-600/20',
    pattern: 'seo',
    label: 'SEO',
  },
  'Email': {
    icon: '📧',
    gradient: 'from-indigo-600/20 to-blue-600/20',
    pattern: 'email',
    label: 'Email',
  },
  'Newsletter': {
    icon: '📰',
    gradient: 'from-violet-600/20 to-fuchsia-600/20',
    pattern: 'newsletter',
    label: 'News',
  },
  'Press Release': {
    icon: '📋',
    gradient: 'from-gray-600/20 to-slate-600/20',
    pattern: 'press',
    label: 'Press',
  },
  'Strategy': {
    icon: '🧠',
    gradient: 'from-cyan-600/20 to-blue-600/20',
    pattern: 'strategy',
    label: 'Strategy',
  },
  'Research': {
    icon: '🔬',
    gradient: 'from-emerald-600/20 to-teal-600/20',
    pattern: 'research',
    label: 'Research',
  },
  'Design': {
    icon: '🎨',
    gradient: 'from-pink-600/20 to-rose-600/20',
    pattern: 'design',
    label: 'Design',
  },
}

/**
 * SVG pattern backgrounds for different content types.
 */
function PatternSVG({ type, width = 120, height = 60 }) {
  const patterns = {
    social: (
      <>
        {/* Social media mockup lines */}
        <rect x="8" y="8" width="30" height="30" rx="4" fill="currentColor" opacity="0.15" />
        <rect x="44" y="10" width="40" height="3" rx="1.5" fill="currentColor" opacity="0.15" />
        <rect x="44" y="17" width="30" height="3" rx="1.5" fill="currentColor" opacity="0.1" />
        <rect x="44" y="24" width="60" height="3" rx="1.5" fill="currentColor" opacity="0.08" />
        <rect x="8" y="44" width="100" height="3" rx="1.5" fill="currentColor" opacity="0.08" />
        <rect x="8" y="51" width="70" height="3" rx="1.5" fill="currentColor" opacity="0.06" />
      </>
    ),
    blog: (
      <>
        {/* Blog post mockup */}
        <rect x="8" y="6" width="60" height="4" rx="2" fill="currentColor" opacity="0.2" />
        <rect x="8" y="14" width="100" height="2" rx="1" fill="currentColor" opacity="0.08" />
        <rect x="8" y="19" width="95" height="2" rx="1" fill="currentColor" opacity="0.08" />
        <rect x="8" y="24" width="80" height="2" rx="1" fill="currentColor" opacity="0.08" />
        <rect x="8" y="32" width="100" height="2" rx="1" fill="currentColor" opacity="0.06" />
        <rect x="8" y="37" width="90" height="2" rx="1" fill="currentColor" opacity="0.06" />
        <rect x="8" y="42" width="85" height="2" rx="1" fill="currentColor" opacity="0.06" />
        <rect x="8" y="50" width="100" height="2" rx="1" fill="currentColor" opacity="0.05" />
        <rect x="8" y="55" width="60" height="2" rx="1" fill="currentColor" opacity="0.05" />
      </>
    ),
    ad: (
      <>
        {/* Ad layout mockup */}
        <rect x="8" y="6" width="104" height="30" rx="3" fill="currentColor" opacity="0.1" />
        <rect x="14" y="12" width="50" height="5" rx="2" fill="currentColor" opacity="0.2" />
        <rect x="14" y="20" width="35" height="3" rx="1.5" fill="currentColor" opacity="0.12" />
        <rect x="30" y="42" width="60" height="10" rx="5" fill="currentColor" opacity="0.18" />
      </>
    ),
    video: (
      <>
        {/* Video player mockup */}
        <rect x="8" y="6" width="104" height="38" rx="3" fill="currentColor" opacity="0.1" />
        <polygon points="50,18 50,32 64,25" fill="currentColor" opacity="0.2" />
        <rect x="8" y="48" width="104" height="3" rx="1.5" fill="currentColor" opacity="0.08" />
        <rect x="8" y="48" width="40" height="3" rx="1.5" fill="currentColor" opacity="0.15" />
      </>
    ),
    landing: (
      <>
        {/* Landing page wireframe */}
        <rect x="8" y="6" width="104" height="12" rx="2" fill="currentColor" opacity="0.08" />
        <rect x="30" y="9" width="60" height="3" rx="1.5" fill="currentColor" opacity="0.15" />
        <rect x="20" y="22" width="80" height="5" rx="2" fill="currentColor" opacity="0.2" />
        <rect x="30" y="30" width="60" height="3" rx="1.5" fill="currentColor" opacity="0.1" />
        <rect x="15" y="38" width="30" height="16" rx="2" fill="currentColor" opacity="0.06" />
        <rect x="50" y="38" width="30" height="16" rx="2" fill="currentColor" opacity="0.06" />
        <rect x="85" y="38" width="27" height="16" rx="2" fill="currentColor" opacity="0.06" />
      </>
    ),
    email: (
      <>
        {/* Email mockup */}
        <rect x="8" y="6" width="104" height="8" rx="2" fill="currentColor" opacity="0.1" />
        <rect x="12" y="9" width="40" height="2" rx="1" fill="currentColor" opacity="0.15" />
        <rect x="8" y="18" width="104" height="1" fill="currentColor" opacity="0.06" />
        <rect x="8" y="22" width="70" height="3" rx="1.5" fill="currentColor" opacity="0.12" />
        <rect x="8" y="30" width="100" height="2" rx="1" fill="currentColor" opacity="0.06" />
        <rect x="8" y="35" width="95" height="2" rx="1" fill="currentColor" opacity="0.06" />
        <rect x="8" y="40" width="80" height="2" rx="1" fill="currentColor" opacity="0.06" />
        <rect x="8" y="48" width="40" height="8" rx="4" fill="currentColor" opacity="0.12" />
      </>
    ),
    default: (
      <>
        {/* Generic document mockup */}
        <rect x="8" y="6" width="50" height="4" rx="2" fill="currentColor" opacity="0.15" />
        <rect x="8" y="14" width="100" height="2" rx="1" fill="currentColor" opacity="0.08" />
        <rect x="8" y="20" width="90" height="2" rx="1" fill="currentColor" opacity="0.08" />
        <rect x="8" y="26" width="95" height="2" rx="1" fill="currentColor" opacity="0.06" />
        <rect x="8" y="34" width="100" height="2" rx="1" fill="currentColor" opacity="0.06" />
        <rect x="8" y="40" width="80" height="2" rx="1" fill="currentColor" opacity="0.05" />
        <rect x="8" y="48" width="90" height="2" rx="1" fill="currentColor" opacity="0.05" />
      </>
    ),
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="text-white">
      {patterns[type] || patterns.default}
    </svg>
  )
}

/**
 * Inline content preview thumbnail for task cards.
 * Shows a miniature visual representation of the content type.
 */
export function ContentPreviewInline({ task }) {
  const visual = CONTENT_VISUALS[task.contentType] || {
    icon: '📄',
    gradient: 'from-gray-600/20 to-gray-700/20',
    pattern: 'default',
    label: task.contentType || 'Content',
  }

  const hasOutput = task.output && task.output.length > 0

  return (
    <div className={`relative w-full h-16 rounded-md overflow-hidden bg-gradient-to-br ${visual.gradient} border border-white/5`}>
      {/* Pattern background */}
      <div className="absolute inset-0">
        <PatternSVG type={visual.pattern} width={120} height={60} />
      </div>

      {/* Content type icon + label */}
      <div className="absolute bottom-1 right-1.5 flex items-center gap-1">
        <span className="text-[8px] font-semibold text-white/40 uppercase tracking-wider">{visual.label}</span>
        <span className="text-xs opacity-60">{visual.icon}</span>
      </div>

      {/* Has output indicator */}
      {hasOutput && (
        <div className="absolute top-1 right-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse" title="Content generated" />
        </div>
      )}

      {/* Platform tags overlay */}
      {task.platform && task.platform.length > 0 && (
        <div className="absolute top-1 left-1.5 flex gap-0.5">
          {task.platform.slice(0, 3).map(p => (
            <span key={p} className="text-[7px] px-1 py-0.5 rounded bg-black/30 text-white/50 font-medium">
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Larger content preview for task modal or detail views.
 * Shows a richer preview with text excerpt if available.
 */
export function ContentPreviewLarge({ task }) {
  const visual = CONTENT_VISUALS[task.contentType] || {
    icon: '📄',
    gradient: 'from-gray-600/20 to-gray-700/20',
    pattern: 'default',
    label: task.contentType || 'Content',
  }

  const outputExcerpt = useMemo(() => {
    if (!task.output) return null
    // Strip revision metadata
    const idx = task.output.indexOf('---PREVIOUS OUTPUT')
    const clean = idx >= 0 ? task.output.substring(0, idx).trim() : task.output.trim()
    if (clean.startsWith('[REVISION REQUESTED]')) return null
    return clean.substring(0, 200) + (clean.length > 200 ? '...' : '')
  }, [task.output])

  const campaignColor = useMemo(() => {
    return task.campaign ? stringToColor(task.campaign) : null
  }, [task.campaign])

  return (
    <div className={`relative w-full h-32 rounded-lg overflow-hidden bg-gradient-to-br ${visual.gradient} border border-white/5`}>
      {/* Pattern background */}
      <div className="absolute inset-0 opacity-60">
        <PatternSVG type={visual.pattern} width={300} height={128} />
      </div>

      {/* Campaign color strip */}
      {campaignColor && (
        <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: campaignColor }} />
      )}

      {/* Content type header */}
      <div className="absolute top-2 left-3 flex items-center gap-2">
        <span className="text-lg">{visual.icon}</span>
        <div>
          <div className="text-[10px] font-bold text-white/70 uppercase tracking-wider">{visual.label}</div>
          {task.campaign && (
            <div className="text-[8px] text-white/40">{task.campaign}</div>
          )}
        </div>
      </div>

      {/* Output excerpt */}
      {outputExcerpt && (
        <div className="absolute bottom-2 left-3 right-3">
          <div className="bg-black/40 backdrop-blur-sm rounded p-2 border border-white/5">
            <p className="text-[9px] text-white/60 leading-relaxed line-clamp-3 font-mono">
              {outputExcerpt}
            </p>
          </div>
        </div>
      )}

      {/* No output state */}
      {!outputExcerpt && (
        <div className="absolute bottom-2 left-3 right-3">
          <div className="flex items-center gap-1.5 text-white/30">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
            </svg>
            <span className="text-[9px]">Awaiting content generation...</span>
          </div>
        </div>
      )}

      {/* Platform tags */}
      {task.platform && task.platform.length > 0 && (
        <div className="absolute top-2 right-3 flex gap-1">
          {task.platform.slice(0, 4).map(p => (
            <span key={p} className="text-[8px] px-1.5 py-0.5 rounded bg-black/30 text-white/50 font-medium border border-white/5">
              {p}
            </span>
          ))}
        </div>
      )}

      {/* Status indicator */}
      {task.status === 'Done' && (
        <div className="absolute top-2 right-3">
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/20 border border-green-500/30">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-green-400">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className="text-[8px] text-green-400 font-semibold">Done</span>
          </div>
        </div>
      )}
    </div>
  )
}
