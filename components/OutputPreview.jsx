'use client'

import { useState, useMemo, useCallback } from 'react'
import CopyButton from './CopyButton'

// ─── Helpers ────────────────────────────────────────────

function wordCount(text) {
  if (!text) return 0
  return text.trim().split(/\s+/).filter(Boolean).length
}

function charCount(text) {
  return text ? text.length : 0
}

function readingTime(text) {
  const words = wordCount(text)
  const minutes = Math.ceil(words / 200)
  return minutes < 1 ? '< 1 min' : `${minutes} min read`
}

function extractImageUrls(text) {
  if (!text) return []
  // Match both http URLs and base64 data URLs (from FLUX.1 / Gemini image gen)
  const httpRegex = /https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?[^\s"'<>]*)?/gi
  const dataUrlRegex = /data:image\/[a-z]+;base64,[A-Za-z0-9+/=]+/g
  const httpUrls = text.match(httpRegex) || []
  const dataUrls = text.match(dataUrlRegex) || []
  return [...new Set([...httpUrls, ...dataUrls])]
}

// ─── Inline Markdown Renderer ────────────────────────────

/**
 * Renders inline markdown tokens: **bold**, *italic*, `code`, [links](url), ~~strike~~
 * Regex alternation order: links → code → bold → strikethrough → italic
 */
function InlineMarkdown({ text }) {
  if (!text || typeof text !== 'string') return text ?? null
  const TOKEN_RE = /\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*(.+?)\*\*|~~(.+?)~~|\*(.+?)\*/g
  const parts = []
  let lastIndex = 0
  let match
  let hasTokens = false

  while ((match = TOKEN_RE.exec(text)) !== null) {
    hasTokens = true
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    if (match[1] !== undefined) {
      parts.push(<a key={match.index} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-accent-blue hover:text-blue-300 underline decoration-accent-blue/30 hover:decoration-accent-blue/60 transition-colors">{match[1]}</a>)
    } else if (match[3] !== undefined) {
      parts.push(<code key={match.index} className="px-1 py-0.5 bg-dark-600 rounded text-[10px] text-accent-orange font-mono border border-dark-500">{match[3]}</code>)
    } else if (match[4] !== undefined) {
      parts.push(<strong key={match.index} className="font-bold text-gray-200">{match[4]}</strong>)
    } else if (match[5] !== undefined) {
      parts.push(<s key={match.index} className="text-gray-500 line-through">{match[5]}</s>)
    } else if (match[6] !== undefined) {
      parts.push(<em key={match.index} className="italic text-gray-300">{match[6]}</em>)
    }
    lastIndex = match.index + match[0].length
  }
  if (!hasTokens) return text
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return <>{parts}</>
}

// ─── Platform badge config ──────────────────────────────

const PLATFORM_BADGES = {
  Instagram:  { label: 'IG',       color: 'from-pink-600 to-purple-600',   textColor: 'text-white' },
  Facebook:   { label: 'FB',       color: 'from-blue-600 to-blue-700',     textColor: 'text-white' },
  TikTok:     { label: 'TT',       color: 'from-gray-800 to-gray-900',     textColor: 'text-white' },
  Twitter:    { label: 'X',        color: 'from-gray-700 to-gray-900',     textColor: 'text-white' },
  LinkedIn:   { label: 'LI',       color: 'from-blue-700 to-blue-800',     textColor: 'text-white' },
  YouTube:    { label: 'YT',       color: 'from-red-600 to-red-700',       textColor: 'text-white' },
  Pinterest:  { label: 'PIN',      color: 'from-red-500 to-red-600',       textColor: 'text-white' },
  Email:      { label: 'EMAIL',    color: 'from-indigo-600 to-indigo-700', textColor: 'text-white' },
  Google:     { label: 'GOOG',     color: 'from-blue-500 to-green-500',    textColor: 'text-white' },
  Meta:       { label: 'META',     color: 'from-blue-500 to-blue-600',     textColor: 'text-white' },
}

function PlatformBadge({ platform }) {
  const badge = PLATFORM_BADGES[platform] || { label: platform?.substring(0, 3).toUpperCase() || '???', color: 'from-gray-600 to-gray-700', textColor: 'text-white' }
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-gradient-to-r ${badge.color} ${badge.textColor} shadow-sm`}>
      {badge.label}
    </span>
  )
}

// ─── Collapsible Section ────────────────────────────────

function CollapsibleSection({ title, subtitle, defaultOpen = false, badge, children, copyText }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border border-dark-500 rounded-lg overflow-hidden transition-all duration-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-dark-700 hover:bg-dark-600 transition-colors text-left group"
      >
        <div className="flex items-center gap-2 min-w-0">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`text-gray-500 transition-transform duration-200 flex-shrink-0 ${open ? 'rotate-90' : ''}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <span className="text-xs font-semibold text-gray-300 truncate">{title}</span>
          {subtitle && <span className="text-[10px] text-gray-500 truncate hidden sm:inline">{subtitle}</span>}
          {badge}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
          {copyText && (
            <span onClick={(e) => e.stopPropagation()}>
              <CopyButton text={copyText} variant="icon" />
            </span>
          )}
        </div>
      </button>
      <div
        className={`transition-all duration-300 ease-in-out overflow-hidden ${
          open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="p-3 bg-dark-800 border-t border-dark-500">
          {children}
        </div>
      </div>
    </div>
  )
}

// ─── Stats Bar ──────────────────────────────────────────

function StatsBar({ text }) {
  if (!text) return null
  const words = wordCount(text)
  const chars = charCount(text)
  const reading = readingTime(text)

  return (
    <div className="flex items-center gap-3 text-[10px] text-gray-500 mb-3">
      <span className="flex items-center gap-1">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
        {words.toLocaleString()} words
      </span>
      <span>{chars.toLocaleString()} chars</span>
      <span className="flex items-center gap-1">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
        {reading}
      </span>
    </div>
  )
}

// ─── Link Card ──────────────────────────────────────────

function LinkCard({ href, icon, label, description }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 px-3 py-2.5 bg-dark-700 rounded-lg border border-dark-500 hover:border-accent-blue/30 hover:bg-dark-600 transition-all group"
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue/20 to-accent-purple/20 flex items-center justify-center text-sm">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">{label}</div>
        <div className="text-[10px] text-gray-500 truncate">{description || href}</div>
      </div>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-600 group-hover:text-gray-400 flex-shrink-0">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
        <polyline points="15 3 21 3 21 9" />
        <line x1="10" y1="14" x2="21" y2="3" />
      </svg>
    </a>
  )
}

// ─── Content-Type Specific Renderers ────────────────────

/**
 * Ad Copy renderer — splits variations and shows character counts + platform badges
 */
function AdCopyPreview({ output, platforms }) {
  const variations = useMemo(() => {
    if (!output) return []
    // Try to split by common variation patterns
    const varPatterns = [
      /(?:^|\n)(?:Variation|Version|Option|Ad|Copy)\s*#?\s*\d+[:\s\-]*/gi,
      /(?:^|\n)(?:#{1,3}\s*(?:Variation|Version|Option|Ad)\s*#?\d+)/gi,
      /(?:^|\n)---+\s*\n/g,
    ]
    for (const pattern of varPatterns) {
      const splits = output.split(pattern).filter(s => s.trim())
      if (splits.length > 1) return splits.map(s => s.trim())
    }
    // Fallback: if output has clear double-newline separators for multiple blocks
    const blocks = output.split(/\n{3,}/).filter(s => s.trim())
    if (blocks.length > 1) return blocks.map(s => s.trim())
    return [output.trim()]
  }, [output])

  return (
    <div className="space-y-3">
      {variations.map((variation, i) => (
        <div key={i} className="bg-dark-900 rounded-lg border border-dark-500 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-dark-500 bg-purple-500/5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-purple-400 uppercase tracking-wider">
                {variations.length > 1 ? `Variation ${i + 1}` : 'Ad Copy'}
              </span>
              {platforms?.map(p => <PlatformBadge key={p} platform={p} />)}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-gray-500 font-mono">{charCount(variation)} chars</span>
              <CopyButton text={variation} variant="icon" />
            </div>
          </div>
          <div className="p-3">
            <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap"><InlineMarkdown text={variation} /></p>
          </div>
          {/* Character limit indicators */}
          <div className="px-3 pb-2 flex items-center gap-2">
            {charCount(variation) <= 125 && (
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">FB Primary</span>
            )}
            {charCount(variation) <= 280 && (
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">X/Twitter</span>
            )}
            {charCount(variation) <= 2200 && (
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-400 border border-pink-500/20">IG Caption</span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Social Post renderer — mock social media frames
 */
function SocialPostPreview({ output, platforms }) {
  const posts = useMemo(() => {
    if (!output) return []
    // Try to split by platform headers
    const platformSplits = output.split(/(?:^|\n)(?:#{1,3}\s*)?(?:Instagram|Facebook|TikTok|Twitter|LinkedIn|YouTube|Pinterest)[:\s]*/gi)
    if (platformSplits.filter(s => s.trim()).length > 1) {
      return platformSplits.filter(s => s.trim()).map(s => s.trim())
    }
    const blocks = output.split(/\n{3,}/).filter(s => s.trim())
    if (blocks.length > 1) return blocks.map(s => s.trim())
    return [output.trim()]
  }, [output])

  const frameStyle = useMemo(() => {
    const first = (platforms || [])[0]
    if (first === 'Instagram' || first === 'Facebook') return 'instagram'
    if (first === 'TikTok') return 'tiktok'
    if (first === 'Twitter') return 'twitter'
    if (first === 'LinkedIn') return 'linkedin'
    return 'generic'
  }, [platforms])

  return (
    <div className="space-y-3">
      {posts.map((post, i) => (
        <div key={i} className="rounded-lg overflow-hidden border border-dark-500">
          {/* Frame header */}
          {frameStyle === 'instagram' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-dark-900 border-b border-dark-500">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 to-purple-600" />
              <span className="text-[10px] font-bold text-gray-300">songfinch</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" className="text-blue-400">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="ml-auto">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-500">
                  <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
                </svg>
              </div>
            </div>
          )}
          {frameStyle === 'tiktok' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-black border-b border-dark-500">
              <span className="text-[10px] font-bold text-white">@songfinch</span>
              <span className="ml-auto text-[9px] text-gray-500">TikTok Caption</span>
            </div>
          )}
          {frameStyle === 'twitter' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-dark-900 border-b border-dark-500">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600" />
              <div>
                <span className="text-[10px] font-bold text-gray-300">Songfinch</span>
                <span className="text-[10px] text-gray-500 ml-1">@songfinch</span>
              </div>
            </div>
          )}
          {frameStyle === 'linkedin' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-dark-900 border-b border-dark-500">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600 to-blue-800" />
              <div>
                <span className="text-[10px] font-bold text-gray-300">Songfinch</span>
                <span className="text-[9px] text-gray-500 block">Music & Entertainment</span>
              </div>
            </div>
          )}
          {frameStyle === 'generic' && (
            <div className="flex items-center gap-2 px-3 py-2 bg-dark-900 border-b border-dark-500">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple" />
              <span className="text-[10px] font-bold text-gray-300">Social Post {posts.length > 1 ? `#${i + 1}` : ''}</span>
              {platforms?.map(p => <PlatformBadge key={p} platform={p} />)}
            </div>
          )}
          {/* Post content */}
          <div className="p-3 bg-dark-800">
            <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap"><InlineMarkdown text={post} /></p>
          </div>
          {/* Post footer */}
          <div className="flex items-center justify-between px-3 py-2 bg-dark-900 border-t border-dark-500">
            <div className="flex items-center gap-3 text-gray-600">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-gray-500 font-mono">{charCount(post)} chars</span>
              <CopyButton text={post} variant="icon" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Blog / SEO Content renderer — markdown-like formatting
 */
function BlogPreview({ output }) {
  const rendered = useMemo(() => {
    if (!output) return []
    const lines = output.split('\n')
    const elements = []
    let currentParagraph = []

    const flushParagraph = () => {
      if (currentParagraph.length > 0) {
        elements.push({ type: 'paragraph', text: currentParagraph.join(' ') })
        currentParagraph = []
      }
    }

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        flushParagraph()
        continue
      }
      if (trimmed.startsWith('# ')) {
        flushParagraph()
        elements.push({ type: 'h1', text: trimmed.substring(2) })
      } else if (trimmed.startsWith('## ')) {
        flushParagraph()
        elements.push({ type: 'h2', text: trimmed.substring(3) })
      } else if (trimmed.startsWith('### ')) {
        flushParagraph()
        elements.push({ type: 'h3', text: trimmed.substring(4) })
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        flushParagraph()
        elements.push({ type: 'bullet', text: trimmed.substring(2) })
      } else if (/^\d+\.\s/.test(trimmed)) {
        flushParagraph()
        elements.push({ type: 'numbered', text: trimmed })
      } else if (trimmed.startsWith('> ')) {
        flushParagraph()
        elements.push({ type: 'blockquote', text: trimmed.substring(2) })
      } else if (trimmed.startsWith('---') || trimmed.startsWith('***')) {
        flushParagraph()
        elements.push({ type: 'hr' })
      } else if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        flushParagraph()
        elements.push({ type: 'bold-line', text: trimmed.replace(/\*\*/g, '') })
      } else {
        currentParagraph.push(trimmed)
      }
    }
    flushParagraph()
    return elements
  }, [output])

  return (
    <div className="prose-dark space-y-2">
      {rendered.map((el, i) => {
        switch (el.type) {
          case 'h1': return <h2 key={i} className="text-base font-bold text-white mt-4 mb-1 tracking-tight">{el.text}</h2>
          case 'h2': return <h3 key={i} className="text-sm font-bold text-gray-200 mt-3 mb-1">{el.text}</h3>
          case 'h3': return <h4 key={i} className="text-xs font-bold text-gray-300 mt-2 mb-1">{el.text}</h4>
          case 'paragraph': return <p key={i} className="text-xs text-gray-400 leading-relaxed"><InlineMarkdown text={el.text} /></p>
          case 'bullet': return (
            <div key={i} className="flex items-start gap-2 pl-2">
              <span className="text-accent-blue mt-1 text-[8px]">&#9679;</span>
              <span className="text-xs text-gray-400 leading-relaxed"><InlineMarkdown text={el.text} /></span>
            </div>
          )
          case 'numbered': return <p key={i} className="text-xs text-gray-400 leading-relaxed pl-2"><InlineMarkdown text={el.text} /></p>
          case 'blockquote': return (
            <div key={i} className="border-l-2 border-accent-purple/40 pl-3 py-1 bg-purple-500/5 rounded-r">
              <p className="text-xs text-gray-400 italic leading-relaxed"><InlineMarkdown text={el.text} /></p>
            </div>
          )
          case 'hr': return <hr key={i} className="border-dark-500 my-3" />
          case 'bold-line': return <p key={i} className="text-xs font-bold text-gray-300">{el.text}</p>
          default: return null
        }
      })}
    </div>
  )
}

