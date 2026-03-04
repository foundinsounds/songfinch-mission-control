'use client'

import { useState, useEffect, useCallback } from 'react'
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

export default function Roundtable() {
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
  const [runningAgents, setRunningAgents] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCommandBar, setShowCommandBar] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [currentView, setCurrentView] = useState('kanban')

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
      if (data.tasks && data.tasks.length > 0) {
        setTasks(data.tasks)
      }
      if (data.activity && data.activity.length > 0) {
        setActivity(data.activity)
      }

      setDataSource('airtable')
      setLastSync(new Date())
    } catch (err) {
      console.warn('Airtable fetch failed, using mock data:', err.message)
      setDataSource('mock')
    }
  }, [])

  // Read settings from localStorage
  const getSettings = useCallback(() => {
    if (typeof window === 'undefined') return { autoRunAgents: false, runInterval: 60, pollInterval: 15 }
    try {
      const saved = localStorage.getItem('roundtable-settings')
      if (saved) return { autoRunAgents: false, runInterval: 60, pollInterval: 15, ...JSON.parse(saved) }
    } catch {}
    return { autoRunAgents: false, runInterval: 60, pollInterval: 15 }
  }, [])

  // Initial fetch + polling (uses configured pollInterval)
  useEffect(() => {
    fetchData()
    const pollSeconds = getSettings().pollInterval || 15
    const poller = setInterval(fetchData, pollSeconds * 1000)
    return () => clearInterval(poller)
  }, [fetchData, getSettings])

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
      setTimeout(fetchData, 1000)
      return true
    } catch (err) {
      console.error('Failed to approve task:', err)
      return false
    }
  }, [fetchData])

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
      setTimeout(fetchData, 1000)
      return true
    } catch (err) {
      console.error('Failed to update task:', err)
      return false
    }
  }, [fetchData])

  // Run Agents — trigger the cron endpoint manually
  const handleRunAgents = useCallback(async () => {
    setRunningAgents(true)
    try {
      const res = await fetch('/api/cron/run-agents')
      const data = await res.json()
      console.log('[Roundtable] Agent run result:', data)
      // Refresh data after agents run
      setTimeout(fetchData, 2000)
    } catch (err) {
      console.error('Failed to run agents:', err)
    } finally {
      setTimeout(() => setRunningAgents(false), 3000)
    }
  }, [fetchData])

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
        // Future: open create task modal
        console.log('[Command] Create task:', entity)
        break
      default:
        console.log('[Command]', command, entity)
    }
  }, [handleRunAgents, fetchData, tasks])

  // Board/List views always show all tasks — sidebar selection highlights but doesn't filter
  const filteredTasks = tasks

  const stats = {
    agentsActive: agents.filter(a => a.status === 'Working' || a.status === 'Active').length,
    totalAgents: agents.length,
    tasksInQueue: tasks.filter(t => t.status !== 'Done').length,
    tasksTotal: tasks.length,
    inReview: tasks.filter(t => t.status === 'Review').length,
    completed: tasks.filter(t => t.status === 'Done').length,
    contentPieces: tasks.filter(t => t.status === 'Done').length,
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top Header Bar */}
      <StatsHeader
        stats={stats}
        currentTime={currentTime}
        dataSource={dataSource}
        lastSync={lastSync}
        theme={theme}
        onToggleTheme={toggleTheme}
        onRunAgents={handleRunAgents}
        runningAgents={runningAgents}
        onOpenSettings={() => setShowSettings(true)}
      />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Agent Sidebar */}
        <AgentSidebar
          agents={agents}
          selectedAgent={selectedAgent}
          onSelectAgent={(name) => setSelectedAgent(selectedAgent === name ? null : name)}
          onConfigAgent={(agent) => setConfigAgent(agent)}
          tasks={tasks}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* View Switcher */}
          <div className="px-4 py-2 border-b border-dark-500 flex items-center gap-1 shrink-0 bg-dark-800/30 overflow-x-auto">
            {[
              { key: 'kanban', label: 'Board', icon: '\u25A6' },
              { key: 'list', label: 'List', icon: '\u2630' },
              { key: 'inbox', label: 'Inbox', icon: '\u{1F4E5}' },
              { key: 'agents', label: 'Agents', icon: '\u{1F916}' },
              { key: 'calendar', label: 'Calendar', icon: '\u{1F4C5}' },
              { key: 'campaigns', label: 'Campaigns', icon: '\u{1F3AF}' },
              { key: 'approvals', label: 'Approvals', icon: '\u2705' },
              { key: 'content', label: 'Content', icon: '\u{1F4C4}' },
              { key: 'templates', label: 'Templates', icon: '\u{1F4CB}' },
              { key: 'abtests', label: 'A/B Tests', icon: '\u{1F9EA}' },
              { key: 'scoring', label: 'Scoring', icon: '\u{1F3C6}' },
              { key: 'skills', label: 'Skills', icon: '\u26A1' },
              { key: 'batch', label: 'Batch', icon: '\u{1F4E6}' },
              { key: 'intelligence', label: 'Intel', icon: '\u{1F9E0}' },
              { key: 'webhooks', label: 'Webhooks', icon: '\u{1F517}' },
              { key: 'analytics', label: 'Analytics', icon: '\u{1F4CA}' },
            ].map((view) => (
              <button
                key={view.key}
                onClick={() => setCurrentView(view.key)}
                className={`text-[11px] px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                  currentView === view.key
                    ? 'bg-accent-orange/15 text-accent-orange border border-accent-orange/25 font-semibold'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-dark-600'
                }`}
              >
                <span>{view.icon}</span>
                {view.label}
              </button>
            ))}
          </div>

          {/* View Content */}
          <div className="flex-1 overflow-auto">
            {currentView === 'kanban' && (
              <KanbanBoard
                tasks={filteredTasks}
                agents={agents}
                selectedAgent={selectedAgent}
                onTaskClick={setSelectedTask}
                onQuickApprove={handleApproveTask}
                onRequestChanges={(task) => setSelectedTask(task)}
              />
            )}
            {currentView === 'list' && (
              <ListView
                tasks={filteredTasks}
                agents={agents}
                selectedAgent={selectedAgent}
                onTaskClick={setSelectedTask}
                onQuickApprove={handleApproveTask}
              />
            )}
            {currentView === 'agents' && (
              <AgentActivityView
                agents={agents}
                tasks={tasks}
                activity={activity}
                onAgentClick={(agent) => setConfigAgent(agent)}
              />
            )}
            {currentView === 'content' && (
              <ContentView />
            )}
            {currentView === 'inbox' && (
              <SmartInbox tasks={tasks} agents={agents} onTaskClick={setSelectedTask} />
            )}
            {currentView === 'calendar' && (
              <ContentCalendar tasks={tasks} agents={agents} onTaskClick={setSelectedTask} />
            )}
            {currentView === 'campaigns' && (
              <CampaignPlanner tasks={tasks} agents={agents} />
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
            {currentView === 'webhooks' && (
              <WebhookManager />
            )}
            {currentView === 'analytics' && (
              <AnalyticsDashboard
                agents={agents}
                tasks={tasks}
                activity={activity}
              />
            )}
          </div>
        </div>

        {/* Live Feed */}
        <LiveFeed
          activity={activity}
          filter={feedFilter}
          onFilterChange={setFeedFilter}
        />
      </div>

      {/* Footer */}
      <footer className="footer-bar border-t border-dark-500 px-6 py-2 flex items-center justify-between shrink-0">
        <div className="text-[11px] text-gray-600">
          Roundtable {VERSION} — {COUNCIL_NAME}
        </div>
        <div className="flex items-center gap-4 text-[11px] text-gray-600">
          <a
            href={GOOGLE_DRIVE_FOLDER}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors flex items-center gap-1"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 12h-6l-2 3H9l-2-3H1" />
              <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
            </svg>
            Google Drive
          </a>
          <a
            href={AIRTABLE_BASE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors flex items-center gap-1"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="14" y="14" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
            </svg>
            Airtable
          </a>
          <span className="opacity-40">|</span>
          <span>{agents.length} agents deployed</span>
          <span className="opacity-40">|</span>
          <button onClick={() => setShowChat(!showChat)}
            className="hover:text-accent-orange transition-colors flex items-center gap-1">
            {'\u{1F4AC}'} Chat
          </button>
        </div>
      </footer>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          agent={agents.find(a => a.name === selectedTask.agent)}
          onClose={() => setSelectedTask(null)}
          onApprove={handleApproveTask}
          onUpdateStatus={handleUpdateTaskStatus}
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
