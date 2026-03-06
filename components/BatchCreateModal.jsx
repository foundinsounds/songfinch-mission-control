'use client'

import { useState, useRef, useCallback } from 'react'

const EXAMPLE_CSV = `Task Name,Priority,Agent,Content Type
Q2 Social Campaign,High,MUSE,Social Post
Blog: Industry Trends,Medium,STORY,Blog Post
Newsletter May Edition,Low,,Newsletter`

/**
 * BatchCreateModal — Paste CSV/TSV data to create multiple tasks at once.
 * Supports both comma and tab delimiters (auto-detected).
 * Preview table shows parsed rows before submission.
 */
export default function BatchCreateModal({ isOpen, onClose, onCreateTask }) {
  const [rawInput, setRawInput] = useState('')
  const [parsedRows, setParsedRows] = useState([])
  const [parseError, setParseError] = useState(null)
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState(0)
  const textareaRef = useRef(null)

  // Parse CSV/TSV input
  const parseInput = useCallback((text) => {
    if (!text.trim()) {
      setParsedRows([])
      setParseError(null)
      return
    }

    try {
      const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length === 0) { setParsedRows([]); return }

      // Auto-detect delimiter: tab vs comma
      const firstLine = lines[0]
      const delimiter = firstLine.includes('\t') ? '\t' : ','

      // Check if first line looks like a header
      const firstCells = firstLine.split(delimiter).map(c => c.trim().toLowerCase())
      const headerKeywords = ['name', 'task', 'title', 'priority', 'agent', 'type', 'content', 'description', 'status']
      const isHeader = firstCells.some(c => headerKeywords.some(k => c.includes(k)))

      const dataLines = isHeader ? lines.slice(1) : lines
      const headers = isHeader
        ? firstLine.split(delimiter).map(h => h.trim())
        : null

      // Map column indices to fields
      let nameIdx = 0, priorityIdx = -1, agentIdx = -1, typeIdx = -1

      if (headers) {
        headers.forEach((h, i) => {
          const hl = h.toLowerCase()
          if (hl.includes('name') || hl.includes('task') || hl.includes('title')) nameIdx = i
          if (hl.includes('priority')) priorityIdx = i
          if (hl.includes('agent')) agentIdx = i
          if (hl.includes('type') || hl.includes('content')) typeIdx = i
        })
      }

      const rows = dataLines.map((line, idx) => {
        const cells = line.split(delimiter).map(c => c.trim())
        const name = cells[nameIdx] || ''
        const priority = priorityIdx >= 0 ? (cells[priorityIdx] || 'Medium') : 'Medium'
        const agent = agentIdx >= 0 ? (cells[agentIdx] || '') : ''
        const contentType = typeIdx >= 0 ? (cells[typeIdx] || '') : ''

        return {
          id: idx,
          name,
          priority: ['High', 'Medium', 'Low'].includes(priority) ? priority : 'Medium',
          agent,
          contentType,
          valid: name.length > 0,
        }
      }).filter(r => r.name.trim().length > 0)

      setParsedRows(rows)
      setParseError(rows.length === 0 ? 'No valid tasks found. Each row needs at least a task name.' : null)
    } catch (err) {
      setParseError('Could not parse input. Use CSV or tab-separated format.')
      setParsedRows([])
    }
  }, [])

  const handlePaste = useCallback((e) => {
    // Let the paste happen, then parse
    setTimeout(() => {
      const text = e.target.value
      parseInput(text)
    }, 0)
  }, [parseInput])

  const handleChange = useCallback((e) => {
    setRawInput(e.target.value)
    parseInput(e.target.value)
  }, [parseInput])

  const handleLoadExample = useCallback(() => {
    setRawInput(EXAMPLE_CSV)
    parseInput(EXAMPLE_CSV)
  }, [parseInput])

  const handleRemoveRow = useCallback((id) => {
    setParsedRows(prev => prev.filter(r => r.id !== id))
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!onCreateTask || parsedRows.length === 0) return
    setCreating(true)
    setCreated(0)

    for (let i = 0; i < parsedRows.length; i++) {
      const row = parsedRows[i]
      try {
        await onCreateTask({
          name: row.name,
          priority: row.priority,
          agent: row.agent || undefined,
          contentType: row.contentType || undefined,
          status: row.agent ? 'Assigned' : 'Inbox',
        })
        setCreated(i + 1)
      } catch (err) {
        console.error('Batch create error:', err)
      }
    }

    setCreating(false)
    // Reset and close after a brief delay to show completion
    setTimeout(() => {
      setRawInput('')
      setParsedRows([])
      setCreated(0)
      onClose()
    }, 800)
  }, [parsedRows, onCreateTask, onClose])

  if (!isOpen) return null

  const validRows = parsedRows.filter(r => r.valid)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="batch-create-title">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-dark-800 border border-dark-500 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-slide-down" style={{ boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-dark-500 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">📋</span>
            <div>
              <h2 id="batch-create-title" className="text-sm font-semibold text-gray-200">Batch Create Tasks</h2>
              <p className="text-[10px] text-gray-500 mt-0.5">Paste CSV or tab-separated data to create multiple tasks</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 transition-colors p-1" aria-label="Close batch create modal">
            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Input area */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] text-gray-400 font-medium">Paste your data</label>
              <button
                onClick={handleLoadExample}
                className="text-[10px] text-accent-blue hover:text-accent-blue/80 transition-colors"
              >
                Load example
              </button>
            </div>
            <textarea
              ref={textareaRef}
              value={rawInput}
              onChange={handleChange}
              onPaste={handlePaste}
              placeholder={`Paste CSV or tab-separated data here...\n\nFormat: Task Name, Priority, Agent, Content Type\n(Only task name is required)`}
              rows={5}
              className="w-full px-3 py-2.5 bg-dark-900 border border-dark-500 rounded-xl text-[11px] text-gray-200 placeholder-gray-600 font-mono focus:outline-none focus:border-accent-orange/40 focus:ring-1 focus:ring-accent-orange/20 transition-all resize-none"
              autoFocus
            />
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[9px] text-gray-600">Supports: CSV, TSV (tab-separated), spreadsheet paste</span>
              {parseError && <span className="text-[9px] text-red-400">{parseError}</span>}
            </div>
          </div>

          {/* Preview table */}
          {parsedRows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] text-gray-400 font-medium">
                  Preview ({validRows.length} task{validRows.length !== 1 ? 's' : ''})
                </span>
                {creating && (
                  <span className="text-[10px] text-accent-green font-medium">
                    Creating {created}/{validRows.length}...
                  </span>
                )}
              </div>
              <div className="border border-dark-500 rounded-xl overflow-hidden">
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="bg-dark-700/80 border-b border-dark-500">
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold w-[40%]">Name</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold w-[15%]">Priority</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold w-[20%]">Agent</th>
                      <th className="text-left px-3 py-2 text-gray-500 font-semibold w-[20%]">Type</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.map((row, i) => (
                      <tr
                        key={row.id}
                        className={`border-b border-dark-500/50 last:border-b-0 ${
                          creating && i < created ? 'bg-accent-green/5' : 'hover:bg-dark-700/30'
                        } transition-colors`}
                      >
                        <td className="px-3 py-1.5 text-gray-200 font-medium">{row.name}</td>
                        <td className="px-3 py-1.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            row.priority === 'High' ? 'bg-red-500/15 text-red-400' :
                            row.priority === 'Low' ? 'bg-blue-500/15 text-blue-400' :
                            'bg-yellow-500/15 text-yellow-400'
                          }`}>
                            {row.priority}
                          </span>
                        </td>
                        <td className="px-3 py-1.5 text-gray-400">{row.agent || '—'}</td>
                        <td className="px-3 py-1.5 text-gray-400">{row.contentType || '—'}</td>
                        <td className="px-1">
                          {!creating && (
                            <button
                              onClick={() => handleRemoveRow(row.id)}
                              className="text-gray-600 hover:text-red-400 transition-colors p-1"
                              title="Remove row"
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            </button>
                          )}
                          {creating && i < created && (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-accent-green mx-auto">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-dark-500 flex items-center justify-between shrink-0 bg-dark-800/50">
          <span className="text-[10px] text-gray-600">
            {validRows.length > 0
              ? `${validRows.length} task${validRows.length !== 1 ? 's' : ''} ready to create`
              : 'Paste data above to get started'
            }
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="text-[11px] px-4 py-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-dark-600 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={validRows.length === 0 || creating}
              className="text-[11px] px-5 py-1.5 rounded-lg bg-accent-orange text-white font-semibold hover:bg-accent-orange/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? `Creating ${created}/${validRows.length}...` : `Create ${validRows.length} Task${validRows.length !== 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
