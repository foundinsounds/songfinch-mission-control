'use client'

import { useState, useRef, useEffect, memo } from 'react'

const SearchBar = memo(function SearchBar({ value, onChange, resultCount, totalCount }) {
  const inputRef = useRef(null)

  // Cmd/Ctrl+F focuses the search bar
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        // Don't hijack browser find if already focused on an input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const hasQuery = value && value.length > 0
  const isFiltered = hasQuery && resultCount !== totalCount

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-dark-500 bg-dark-800/40">
      {/* Search icon */}
      <svg
        width="14" height="14" viewBox="0 0 24 24" fill="none"
        stroke={hasQuery ? '#f97316' : '#6b7280'} strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round"
        className="shrink-0 transition-colors"
      >
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>

      {/* Input */}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search tasks… (⌘F)"
        className="flex-1 bg-transparent text-xs text-gray-200 placeholder-gray-600 outline-none border-none"
      />

      {/* Result count */}
      {hasQuery && (
        <span className={`text-[10px] font-mono shrink-0 ${isFiltered ? 'text-accent-orange' : 'text-gray-500'}`}>
          {resultCount}/{totalCount}
        </span>
      )}

      {/* Clear button */}
      {hasQuery && (
        <button
          onClick={() => onChange('')}
          className="text-gray-500 hover:text-gray-300 p-0.5 rounded transition-colors shrink-0"
          title="Clear search"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  )
})

export default SearchBar