/**
 * Video Script renderer — screenplay-style formatting
 */
function VideoScriptPreview({ output }) {
  const scenes = useMemo(() => {
    if (!output) return []
    const lines = output.split('\n')
    const parts = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      if (/^(?:SCENE|INT\.|EXT\.|INT\/EXT)/i.test(trimmed)) {
        parts.push({ type: 'scene', text: trimmed })
      } else if (/^\[.*\]$/.test(trimmed) || /^(?:ACTION|VISUAL|CUT TO|FADE|TRANSITION)/i.test(trimmed)) {
        parts.push({ type: 'action', text: trimmed })
      } else if (/^[A-Z][A-Z\s]+:/.test(trimmed) || /^(?:NARRATOR|HOST|VO|V\.O\.|SPEAKER)/i.test(trimmed)) {
        const colonIdx = trimmed.indexOf(':')
        if (colonIdx > 0) {
          parts.push({
            type: 'dialogue',
            speaker: trimmed.substring(0, colonIdx).trim(),
            text: trimmed.substring(colonIdx + 1).trim(),
          })
        } else {
          parts.push({ type: 'dialogue', speaker: trimmed, text: '' })
        }
      } else if (/^\(.*\)$/.test(trimmed)) {
        parts.push({ type: 'direction', text: trimmed })
      } else if (/^#{1,3}\s/.test(trimmed)) {
        parts.push({ type: 'heading', text: trimmed.replace(/^#{1,3}\s*/, '') })
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        parts.push({ type: 'bullet', text: trimmed.substring(2) })
      } else if (/^---/.test(trimmed)) {
        parts.push({ type: 'divider' })
      } else {
        parts.push({ type: 'text', text: trimmed })
      }
    }
    return parts
  }, [output])

  return (
    <div className="font-mono space-y-1">
      {scenes.map((part, i) => {
        switch (part.type) {
          case 'scene': return (
            <div key={i} className="bg-yellow-500/10 px-3 py-1.5 rounded border-l-2 border-yellow-500/40 mt-3 first:mt-0">
              <span className="text-[11px] font-bold text-yellow-400 uppercase tracking-wide">{part.text}</span>
            </div>
          )
          case 'action': return (
            <div key={i} className="px-3 py-1">
              <span className="text-[11px] text-gray-400 italic">{part.text}</span>
            </div>
          )
          case 'dialogue': return (
            <div key={i} className="px-3 py-1 ml-4">
              <span className="text-[10px] font-bold text-accent-blue uppercase tracking-wider block mb-0.5">{part.speaker}</span>
              {part.text && <span className="text-xs text-gray-300 leading-relaxed"><InlineMarkdown text={part.text} /></span>}
            </div>
          )
          case 'direction': return (
            <div key={i} className="px-3 py-0.5 text-center">
              <span className="text-[10px] text-gray-500 italic">{part.text}</span>
            </div>
          )
          case 'heading': return (
            <div key={i} className="px-3 py-1 mt-3 first:mt-0">
              <span className="text-xs font-bold text-gray-200">{part.text}</span>
            </div>
          )
          case 'bullet': return (
            <div key={i} className="flex items-start gap-2 px-3 py-0.5 ml-4">
              <span className="text-accent-orange text-[8px] mt-1">&#9679;</span>
              <span className="text-[11px] text-gray-400"><InlineMarkdown text={part.text} /></span>
            </div>
          )
          case 'divider': return <hr key={i} className="border-dark-500 my-2" />
          default: return (
            <div key={i} className="px-3 py-0.5">
              <span className="text-[11px] text-gray-400"><InlineMarkdown text={part.text} /></span>
            </div>
          )
        }
      })}
    </div>
  )
}

/**
 * Landing Page renderer — visual hierarchy with sections
 */
function LandingPagePreview({ output }) {
  const sections = useMemo(() => {
    if (!output) return []
    const lines = output.split('\n')
    const parts = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      if (trimmed.startsWith('# ')) {
        parts.push({ type: 'hero-heading', text: trimmed.substring(2) })
      } else if (trimmed.startsWith('## ')) {
        parts.push({ type: 'section-heading', text: trimmed.substring(3) })
      } else if (trimmed.startsWith('### ')) {
        parts.push({ type: 'subheading', text: trimmed.substring(4) })
      } else if (/^\[CTA\]|^\[BUTTON\]|^CTA:/i.test(trimmed)) {
        parts.push({ type: 'cta', text: trimmed.replace(/^\[CTA\]|\[BUTTON\]|CTA:\s*/i, '') })
      } else if (/^\*\*.*\*\*$/.test(trimmed)) {
        parts.push({ type: 'bold', text: trimmed.replace(/\*\*/g, '') })
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        parts.push({ type: 'feature', text: trimmed.substring(2) })
      } else if (/^---/.test(trimmed)) {
        parts.push({ type: 'divider' })
      } else {
        parts.push({ type: 'body', text: trimmed })
      }
    }
    return parts
  }, [output])

  return (
    <div className="space-y-2 bg-dark-900 rounded-lg border border-dark-500 overflow-hidden">
      {sections.map((section, i) => {
        switch (section.type) {
          case 'hero-heading': return (
            <div key={i} className="px-4 pt-5 pb-2 text-center">
              <h2 className="text-lg font-extrabold text-white tracking-tight leading-tight">{section.text}</h2>
            </div>
          )
          case 'section-heading': return (
            <div key={i} className="px-4 pt-4 pb-1">
              <h3 className="text-sm font-bold text-gray-200">{section.text}</h3>
            </div>
          )
          case 'subheading': return (
            <div key={i} className="px-4 py-1">
              <h4 className="text-xs font-semibold text-gray-300">{section.text}</h4>
            </div>
          )
          case 'body': return (
            <div key={i} className="px-4 py-0.5">
              <p className="text-xs text-gray-400 leading-relaxed"><InlineMarkdown text={section.text} /></p>
            </div>
          )
          case 'bold': return (
            <div key={i} className="px-4 py-0.5">
              <p className="text-xs font-bold text-gray-300">{section.text}</p>
            </div>
          )
          case 'cta': return (
            <div key={i} className="px-4 py-3 text-center">
              <span className="inline-block px-5 py-2 rounded-full bg-gradient-to-r from-accent-blue to-accent-purple text-white text-xs font-bold shadow-lg shadow-accent-blue/20">
                {section.text}
              </span>
            </div>
          )
          case 'feature': return (
            <div key={i} className="flex items-start gap-2 px-4 py-0.5">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent-green mt-0.5 flex-shrink-0">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-xs text-gray-400"><InlineMarkdown text={section.text} /></span>
            </div>
          )
          case 'divider': return <hr key={i} className="border-dark-500 mx-4 my-2" />
          default: return null
        }
      })}
      <div className="h-2" />
    </div>
  )
}

/**
 * Email renderer — email preview with subject, body, CTA
 */
function EmailPreview({ output }) {
  const parsed = useMemo(() => {
    if (!output) return { subject: '', preheader: '', body: '', cta: '' }
    const lines = output.split('\n')
    let subject = ''
    let preheader = ''
    let cta = ''
    const bodyLines = []
    let inBody = false

    for (const line of lines) {
      const trimmed = line.trim()
      if (/^Subject[:\s]/i.test(trimmed)) {
        subject = trimmed.replace(/^Subject[:\s]*/i, '')
      } else if (/^Pre-?header[:\s]/i.test(trimmed)) {
        preheader = trimmed.replace(/^Pre-?header[:\s]*/i, '')
      } else if (/^\[CTA\]|^\[BUTTON\]|^CTA:/i.test(trimmed)) {
        cta = trimmed.replace(/^\[CTA\]|\[BUTTON\]|CTA:\s*/i, '')
      } else if (trimmed) {
        bodyLines.push(trimmed)
        inBody = true
      }
    }

    // If no subject found, use first line
    if (!subject && bodyLines.length > 0) {
      subject = bodyLines.shift()
    }

    return { subject, preheader, body: bodyLines.join('\n'), cta }
  }, [output])

  return (
    <div className="bg-dark-900 rounded-lg border border-dark-500 overflow-hidden">
      {/* Email client chrome */}
      <div className="bg-dark-700 px-3 py-2 border-b border-dark-500">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="w-2 h-2 rounded-full bg-red-500/60" />
          <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
          <div className="w-2 h-2 rounded-full bg-green-500/60" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-gray-500 w-12 text-right">From:</span>
            <span className="text-[10px] text-gray-400">Songfinch &lt;hello@songfinch.com&gt;</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] text-gray-500 w-12 text-right">Subject:</span>
            <span className="text-[10px] font-bold text-gray-200">{parsed.subject || 'No subject'}</span>
          </div>
          {parsed.preheader && (
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-gray-500 w-12 text-right">Preview:</span>
              <span className="text-[10px] text-gray-500 italic">{parsed.preheader}</span>
            </div>
          )}
        </div>
      </div>
      {/* Email body */}
      <div className="p-4">
        <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap"><InlineMarkdown text={parsed.body} /></div>
        {parsed.cta && (
          <div className="mt-4 text-center">
            <span className="inline-block px-5 py-2.5 rounded-lg bg-gradient-to-r from-accent-blue to-accent-purple text-white text-xs font-bold shadow-lg">
              {parsed.cta}
            </span>
          </div>
        )}
      </div>
      {/* Email footer */}
      <div className="px-4 py-2 border-t border-dark-500 bg-dark-700">
        <p className="text-[9px] text-gray-600 text-center">
          Songfinch, Inc. &bull; You're receiving this because you subscribed
        </p>
      </div>
    </div>
  )
}

