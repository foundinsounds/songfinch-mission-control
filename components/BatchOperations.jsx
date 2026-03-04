'use client'

import { useState, useMemo } from 'react'

export default function BatchOperations({ tasks, agents, onTaskUpdate }) {
  const [selectedTasks, setSelectedTasks] = useState(new Set())
  const [batchAction, setBatchAction] = useState('')
  const [batchAgent, setBatchAgent] = useState('')
  const [batchStatus, setBatchStatus] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterAgent, setFilterAgent] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [executing, setExecuting] = useState(false)
  const [lastResult, setLastResult] = useState(null)

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterStatus !== 'all' && t.status !== filterStatus) return false
      if (filterAgent !== 'all' && t.agent !== filterAgent) return false
      if (searchQuery && !t.name?.toLowerCase().includes(searchQuery.toLowerCase())) return false
      return true
    })
  }, [tasks, filterStatus, filterAgent, searchQuery])

  const toggleTask = (id) => {
    const next = new Set(selectedTasks)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedTasks(next)
  }

  const selectAll = () => {
    if (selectedTasks.size === filteredTasks.length) {
      setSelectedTasks(new Set())
    } else {
      setSelectedTasks(new Set(filteredTasks.map(t => t.id)))
    }
  }

  const executeBatch = async () => {
    if (selectedTasks.size === 0 || !batchAction) return
    setExecuting(true)

    const targets = tasks.filter(t => selectedTasks.has(t.id))
    let successCount = 0
    let failCount = 0

    for (const task of targets) {
      try {
        const updates = {}
        if (batchAction === 'reassign' && batchAgent) updates.agent = batchAgent
        if (batchAction === 'status' && batchStatus) updates.status = batchStatus
        if (batchAction === 'delete') updates.status = 'Archived'

        if (Object.keys(updates).length > 0 && onTaskUpdate) {
          await onTaskUpdate(task.id, updates)
          successCount++
        }
      } catch {
        failCount++
      }
    }

    setLastResult({ action: batchAction, success: successCount, fail: failCount, total: targets.length })
    setSelectedTasks(new Set())
    setExecuting(false)
  }

  const statuses = ['Inbox', 'Assigned', 'In Progress', 'Review', 'Done']

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-dark-500 flex items-center justify-between shrink-0 bg-dark-800/50">
        <h2 className="text-sm font-bold text-gray-200">Batch Operations</h2>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="text-gray-500">{filteredTasks.length} tasks</span>
          <span className="text-accent-orange">{selectedTasks.size} selected</span>
        </div>
      </div>

      {/* Filters */}
      <div className="px-4 py-2 border-b border-dark-500 flex items-center gap-3 bg-dark-800/30">
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search tasks..."
          className="bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs text-gray-200 placeholder-gray-600 w-48" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs text-gray-200">
          <option value="all">All Statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterAgent} onChange={e => setFilterAgent(e.target.value)}
          className="bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs text-gray-200">
          <option value="all">All Agents</option>
          {agents.map(a => <option key={a.id} value={a.name}>{a.emoji} {a.name}</option>)}
        </select>
      </div>

      {/* Action Bar */}
      <div className="px-4 py-2 border-b border-dark-500 flex items-center gap-3 bg-dark-700/50">
        <button onClick={selectAll}
          className="text-[10px] px-2 py-1 bg-dark-600 text-gray-400 rounded hover:text-gray-200 transition-colors">
          {selectedTasks.size === filteredTasks.length && filteredTasks.length > 0 ? 'Deselect All' : 'Select All'}
        </button>
        <div className="h-4 w-px bg-dark-500" />
        <select value={batchAction} onChange={e => setBatchAction(e.target.value)}
          className="bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs text-gray-200">
          <option value="">Choose action...</option>
          <option value="reassign">Reassign Agent</option>
          <option value="status">Change Status</option>
          <option value="delete">Archive</option>
        </select>

        {batchAction === 'reassign' && (
          <select value={batchAgent} onChange={e => setBatchAgent(e.target.value)}
            className="bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs text-gray-200">
            <option value="">Select agent...</option>
            {agents.map(a => <option key={a.id} value={a.name}>{a.emoji} {a.name}</option>)}
          </select>
        )}

        {batchAction === 'status' && (
          <select value={batchStatus} onChange={e => setBatchStatus(e.target.value)}
            className="bg-dark-600 border border-dark-500 rounded px-2 py-1 text-xs text-gray-200">
            <option value="">Select status...</option>
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        <button onClick={executeBatch}
          disabled={selectedTasks.size === 0 || !batchAction || executing}
          className={`text-[10px] px-3 py-1.5 rounded font-semibold transition-colors ${
            selectedTasks.size > 0 && batchAction
              ? 'bg-accent-orange text-dark-900 hover:bg-accent-orange/80'
              : 'bg-dark-600 text-gray-600 cursor-not-allowed'
          }`}>
          {executing ? 'Executing...' : `Apply to ${selectedTasks.size} tasks`}
        </button>
      </div>

      {/* Result Banner */}
      {lastResult && (
        <div className="px-4 py-2 bg-accent-green/10 border-b border-accent-green/20 flex items-center justify-between">
          <span className="text-[10px] text-accent-green">
            Batch {lastResult.action}: {lastResult.success}/{lastResult.total} succeeded
            {lastResult.fail > 0 && `, ${lastResult.fail} failed`}
          </span>
          <button onClick={() => setLastResult(null)} className="text-gray-500 hover:text-gray-300">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
          </button>
        </div>
      )}

      {/* Task List */}
      <div className="flex-1 overflow-y-auto">
        {filteredTasks.map(task => {
          const agent = agents.find(a => a.name === task.agent)
          const selected = selectedTasks.has(task.id)
          return (
            <div key={task.id} className={`px-4 py-2.5 border-b border-dark-500/50 flex items-center gap-3 transition-colors cursor-pointer ${
              selected ? 'bg-accent-orange/10' : 'hover:bg-dark-700/50'
            }`} onClick={() => toggleTask(task.id)}>
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                selected ? 'border-accent-orange bg-accent-orange' : 'border-dark-400'
              }`}>
                {selected && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold truncate">{task.name}</div>
                <div className="text-[10px] text-gray-500">{task.type || 'Task'}</div>
              </div>
              {agent && (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-sm">{agent.emoji}</span>
                  <span className="text-[10px] text-gray-500">{agent.name}</span>
                </div>
              )}
              <span className={`text-[9px] px-2 py-0.5 rounded-full shrink-0 ${
                task.status === 'Done' ? 'bg-green-500/20 text-green-400' :
                task.status === 'Review' ? 'bg-orange-500/20 text-orange-400' :
                task.status === 'In Progress' ? 'bg-blue-500/20 text-blue-400' :
                'bg-gray-500/20 text-gray-400'
              }`}>{task.status}</span>
            </div>
          )
        })}
        {filteredTasks.length === 0 && (
          <div className="p-8 text-center text-gray-600 text-sm">No tasks match your filters</div>
        )}
      </div>
    </div>
  )
}
