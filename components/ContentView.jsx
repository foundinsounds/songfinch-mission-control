'use client'

import { useState, useEffect } from 'react'
import { AGENTS } from '../lib/agents'

const STATUS_STYLES = {
  'Draft': 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  'Review': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  'Approved': 'bg-green-500/10 text-green-400 border-green-500/20',
  'Published': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
}

const TYPE_COLORS = {
  'Ad Copy': 'text-purple-400',
  'Social Post': 'text-blue-400',
  'Video Script': 'text-red-400',
  'Blog Post': 'text-green-400',
  'Landing Page': 'text-yellow-400',
  'Artist Spotlight': 'text-orange-400',
  'SEO Content': 'text-teal-400',
  'Strategy': 'text-pink-400',
  'General': 'text-gray-400',
}

export default function ContentView() {
  const [content, setContent] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedItem, setSelectedItem] = useState(null)
  const [filterType, setFilterType] = useState('All')

  useEffect(() => {
    fetchContent()
  }, [])

  async function fetchContent() {
    try {
      const res = await fetch('/api/content')
      if (res.ok) {
        const data = await res.json()
        setContent(data.content || [])
      }
    } catch (err) {
      console.warn('Failed to fetch content:', err.message)
    } finally {
      setLoading(false)
    }
  }

  const contentTypes = ['All', ...new Set(content.map(c => c.contentType).filter(Boolean))]
  const filtered = filterType === 'All' ? content : content.filter(c => c.contentType === filterType)

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-6 h-6 border-2 border-accent-orange border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-sm text-gray-500">Loading content library...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-dark-500 flex items-center justify-between shrink-0 bg-dark-800/50">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-300">{filtered.length} items</span>
          <span className="text-gray-600">|</span>
          <div className="flex gap-1 flex-wrap">
            {contentTypes.map((type) => (
              <button
                key={type}
                onClick={() => setFilterType(type)}
                className={`text-[10px] px-2 py-1 rounded-full transition-all ${
                  filterType === type
                    ? 'bg-accent-orange/20 text-accent-orange border border-accent-orange/30'
                    : 'bg-dark-600 text-gray-500 border border-transparent hover:text-gray-300'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-3xl mb-3">&#128196;</div>
            <p className="text-sm text-gray-500">No content generated yet</p>
            <p className="text-xs text-gray-600 mt-1">Run agents to populate the content library</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((item) => {
              const agent = item.agent ? AGENTS.find(a => a.name === item.agent) : null

              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
                  className="task-card bg-dark-700 rounded-lg border border-dark-500 p-4 cursor-pointer hover:border-dark-400 transition-colors"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-2">
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${TYPE_COLORS[item.contentType] || 'text-gray-400'}`}>
                      {item.contentType || 'General'}
                    </span>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${STATUS_STYLES[item.status] || 'bg-dark-600 text-gray-400 border-dark-500'}`}>
                      {item.status}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-semibold text-gray-100 leading-tight mb-2">
                    {item.title}
                  </h3>

                  {/* Preview */}
                  <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-3 mb-3">
                    {item.body?.substring(0, 200)}
                  </p>

                  {/* Meta */}
                  <div className="flex items-center justify-between">
                    {agent ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{agent.emoji}</span>
                        <span className="text-[11px] text-gray-400">{agent.name}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-gray-600">{item.agent || '—'}</span>
                    )}
                    {item.platform && (
                      <span className="text-[10px] text-gray-600">{item.platform}</span>
                    )}
                  </div>

                  {/* Expanded Content */}
                  {selectedItem?.id === item.id && (
                    <div className="mt-3 pt-3 border-t border-dark-500">
                      <div className="bg-dark-900 rounded-lg p-3 border border-dark-500 max-h-64 overflow-y-auto">
                        <pre className="text-[11px] text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                          {item.body}
                        </pre>
                      </div>
                      {item.headline && (
                        <div className="mt-2">
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Headline: </span>
                          <span className="text-[11px] text-gray-300">{item.headline}</span>
                        </div>
                      )}
                      {item.cta && (
                        <div className="mt-1">
                          <span className="text-[10px] text-gray-500 uppercase tracking-wider">CTA: </span>
                          <span className="text-[11px] text-gray-300">{item.cta}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