/**
 * Image / Design asset renderer — link cards + image previews
 */
function ImagePreview({ output, canvaLink, driveLink }) {
  const imageUrls = useMemo(() => extractImageUrls(output), [output])

  return (
    <div className="space-y-3">
      {/* External link cards */}
      <div className="space-y-2">
        <LinkCard
          href={canvaLink}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-purple">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          }
          label="Open in Canva"
          description="Edit design in Canva"
        />
        <LinkCard
          href={driveLink}
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent-blue">
              <path d="M12 2L2 19.5h7.5L12 14l2.5 5.5H22L12 2z" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          }
          label="Open in Google Drive"
          description="View file in Drive"
        />
      </div>

      {/* Image previews */}
      {imageUrls.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Image Preview</span>
          <div className="grid grid-cols-2 gap-2">
            {imageUrls.slice(0, 4).map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-dark-500 hover:border-accent-blue/30 transition-colors">
                <img
                  src={url}
                  alt={`Design asset ${i + 1}`}
                  className="w-full h-32 object-cover bg-dark-700"
                  onError={(e) => { e.target.style.display = 'none' }}
                />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Description text */}
      {output && !imageUrls.length && !canvaLink && !driveLink && (
        <div className="bg-dark-900 rounded-lg border border-dark-500 p-3">
          <pre className="text-xs text-gray-400 whitespace-pre-wrap font-mono leading-relaxed">{output}</pre>
        </div>
      )}
    </div>
  )
}

