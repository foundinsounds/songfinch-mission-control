'use client'

import { useEffect, useState, useCallback } from 'react'

// ---- Shortcut Registry ----
const SHORTCUTS = [
  // Navigation
  { key: '1', label: 'Kanban view', category: 'Navigation' },
  { key: '2', label: 'List view', category: 'Navigation' },
  { key: '3', label: 'Content view', category: 'Navigation' },
  { key: '4', label: 'Agents view', category: 'Navigation' },
  { key: '5', label: 'Analytics view', category: 'Navigation' },

  // Actions
  { key: 'r', label: 'Run agents', category: 'Actions', meta: false },
  { key: 'p', label: 'Plan campaign', category: 'Actions', meta: false },
  { key: 'n', label: 'New task', category: 'Actions', meta: false },

  // UI
  { key: 'k', label: 'Command bar', category: 'UI', meta: true },
  { key: 'f', label: 'Search / filter', category: 'UI', meta: true },
  { key: 't', label: 'Toggle theme', category: 'UI', meta: false },
  { key: '?', label: 'Show shortcuts', category: 'UI', meta: false },
  { key: 'Escape', label: 'Close modal / panel', category: 'UI' },
]

/**
 * Hook for registering keyboard shortcuts with optional toast feedback.
 * @param {Object} handlers - Map of shortcut keys to handler functions
 * @param {Function} [toastFn] - Optional toast function: (message, type) => void
 * @returns {{ showHelp: boolean, setShowHelp: function }}
 */
export function useKeyboardShortcuts(handlers = {}, toastFn) {
  const [showHelp, setShowHelp] = useState(false)

  // toast with shortcut-specific styling
  const notify = useCallback((label, key, meta = false) => {
    if (!toastFn) return
    const kbd = meta ? `⌘${key.toUpperCase()}` : key.length === 1 ? key.toUpperCase() : key
    toastFn(`⌨ ${kbd} → ${label}`, 'shortcut')
  }, [toastFn])

  const handleKeyDown = useCallback((e) => {
    // Don't trigger shortcuts when typing in input/textarea
    const target = e.target
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable
    ) {
      // Only allow Escape to pass through from inputs
      if (e.key !== 'Escape') return
    }

    const isMeta = e.metaKey || e.ctrlKey
    const key = e.key

    // Show shortcut help
    if (key === '?' && !isMeta) {
      e.preventDefault()
      setShowHelp(prev => !prev)
      notify('Toggle shortcuts', '?')
      return
    }

    // Close help on Escape
    if (key === 'Escape') {
      if (showHelp) {
        setShowHelp(false)
        return
      }
      handlers.onEscape?.()
      return
    }

    // Meta + key shortcuts
    if (isMeta) {
      if (key === 'k' && handlers.onCommandBar) {
        e.preventDefault()
        handlers.onCommandBar()
        notify('Command bar', 'k', true)
        return
      }
      if (key === 'f' && handlers.onSearch) {
        e.preventDefault()
        handlers.onSearch()
        notify('Search', 'f', true)
        return
      }
    }

    // Non-meta shortcuts
    if (!isMeta && !e.altKey) {
      // Number keys for view switching
      if (['1', '2', '3', '4', '5'].includes(key) && handlers.onViewSwitch) {
        e.preventDefault()
        const viewLabels = ['Board', 'List', 'Content', 'Agents', 'Analytics']
        const views = ['kanban', 'list', 'content', 'agents', 'analytics']
        handlers.onViewSwitch(views[parseInt(key) - 1])
        notify(viewLabels[parseInt(key) - 1], key)
        return
      }

      if (key === 'r' && handlers.onRunAgents) {
        e.preventDefault()
        handlers.onRunAgents()
        notify('Run agents', 'r')
        return
      }

      if (key === 'p' && handlers.onPlanCampaign) {
        e.preventDefault()
        handlers.onPlanCampaign()
        notify('Plan campaign', 'p')
        return
      }

      if (key === 'n' && handlers.onNewTask) {
        e.preventDefault()
        handlers.onNewTask()
        notify('New task', 'n')
        return
      }

      if (key === 't' && handlers.onToggleTheme) {
        e.preventDefault()
        handlers.onToggleTheme()
        notify('Toggle theme', 't')
        return
      }
    }
  }, [handlers, showHelp, notify])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return { showHelp, setShowHelp }
}

// ---- Shortcut Help Modal ----
export function ShortcutHelpModal({ onClose }) {
  const categories = {}
  SHORTCUTS.forEach(s => {
    if (!categories[s.category]) categories[s.category] = []
    categories[s.category].push(s)
  })

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-dark-800 border border-dark-500 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 animate-slide-down"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-gray-100 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <line x1="6" y1="8" x2="6" y2="8"/>
              <line x1="10" y1="8" x2="18" y2="8"/>
              <line x1="6" y1="12" x2="18" y2="12"/>
              <line x1="6" y1="16" x2="14" y2="16"/>
            </svg>
            Keyboard Shortcuts
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          {Object.entries(categories).map(([category, shortcuts]) => (
            <div key={category}>
              <h4 className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-2">
                {category}
              </h4>
              <div className="space-y-1">
                {shortcuts.map(shortcut => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-dark-700/50 transition-colors"
                  >
                    <span className="text-[12px] text-gray-300">{shortcut.label}</span>
                    <div className="flex items-center gap-1">
                      {shortcut.meta && (
                        <kbd className="text-[10px] px-1.5 py-0.5 bg-dark-600 border border-dark-500 rounded text-gray-400 font-mono">
                          {navigator?.platform?.includes('Mac') ? '\u2318' : 'Ctrl'}
                        </kbd>
                      )}
                      <kbd className="text-[10px] px-1.5 py-0.5 bg-dark-600 border border-dark-500 rounded text-gray-400 font-mono min-w-[22px] text-center">
                        {shortcut.key === 'Escape' ? 'Esc' : shortcut.key}
                      </kbd>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-dark-500 text-center">
          <span className="text-[10px] text-gray-600">
            Press <kbd className="px-1 py-0.5 bg-dark-600 border border-dark-500 rounded text-gray-400 font-mono text-[9px]">?</kbd> to toggle this menu
          </span>
        </div>
      </div>
    </div>
  )
}

export default ShortcutHelpModal
