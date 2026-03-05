'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { AGENTS as FALLBACK_AGENTS } from '../lib/agents'
import { MOCK_TASKS, MOCK_ACTIVITY } from '../lib/mockData'
import { GOOGLE_DRIVE_FOLDER, AIRTABLE_BASE_URL, VERSION, COUNCIL_NAME } from '../lib/constants'
import AgentSidebar from '../components/AgentSidebar'
import AgentConfigPanel from '../components/AgentConfigPanel'
import KanbanBoard from '../components/KanbanBoard'
import ListView from '../components/ListView'
import ContentView from '../components/ContentView'
import LiveFeed from '../components/LiveFeed'
import StatsHeader from '../components/StatsHeader'
import TaskModal from '../components/TaskModal'
import SettingsPanel from '../components/SettingsPanel'
import AgentActivityView from '../components/AgentActivityView'
import AnalyticsDashboard from '../components/AnalyticsDashboard'
import CommandBar from '../components/CommandBar'
import AgentChat from '../components/AgentChat'
import CampaignPlanner from '../components/CampaignPlanner'
import CampaignTimeline from '../components/CampaignTimeline'
import ApprovalWorkflow from '../components/ApprovalWorkflow'
import AgentScoring from '../components/AgentScoring'
import TemplateLibrary from '../components/TemplateLibrary'
import WebhookManager from '../components/WebhookManager'
import ContentCalendar from '../components/ContentCalendar'
import AgentSkills from '../components/AgentSkills'
import BatchOperations from '../components/BatchOperations'
import SmartInbox from '../components/SmartInbox'
import ABTestPipeline from '../components/ABTestPipeline'
import CouncilIntelligence from '../components/CouncilIntelligence'
import ViewSwitcher from '../components/ViewSwitcher'
import ExportButton from '../components/ExportButton'
import NotificationCenter from '../components/NotificationCenter'
import MobileBottomNav from '../components/MobileBottomNav'
import QuickCreateFAB from '../components/QuickCreateFAB'
import KeyboardShortcutModal from '../components/KeyboardShortcutModal'
import BatchCreateModal from '../components/BatchCreateModal'
import WelcomeState from '../components/WelcomeState'
import AgentHealthSparklines from '../components/AgentHealthSparklines'
import BulkActions, { useTaskSelection } from '../components/BulkActions'
import AgentWorkloadBalancer from '../components/AgentWorkloadBalancer'
import ViewTransition from '../components/ViewTransition'
import SearchBar from '../components/SearchBar'
import QuickFiltersBar from '../components/QuickFiltersBar'
import FooterSparkline from '../components/FooterSparkline'
import ScrollToTop from '../components/ScrollToTop'
import Breadcrumb from '../components/Breadcrumb'
import PipelineStatusBadge from '../components/PipelineStatusBadge'
import FaviconBadge from '../components/FaviconBadge'
import AgentMetrics from '../components/AgentMetrics'
import AgentComparison from '../components/AgentComparison'
import ContentCalendarHeatmap from '../components/ContentCalendarHeatmap'
import QuickCreateBar from '../components/QuickCreateBar'
import AgentTimeline from '../components/AgentTimeline'
import TaskContextMenu from '../components/TaskContextMenu'
import FocusMode from '../components/FocusMode'
import ProductivityScore from '../components/ProductivityScore'
import { useURLState } from '../lib/useURLState'
import { playApproveSound, playCompleteSound, playErrorSound, playCreateSound, playDropSound, playStatusChangeSound } from '../lib/sounds'
import { checkEscalations } from '../lib/escalation'
import { fireConfetti } from '../lib/confetti'
import { useToast } from '../components/ToastProvider'