/**
 * Strategy / Research renderer — report-style with sections
 */
function StrategyPreview({ output }) {
  const sections = useMemo(() => {
    if (!output) return []
    const lines = output.split('\n')
    const parts = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      if (trimmed.startsWith('# ')) {
        parts.push({ type: 'title', text: trimmed.substring(2) })
      } else if (trimmed.startsWith('## ')) {
        parts.push({ type: 'section', text: trimmed.substring(3) })
      } else if (trimmed.startsWith('### ')) {
        parts.push({ type: 'subsection', text: trimmed.substring(4) })
      } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        parts.push({ type: 'bullet', text: trimmed.substring(2) })
      } else if (/^\d+\.\s/.test(trimmed)) {
        parts.push({ type: 'numbered', text: trimmed })
      } else if (trimmed.startsWith('> ')) {
        parts.push({ type: 'insight', text: trimmed.substring(2) })
      } else if (/^---/.test(trimmed)) {
        parts.push({ type: 'divider' })
      } else if (/^\*\*.*\*\*$/.test(trimmed)) {
        parts.push({ type: 'bold', text: trimmed.replace(/\*\*/g, '') })
      } else if (/^(?:Key (?:Finding|Insight|Takeaway|Metric)|Summary|Recommendation|Conclusion)[:\s]/i.test(trimmed)) {
        const colonIdx = trimmed.indexOf(':')
        parts.push({
          type: 'callout',
          label: colonIdx > 0 ? trimmed.substring(0, colonIdx) : 'Key Point',
          text: colonIdx > 0 ? trimmed.substring(colonIdx + 1).trim() : trimmed,
        })
      } else {
        parts.push({ type: 'text', text: trimmed })
      }
    }
    return parts
  }, [output])

  return (
    <div className="space-y-1.5">
      {sections.map((part, i) => {
        switch (part.type) {
          case 'title': return (
            <div key={i} className="pb-2 mb-2 border-b border-dark-500">
              <h2 className="text-base font-bold text-white">{part.text}</h2>
            </div>
          )
          case 'section': return (
            <div key={i} className="pt-3 pb-1">
              <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
                <span className="w-1 h-4 bg-accent-teal rounded-full inline-block" />
                {part.text}
              </h3>
            </div>
          )
          case 'subsection': return (
            <div key={i} className="pt-1">
              <h4 className="text-xs font-bold text-gray-300 pl-3">{part.text}</h4>
            </div>
          )
          case 'bullet': return (
            <div key={i} className="flex items-start gap-2 pl-3">
              <span className="text-accent-teal text-[8px] mt-1.5">&#9679;</span>
              <span className="text-xs text-gray-400 leading-relaxed"><InlineMarkdown text={part.text} /></span>
            </div>
          )
          case 'numbered': return (
            <p key={i} className="text-xs text-gray-400 leading-relaxed pl-3"><InlineMarkdown text={part.text} /></p>
          )
          case 'insight': return (
            <div key={i} className="ml-3 border-l-2 border-accent-purple/40 pl-3 py-1 bg-purple-500/5 rounded-r">
              <p className="text-xs text-gray-400 italic"><InlineMarkdown text={part.text} /></p>
            </div>
          )
          case 'callout': return (
            <div key={i} className="ml-3 px-3 py-2 bg-accent-teal/5 rounded-lg border border-accent-teal/20">
              <span className="text-[9px] font-bold text-accent-teal uppercase tracking-wider block mb-0.5">{part.label}</span>
              <span className="text-xs text-gray-300"><InlineMarkdown text={part.text} /></span>
            </div>
          )
          case 'bold': return <p key={i} className="text-xs font-bold text-gray-300 pl-3"><InlineMarkdown text={part.text} /></p>
          case 'divider': return <hr key={i} className="border-dark-500 my-2" />
          default: return <p key={i} className="text-xs text-gray-400 leading-relaxed pl-3"><InlineMarkdown text={part.text} /></p>
        }
      })}
    </div>
  )
}

