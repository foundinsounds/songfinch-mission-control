'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { AGENTS } from '../lib/agents'

const CONTENT_TYPES = ['Blog Post', 'Social Post', 'Email', 'Ad Copy', 'Video Script', 'Press Release', 'Newsletter']
const PRIORITIES = ['High', 'Medium', 'Low']

/**
 * Compute word-overlap ratio between two strings.
 * Splits both strings into lowercase word sets, returns the fraction of
 * words in the smaller set that also appear in the larger set.
 */
function wordOverlapRatio(a, b) {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter(Boolean))
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter(Boolean))
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  const [smaller, larger] = wordsA.size <= wordsB.size ? [wordsA, wordsB] : [wordsB, wordsA]
  let matches = 0
  for (const w of smaller) {
    if (larger.has(w)) matches++
  }
  return matches / smaller.size
}

/**
 * Check whether `input` is similar to `existing` using three heuristics:
 *  1. Exact match (case-insensitive)
 *  2. Substring containment (either direction)
 *  3. Word overlap > 60%
 */
function isSimilar(input, existing) {
  const a = input.toLowerCase().trim()
  const b = existing.toLowerCase().trim()
  if (!a || !b) return false
  // Exact match
  if (a === b) return true
  // Substring containment
  if (a.includes(b) || b.includes(a)) return true
  // Word overlap
  if (wordOverlapRatio(a, b) > 0.6) return true
  return false
}

/**
 * QuickCreateBar — Keyboard-optimized inline task creation bar.
 * Drops down from top of content area when triggered by 'N' shortcut.
 * Tab through fields, Enter to create, Escape to dismiss.
 * All fields in a single horizontal row for speed.
 */
export default function QuickCreateBar({ isOpen, onClose, onCreateTask, agents = [], existingTasks = [] }) {
  const [name, setName] = useState('')
  const [agent, setAgent] = useState('')
  const [priority, setPriority] = useState('Medium')
  const [contentType, setContentType] = useState('')
  const [creating, setCreating] = useState(false)
  const [similarTasks, setSimilarTasks] = useState([])
  const nameRef = useRef(null)
  const formRef = useRef(null)
  const debounceRef = useRef(null)

  const agentList = agents.length > 0 ? agents : AGENTS

  // Memoise the list of existing task names to avoid re-computing on every render
  const existingTaskNames = useMemo(
    () => existingTasks.map(t => (typeof t === 'string' ? t : t.name || '')).filter(Boolean),
    [existingTasks]
  )

  // Debounced duplicate detection — runs 300ms after the user stops typing
  useEffect(() => {
    // Clear any pending timer
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const trimmed = name.trim()
    if (!trimmed || existingTaskNames.length === 0) {
      setSimilarTasks([])
      return
    }

    debounceRef.current = setTimeout(() => {
      const matches = existingTaskNames.filter(taskName => isSimilar(trimmed, taskName))
      // De-duplicate (case-insensitive) and cap at 3
      const seen = new Set()
      const unique = []
      for (const m of matches) {
        const key = m.toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          unique.push(m)
        }
        if (unique.length >= 3) break
      }
      setSimilarTasks(unique)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [name, existingTaskNames])

  // Auto-focus name input when opened
  useEffect(() => {
    if (isOpen && nameRef.current) {
      // Small delay for animation
      const timer = setTimeout(() => nameRef.current?.focus(), 80)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [isOpen, onClose])

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault()
    if (!name.trim() || creating) return

    setCreating(true)
    try {
      if (onCreateTask) {
        await onCreateTask({
          name: name.trim(),
          contentType: contentType || undefined,
          priority,
          agent: agent || undefined,
          status: agent ? 'Assigned' : 'Inbox',
        })
      }
      // Reset form
      setName('')
      setAgent('')
      setPriority('Medium')
      setContentType('')
      setSimilarTasks([])
      onClose()
    } finally {
      setCreating(false)
    }
  }, [name, agent, priority, contentType, creating, onCreateTask, onClose])

  if (!isOpen) return null

  const selectClasses = 'bg-dark-600 border border-dark-500 rounded-md text-[11px] text-gray-300 px-2 py-1.5 focus:outline-none focus:border-accent-orange/50 focus:ring-1 focus:ring-accent-orange/20 transition-colors appearance-none cursor-pointer'

  return (
    <div
      className="overflow-hidden transition-all duration-300 ease-out"
      style={{
        maxHeight: isOpen ? (similarTasks.length > 0 ? '100px' : '60px') : '0px',
        opacity: isOpen ? 1 : 0,
      }}
    >
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="flex items-center gap-2 px-3 py-2 bg-dark-800/80 border-b border-dark-500/60 backdrop-blur-sm"
      >
        {/* Quick create indicator */}
        <div className="shrink-0 flex items-center gap-1.5">
          <div className="w-5 h-5 rounded-md bg-accent-orange/15 flex items-center justify-center">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
        </div>

        {/* Task name — auto-focused */}
        <input
          ref={nameRef}
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Task name — Tab to set fields, Enter to create"
          className="flex-1 min-w-0 bg-transparent text-[12px] text-gray-200 placeholder-gray-600 focus:outline-none"
          autoComplete="off"
        />

        {/* Agent select */}
        <select
          value={agent}
          onChange={e => setAgent(e.target.value)}
          className={`${selectClasses} w-[90px]`}
          tabIndex={0}
        >
          <option value="">Agent</option>
          {agentList.map(a => (
            <option key={a.name} value={a.name}>{a.name}</option>
          ))}
        </select>

        {/* Priority select */}
        <select
          value={priority}
          onChange={e => setPriority(e.target.value)}
          className={`${selectClasses} w-[80px]`}
          tabIndex={0}
        >
          {PRIORITIES.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {/* Content type select */}
        <select
          value={contentType}
          onChange={e => setContentType(e.target.value)}
          className={`${selectClasses} w-[100px] hidden sm:block`}
          tabIndex={0}
        >
          <option value="">Type</option>
          {CONTENT_TYPES.map(ct => (
            <option key={ct} value={ct}>{ct}</option>
          ))}
        </select>

        {/* Submit button */}
        <button
          type="submit"
          disabled={!name.trim() || creating}
          className="shrink-0 px-3 py-1.5 rounded-md bg-accent-orange/20 text-accent-orange text-[10px] font-bold
            hover:bg-accent-orange/30 disabled:opacity-30 disabled:cursor-not-allowed
            transition-colors focus:outline-none focus:ring-1 focus:ring-accent-orange/40"
        >
          {creating ? '...' : '⏎ Create'}
        </button>

        {/* Cancel */}
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 text-gray-600 hover:text-gray-400 transition-colors p-1"
          tabIndex={-1}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </form>

      {/* Duplicate-detection warning banner */}
      <div
        className="transition-all duration-200 ease-out overflow-hidden"
        style={{
          maxHeight: similarTasks.length > 0 ? '32px' : '0px',
          opacity: similarTasks.length > 0 ? 1 : 0,
        }}
      >
        <div className="px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-400 text-[10px] leading-tight truncate">
          Similar tasks exist: {similarTasks.join(', ')}
        </div>
      </div>
    </div>
  )
}