export default function Roundtable() {
  const showToast = useToast()
  const [agents, setAgents] = useState(FALLBACK_AGENTS)
  const [tasks, setTasks] = useState(MOCK_TASKS)
  const [activity, setActivity] = useState(MOCK_ACTIVITY)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [configAgent, setConfigAgent] = useState(null)
  const [selectedTask, setSelectedTask] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [feedFilter, setFeedFilter] = useState('All')
  const [dataSource, setDataSource] = useState('loading')
  const [lastSync, setLastSync] = useState(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [runningAgents, setRunningAgents] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCommandBar, setShowCommandBar] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [currentView, setCurrentView] = useState('kanban')
  const [feedCollapsed, setFeedCollapsed] = useState(false)
  const [planningCampaign, setPlanningCampaign] = useState(false)
  const [mobileSidebar, setMobileSidebar] = useState(false)
  const [mobileFeed, setMobileFeed] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [showBatchCreate, setShowBatchCreate] = useState(false)
  const [showMetrics, setShowMetrics] = useState(false)
  const [showComparison, setShowComparison] = useState(false)
  const [showCalendarHeatmap, setShowCalendarHeatmap] = useState(false)
  const [showQuickCreate, setShowQuickCreate] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)
  const [focusModeActive, setFocusModeActive] = useState(false)
  const [contextMenu, setContextMenu] = useState(null) // { x, y, task }
  const [focusedTaskId, setFocusedTaskId] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [quickFilters, setQuickFilters] = useState({ priorities: [], agents: [], contentTypes: [], statuses: [] })

  // Auto-refresh polling interval (ms) — configurable, default 30s
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(30000)

  // Task selection for bulk operations
  const { selectedIds, toggleSelect, selectAll, deselectAll, isSelected } = useTaskSelection()

  // Persist view/filter state to URL search params
  useURLState(
    {
      view: [currentView, setCurrentView],
      agent: [selectedAgent, setSelectedAgent],
      feed: [feedFilter, setFeedFilter],
    },
    { view: 'kanban', agent: null, feed: 'All' }
  )

  // Settings revision counter — bumped when localStorage changes
  const [settingsRev, setSettingsRev] = useState(0)

  // Listen for settings changes (from SettingsPanel in same tab)
  useEffect(() => {
    const handler = () => setSettingsRev(r => r + 1)
    window.addEventListener('roundtable-settings-changed', handler)
    return () => window.removeEventListener('roundtable-settings-changed', handler)
  }, [])

  // Theme state
  const [theme, setTheme] = useState('dark')

  // Initialize theme from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('roundtable-theme') || 'dark'
    setTheme(saved)
    document.documentElement.setAttribute('data-theme', saved)
  }, [])

  // Toggle theme
  const toggleTheme = useCallback(() => {
    setTheme(prev => {
      const next = prev === 'dark' ? 'light' : 'dark'
      localStorage.setItem('roundtable-theme', next)
      document.documentElement.setAttribute('data-theme', next)
      if (next === 'light') {
        document.documentElement.classList.add('light')
      } else {
        document.documentElement.classList.remove('light')
      }
      return next
    })
  }, [])

  // Fetch live data from Airtable
  const fetchData = useCallback(async () => {
    // Skip polling when tab is hidden to save API calls
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return

    setIsSyncing(true)
    try {
      const res = await fetch('/api/data')
      if (!res.ok) throw new Error('API error')
      const data = await res.json()

      if (data.agents && data.agents.length > 0) {
        // Merge: Airtable agents + any fallback agents not in Airtable
        const airtableNames = new Set(data.agents.map(a => a.name))
        const missing = FALLBACK_AGENTS.filter(a => !airtableNames.has(a.name))
        setAgents([...data.agents, ...missing])
      }

      // Always accept the Airtable tasks — even if empty.
      // Only fall back to mock data on network / API errors (catch block).
      if (data.tasks) {
        if (data.tasks.length > 0) {
          setTasks(checkEscalations(data.tasks))
          setDataSource('airtable')
        } else {
          setTasks([])
          setDataSource('airtable-empty')
        }
      }

      if (data.activity && data.activity.length > 0) {
        setActivity(data.activity)
      }

      setLastSync(new Date())
    } catch (err) {
      console.warn('Airtable fetch failed, using mock data:', err.message)
      setDataSource('mock')
    } finally {
      setIsSyncing(false)
    }
  }, [])

  // Read settings from localStorage
  const getSettings = useCallback(() => {
    if (typeof window === 'undefined') return { autoRunAgents: true, runInterval: 15, pollInterval: 10 }
    try {
      const saved = localStorage.getItem('roundtable-settings')
      if (saved) return { autoRunAgents: true, runInterval: 15, pollInterval: 10, ...JSON.parse(saved) }
    } catch {}
    return { autoRunAgents: true, runInterval: 15, pollInterval: 10 }
  }, [])

  // Initial fetch + visibility-aware auto-polling
  useEffect(() => {
    fetchData()

    let poller = null

    function startPolling() {
      stopPolling()
      if (autoRefreshInterval > 0) {
        poller = setInterval(fetchData, autoRefreshInterval)
      }
    }

    function stopPolling() {
      if (poller) {
        clearInterval(poller)
        poller = null
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        stopPolling()
      } else {
        // Refresh immediately when tab becomes visible, then resume polling
        fetchData()
        startPolling()
      }
    }

    startPolling()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      stopPolling()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchData, autoRefreshInterval])

  // Auto-run agents on configured interval
  useEffect(() => {
    function checkAndRun() {
      const settings = getSettings()
      if (!settings.autoRunAgents) return

      // Run agents automatically
      fetch('/api/cron/run-agents')
        .then(res => res.json())
        .then(data => {
          console.log('[Roundtable] Auto-run result:', data)
          setTimeout(fetchData, 2000)
        })
        .catch(err => console.error('[Roundtable] Auto-run failed:', err))
    }

    const settings = getSettings()
    if (!settings.autoRunAgents) return

    // Run immediately on enable, then on interval
    checkAndRun()
    const intervalMs = (settings.runInterval || 60) * 60 * 1000
    const runner = setInterval(checkAndRun, intervalMs)
    return () => clearInterval(runner)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getSettings, fetchData, settingsRev])

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Handle agent config update (optimistic UI)
  const handleAgentUpdate = useCallback((updatedAgent) => {
    setAgents(prev => prev.map(a => a.id === updatedAgent.id ? { ...a, ...updatedAgent } : a))
  }, [])

  // Handle task approval
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
  }, [fetchData, showToast])

  // Handle task status update
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
      if (newStatus === 'Done') { playCompleteSound(); fireConfetti({ particleCount: 35 }); showToast(`Task completed ✓`, 'success') }
      else { playStatusChangeSound(); showToast(`Moved to ${newStatus}`, 'info') }
      setTimeout(fetchData, 1000)
      return true
    } catch (err) {
      console.error('Failed to update task:', err)
      playErrorSound()
      showToast('Failed to update task status', 'error')
      return false
    }
  }, [fetchData, showToast])

  // Retry failed task — reset to Assigned and re-trigger
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
  }, [fetchData, showToast])

  // Dependency management — add/remove blockedBy entries
  const handleAddDependency = useCallback((taskId, depId) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t
      const existing = t.blockedBy || []
      if (existing.includes(depId)) return t
      return { ...t, blockedBy: [...existing, depId] }
    }))
    // Update selected task if it's the one being modified
    setSelectedTask(prev => {
      if (!prev || prev.id !== taskId) return prev
      const existing = prev.blockedBy || []
      if (existing.includes(depId)) return prev
      return { ...prev, blockedBy: [...existing, depId] }
    })
  }, [])

  const handleRemoveDependency = useCallback((taskId, depId) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== taskId) return t
      return { ...t, blockedBy: (t.blockedBy || []).filter(id => id !== depId) }
    }))
    setSelectedTask(prev => {
      if (!prev || prev.id !== taskId) return prev
      return { ...prev, blockedBy: (prev.blockedBy || []).filter(id => id !== depId) }
    })
  }, [])

  // Run Agents — trigger the cron endpoint manually
  const handleRunAgents = useCallback(async () => {
    setRunningAgents(true)
    try {
      const res = await fetch('/api/cron/run-agents')
      const data = await res.json()
      console.log('[Roundtable] Agent run result:', data)
      showToast('Agents dispatched', 'success')
      // Refresh data after agents run
      setTimeout(fetchData, 2000)
    } catch (err) {
      console.error('Failed to run agents:', err)
      showToast('Failed to run agents', 'error')
    } finally {
      setTimeout(() => setRunningAgents(false), 3000)
    }
  }, [fetchData, showToast])

  // Plan Campaign — trigger CMO content planner
  const handlePlanCampaign = useCallback(async () => {
    setPlanningCampaign(true)
    try {
      const res = await fetch('/api/campaigns/plan', { method: 'POST' })
      const data = await res.json()
      console.log('[Roundtable] Campaign plan result:', data)
      showToast('Campaign plan created', 'success')
      setTimeout(fetchData, 2000)
    } catch (err) {
      console.error('Failed to plan campaign:', err)
      showToast('Failed to plan campaign', 'error')
    } finally {
      setTimeout(() => setPlanningCampaign(false), 3000)
    }
  }, [fetchData, showToast])

  // Quick-create task handler (from FAB)
  const handleCreateTask = useCallback(async (taskData) => {
    try {
      const res = await fetch('/api/tasks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData),
      })
      if (res.ok) {
        const created = await res.json()
        // Optimistically add to local state
        setTasks(prev => [{ ...taskData, id: created.id || `temp-${Date.now()}`, createdAt: new Date().toISOString() }, ...prev])
        playCreateSound()
        showToast(`Task "${taskData.name}" created`, 'success')
        setTimeout(fetchData, 1500)
      } else {
        // Fallback: add locally with temp id
        setTasks(prev => [{ ...taskData, id: `temp-${Date.now()}`, createdAt: new Date().toISOString() }, ...prev])
        playCreateSound()
        showToast('Task created locally (sync pending)', 'warning')
      }
    } catch {
      // Offline fallback
      setTasks(prev => [{ ...taskData, id: `temp-${Date.now()}`, createdAt: new Date().toISOString() }, ...prev])
      showToast('Task saved offline — will sync when online', 'warning')
    }
  }, [fetchData, showToast])

  // Welcome state action handler
  const handleWelcomeAction = useCallback((action) => {
    switch (action) {
      case 'create-task': setShowCommandBar(true); break
      case 'run-agents': handleRunAgents(); break
      case 'plan-campaign': handlePlanCampaign(); break
      case 'view-analytics': setCurrentView('analytics'); break
      default: break
    }
  }, [handleRunAgents, handlePlanCampaign])

  // ? key opens shortcut cheatsheet
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
  }, [])

  // Flattened task list for keyboard navigation (column by column, left to right)
  const navigableTasks = useMemo(() => {
    const columnOrder = ['Inbox', 'Assigned', 'In Progress', 'Review', 'Done']
    const flat = []
    columnOrder.forEach(col => {
      tasks.filter(t => t.status === col).forEach(t => flat.push(t))
    })
    return flat
  }, [tasks])

  // j/k/Enter/Escape keyboard navigation
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
  }, [navigableTasks, focusedTaskId, selectedTask, showCommandBar, showSettings, showChat, currentView, toggleSelect])

  // Command Bar handler
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
        // Select review tasks by filtering
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
        // Command bar task creation — create task with entity as name
        if (entity) {
          handleCreateTask({ name: entity, status: 'Inbox', priority: 'Medium' })
        }
        break
      default:
        console.log('[Command]', command, entity)
    }
  }, [handleRunAgents, handleCreateTask, fetchData, tasks])

  // Search filter + quick filters across all task fields
  const filteredTasks = useMemo(() => {
    let result = tasks

    // Apply quick filters first
    const { priorities, agents: agentFilters, contentTypes, statuses } = quickFilters
    if (priorities?.length > 0) {
      result = result.filter(t => priorities.includes(t.priority))
    }
    if (agentFilters?.length > 0) {
      result = result.filter(t => t.agent && agentFilters.includes(t.agent))
    }
    if (contentTypes?.length > 0) {
      result = result.filter(t => t.contentType && contentTypes.includes(t.contentType))
    }
    if (statuses?.length > 0) {
      result = result.filter(t => t.status && statuses.includes(t.status))
    }

    // Fuzzy search — token-based scoring with typo tolerance
    if (searchQuery && searchQuery.trim().length > 0) {
      const rawQ = searchQuery.trim().toLowerCase()
      const tokens = rawQ.split(/\s+/).filter(Boolean)

      // Character-sequence fuzzy match: do all chars of pattern appear in order in str?
      const fuzzyMatch = (str, pattern) => {
        let si = 0, pi = 0
        while (si < str.length && pi < pattern.length) {
          if (str[si] === pattern[pi]) pi++
          si++
        }
        return pi === pattern.length
      }

      // Score a single token against a single field value (0 = no match)
      const scoreToken = (field, token) => {
        if (!field) return 0
        const f = field.toLowerCase()
        if (f === token) return 100          // exact field match
        if (f.startsWith(token)) return 80   // starts with
        if (f.includes(token)) return 60     // substring
        if (token.length >= 2 && fuzzyMatch(f, token)) return 30 // fuzzy sequence
        return 0
      }

      // Score a task: sum of best-field scores per token
      const scoreTask = (t) => {
        const fields = [
          t.name, t.description, t.agent, t.status,
          t.priority, t.contentType, t.campaign, t.platform,
          ...(t.tags || [])
        ]
        let total = 0
        for (const token of tokens) {
          let best = 0
          for (const f of fields) {
            const s = scoreToken(f, token)
            if (s > best) best = s
          }
          if (best === 0) return 0 // all tokens must match something
          total += best
        }
        return total
      }

      const scored = result.map(t => ({ task: t, score: scoreTask(t) }))
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
      result = scored.map(s => s.task)
    }

    return result
  }, [tasks, searchQuery, quickFilters])

  // Generate pseudo-historical sparkline trends from current task data
  const generateSparkTrend = useCallback((current, seed = 0, volatility = 0.35) => {
    const pts = 8
    const result = []
    // Deterministic seed so sparklines don't jitter on re-render
    let s = seed + 7
    const rand = () => { s = (s * 16807 + 0) % 2147483647; return (s % 1000) / 1000 }
    // Start from a plausible past value and converge to current
    let val = Math.max(0, current * (0.4 + rand() * 0.6))
    for (let i = 0; i < pts; i++) {
      result.push(Math.round(val))
      const progress = i / (pts - 1)
      const target = current
      val = val + (target - val) * (0.15 + progress * 0.3) + (rand() - 0.5) * current * volatility
      val = Math.max(0, val)
    }
    result[pts - 1] = current // ensure last point matches exactly
    return result
  }, [])

  const stats = {
    agentsActive: agents.filter(a => a.status === 'Working' || a.status === 'Active').length,
    totalAgents: agents.length,
    tasksInQueue: tasks.filter(t => t.status !== 'Done').length,
    tasksTotal: tasks.length,
    inReview: tasks.filter(t => t.status === 'Review').length,
    completed: tasks.filter(t => t.status === 'Done').length,
    contentPieces: tasks.filter(t => t.status === 'Done').length,
  }

  const sparklines = useMemo(() => ({
    queue: generateSparkTrend(stats.tasksInQueue, 1),
    review: generateSparkTrend(stats.inReview, 2),
    done: generateSparkTrend(stats.completed, 3, 0.25),
    content: generateSparkTrend(stats.contentPieces, 4, 0.25),
  }), [stats.tasksInQueue, stats.inReview, stats.completed, stats.contentPieces, generateSparkTrend])

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <FaviconBadge tasks={tasks} />
      {/* Top Header Bar */}
      <StatsHeader
        stats={stats}
        sparklines={sparklines}
        currentTime={currentTime}
        dataSource={dataSource}
        lastSync={lastSync}
        isSyncing={isSyncing}
        onRefresh={fetchData}
        theme={theme}
        onToggleTheme={toggleTheme}
        onRunAgents={handleRunAgents}
        runningAgents={runningAgents}
        onPlanCampaign={handlePlanCampaign}
        planningCampaign={planningCampaign}
        onOpenSettings={() => setShowSettings(true)}
        onOpenMetrics={() => setShowMetrics(true)}
        onOpenComparison={() => setShowComparison(true)}
        onOpenCalendarHeatmap={() => setShowCalendarHeatmap(true)}
        onOpenTimeline={() => setShowTimeline(true)}
        onToggleFocusMode={() => setFocusModeActive(s => !s)}
        focusModeActive={focusModeActive}
        onToggleSidebar={() => setMobileSidebar(s => !s)}
        onToggleFeed={() => setMobileFeed(f => !f)}
        notificationSlot={<NotificationCenter tasks={tasks} activity={activity} />}
        pipelineSlot={<PipelineStatusBadge />}
        productivitySlot={<ProductivityScore tasks={tasks} activity={activity} />}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Mobile Sidebar Overlay */}
        {mobileSidebar && (
          <div className="md:hidden mobile-sidebar-overlay" onClick={() => setMobileSidebar(false)} />
        )}

        {/* Agent Sidebar — hidden on mobile unless toggled */}
        <div className={`${mobileSidebar ? 'mobile-sidebar block' : 'hidden'} md:block`}>
          <AgentSidebar
            agents={agents}
            selectedAgent={selectedAgent}
            onSelectAgent={(name) => { setSelectedAgent(selectedAgent === name ? null : name); setMobileSidebar(false) }}
            onConfigAgent={(agent) => { setConfigAgent(agent); setMobileSidebar(false) }}
            tasks={tasks}
          />
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Breadcrumb Navigation Trail */}
          <Breadcrumb
            currentView={currentView}
            selectedAgent={selectedAgent}
            selectedTask={selectedTask}
            onNavigate={({ view, agent, task }) => {
              if (view) setCurrentView(view)
              setSelectedAgent(agent || null)
              if (task === null) setSelectedTask(null)
            }}
          />

          {/* View Switcher — Primary tabs + More dropdown */}
          <ViewSwitcher currentView={currentView} onViewChange={setCurrentView} inReview={stats.inReview} inboxCount={tasks.filter(t => t.status !== 'Done' && t.status !== 'Archived').length} />

          {/* Quick Create Bar — inline keyboard-driven task creation */}
          <QuickCreateBar
            isOpen={showQuickCreate}
            onClose={() => setShowQuickCreate(false)}
            onCreateTask={handleCreateTask}
            agents={agents}
            existingTasks={tasks}
          />

          {/* Global Search Bar */}
          {(currentView === 'kanban' || currentView === 'list') && (
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              resultCount={filteredTasks.length}
              totalCount={tasks.length}
            />
          )}

          {/* Quick Filters Bar */}
          {(currentView === 'kanban' || currentView === 'list') && (
            <QuickFiltersBar
              tasks={tasks}
              agents={agents}
              filters={quickFilters}
              onFiltersChange={setQuickFilters}
            />
          )}

          {/* View Content */}
          <ViewTransition viewKey={currentView} className="flex-1 overflow-auto">
            {currentView === 'kanban' && (
              filteredTasks.length === 0 ? (
                <WelcomeState agents={agents} onAction={handleWelcomeAction} dataSource={dataSource} onRefresh={fetchData} />
              ) : (
                <KanbanBoard
                  tasks={filteredTasks}
                  allTasks={tasks}
                  agents={agents}
                  selectedAgent={selectedAgent}
                  onTaskClick={setSelectedTask}
                  onQuickApprove={handleApproveTask}
                  onRequestChanges={(task) => setSelectedTask(task)}
                  onRetry={handleRetryTask}
                  onStatusChange={handleUpdateTaskStatus}
                  isTaskSelected={isSelected}
                  onToggleTaskSelect={toggleSelect}
                  focusedTaskId={focusedTaskId}
                  loading={dataSource === 'loading'}
                  onCreateTask={handleCreateTask}
                  searchQuery={searchQuery}
                  onReorderTasks={(columnStatus, reorderedIds) => {
                    // Reorder is managed internally by KanbanBoard via localStorage.
                    // This callback allows parent to sync order to an external store if needed.
                  }}
                  onTaskContextMenu={(e, task) => setContextMenu({ x: e.clientX, y: e.clientY, task })}
                />
              )
            )}
            {currentView === 'list' && (
              <ListView
                tasks={filteredTasks}
                agents={agents}
                selectedAgent={selectedAgent}
                onTaskClick={setSelectedTask}
                onQuickApprove={handleApproveTask}
                onRetry={handleRetryTask}
              />
            )}
            {currentView === 'agents' && (
              <div className="space-y-0">
                {/* Agent health sparklines strip */}
                <div className="px-4 py-2 border-b border-dark-500 bg-dark-800/30">
                  <AgentHealthSparklines agents={agents} tasks={tasks} compact />
                </div>
                <AgentActivityView
                  agents={agents}
                  tasks={tasks}
                  activity={activity}
                  onAgentClick={(agent) => setConfigAgent(agent)}
                />
              </div>
            )}
            {currentView === 'content' && (
              <ContentView />
            )}
            {currentView === 'inbox' && (
              <SmartInbox tasks={tasks} agents={agents} onTaskClick={setSelectedTask} />
            )}
            {currentView === 'calendar' && (
              <ContentCalendar tasks={tasks} agents={agents} onTaskClick={setSelectedTask} onRefresh={fetchData} />
            )}
            {currentView === 'campaigns' && (
              <CampaignPlanner tasks={tasks} agents={agents} />
            )}
            {currentView === 'timeline' && (
              <CampaignTimeline
                tasks={filteredTasks}
                onSelectTask={setSelectedTask}
                onFilterByCampaign={(campaign) => {
                  setSearchQuery(campaign)
                  setCurrentView('kanban')
                }}
              />
            )}
            {currentView === 'approvals' && (
              <ApprovalWorkflow tasks={tasks} agents={agents} onTaskClick={setSelectedTask} onApprove={handleApproveTask} />
            )}
            {currentView === 'templates' && (
              <TemplateLibrary />
            )}
            {currentView === 'abtests' && (
              <ABTestPipeline agents={agents} />
            )}
            {currentView === 'scoring' && (
              <AgentScoring agents={agents} tasks={tasks} activity={activity} />
            )}
            {currentView === 'skills' && (
              <AgentSkills agents={agents} />
            )}
            {currentView === 'batch' && (
              <BatchOperations tasks={tasks} agents={agents} onTaskUpdate={async (id, updates) => {
                try {
                  const res = await fetch('/api/tasks/update', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ recordId: id, fields: updates }),
                  })
                  if (!res.ok) throw new Error('Update failed')
                  setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t))
                  return true
                } catch { return false }
              }} />
            )}
            {currentView === 'intelligence' && (
              <CouncilIntelligence agents={agents} tasks={tasks} activity={activity} />
            )}
            {currentView === 'workload' && (
              <AgentWorkloadBalancer tasks={tasks} agents={agents} />
            )}
            {currentView === 'webhooks' && (
              <WebhookManager />
            )}
            {currentView === 'analytics' && (
              <div className="space-y-0">
                <AnalyticsDashboard
                  agents={agents}
                  tasks={tasks}
                  activity={activity}
                  onConfigAgent={(agent) => setConfigAgent(agent)}
                />
                {/* Full agent health sparklines at bottom */}
                <div className="px-4 py-4 border-t border-dark-500">
                  <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Agent Health Monitor</h3>
                  <AgentHealthSparklines agents={agents} tasks={tasks} />
                </div>
              </div>
            )}
          </ViewTransition>
        </div>

        {/* Mobile Feed Overlay */}
        {mobileFeed && (
          <div className="md:hidden mobile-sidebar-overlay" onClick={() => setMobileFeed(false)} />
        )}

        {/* Live Feed — hidden on mobile unless toggled */}
        <div className={`${mobileFeed ? 'mobile-feed block' : 'hidden'} md:block`}>
          <LiveFeed
            activity={activity}
            filter={feedFilter}
            onFilterChange={setFeedFilter}
            collapsed={feedCollapsed}
            onToggleCollapse={() => setFeedCollapsed(c => !c)}
          />
        </div>
      </div>

      {/* Footer */}
      <footer className="footer-bar border-t border-dark-500 px-3 sm:px-6 py-2 pb-14 flex items-center justify-between shrink-0">
        <div className="text-[10px] sm:text-[11px] text-gray-600 truncate flex items-center gap-2">
          <span className="hidden sm:inline">Roundtable {VERSION} — {COUNCIL_NAME}</span>
          <span className="sm:hidden">RT {VERSION}</span>
          {/* Activity sparkline moved to fixed bottom strip */}
        </div>
        <div className="flex items-center gap-2 sm:gap-4 text-[10px] sm:text-[11px] text-gray-600">
          {/* Sync indicator */}
          <div className="flex items-center gap-1.5" title={lastSync ? `Last synced: ${lastSync.toLocaleTimeString()}` : 'Not synced yet'}>
            {isSyncing ? (
              <svg className="w-3 h-3 animate-spin text-accent-orange" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4 31.4" strokeLinecap="round" />
              </svg>
            ) : (
              <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${lastSync && (Date.now() - lastSync.getTime()) < 30000 ? 'bg-accent-green pulse-dot' : 'bg-gray-600'}`} />
            )}
            <span className="hidden lg:inline">
              {isSyncing ? (
                <span className="text-accent-orange">Syncing…</span>
              ) : lastSync ? (
                `Synced ${Math.floor((Date.now() - lastSync.getTime()) / 1000)}s ago`
              ) : (
                'Not synced'
              )}
            </span>
            <button
              onClick={() => !isSyncing && fetchData()}
              disabled={isSyncing}
              className="ml-0.5 p-0.5 rounded hover:bg-dark-600 transition-colors disabled:opacity-30"
              title="Refresh now (⌘R)"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={isSyncing ? 'animate-spin' : ''}>
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
              </svg>
            </button>
          </div>
          <a
            href={GOOGLE_DRIVE_FOLDER}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex hover:text-gray-400 transition-colors items-center gap-1"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-6l-2 3H9l-2-3H1" />
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
            </svg>
            Drive
          </a>
          <a
            href={AIRTABLE_BASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden md:flex hover:text-gray-400 transition-colors items-center gap-1"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Airtable
          </a>
          <span className="hidden sm:inline opacity-40">|</span>
          <span className="hidden sm:inline">{agents.length} agents</span>
          <ExportButton tasks={tasks} activity={activity} />
          <span className="opacity-40">|</span>
          <button onClick={() => setShowChat(!showChat)}
            className="hover:text-accent-orange transition-colors flex items-center gap-1">
            💬 <span className="hidden sm:inline">Chat</span>
          </button>
        </div>
      </footer>

      {/* Activity Strip — fixed bottom bar with sparkline + stats */}
      <FooterSparkline activity={activity} tasks={tasks} />

      {/* Bulk Actions Toolbar — floats at bottom when tasks are selected */}
      <BulkActions
        selectedIds={selectedIds}
        tasks={tasks}
        agents={agents}
        onApproveAll={async (ids) => {
          for (const id of ids) {
            const task = tasks.find(t => t.id === id)
            if (task) await handleApproveTask(task)
          }
          deselectAll()
        }}
        onStatusChange={async (ids, status) => {
          for (const id of ids) {
            const task = tasks.find(t => t.id === id)
            if (task) await handleUpdateTaskStatus(task, status)
          }
          deselectAll()
        }}
        onAssign={async (ids, agentName) => {
          let ok = 0
          for (const id of ids) {
            try {
              await fetch('/api/tasks/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recordId: id, fields: { Agent: agentName } }),
              })
              setTasks(prev => prev.map(t => t.id === id ? { ...t, agent: agentName } : t))
              ok++
            } catch (err) { console.error('Bulk assign error:', err) }
          }
          showToast(`Assigned ${ok} task${ok !== 1 ? 's' : ''} to ${agentName}`, 'success')
          deselectAll()
          setTimeout(fetchData, 1000)
        }}
        onPriorityChange={async (ids, priority) => {
          const label = priority.charAt(0).toUpperCase() + priority.slice(1)
          let ok = 0
          for (const id of ids) {
            try {
              await fetch('/api/tasks/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recordId: id, fields: { Priority: label } }),
              })
              setTasks(prev => prev.map(t => t.id === id ? { ...t, priority: label } : t))
              ok++
            } catch (err) { console.error('Bulk priority error:', err) }
          }
          showToast(`Updated priority to ${label} for ${ok} task${ok !== 1 ? 's' : ''}`, 'info')
          deselectAll()
          setTimeout(fetchData, 1000)
        }}
        onExportToDrive={async (ids) => {
          showToast(`Exporting ${ids.length} task${ids.length !== 1 ? 's' : ''} to Drive...`, 'info')
          try {
            const res = await fetch('/api/export/drive', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ taskIds: ids }),
            })
            const data = await res.json()
            if (!res.ok) throw new Error(data.error || 'Export failed')
            showToast(`Exported ${data.count} task${data.count !== 1 ? 's' : ''} to Google Drive`, 'success')
            deselectAll()
            setTimeout(fetchData, 1000)
          } catch (err) {
            showToast(`Drive export failed: ${err.message}`, 'error')
          }
        }}
        onDeselectAll={deselectAll}
      />

      {/* Mobile Bottom Navigation */}
      <MobileBottomNav
        currentView={currentView}
        onViewChange={setCurrentView}
        inReview={stats.inReview}
        inboxCount={tasks.filter(t => t.status !== 'Done' && t.status !== 'Archived').length}
        boardCount={stats.tasksInQueue}
        agentsActive={stats.agentsActive}
      />

      {/* Scroll to Top */}
      <ScrollToTop />

      {/* Quick Create FAB */}
      <QuickCreateFAB onCreateTask={handleCreateTask} agents={agents} />

      {/* Keyboard Shortcut Cheatsheet */}
      <KeyboardShortcutModal isOpen={showShortcuts} onClose={() => setShowShortcuts(false)} />
      <BatchCreateModal isOpen={showBatchCreate} onClose={() => setShowBatchCreate(false)} onCreateTask={handleCreateTask} />
      {showMetrics && <AgentMetrics tasks={tasks} agents={agents} activity={activity} onClose={() => setShowMetrics(false)} />}
      {showComparison && <AgentComparison agents={agents} tasks={tasks} onClose={() => setShowComparison(false)} />}
      {showCalendarHeatmap && <ContentCalendarHeatmap activity={activity} tasks={tasks} onClose={() => setShowCalendarHeatmap(false)} />}
      {showTimeline && <AgentTimeline activity={activity} agents={agents} onClose={() => setShowTimeline(false)} />}

      {/* Focus Mode Overlay */}
      <FocusMode isActive={focusModeActive} onToggle={() => setFocusModeActive(s => !s)} />

      {/* Right-click Context Menu */}
      {contextMenu && (
        <TaskContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          task={contextMenu.task}
          agents={agents}
          onClose={() => setContextMenu(null)}
          onUpdateStatus={(taskId, status) => {
            handleUpdateTaskStatus(taskId, status)
            setContextMenu(null)
          }}
          onAssignAgent={(taskId, agentName) => {
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, agent: agentName, status: agentName ? 'Assigned' : t.status } : t))
            showToast(`Assigned to ${agentName}`, 'info')
            setContextMenu(null)
          }}
          onChangePriority={(taskId, priority) => {
            setTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority } : t))
            showToast(`Priority → ${priority}`, 'info')
            setContextMenu(null)
          }}
        />
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          agent={agents.find(a => a.name === selectedTask.agent)}
          onClose={() => setSelectedTask(null)}
          onApprove={handleApproveTask}
          onUpdateStatus={handleUpdateTaskStatus}
          allTasks={tasks}
          taskPosition={navigableTasks.length > 0 ? { current: navigableTasks.findIndex(t => t.id === selectedTask.id) + 1, total: navigableTasks.length } : null}
          onNextTask={(() => {
            const idx = navigableTasks.findIndex(t => t.id === selectedTask.id)
            if (idx < navigableTasks.length - 1) return () => setSelectedTask(navigableTasks[idx + 1])
            return null
          })()}
          onPrevTask={(() => {
            const idx = navigableTasks.findIndex(t => t.id === selectedTask.id)
            if (idx > 0) return () => setSelectedTask(navigableTasks[idx - 1])
            return null
          })()}
          onAddDependency={(depId) => handleAddDependency(selectedTask.id, depId)}
          onRemoveDependency={(depId) => handleRemoveDependency(selectedTask.id, depId)}
          onAssignAgent={async (agent) => {
            try {
              const res = await fetch('/api/tasks/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recordId: selectedTask.id, fields: { Agent: agent.name } }),
              })
              if (!res.ok) throw new Error('Agent assignment failed')
              // Update local state immediately
              setTasks(prev => prev.map(t => t.id === selectedTask.id ? { ...t, agent: agent.name, status: t.status === 'Inbox' ? 'Assigned' : t.status } : t))
              setSelectedTask(prev => prev ? { ...prev, agent: agent.name, status: prev.status === 'Inbox' ? 'Assigned' : prev.status } : prev)
              showToast(`Assigned to ${agent.name}`, 'success')
              setTimeout(fetchData, 1000)
            } catch (err) {
              console.error('Agent assignment error:', err)
              showToast('Failed to assign agent', 'error')
            }
          }}
          onRefreshData={() => setTimeout(fetchData, 1000)}
          showToast={showToast}
          onEditTask={async (task, updates) => {
            try {
              const res = await fetch('/api/tasks/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ recordId: task.id, fields: updates }),
              })
              if (!res.ok) throw new Error('Update failed')
              setTasks(prev => prev.map(t => t.id === task.id ? { ...t, ...Object.fromEntries(Object.entries(updates).map(([k, v]) => [k === 'Name' ? 'name' : k === 'Description' ? 'description' : k === 'Content Type' ? 'contentType' : k === 'Priority' ? 'priority' : k, v])) } : t))
              showToast('Task updated', 'success')
              setTimeout(fetchData, 1000)
              return true
            } catch {
              showToast('Failed to update task', 'error')
              return false
            }
          }}
        />
      )}

      {/* Agent Config Panel */}
      {configAgent && (
        <AgentConfigPanel
          agent={configAgent}
          onClose={() => setConfigAgent(null)}
          onAgentUpdate={handleAgentUpdate}
        />
      )}

      {/* Settings Panel */}
      {showSettings && (
        <SettingsPanel
          theme={theme}
          onToggleTheme={toggleTheme}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Agent Chat */}
      <AgentChat agents={agents} isOpen={showChat} onClose={() => setShowChat(false)} />

      {/* Command Bar */}
      <CommandBar
        isOpen={showCommandBar}
        onClose={() => setShowCommandBar(false)}
        onCommand={handleCommand}
        tasks={tasks}
      />
    </div>
  )
}
