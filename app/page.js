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
import AgentWorkflowLive from '../components/AgentWorkflowLive'
import ViewTransition from '../components/ViewTransition'
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
import { useKeyboardNavigation } from '../lib/useKeyboardNavigation'
import { useTaskSearch } from '../lib/useTaskSearch'
import { useCommandHandler } from '../lib/useCommandHandler'
import { useDataFetching } from '../lib/useDataFetching'
import { useTheme } from '../lib/useTheme'
import { useTaskActions } from '../lib/useTaskActions'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { playDropSound } from '../lib/sounds'
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
  // lastSync and isSyncing state moved to useDataFetching hook
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
  const [systemPaused, setSystemPaused] = useState(false)
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

  // Theme (extracted to hook)
  const { theme, toggleTheme } = useTheme()

  // Data fetching, polling, and auto-run (extracted to hook)
  const { fetchData, getSettings, lastSync, isSyncing } = useDataFetching({
    setAgents,
    setTasks,
    setActivity,
    setDataSource,
    autoRefreshInterval,
    settingsRev,
  })

  // System pause status check
  useEffect(() => {
    fetch('/api/system').then(r => r.json()).then(d => {
      if (d.paused !== undefined) setSystemPaused(d.paused)
    }).catch(() => {})
  }, [])

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Handle agent config update (optimistic UI)
  const handleAgentUpdate = useCallback((updatedAgent) => {
    setAgents(prev => prev.map(a => a.id === updatedAgent.id ? { ...a, ...updatedAgent } : a))
  }, [])

  // Task CRUD operations (extracted to hook)
  const {
    handleApproveTask,
    handleUpdateTaskStatus,
    handleRetryTask,
    handleCreateTask,
    handleAddDependency,
    handleRemoveDependency,
  } = useTaskActions({ setTasks, setSelectedTask, fetchData, showToast })

  // Run Agents — trigger the cron endpoint manually
  const handleRunAgents = useCallback(async () => {
    setRunningAgents(true)
    try {
      await fetch('/api/cron/run-agents')
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
      await fetch('/api/campaigns/plan', { method: 'POST' })
      showToast('Campaign plan created', 'success')
      setTimeout(fetchData, 2000)
    } catch (err) {
      console.error('Failed to plan campaign:', err)
      showToast('Failed to plan campaign', 'error')
    } finally {
      setTimeout(() => setPlanningCampaign(false), 3000)
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

  // Keyboard navigation — global hotkeys + task j/k/h/l/Enter/Escape (extracted to hook)
  const { navigableTasks } = useKeyboardNavigation({
    tasks,
    focusedTaskId,
    selectedTask,
    showCommandBar,
    showSettings,
    showChat,
    currentView,
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
    toggleSelect,
    handleApproveTask,
    handleUpdateTaskStatus,
    showToast,
  })

  // Command Bar handler (extracted to hook)
  const handleCommand = useCommandHandler({
    setCurrentView,
    setShowCommandBar,
    setShowChat,
    setShowSettings,
    setSelectedTask,
    handleRunAgents,
    handleCreateTask,
    fetchData,
    tasks,
  })

  // Search filter + quick filters (extracted to hook)
  const filteredTasks = useTaskSearch(tasks, searchQuery, quickFilters)

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
      {/* Skip navigation link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-dark-800 focus:text-white focus:px-4 focus:py-2 focus:rounded focus:ring-2 focus:ring-accent-orange"
      >
        Skip to main content
      </a>
      <FaviconBadge tasks={tasks} />
      {systemPaused && (
        <div className="bg-red-600 text-white text-center py-2 px-4 text-sm font-medium flex items-center justify-center gap-2">
          <span className="inline-block w-2 h-2 bg-white rounded-full animate-pulse" />
          SYSTEM PAUSED — All agent processing is halted. Set SYSTEM_PAUSED=false in Vercel env vars to resume.
        </div>
      )}
      {/* Top Header Bar */}
      <StatsHeader
        data={{ stats, sparklines, currentTime, dataSource, lastSync }}
        sync={{ isSyncing, onRefresh: fetchData }}
        actions={{
          onRunAgents: handleRunAgents, runningAgents,
          onPlanCampaign: handlePlanCampaign, planningCampaign,
        }}
        panels={{
          onOpenSettings: () => setShowSettings(true),
          onOpenMetrics: () => setShowMetrics(true),
          onOpenComparison: () => setShowComparison(true),
          onOpenCalendarHeatmap: () => setShowCalendarHeatmap(true),
          onOpenTimeline: () => setShowTimeline(true),
        }}
        ui={{
          theme, onToggleTheme: toggleTheme,
          focusModeActive, onToggleFocusMode: () => setFocusModeActive(s => !s),
          onToggleSidebar: () => setMobileSidebar(s => !s),
          onToggleFeed: () => setMobileFeed(f => !f),
        }}
        slots={{
          notification: <NotificationCenter tasks={tasks} activity={activity} />,
          pipeline: <PipelineStatusBadge />,
          productivity: <ProductivityScore tasks={tasks} activity={activity} />,
        }}
      />

      {/* Main Content */}
      <main id="main-content" className="flex flex-1 overflow-hidden">
        {/* Mobile Sidebar Overlay */}
        {mobileSidebar && (
          <div
            className="md:hidden mobile-sidebar-overlay"
            role="presentation"
            aria-label="Close sidebar"
            onClick={() => setMobileSidebar(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') setMobileSidebar(false) }}
          />
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
          {/* Breadcrumb — only show when there's deeper navigation context */}
          {(selectedAgent || selectedTask) && (
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
          )}

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

          {/* Unified Search + Filters Toolbar */}
          {(currentView === 'kanban' || currentView === 'list') && (
            <QuickFiltersBar
              tasks={tasks}
              agents={agents}
              filters={quickFilters}
              onFiltersChange={setQuickFilters}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              resultCount={filteredTasks.length}
              totalCount={tasks.length}
            />
          )}

          {/* View Content */}
          <ErrorBoundary name="Dashboard View">
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
            {currentView === 'workflow' && (
              <AgentWorkflowLive
                agents={agents}
                tasks={tasks}
                activity={activity}
                onAgentClick={(agent) => setConfigAgent(agent)}
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
              <SmartInbox tasks={tasks} agents={agents} onTaskClick={setSelectedTask} onRefresh={fetchData} />
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
          </ErrorBoundary>
        </div>

        {/* Mobile Feed Overlay */}
        {mobileFeed && (
          <div
            className="md:hidden mobile-sidebar-overlay"
            role="presentation"
            aria-label="Close feed"
            onClick={() => setMobileFeed(false)}
            onKeyDown={(e) => { if (e.key === 'Escape') setMobileFeed(false) }}
          />
        )}

        {/* Live Feed — hidden on mobile unless toggled */}
        <div className={`${mobileFeed ? 'mobile-feed block' : 'hidden'} md:block`}>
          <ErrorBoundary name="Live Feed">
            <LiveFeed
              activity={activity}
              filter={feedFilter}
              onFilterChange={setFeedFilter}
              collapsed={feedCollapsed}
              onToggleCollapse={() => setFeedCollapsed(c => !c)}
            />
          </ErrorBoundary>
        </div>
      </main>

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
              aria-label="Refresh data"
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
          tasks={tasks}
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
      <AgentChat agents={agents} isOpen={showChat} onClose={() => setShowChat(false)} onOpen={() => setShowChat(true)} />

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
