'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

const COMMANDS = [
  { key: 'create-task', label: 'Create Task', desc: 'Add a new task to the queue', icon: '+', category: 'tasks' },
  { key: 'run-agents', label: 'Run Agents', desc: 'Trigger all assigned agents', icon: '\u25B6', category: 'agents' },
  { key: 'view-kanban', label: 'View Board', desc: 'Switch to kanban board', icon: '\u25A6', category: 'navigation' },
  { key: 'view-list', label: 'View List', desc: 'Switch to list view', icon: '\u2630', category: 'navigation' },
  { key: 'view-agents', label: 'View Agents', desc: 'Switch to agent overview', icon: '\u{1F916}', category: 'navigation' },
  { key: 'view-content', label: 'View Content', desc: 'Switch to content library', icon: '\u{1F4C4}', category: 'navigation' },
  { key: 'view-analytics', label: 'View Analytics', desc: 'Open performance dashboard', icon: '\u{1F4CA}', category: 'navigation' },
  { key: 'settings', label: 'Settings', desc: 'Open settings panel', icon: '\u2699', category: 'system' },
  { key: 'refresh', label: 'Refresh Data', desc: 'Force sync from Airtable', icon: '\u21BB', category: 'system' },
  { key: 'find-task', label: 'Find Task', desc: 'Search tasks by name', icon: '\u{1F50D}', category: 'tasks' },
  { key: 'filter-review', label: 'Show Review Tasks', desc: 'Filter to tasks needing review', icon: '\u{1F440}', category: 'tasks' },
  { key: 'filter-done', label: 'Show Done Tasks', desc: 'Filter to completed tasks', icon: '\u2705', category: 'tasks' },
]

// NLP-style parsing: extract intent and entities from natural language input
function parseNaturalLanguage(input) {
  const lower = input.toLowerCase().trim()

  // Create task: "create a blog post about X" / "new task: X" / "add task for SCOUT"
  const createMatch = lower.match(/^(?:create|add|new|make)\s+(?:a\s+)?(?:task|content|post|article|blog|ad|video|script)?\s*(?:about|for|called|named|:)?\s*(.+)?$/i)
  if (createMatch) {
    return { command: 'create-task', entity: createMatch[1]?.trim() || '' }
  }

  // Run agents: "run agents" / "start agents" / "process tasks"
  if (/^(?:run|start|trigger|execute|process)\s+(?:agents?|tasks?|queue)/.test(lower)) {
    return { command: 'run-agents' }
  }

  // Navigation: "show kanban" / "go to list" / "open agents" / "analytics"
  if (/(?:show|go\s+to|open|view|switch\s+to)?\s*(?:kanban|board)/.test(lower)) return { command: 'view-kanban' }
  if (/(?:show|go\s+to|open|view|switch\s+to)?\s*list/.test(lower)) return { command: 'view-list' }
  if (/(?:show|go\s+to|open|view|switch\s+to)?\s*agents?/.test(lower)) return { command: 'view-agents' }
  if (/(?:show|go\s+to|open|view|switch\s+to)?\s*content/.test(lower)) return { command: 'view-content' }
  if (/(?:show|go\s+to|open|view|switch\s+to)?\s*(?:analytics|stats|dashboard|performance|metrics)/.test(lower)) return { command: 'view-analytics' }

  // Settings
  if (/(?:open|show)?\s*settings/.test(lower)) return { command: 'settings' }

  // Refresh
  if (/(?:refresh|sync|reload|update)\s*(?:data)?/.test(lower)) return { command: 'refresh' }

  // Find/search
  const findMatch = lower.match(/(?:find|search|look\s+for|where\s+is)\s+(?:task\s+)?(.+)/)
  if (findMatch) return { command: 'find-task', entity: findMatch[1].trim() }

  // Filter by status
  if (/(?:show|filter|only)?\s*(?:review|pending\s+review|needs?\s+review)/.test(lower)) return { command: 'filter-review' }
  if (/(?:show|filter|only)?\s*(?:done|completed|finished|approved)/.test(lower)) return { command: 'filter-done' }

  // Assign agent: "assign SCOUT to X"
  const assignMatch = lower.match(/assign\s+(\w+)\s+to\s+(.+)/)
  if (assignMatch) return { command: 'assign-agent', entity: `${assignMatch[1]}: ${assignMatch[2]}` }

  return null
}

