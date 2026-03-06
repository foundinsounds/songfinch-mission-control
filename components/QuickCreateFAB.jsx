'use client'

import { useState, useRef, useEffect } from 'react'
import { AGENTS } from '../lib/agents'

const CONTENT_TYPES = ['Blog Post', 'Social Post', 'Email', 'Ad Copy', 'Video Script', 'Press Release', 'Newsletter']
const PRIORITIES = ['High', 'Medium', 'Low']

export default function QuickCreateFAB({ onCreateTask, agents = [] }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [form, setForm] = useState({
    name: '',
    description: '',
    contentType: '',
    priority: 'Medium',
    agent: '',
  })
  const [creating, setCreating] = useState(false)
  const panelRef = useRef(null)

  // Close on outside click
  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setIsOpen(false)
        setIsExpanded(false)
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
        setIsExpanded(false)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return

    setCreating(true)
    try {
      if (onCreateTask) {
        await onCreateTask({
          name: form.name.trim(),
          description: form.description.trim(),
          contentType: form.contentType || undefined,
          priority: form.priority,
          agent: form.agent || undefined,
          status: form.agent ? 'Assigned' : 'Inbox',
        })
      }
      setForm({ name: '', description: '', contentType: '', priority: 'Medium', agent: '' })
      setIsOpen(false)
      setIsExpanded(false)
    } finally {
      setCreating(false)
    }
  }

  const agentList = agents.length > 0 ? agents : AGENTS

  return (
    <div className="fixed bottom-20 md:bottom-14 right-4 sm:right-6 z-30" ref={panelRef}>
      {/* Expanded create form */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-[320px] sm:w-[360px] bg-dark-700 border border-dark-500 rounded-xl shadow-2xl animate-slide-down overflow-hidden">
          <form onSubmit={handleSubmit}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-dark-500 flex items-center justify-between bg-dark-800/50">
              <div className="flex items-center gap-2">
                <span className="text-sm">✨</span>
                <span className="text-xs font-semibold text-gray-200">Quick Create Task</span>
              </div>
              <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-[9px] text-gray-500 hover:text-gray-300 px-2 py-0.5 rounded bg-dark-600 transition-colors"
              >
                {isExpanded ? 'Simple' : 'Details'}
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Task name */}
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Task name..."
                aria-label="Task name"
                className="w-full px-3 py-2 bg-dark-800 border border-dark-500 rounded-lg text-[12px] text-gray-200 placeholder-gray-600 focus:outline-none focus:border-accent-orange/40 transition-colors"
                autoFocus
              />

              {/* Expanded fields */}
              {isExpanded && (
                <>
                  {/* Description */}
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Description (optional)..."
                    aria-label="Task description"
                    rows={2}
                    className="w-full px-3 py-2 bg-dark-800 border border-dark-500 rounded-lg text-[11px] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-accent-orange/40 transition-colors resize-none"
                  />

                  {/* Content Type + Priority row */}
                  <div className="flex gap-2">
                    <select
                      value={form.contentType}
                      onChange={(e) => setForm(f => ({ ...f, contentType: e.target.value }))}
                      aria-label="Content type"
                      className="flex-1 px-2 py-1.5 bg-dark-800 border border-dark-500 rounded-lg text-[11px] text-gray-400 focus:outline-none cursor-pointer"
                    >
                      <option value="">Type</option>
                      {CONTENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
                      aria-label="Priority"
                      className="flex-1 px-2 py-1.5 bg-dark-800 border border-dark-500 rounded-lg text-[11px] text-gray-400 focus:outline-none cursor-pointer"
                    >
                      {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>

                  {/* Agent assignment */}
                  <select
                    value={form.agent}
                    onChange={(e) => setForm(f => ({ ...f, agent: e.target.value }))}
                    aria-label="Assign to agent"
                    className="w-full px-2 py-1.5 bg-dark-800 border border-dark-500 rounded-lg text-[11px] text-gray-400 focus:outline-none cursor-pointer"
                  >
                    <option value="">Assign to agent (optional)</option>
                    {agentList.map(a => (
                      <option key={a.name} value={a.name}>{a.emoji} {a.name} — {a.role}</option>
                    ))}
                  </select>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-dark-500 flex items-center justify-between bg-dark-800/30">
              <span className="text-[9px] text-gray-600">
                {form.agent ? `→ ${form.agent}` : '→ Inbox'}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setIsOpen(false); setIsExpanded(false) }}
                  className="text-[10px] px-3 py-1.5 rounded-md text-gray-500 hover:text-gray-300 hover:bg-dark-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!form.name.trim() || creating}
                  className="text-[10px] px-4 py-1.5 rounded-md bg-accent-orange text-white font-semibold hover:bg-accent-orange/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* FAB Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all animate-float-up ${
          isOpen
            ? 'bg-dark-600 text-gray-400 rotate-45'
            : 'bg-accent-orange text-white hover:bg-accent-orange/90 hover:shadow-xl glow-orange'
        }`}
        title="Quick create task"
        aria-label="Quick create task"
        aria-expanded={isOpen}
      >
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </button>
    </div>
  )
}
