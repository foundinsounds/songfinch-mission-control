'use client'

import { useMemo, useState, useRef, useEffect } from 'react'

/**
 * QuickFiltersBar — Horizontal filter chip bar below the search bar.
 * Provides instant filtering by agent, priority, and content type.
 * Active filters reduce the task set shown on the board.
 * Chips animate in/out with subtle transitions.
 */

const PRIORITY_OPTIONS = [
  { value: 'High', label: 'High', color: 'bg-red-500/15 text-red-400 border-red-500/25' },
  { value: 'Medium', label: 'Med', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25' },
  { value: 'Low', label: 'Low', color: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
]

const STATUS_OPTIONS = [
  { value: 'Inbox', label: 'Inbox', color: 'bg-gray-500/15 text-gray-400 border-gray-500/25' },
  { value: 'Assigned', label: 'Assigned', color: 'bg-purple-500/15 text-purple-400 border-purple-500/25' },
  { value: 'In Progress', label: 'Active', color: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  { value: 'Review', label: 'Review', color: 'bg-amber-500/15 text-amber-400 border-amber-500/25' },
  { value: 'Done', label: 'Done', color: 'bg-green-500/15 text-green-400 border-green-500/25' },
]

function FilterDropdown({ label, icon, options, selectedValues, onChange, align = 'left' }) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const hasSelection = selectedValues.length > 0

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium border transition-all ${
          hasSelection
            ? 'bg-accent-orange/10 text-accent-orange border-accent-orange/25 shadow-sm shadow-accent-orange/10'
            : 'bg-dark-700 text-gray-500 border-dark-500 hover:border-gray-500 hover:text-gray-400'
        }`}
      >
        {icon}
        <span>{label}</span>
        {hasSelection && (
          <span className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full bg-accent-orange text-white text-[8px] font-bold ml-0.5">
            {selectedValues.length}
          </span>
        )}
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className={`absolute top-full mt-1 ${align === 'right' ? 'right-0' : 'left-0'} z-50 w-40 bg-dark-700 border border-dark-500 rounded-xl shadow-2xl py-1.5 ctx-menu`}
          style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.5)' }}
        >
          {options.map(opt => {
            const active = selectedValues.includes(opt.value)
            return (
              <button
                key={opt.value}
                onClick={() => {
                  onChange(
                    active
                      ? selectedValues.filter(v => v !== opt.value)
                      : [...selectedValues, opt.value]
                  )
                }}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-[11px] rounded-md transition-colors ${
                  active
                    ? 'bg-accent-orange/10 text-accent-orange'
                    : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                  active ? 'bg-accent-orange border-accent-orange' : 'border-dark-400'
                }`}>
                  {active && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </span>
                {opt.color ? (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] border ${opt.color}`}>{opt.label}</span>
                ) : (
                  <span>{opt.label}</span>
                )}
              </button>
            )
          })}
          {selectedValues.length > 0 && (
            <>
              <div className="h-px bg-white/[0.06] my-1 mx-2" />
              <button
                onClick={() => onChange([])}
                className="w-full px-3 py-1.5 text-[10px] text-gray-500 hover:text-gray-300 transition-colors text-left"
              >
                Clear filter
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function QuickFiltersBar({ tasks, agents, filters, onFiltersChange }) {
  // Derive unique content types from current tasks
  const contentTypes = useMemo(() => {
    const types = new Set()
    tasks.forEach(t => t.contentType && types.add(t.contentType))
    return Array.from(types).sort()
  }, [tasks])

  // Build agent options from agents list
  const agentOptions = useMemo(() =>
    agents.map(a => ({ value: a.name, label: a.name, emoji: a.emoji })),
    [agents]
  )

  const contentTypeOptions = useMemo(() =>
    contentTypes.map(ct => ({ value: ct, label: ct })),
    [contentTypes]
  )

  const activeCount = (filters.agents?.length || 0) + (filters.priorities?.length || 0) + (filters.contentTypes?.length || 0) + (filters.statuses?.length || 0)

  // Active filter chips — shown inline for quick removal
  const activeChips = useMemo(() => {
    const chips = []
    filters.priorities?.forEach(p => chips.push({ type: 'priority', value: p, label: p, clear: () => onFiltersChange({ ...filters, priorities: filters.priorities.filter(v => v !== p) }) }))
    filters.agents?.forEach(a => {
      const agent = agents.find(ag => ag.name === a)
      chips.push({ type: 'agent', value: a, label: `${agent?.emoji || ''} ${a}`, clear: () => onFiltersChange({ ...filters, agents: filters.agents.filter(v => v !== a) }) })
    })
    filters.contentTypes?.forEach(ct => chips.push({ type: 'contentType', value: ct, label: ct, clear: () => onFiltersChange({ ...filters, contentTypes: filters.contentTypes.filter(v => v !== ct) }) }))
    filters.statuses?.forEach(s => chips.push({ type: 'status', value: s, label: s, clear: () => onFiltersChange({ ...filters, statuses: filters.statuses.filter(v => v !== s) }) }))
    return chips
  }, [filters, agents, onFiltersChange])

  return (
    <div className="px-3 sm:px-6 py-1.5 border-b border-dark-500/50 flex items-center gap-2 overflow-x-auto scrollbar-hide bg-dark-800/30">
      {/* Filter icon */}
      <div className="flex items-center gap-1 text-[10px] text-gray-600 shrink-0">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <span className="hidden sm:inline">Filters</span>
      </div>

      <div className="h-3 w-px bg-dark-500 shrink-0" />

      {/* Filter dropdowns */}
      <FilterDropdown
        label="Priority"
        icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>}
        options={PRIORITY_OPTIONS}
        selectedValues={filters.priorities || []}
        onChange={(vals) => onFiltersChange({ ...filters, priorities: vals })}
      />
      <FilterDropdown
        label="Agent"
        icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>}
        options={agentOptions}
        selectedValues={filters.agents || []}
        onChange={(vals) => onFiltersChange({ ...filters, agents: vals })}
      />
      <FilterDropdown
        label="Status"
        icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>}
        options={STATUS_OPTIONS}
        selectedValues={filters.statuses || []}
        onChange={(vals) => onFiltersChange({ ...filters, statuses: vals })}
      />
      {contentTypeOptions.length > 0 && (
        <FilterDropdown
          label="Type"
          icon={<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>}
          options={contentTypeOptions}
          selectedValues={filters.contentTypes || []}
          onChange={(vals) => onFiltersChange({ ...filters, contentTypes: vals })}
        />
      )}

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <>
          <div className="h-3 w-px bg-dark-500 shrink-0" />
          {activeChips.map(chip => (
            <span
              key={`${chip.type}-${chip.value}`}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-orange/10 text-accent-orange text-[9px] font-medium border border-accent-orange/20 shrink-0 animate-slide-down"
            >
              {chip.label}
              <button
                onClick={chip.clear}
                className="hover:text-white transition-colors"
              >
                <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </span>
          ))}
          <button
            onClick={() => onFiltersChange({ priorities: [], agents: [], contentTypes: [], statuses: [] })}
            className="text-[9px] text-gray-600 hover:text-gray-400 transition-colors shrink-0 ml-1"
          >
            Clear all
          </button>
        </>
      )}

      {/* Active filter count badge */}
      {activeCount > 0 && (
        <span className="ml-auto text-[9px] text-gray-600 shrink-0">
          {activeCount} filter{activeCount !== 1 ? 's' : ''} active
        </span>
      )}
    </div>
  )
}
