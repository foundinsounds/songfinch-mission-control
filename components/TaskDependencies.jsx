'use client'

import { useMemo, useState } from 'react'

/**
 * Check if a task is blocked by unfinished dependencies.
 * A task is "blocked" if any of its blockedBy tasks are not in 'Done' status.
 */
export function isTaskBlocked(task, allTasks) {
  if (!task.blockedBy || task.blockedBy.length === 0) return false
  return task.blockedBy.some(depId => {
    const dep = allTasks.find(t => t.id === depId)
    return dep && dep.status !== 'Done'
  })
}

/**
 * Get all blocking tasks that are not yet done.
 */
export function getBlockingTasks(task, allTasks) {
  if (!task.blockedBy || task.blockedBy.length === 0) return []
  return task.blockedBy
    .map(depId => allTasks.find(t => t.id === depId))
    .filter(t => t && t.status !== 'Done')
}

/**
 * Get all tasks that depend on this task (downstream).
 */
export function getDependentTasks(task, allTasks) {
  return allTasks.filter(t => t.blockedBy && t.blockedBy.includes(task.id))
}

/**
 * Validate no circular dependencies when adding a new dep.
 */
export function wouldCreateCycle(taskId, newDepId, allTasks, visited = new Set()) {
  if (taskId === newDepId) return true
  if (visited.has(newDepId)) return false
  visited.add(newDepId)

  const depTask = allTasks.find(t => t.id === newDepId)
  if (!depTask || !depTask.blockedBy) return false

  return depTask.blockedBy.some(id => wouldCreateCycle(taskId, id, allTasks, visited))
}

/**
 * Inline "Blocked" badge for task cards.
 */
export function BlockedBadge({ task, allTasks }) {
  const blocking = useMemo(() => getBlockingTasks(task, allTasks), [task, allTasks])
  if (blocking.length === 0) return null

  return (
    <span
      className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20"
      title={`Blocked by: ${blocking.map(t => t.name).join(', ')}`}
    >
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
      </svg>
      Blocked ({blocking.length})
    </span>
  )
}

/**
 * "Unblocks X" badge — shows when completing this task will unblock others.
 */
export function UnblocksBadge({ task, allTasks }) {
  const dependents = useMemo(() => getDependentTasks(task, allTasks), [task, allTasks])
  if (dependents.length === 0) return null

  return (
    <span
      className="inline-flex items-center gap-1 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-accent-blue/10 text-accent-blue border border-accent-blue/20"
      title={`Completing this unblocks: ${dependents.map(t => t.name).join(', ')}`}
    >
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <polyline points="13 17 18 12 13 7" />
        <polyline points="6 17 11 12 6 7" />
      </svg>
      Unblocks {dependents.length}
    </span>
  )
}

/**
 * DependencyChainBadge — Shows the total depth of the dependency chain
 * upstream (how many steps to no-deps) + downstream (how many steps to leaf).
 * Only renders when chain is 2+ deep.
 */
export function DependencyChainBadge({ task, allTasks }) {
  const chainLength = useMemo(() => {
    // Walk upstream (blockedBy) counting max depth
    function upDepth(t, visited = new Set()) {
      if (!t || !t.blockedBy || t.blockedBy.length === 0 || visited.has(t.id)) return 0
      visited.add(t.id)
      return 1 + Math.max(...t.blockedBy.map(id => {
        const dep = allTasks.find(x => x.id === id)
        return upDepth(dep, visited)
      }))
    }
    // Walk downstream (dependents) counting max depth
    function downDepth(t, visited = new Set()) {
      if (!t || visited.has(t.id)) return 0
      visited.add(t.id)
      const deps = allTasks.filter(x => x.blockedBy && x.blockedBy.includes(t.id))
      if (deps.length === 0) return 0
      return 1 + Math.max(...deps.map(d => downDepth(d, visited)))
    }
    return upDepth(task) + downDepth(task)
  }, [task, allTasks])

  if (chainLength < 2) return null

  return (
    <span
      className="inline-flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20"
      title={`Part of a ${chainLength}-step dependency chain`}
    >
      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
      </svg>
      Chain {chainLength}
    </span>
  )
}

/**
 * Full dependency view for the TaskModal — shows blocking + dependent tasks.
 */
