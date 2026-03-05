'use client'

import { useState, useCallback } from 'react'

function escapeCSV(value) {
  if (value == null) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function tasksToCSV(tasks) {
  const headers = ['ID', 'Name', 'Agent', 'Status', 'Priority', 'Content Type', 'Platform', 'Campaign', 'Tags', 'Blocked By', 'Created', 'Description']
  const rows = tasks.map(t => [
    t.id,
    t.name,
    t.agent || '',
    t.status,
    t.priority || '',
    t.contentType || '',
    Array.isArray(t.platform) ? t.platform.join('; ') : (t.platform || ''),
    t.campaign || '',
    Array.isArray(t.tags) ? t.tags.join('; ') : '',
    Array.isArray(t.blockedBy) ? t.blockedBy.join('; ') : '',
    t.createdAt || '',
    (t.description || '').slice(0, 200),
  ])

  return [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n')
}

function activityToCSV(activity) {
  const headers = ['Timestamp', 'Type', 'Agent', 'Message']
  const rows = activity.map(a => [
    a.timestamp || '',
    a.type || '',
    a.agent || '',
    a.message || '',
  ])

  return [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n')
}

function agentSummaryToCSV(tasks) {
  const agentMap = {}
  tasks.forEach(t => {
    const agent = t.agent || 'Unassigned'
    if (!agentMap[agent]) agentMap[agent] = { total: 0, done: 0, inProgress: 0, review: 0, high: 0 }
    agentMap[agent].total++
    if (t.status === 'Done') agentMap[agent].done++
    if (t.status === 'In Progress') agentMap[agent].inProgress++
    if (t.status === 'Review') agentMap[agent].review++
    if (t.priority === 'High') agentMap[agent].high++
  })

  const headers = ['Agent', 'Total Tasks', 'Done', 'In Progress', 'Review', 'High Priority', 'Completion %']
  const rows = Object.entries(agentMap).map(([name, stats]) => [
    name,
    stats.total,
    stats.done,
    stats.inProgress,
    stats.review,
    stats.high,
    stats.total > 0 ? Math.round((stats.done / stats.total) * 100) + '%' : '0%',
  ])

  return [
    headers.map(escapeCSV).join(','),
    ...rows.map(row => row.map(escapeCSV).join(','))
  ].join('\n')
}

function tasksToJSON(tasks) {
  return JSON.stringify(tasks.map(t => ({
    id: t.id,
    name: t.name,
    agent: t.agent || null,
    status: t.status,
    priority: t.priority || null,
    contentType: t.contentType || null,
    platform: t.platform || [],
    campaign: t.campaign || null,
    tags: t.tags || [],
    blockedBy: t.blockedBy || [],
    createdAt: t.createdAt || null,
    description: t.description || '',
  })), null, 2)
}

function downloadFile(content, filename, mimeType = 'text/csv;charset=utf-8;') {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function ExportButton({ tasks = [], activity = [] }) {
  const [showMenu, setShowMenu] = useState(false)
  const [exporting, setExporting] = useState(null)
  const [success, setSuccess] = useState(null)

  const showSuccess = useCallback((label) => {
    setSuccess(label)
    setTimeout(() => setSuccess(null), 2000)
  }, [])

  const handleExport = useCallback((type) => {
    setExporting(type)
    const timestamp = new Date().toISOString().slice(0, 10)

    setTimeout(() => {
      switch (type) {
        case 'tasks': {
          downloadFile(tasksToCSV(tasks), `roundtable-tasks-${timestamp}.csv`)
          showSuccess('Tasks exported')
          break
        }
        case 'tasks-json': {
          downloadFile(tasksToJSON(tasks), `roundtable-tasks-${timestamp}.json`, 'application/json')
          showSuccess('Tasks exported as JSON')
          break
        }
        case 'agents': {
          downloadFile(agentSummaryToCSV(tasks), `roundtable-agents-${timestamp}.csv`)
          showSuccess('Agent summary exported')
          break
        }
        case 'activity': {
          downloadFile(activityToCSV(activity), `roundtable-activity-${timestamp}.csv`)
          showSuccess('Activity exported')
          break
        }
        case 'all': {
          downloadFile(tasksToCSV(tasks), `roundtable-tasks-${timestamp}.csv`)
          setTimeout(() => downloadFile(activityToCSV(activity), `roundtable-activity-${timestamp}.csv`), 300)
          setTimeout(() => downloadFile(agentSummaryToCSV(tasks), `roundtable-agents-${timestamp}.csv`), 600)
          showSuccess('All data exported')
          break
        }
      }
      setExporting(null)
      setShowMenu(false)
    }, 200)
  }, [tasks, activity, showSuccess])

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="header-btn px-2 py-1.5 rounded-md flex items-center gap-1.5 text-[11px]"
        title="Export data"
      >
        {success ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        )}
        <span className="hidden sm:inline">{success || 'Export'}</span>
      </button>

      {showMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
          <div className="absolute right-0 top-full mt-1 bg-dark-700 border border-dark-500 rounded-lg shadow-xl py-1 z-50 min-w-[200px] animate-slide-down">
            <div className="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider">Export as CSV</div>

            <button
              onClick={() => handleExport('tasks')}
              disabled={exporting}
              className="w-full text-left text-[11px] px-3 py-2 text-gray-300 hover:text-white hover:bg-dark-600 transition-colors flex items-center gap-2"
            >
              <span>📋</span>
              <span>Tasks ({tasks.length})</span>
              {exporting === 'tasks' && <span className="animate-spin ml-auto text-[10px]">⏳</span>}
            </button>

            <button
              onClick={() => handleExport('agents')}
              disabled={exporting}
              className="w-full text-left text-[11px] px-3 py-2 text-gray-300 hover:text-white hover:bg-dark-600 transition-colors flex items-center gap-2"
            >
              <span>🤖</span>
              <span>Agent Summary</span>
              {exporting === 'agents' && <span className="animate-spin ml-auto text-[10px]">⏳</span>}
            </button>

            <button
              onClick={() => handleExport('activity')}
              disabled={exporting}
              className="w-full text-left text-[11px] px-3 py-2 text-gray-300 hover:text-white hover:bg-dark-600 transition-colors flex items-center gap-2"
            >
              <span>📡</span>
              <span>Activity Log ({activity.length})</span>
              {exporting === 'activity' && <span className="animate-spin ml-auto text-[10px]">⏳</span>}
            </button>

            <div className="border-t border-dark-500 my-1" />
            <div className="px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider">Other Formats</div>

            <button
              onClick={() => handleExport('tasks-json')}
              disabled={exporting}
              className="w-full text-left text-[11px] px-3 py-2 text-gray-300 hover:text-white hover:bg-dark-600 transition-colors flex items-center gap-2"
            >
              <span>{ }</span>
              <span className="font-mono">Tasks as JSON</span>
              {exporting === 'tasks-json' && <span className="animate-spin ml-auto text-[10px]">⏳</span>}
            </button>

            <div className="border-t border-dark-500 my-1" />

            <button
              onClick={() => handleExport('all')}
              disabled={exporting}
              className="w-full text-left text-[11px] px-3 py-2 text-accent-orange hover:bg-dark-600 transition-colors flex items-center gap-2 font-medium"
            >
              <span>📦</span>
              <span>Export Everything</span>
              {exporting === 'all' && <span className="animate-spin ml-auto text-[10px]">⏳</span>}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