/**
 * Fallback plain-text renderer
 */
function PlainTextPreview({ output }) {
  return (
    <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
      <InlineMarkdown text={output} />
    </pre>
  )
}

// ─── Content Type Router ────────────────────────────────

const CONTENT_TYPE_MAP = {
  'Ad Copy':         'ad',
  'Social Post':     'social',
  'Blog Post':       'blog',
  'SEO Content':     'blog',
  'Video Script':    'video',
  'Landing Page':    'landing',
  'Email':           'email',
  'Newsletter':      'email',
  'Image':           'image',
  'Design':          'image',
  'Strategy':        'strategy',
  'Research':        'strategy',
  'Press Release':   'blog',
  'Artist Spotlight': 'blog',
}

const CONTENT_TYPE_ICONS = {
  ad:       { icon: '\uD83D\uDCE2', label: 'Ad Copy',      accent: 'purple' },
  social:   { icon: '\uD83D\uDCF1', label: 'Social Post',   accent: 'blue' },
  blog:     { icon: '\uD83D\uDCDD', label: 'Blog/SEO',      accent: 'green' },
  video:    { icon: '\uD83C\uDFAC', label: 'Video Script',  accent: 'orange' },
  landing:  { icon: '\uD83C\uDF10', label: 'Landing Page',  accent: 'yellow' },
  email:    { icon: '\uD83D\uDCE7', label: 'Email',         accent: 'indigo' },
  image:    { icon: '\uD83C\uDFA8', label: 'Design Asset',  accent: 'pink' },
  strategy: { icon: '\uD83E\uDDE0', label: 'Strategy',      accent: 'teal' },
}

