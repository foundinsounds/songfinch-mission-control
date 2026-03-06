'use client'

import { useEffect, useMemo } from 'react'

/**
 * useKeyboardNavigation — centralizes all keyboard shortcut handling for the
 * Roundtable dashboard. Extracted from page.js to reduce component complexity.
 *
 * Two separate effects:
 *  1. Global hotkeys (?, B, M, C, G, N, Y, Shift+F) — always active unless
 *     inside an input field.
 *  2. Task-navigation keys (j/k/Enter/Escape/x/a/h/l/d) — only active on
 *     kanban/list views when no modal is open.
 */
export function useKeyboardNavigation({
  // State values
  tasks,
  focusedTaskId,
  selectedTask,
  showCommandBar,
  showSettings,
  showChat,
  currentView,
  // State setters
  setFocusedTaskId,
  setSelectedTask,
  setShowShortcuts,
  setShowBatchCreate,
  setShowMetrics,
  setShowComparison,
  setShowCalendarHeatmap,
  setShowQuickCreate,
  setShowTimeline,
  setFocusModeActive,
  // Callbacks
  toggleSelect,
  handleApproveTask,
  handleUpdateTaskStatus,
  showToast,
}) {
  // Flattened task list for keyboard navigation (column by column, left to right)
  const navigableTasks = useMemo(() => {
    const columnOrder = ['Inbox', 'Assigned', 'In Progress', 'Review', 'Done']
    const flat = []
    columnOrder.forEach(col => {
      tasks.filter(t => t.status === col).forEach(t => flat.push(t))
    })
    return flat
  }, [tasks])

  // Global hotkeys: ?, B, M, C, G, N, Y, Shift+F
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
      if (e.key === '?') {
        e.preventDefault()
        setShowShortcuts(s => !s)
      }
      if (e.key === 'b' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setShowBatchCreate(s => !s)
        showToast('⌨ B → Batch create', 'info')
      }
      if (e.key === 'm' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setShowMetrics(s => !s)
        showToast('⌨ M → Agent metrics', 'info')
      }
      if (e.key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setShowComparison(s => !s)
        showToast('⌨ C → Agent comparison', 'info')
      }
      if (e.key === 'g' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setShowCalendarHeatmap(s => !s)
        showToast('⌨ G → Content calendar heatmap', 'info')
      }
      if (e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setShowQuickCreate(s => !s)
        showToast('⌨ N → Quick create', 'info')
      }
      if (e.key === 'y' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setShowTimeline(s => !s)
        showToast('⌨ Y → Agent timeline', 'info')
      }
      if (e.key === 'F' && !e.metaKey && !e.ctrlKey && e.shiftKey) {
        e.preventDefault()
        setFocusModeActive(s => !s)
        showToast('⌨ Shift+F → Focus mode', 'info')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Task navigation: j/k/Enter/Escape/x/a/h/l/d
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
      if (selectedTask || showCommandBar || showSettings || showChat) return
      if (currentView !== 'kanban' && currentView !== 'list') return

      if (e.key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        if (navigableTasks.length === 0) return
        setFocusedTaskId(prev => {
          if (!prev) return navigableTasks[0]?.id || null
          const idx = navigableTasks.findIndex(t => t.id === prev)
          const next = Math.min(idx + 1, navigableTasks.length - 1)
          return navigableTasks[next]?.id || prev
        })
      }
      if (e.key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (navigableTasks.length === 0) return
        setFocusedTaskId(prev => {
          if (!prev) return navigableTasks[navigableTasks.length - 1]?.id || null
          const idx = navigableTasks.findIndex(t => t.id === prev)
          const next = Math.max(idx - 1, 0)
          return navigableTasks[next]?.id || prev
        })
      }
      if (e.key === 'Enter' && focusedTaskId) {
        e.preventDefault()
        const task = navigableTasks.find(t => t.id === focusedTaskId)
        if (task) setSelectedTask(task)
      }
      if (e.key === 'Escape') {
        setFocusedTaskId(null)
      }
      // x to toggle selection on focused task
      if (e.key === 'x' && focusedTaskId) {
        e.preventDefault()
        toggleSelect(focusedTaskId)
        showToast('⌨ X → Toggled selection', 'info')
      }
      // a to approve focused task (if in Review)
      if (e.key === 'a' && focusedTaskId) {
        const task = navigableTasks.find(t => t.id === focusedTaskId)
        if (task && task.status === 'Review') {
          e.preventDefault()
          handleApproveTask(task)
          showToast('⌨ A → Approved task', 'success')
        }
      }
      // h/l/]/[ or ArrowLeft/ArrowRight to cycle focused task between statuses
      if ((e.key === 'l' || e.key === ']' || e.key === 'ArrowRight') && focusedTaskId) {
        const task = navigableTasks.find(t => t.id === focusedTaskId)
        if (task) {
          const statusOrder = ['Inbox', 'Assigned', 'In Progress', 'Review', 'Done']
          const idx = statusOrder.indexOf(task.status)
          if (idx < statusOrder.length - 1) {
            e.preventDefault()
            handleUpdateTaskStatus(task, statusOrder[idx + 1])
            showToast(`⌨ → Moved to ${statusOrder[idx + 1]}`, 'info')
          }
        }
      }
      if ((e.key === 'h' || e.key === '[' || (e.key === 'ArrowLeft' && !e.metaKey)) && focusedTaskId) {
        const task = navigableTasks.find(t => t.id === focusedTaskId)
        if (task) {
          const statusOrder = ['Inbox', 'Assigned', 'In Progress', 'Review', 'Done']
          const idx = statusOrder.indexOf(task.status)
          if (idx > 0) {
            e.preventDefault()
            handleUpdateTaskStatus(task, statusOrder[idx - 1])
            showToast(`⌨ ← Moved to ${statusOrder[idx - 1]}`, 'info')
          }
        }
      }
      // d to quickly mark focused task as Done
      if (e.key === 'd' && focusedTaskId && !e.metaKey && !e.ctrlKey) {
        const task = navigableTasks.find(t => t.id === focusedTaskId)
        if (task && task.status !== 'Done') {
          e.preventDefault()
          handleUpdateTaskStatus(task, 'Done')
          showToast('⌨ D → Marked as Done', 'success')
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [navigableTasks, focusedTaskId, selectedTask, showCommandBar, showSettings, showChat, currentView, toggleSelect]) // eslint-disable-line react-hooks/exhaustive-deps

  return { navigableTasks }
}
