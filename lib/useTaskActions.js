'use client'

import { useCallback } from 'react'
import { playApproveSound, playCompleteSound, playErrorSound, playCreateSound, playStatusChangeSound } from './sounds'
import { fireConfetti } from './confetti'

/**
 * useTaskActions — encapsulates all task CRUD operations with optimistic UI,
 * API calls, sound effects, and toast notifications.
 *
 * Extracted from page.js to isolate task mutation concerns from the view layer.
 *
 * Actions provided:
 *  - handleApproveTask:       mark task as Done with content context
 *  - handleUpdateTaskStatus:  move task to any status
 *  - handleRetryTask:         reset failed task back to Assigned
 *  - handleCreateTask:        create new task with offline fallback
 *  - handleAddDependency:     add a blockedBy entry to a task
 *  - handleRemoveDependency:  remove a blockedBy entry from a task
 */
export function useTaskActions({
  setTasks,
  setSelectedTask,
  fetchData,
  showToast,
}) {
  // Approve task → Done (with content context for the API)
  const handleApproveTask = useCallback(async (task) => {
    try {
      const res = await fetch('/api/tasks/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: task.id,
          fields: { Status: 'Done' },
          taskContext: {
            output: task.output,
            contentType: task.contentType,
            platform: Array.isArray(task.platform) ? task.platform.join(', ') : (task.platform || ''),
            agent: task.agent,
            campaign: task.campaign,
          },
        }),
      })

      if (!res.ok) throw new Error('Failed to approve task')

      setTasks(prev => prev.map(t =>
        t.id === task.id ? { ...t, status: 'Done' } : t
      ))
      setSelectedTask(null)
      playApproveSound()
      fireConfetti({ particleCount: 50 })
      showToast(`"${task.name}" approved ✓`, 'success')
      setTimeout(fetchData, 1000)
      return true
    } catch (err) {
      console.error('Failed to approve task:', err)
      playErrorSound()
      showToast('Failed to approve task', 'error')
      return false
    }
  }, [setTasks, setSelectedTask, fetchData, showToast])

  // Update task to any status
  const handleUpdateTaskStatus = useCallback(async (task, newStatus) => {
    try {
      const res = await fetch('/api/tasks/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: task.id,
          fields: { Status: newStatus },
        }),
      })

      if (!res.ok) throw new Error('Failed to update task status')

      setTasks(prev => prev.map(t =>
        t.id === task.id ? { ...t, status: newStatus } : t
      ))
      if (newStatus === 'Done') {
        playCompleteSound()
        fireConfetti({ particleCount: 35 })
        showToast('Task completed ✓', 'success')
      } else {
        playStatusChangeSound()
        showToast(`Moved to ${newStatus}`, 'info')
      }
      setTimeout(fetchData, 1000)
      return true
    } catch (err) {
      console.error('Failed to update task:', err)
      playErrorSound()
      showToast('Failed to update task status', 'error')
      return false
    }
  }, [setTasks, fetchData, showToast])

  // Retry failed task → reset to Assigned
  const handleRetryTask = useCallback(async (task) => {
    try {
      const res = await fetch('/api/tasks/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recordId: task.id,
          fields: { Status: 'Assigned' },
        }),
      })

      if (!res.ok) throw new Error('Failed to retry task')

      setTasks(prev => prev.map(t =>
        t.id === task.id ? { ...t, status: 'Assigned' } : t
      ))
      playStatusChangeSound()
      showToast('Task queued for retry', 'info')
      setTimeout(fetchData, 1000)
      return true
    } catch (err) {
      console.error('Failed to retry task:', err)
      playErrorSound()
      showToast('Failed to retry task', 'error')
      return false
    }
  }, [setTasks, fetchData, showToast])

  // Create new task with offline fallback
  const handleCreateTask = useCallback(async (taskData) => {
    try {
      const res = await fetch('/api/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      })
      if (res.ok) {
        const created = await res.json()
        setTasks(prev => [{
          ...taskData,
          id: created.id || `temp-${Date.now()}`,
          createdAt: new Date().toISOString(),
        }, ...prev])
        playCreateSound()
        showToast(`Task "${taskData.name}" created`, 'success')
        setTimeout(fetchData, 1500)
      } else {
        // Fallback: add locally with temp id
        setTasks(prev => [{
          ...taskData,
          id: `temp-${Date.now()}`,
          createdAt: new Date().toISOString(),
        }, ...prev])
        playCreateSound()
        showToast('Task created locally (sync pending)', 'warning')
      }
    } catch {
      // Offline fallback
      setTasks(prev => [{
        ...taskData,
        id: `temp-${Date.now()}`,
        createdAt: new Date().toISOString(),
      }, ...prev])
      showToast('Task saved offline — will sync when online', 'warning')
    }
  }, [setTasks, fetchData, showToast])

  // Add a dependency (blockedBy) to a task
  const handleAddDependency = useCallback((taskId, depId) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t
      const existing = t.blockedBy || []
      if (existing.includes(depId)) return t
      return { ...t, blockedBy: [...existing, depId] }
    }))
    setSelectedTask(prev => {
      if (!prev || prev.id !== taskId) return prev
      const existing = prev.blockedBy || []
      if (existing.includes(depId)) return prev
      return { ...prev, blockedBy: [...existing, depId] }
    })
  }, [setTasks, setSelectedTask])

  // Remove a dependency (blockedBy) from a task
  const handleRemoveDependency = useCallback((taskId, depId) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t
      return { ...t, blockedBy: (t.blockedBy || []).filter(id => id !== depId) }
    }))
    setSelectedTask(prev => {
      if (!prev || prev.id !== taskId) return prev
      return { ...prev, blockedBy: (prev.blockedBy || []).filter(id => id !== depId) }
    })
  }, [setTasks, setSelectedTask])

  return {
    handleApproveTask,
    handleUpdateTaskStatus,
    handleRetryTask,
    handleCreateTask,
    handleAddDependency,
    handleRemoveDependency,
  }
}