// ─── Main Component ─────────────────────────────────────

export default function OutputPreview({
  output,
  contentType,
  taskName,
  canvaLink,
  driveLink,
  platforms,
  defaultExpanded = false,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  const resolvedType = useMemo(() => {
    if (!contentType) return 'text'
    return CONTENT_TYPE_MAP[contentType] || 'text'
  }, [contentType])

  const typeInfo = CONTENT_TYPE_ICONS[resolvedType] || { icon: '\uD83D\uDCC4', label: contentType || 'Output', accent: 'gray' }

  const hasExternalLinks = canvaLink || driveLink
  const hasOutput = output && output.trim().length > 0

  if (!hasOutput && !hasExternalLinks) return null

  const renderContent = () => {
    // If it's an image/design type or has external links but no text output
    if ((resolvedType === 'image' || hasExternalLinks) && (!hasOutput || resolvedType === 'image')) {
      return <ImagePreview output={output} canvaLink={canvaLink} driveLink={driveLink} />
    }

    switch (resolvedType) {
      case 'ad':
        return <AdCopyPreview output={output} platforms={platforms} />
      case 'social':
        return <SocialPostPreview output={output} platforms={platforms} />
      case 'blog':
        return <BlogPreview output={output} />
      case 'video':
        return <VideoScriptPreview output={output} />
      case 'landing':
        return <LandingPagePreview output={output} />
      case 'email':
        return <EmailPreview output={output} />
      case 'image':
        return <ImagePreview output={output} canvaLink={canvaLink} driveLink={driveLink} />
      case 'strategy':
        return <StrategyPreview output={output} />
      default:
        return <PlainTextPreview output={output} />
    }
  }

  const isLongContent = hasOutput && output.length > 500

  return (
    <div className="space-y-2">
      {/* Header bar with type info, stats, and toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">{typeInfo.icon}</span>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
            {typeInfo.label} Output
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {hasOutput && <CopyButton text={output} variant="button" label="Copy All" />}
          {isLongContent && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] px-2 py-1 rounded bg-dark-600 text-gray-400 hover:text-gray-200 hover:bg-dark-500 transition-colors border border-dark-500"
            >
              {expanded ? 'Collapse' : 'Expand'}
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      {hasOutput && <StatsBar text={output} />}

      {/* External links (shown for all types if present, unless image type handles it) */}
      {hasExternalLinks && resolvedType !== 'image' && (
        <div className="space-y-2 mb-2">
          <LinkCard
            href={canvaLink}
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent-purple">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            }
            label="Open in Canva"
            description="Edit design in Canva"
          />
          <LinkCard
            href={driveLink}
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-accent-blue">
                <path d="M12 2L2 19.5h7.5L12 14l2.5 5.5H22L12 2z" stroke="currentColor" strokeWidth="1.5" />
              </svg>
            }
            label="Open in Google Drive"
            description="View file in Drive"
          />
        </div>
      )}

      {/* Content area — collapsible for long content */}
      {hasOutput && (
        <div className={`transition-all duration-300 ease-in-out overflow-hidden ${
          isLongContent && !expanded ? 'max-h-[300px] relative' : ''
        }`}>
          {renderContent()}

          {/* Fade overlay when collapsed */}
          {isLongContent && !expanded && (
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-dark-800 to-transparent pointer-events-none" />
          )}
        </div>
      )}

      {/* Expand button at bottom when collapsed */}
      {isLongContent && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full py-1.5 text-[10px] text-gray-500 hover:text-gray-300 bg-dark-700 hover:bg-dark-600 rounded-b-lg border border-dark-500 border-t-0 transition-colors flex items-center justify-center gap-1"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
          Show full output ({wordCount(output).toLocaleString()} words)
        </button>
      )}
    </div>
  )
}

/**
 * Compact version for use in task cards (shows just the type + snippet)
 */
export function OutputPreviewCompact({ output, contentType }) {
  const resolvedType = CONTENT_TYPE_MAP[contentType] || 'text'
  const typeInfo = CONTENT_TYPE_ICONS[resolvedType] || { icon: '\uD83D\uDCC4', label: contentType || 'Output', accent: 'gray' }

  if (!output || !output.trim()) return null

  const snippet = output.trim().substring(0, 100) + (output.length > 100 ? '...' : '')

  return (
    <div className="flex items-start gap-2 px-2 py-1.5 bg-dark-700 rounded border border-dark-500">
      <span className="text-xs flex-shrink-0">{typeInfo.icon}</span>
      <p className="text-[10px] text-gray-500 leading-relaxed line-clamp-2">{snippet}</p>
    </div>
  )
}