export default function TaskDependencies({ task, allTasks = [], onAddDependency, onRemoveDependency }) {
  const [showPicker, setShowPicker] = useState(false)
  const [search, setSearch] = useState('')

  const blocking = useMemo(() => getBlockingTasks(task, allTasks), [task, allTasks])
  const completedDeps = useMemo(() => {
    if (!task.blockedBy) return []
    return task.blockedBy
      .map(id => allTasks.find(t => t.id === id))
      .filter(t => t && t.status === 'Done')
  }, [task, allTasks])
  const dependents = useMemo(() => getDependentTasks(task, allTasks), [task, allTasks])

  // Available tasks to link as dependencies (exclude self + existing deps + tasks that would create cycles)
  const availableTasks = useMemo(() => {
    if (!showPicker) return []
    const existingDeps = new Set(task.blockedBy || [])
    return allTasks.filter(t =>
      t.id !== task.id &&
      !existingDeps.has(t.id) &&
      !wouldCreateCycle(task.id, t.id, allTasks) &&
      (search === '' || t.name.toLowerCase().includes(search.toLowerCase()))
    )
  }, [showPicker, task, allTasks, search])

  const hasDeps = (task.blockedBy && task.blockedBy.length > 0) || dependents.length > 0

  return (
    <div className="space-y-3">
      {/* Blocked by */}
      {(blocking.length > 0 || completedDeps.length > 0) && (
        <div>
          <h4 className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5">Depends On</h4>
          <div className="space-y-1">
            {blocking.map(dep => (
              <div key={dep.id} className="flex items-center gap-2 p-2 rounded-lg bg-red-500/5 border border-red-500/15">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                <span className="text-[11px] text-red-300 flex-1 truncate">{dep.name}</span>
                <span className="text-[9px] text-red-400/60 font-mono">{dep.status}</span>
                {onRemoveDependency && (
                  <button
                    onClick={() => onRemoveDependency(dep.id)}
                    className="text-red-400/40 hover:text-red-400 text-xs"
                    title="Remove dependency"
                  >×</button>
                )}
              </div>
            ))}
            {completedDeps.map(dep => (
              <div key={dep.id} className="flex items-center gap-2 p-2 rounded-lg bg-dark-600 border border-dark-500 opacity-60">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-[11px] text-gray-400 flex-1 truncate line-through">{dep.name}</span>
                <span className="text-[9px] text-accent-green font-mono">Done</span>
                {onRemoveDependency && (
                  <button
                    onClick={() => onRemoveDependency(dep.id)}
                    className="text-gray-600 hover:text-gray-400 text-xs"
                    title="Remove dependency"
                  >×</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Dependents (downstream) */}
      {dependents.length > 0 && (
        <div>
          <h4 className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold mb-1.5">Blocks</h4>
          <div className="space-y-1">
            {dependents.map(dep => (
              <div key={dep.id} className="flex items-center gap-2 p-2 rounded-lg bg-dark-600 border border-dark-500">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-accent-blue shrink-0">
                  <polyline points="13 17 18 12 13 7" />
                  <polyline points="6 17 11 12 6 7" />
                </svg>
                <span className="text-[11px] text-gray-300 flex-1 truncate">{dep.name}</span>
                <span className="text-[9px] text-gray-500 font-mono">{dep.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add dependency button */}
      {onAddDependency && (
        <div>
          {!showPicker ? (
            <button
              onClick={() => setShowPicker(true)}
              className="text-[10px] text-gray-500 hover:text-accent-orange transition-colors flex items-center gap-1"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Add dependency
            </button>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                placeholder="Search tasks..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
                className="w-full text-[11px] px-3 py-1.5 rounded-md bg-dark-800 border border-dark-500 text-gray-200 placeholder-gray-600 focus:border-accent-orange/40 focus:outline-none"
              />
              <div className="max-h-32 overflow-y-auto space-y-1">
                {availableTasks.slice(0, 8).map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      onAddDependency(t.id)
                      setShowPicker(false)
                      setSearch('')
                    }}
                    className="w-full text-left flex items-center gap-2 p-1.5 rounded bg-dark-600 hover:bg-dark-500 transition-colors"
                  >
                    <span className="text-[11px] text-gray-300 truncate flex-1">{t.name}</span>
                    <span className="text-[9px] text-gray-500 font-mono shrink-0">{t.status}</span>
                  </button>
                ))}
                {availableTasks.length === 0 && (
                  <div className="text-[10px] text-gray-600 text-center py-2">No matching tasks</div>
                )}
              </div>
              <button
                onClick={() => { setShowPicker(false); setSearch('') }}
                className="text-[9px] text-gray-600 hover:text-gray-400"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      {!hasDeps && !showPicker && (
        <div className="text-[10px] text-gray-600 italic">No dependencies</div>
      )}
    </div>
  )
}
