'use client'

import { useEffect } from 'react'

const SHORTCUT_GROUPS = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open command bar' },
      { keys: ['⌘', 'F'], description: 'Search tasks' },
      { keys: ['1'], description: 'Board view' },
      { keys: ['2'], description: 'List view' },
      { keys: ['3'], description: 'Inbox' },
      { keys: ['4'], description: 'Approvals' },
      { keys: ['5'], description: 'Analytics' },
    ],
  },
  {
    title: 'Actions',
    shortcuts: [
      { keys: ['R'], description: 'Run agents' },
      { keys: ['N'], description: 'New task' },
      { keys: ['C'], description: 'Open chat' },
      { keys: ['S'], description: 'Settings' },
      { keys: ['⌘', 'E'], description: 'Export data' },
      { keys: ['⌘', 'R'], description: 'Refresh data' },
    ],
  },
  {
    title: 'Task Navigation',
    shortcuts: [
      { keys: ['J'], description: 'Focus next task' },
      { keys: ['K'], description: 'Focus previous task' },
      { keys: ['↓'], description: 'Focus next task' },
      { keys: ['↑'], description: 'Focus previous task' },
      { keys: ['Enter'], description: 'Open focused task' },
      { keys: ['X'], description: 'Toggle select focused task' },
      { keys: ['Esc'], description: 'Clear focus / close modal' },
    ],
  },
  {
    title: 'Task Actions',
    shortcuts: [
      { keys: ['A'], description: 'Approve task (in review)' },
      { keys: ['L', ']', '→'], description: 'Move task right (next status)' },
      { keys: ['H', '[', '←'], description: 'Move task left (prev status)' },
      { keys: ['D'], description: 'Mark task as Done' },
      { keys: ['B'], description: 'Batch create from CSV' },
      { keys: ['M'], description: 'Agent metrics panel' },
      { keys: ['C'], description: 'Agent comparison view' },
      { keys: ['G'], description: 'Content calendar heatmap' },
      { keys: ['Y'], description: 'Agent timeline' },
      { keys: ['T'], description: 'Toggle theme' },
      { keys: ['⇧', 'F'], description: 'Toggle focus mode' },
    ],
  },
  {
    title: 'Quick Filters',
    shortcuts: [
      { keys: ['F', 'R'], description: 'Filter: Review' },
      { keys: ['F', 'P'], description: 'Filter: In Progress' },
      { keys: ['F', 'D'], description: 'Filter: Done' },
      { keys: ['F', 'A'], description: 'Filter: All' },
    ],
  },
]

export default function KeyboardShortcutModal({ isOpen, onClose }) {
  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handler = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-dark-700 border border-dark-500 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden animate-slide-down">
        {/* Header */}
        <div className="px-5 py-4 border-b border-dark-500 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-orange/15 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M6 16h12" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-100">Keyboard Shortcuts</h2>
              <p className="text-[10px] text-gray-500">Press <kbd className="px-1 py-0.5 bg-dark-600 rounded text-[9px] text-gray-400 font-mono">?</kbd> to toggle this panel</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 p-1 rounded-lg hover:bg-dark-600 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[60vh] p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {SHORTCUT_GROUPS.map(group => (
              <div key={group.title}>
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2.5">
                  {group.title}
                </h3>
                <div className="space-y-1.5">
                  {group.shortcuts.map(shortcut => (
                    <div
                      key={shortcut.description}
                      className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-dark-600/50 transition-colors"
                    >
                      <span className="text-[11px] text-gray-300">{shortcut.description}</span>
                      <div className="flex items-center gap-0.5">
                        {shortcut.keys.map((key, i) => (
                          <span key={i}>
                            <kbd className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 bg-dark-600 border border-dark-500 rounded text-[10px] text-gray-400 font-mono font-medium shadow-sm">
                              {key}
                            </kbd>
                            {i < shortcut.keys.length - 1 && (
                              <span className="text-[9px] text-gray-600 mx-0.5">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-dark-500 flex items-center justify-between bg-dark-800/30">
          <span className="text-[9px] text-gray-600">Tip: Most shortcuts work when no input is focused</span>
          <button
            onClick={onClose}
            className="text-[10px] px-3 py-1 rounded-md bg-dark-600 text-gray-400 hover:text-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
