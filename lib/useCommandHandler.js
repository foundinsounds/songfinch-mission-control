'use client'

import { useCallback } from 'react'

/**
 * useCommandHandler — routes CommandBar commands to view navigation, handlers,
 * and modal toggles. Extracted from page.js to reduce the massive switch
 * statement footprint.
 *
 * Command categories:
 *  - view-*: switches the current view
 *  - toggle-*: toggles modals/panels
 *  - open-task: opens a task by ID
 *  - create-task: creates a task from CommandBar text
 *  - action commands: run-agents, refresh, settings
 */
export function useCommandHandler({
  setCurrentView,
  setShowCommandBar,
  setShowChat,
  setShowSettings,
  setSelectedTask,
  handleRunAgents,
  handleCreateTask,
  fetchData,
  tasks,
}) {
  const handleCommand = useCallback((command, entity) => {
    switch (command) {
      case 'open-command-bar':
        setShowCommandBar(true)
        break
      case 'run-agents':
        handleRunAgents()
        break
      case 'view-kanban':
        setCurrentView('kanban')
        break
      case 'view-list':
        setCurrentView('list')
        break
      case 'view-workflow':
        setCurrentView('workflow')
        break
      case 'view-agents':
        setCurrentView('agents')
        break
      case 'view-content':
        setCurrentView('content')
        break
      case 'view-analytics':
        setCurrentView('analytics')
        break
      case 'view-inbox':
        setCurrentView('inbox')
        break
      case 'view-calendar':
        setCurrentView('calendar')
        break
      case 'view-campaigns':
        setCurrentView('campaigns')
        break
      case 'view-approvals':
        setCurrentView('approvals')
        break
      case 'view-templates':
        setCurrentView('templates')
        break
      case 'view-scoring':
        setCurrentView('scoring')
        break
      case 'view-skills':
        setCurrentView('skills')
        break
      case 'view-batch':
        setCurrentView('batch')
        break
      case 'view-intelligence':
        setCurrentView('intelligence')
        break
      case 'view-webhooks':
        setCurrentView('webhooks')
        break
      case 'view-abtests':
        setCurrentView('abtests')
        break
      case 'toggle-chat':
        setShowChat(c => !c)
        break
      case 'settings':
        setShowSettings(true)
        break
      case 'refresh':
        fetchData()
        break
      case 'filter-review':
        setCurrentView('list')
        break
      case 'filter-done':
        setCurrentView('list')
        break
      case 'open-task':
        if (entity) {
          const task = tasks.find(t => t.id === entity)
          if (task) setSelectedTask(task)
        }
        break
      case 'create-task':
        if (entity) {
          handleCreateTask({ name: entity, status: 'Inbox', priority: 'Medium' })
        }
        break
      default:
        break
    }
  }, [handleRunAgents, handleCreateTask, fetchData, tasks, setCurrentView, setShowCommandBar, setShowChat, setShowSettings, setSelectedTask])

  return handleCommand
}
