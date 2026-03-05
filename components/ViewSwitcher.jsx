'use client'

import { useState, useRef, useEffect } from 'react'

const PRIMARY_VIEWS = [
  { key: 'kanban', label: 'Board' },
  { key: 'list', label: 'List' },
  { key: 'inbox', label: 'Inbox' },
  { key: 'approvals', label: 'Approvals' },
  { key: 'calendar', label: 'Calendar' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'timeline', label: 'Timeline' },
  { key: 'analytics', label: 'Analytics' },
]

const MORE_VIEWS = [
  { key: 'agents', label: 'Agent Activity' },
  { key: 'content', label: 'Content Library' },
  { key: 'templates', label: 'Templates' },
  { key: 'abtests', label: 'A/B Tests' },
  { key: 'scoring', label: 'Scoring' },
  { key: 'skills', label: 'Skills' },
  { key: 'batch', label: 'Batch Ops' },
  { key: 'intelligence', label: 'Intelligence' },
  { key: 'workload', label: 'Workload' },
  { key: 'webhooks', label: 'Webhooks' },
]

export default function ViewSwitcher({ currentView, onViewChange, inReview = 0, inboxCount = 0 }) {
  const [showMore, setShowMore] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowMore(false)
      }
    }
    if (showMore) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showMore])

  const isMoreActive = MORE_VIEWS.some(v => v.key === currentView)

  const getBadge = (key) => {
    if (key === 'approvals' && inReview > 0) return inReview
    return null
  }

  return (
    <div className="px-2 sm:px-4 py-1.5 border-b border-dark-500 flex items-center gap-0.5 shrink-0 bg-dark-800/30 overflow-x-auto scrollbar-hide">
      {PRIMARY_VIEWS.map((view) => {
        const badge = getBadge(view.key)
        return (
          <button
            key={view.key}
            onClick={() => onViewChange(view.key)}
            className={`text-[11px] px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap ${
              currentView === view.key
                ? 'bg-accent-orange/15 text-accent-orange font-semibold'
                : 'text-gray-500 hover:text-gray-300 hover:bg-dark-600'
            }`}
          >
            {view.label}
            {badge > 0 && (
              <span className="bg-red-500 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold leading-none">{badge}</span>
            )}
          </button>
        )
      })}

      {/* Separator */}
      <div className="w-px h-4 bg-dark-500 mx-1" />

      {/* More dropdown */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setShowMore(!showMore)}
          className={`text-[11px] px-3 py-1.5 rounded-md transition-all flex items-center gap-1 whitespace-nowrap ${
            isMoreActive
              ? 'bg-accent-orange/15 text-accent-orange font-semibold'
              : 'text-gray-500 hover:text-gray-300 hover:bg-dark-600'
          }`}
        >
          {isMoreActive ? MORE_VIEWS.find(v => v.key === currentView)?.label : 'More'}
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className={`transition-transform ${showMore ? 'rotate-180' : ''}`}>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {showMore && (
          <div className="absolute top-full left-0 mt-1 bg-dark-700 border border-dark-500 rounded-lg shadow-xl py-1 z-50 min-w-[180px]">
            {MORE_VIEWS.map((view) => (
              <button
                key={view.key}
                onClick={() => {
                  onViewChange(view.key)
                  setShowMore(false)
                }}
                className={`w-full text-left text-[11px] px-3 py-2 transition-colors ${
                  currentView === view.key
                    ? 'text-accent-orange bg-accent-orange/10'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-dark-600'
                }`}
              >
                {view.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