export default function CommandBar({
  isOpen,
  onClose,
  onCommand,
  tasks = [],
}) {
  const [input, setInput] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef(null)

  // Filter commands based on input
  const filteredCommands = input.trim()
    ? COMMANDS.filter(c =>
        c.label.toLowerCase().includes(input.toLowerCase()) ||
        c.desc.toLowerCase().includes(input.toLowerCase()) ||
        c.key.includes(input.toLowerCase())
      )
    : COMMANDS

  // Also check for NLP match
  const nlpResult = input.trim() ? parseNaturalLanguage(input) : null

  // Task search results when searching for a task
  const taskResults = (nlpResult?.command === 'find-task' && nlpResult.entity)
    ? tasks.filter(t => t.name.toLowerCase().includes(nlpResult.entity.toLowerCase())).slice(0, 5)
    : []

  // Focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
      setInput('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (isOpen) {
          onClose()
        } else {
          onCommand('open-command-bar')
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose, onCommand])

  const handleKeyDown = useCallback((e) => {
    const totalItems = filteredCommands.length + taskResults.length
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(prev => (prev + 1) % Math.max(totalItems, 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev - 1 + Math.max(totalItems, 1)) % Math.max(totalItems, 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      // Check if NLP parsed something directly
      if (nlpResult && filteredCommands.length === 0) {
        onCommand(nlpResult.command, nlpResult.entity)
        onClose()
        return
      }
      // Check task results
      if (selectedIndex >= filteredCommands.length && taskResults.length > 0) {
        const task = taskResults[selectedIndex - filteredCommands.length]
        onCommand('open-task', task.id)
        onClose()
        return
      }
      // Command results
      if (filteredCommands[selectedIndex]) {
        onCommand(filteredCommands[selectedIndex].key)
        onClose()
      }
    }
  }, [filteredCommands, taskResults, selectedIndex, nlpResult, onCommand, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Command Bar */}
      <div className="relative w-full max-w-lg bg-dark-700 border border-dark-400 rounded-xl shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center px-4 py-3 border-b border-dark-500">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 mr-3 shrink-0">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => { setInput(e.target.value); setSelectedIndex(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or describe what you want..."
            className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none"
          />
          <kbd className="text-[9px] text-gray-600 bg-dark-800 px-1.5 py-0.5 rounded border border-dark-500 ml-2">ESC</kbd>
        </div>

        {/* NLP Intent Banner */}
        {nlpResult && filteredCommands.length === 0 && (
          <div className="px-4 py-2 bg-accent-blue/10 border-b border-dark-500 flex items-center gap-2">
            <span className="text-[10px] text-accent-blue font-semibold">Understood:</span>
            <span className="text-[11px] text-gray-300">
              {nlpResult.command.replace(/-/g, ' ')}{nlpResult.entity ? ` "${nlpResult.entity}"` : ''}
            </span>
            <span className="text-[9px] text-gray-500 ml-auto">Press Enter to execute</span>
          </div>
        )}

        {/* Results */}
        <div className="max-h-72 overflow-y-auto py-1">
          {/* Command Results */}
          {filteredCommands.map((cmd, i) => (
            <button
              key={cmd.key}
              onClick={() => { onCommand(cmd.key); onClose() }}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                selectedIndex === i ? 'bg-dark-600' : 'hover:bg-dark-600/50'
              }`}
            >
              <span className="w-7 h-7 rounded-lg bg-dark-800 border border-dark-500 flex items-center justify-center text-xs">
                {cmd.icon}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-gray-200 font-medium">{cmd.label}</div>
                <div className="text-[10px] text-gray-500">{cmd.desc}</div>
              </div>
              <span className="text-[9px] text-gray-600 uppercase tracking-wider shrink-0">{cmd.category}</span>
            </button>
          ))}

          {/* Task Search Results */}
          {taskResults.length > 0 && (
            <>
              <div className="px-4 py-1.5 text-[9px] text-gray-600 uppercase tracking-wider border-t border-dark-500 mt-1">
                Tasks matching "{nlpResult?.entity}"
              </div>
              {taskResults.map((task, i) => (
                <button
                  key={task.id}
                  onClick={() => { onCommand('open-task', task.id); onClose() }}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    selectedIndex === filteredCommands.length + i ? 'bg-dark-600' : 'hover:bg-dark-600/50'
                  }`}
                >
                  <span className="w-7 h-7 rounded-lg bg-dark-800 border border-dark-500 flex items-center justify-center text-[10px]">
                    {task.status === 'Done' ? '\u2705' : task.status === 'Review' ? '\u{1F440}' : '\u{1F4CB}'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-200 truncate">{task.name}</div>
                    <div className="text-[10px] text-gray-500">{task.agent} &middot; {task.status}</div>
                  </div>
                </button>
              ))}
            </>
          )}

          {/* No Results */}
          {filteredCommands.length === 0 && taskResults.length === 0 && !nlpResult && (
            <div className="px-4 py-8 text-center">
              <div className="text-sm text-gray-500">No matching commands</div>
              <div className="text-[10px] text-gray-600 mt-1">Try describing what you want in plain English</div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-dark-500 flex items-center justify-between">
          <div className="flex items-center gap-3 text-[9px] text-gray-600">
            <span className="flex items-center gap-1">
              <kbd className="bg-dark-800 px-1 py-0.5 rounded border border-dark-500">\u2191\u2193</kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="bg-dark-800 px-1 py-0.5 rounded border border-dark-500">\u21B5</kbd>
              Execute
            </span>
          </div>
          <span className="text-[9px] text-gray-600 flex items-center gap-1">
            <kbd className="bg-dark-800 px-1 py-0.5 rounded border border-dark-500">\u2318K</kbd>
            Toggle
          </span>
        </div>
      </div>
    </div>
  )
}
