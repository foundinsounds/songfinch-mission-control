'use client'

import { useState, useEffect, useCallback } from 'react'
import { AGENTS as FALLBACK_AGENTS } from '../lib/agents'
import { MOCK_TASKS, MOCK_ACTIVITY } from '../lib/mockData'
import { GOOGLE_DRIVE_FOLDER, AIRTABLE_BASE_URL, VERSION } from '../lib/constants'
import AgentSidebar from '../components/AgentSidebar'
import AgentConfigPanel from '../components/AgentConfigPanel'
import KanbanBoard from '../components/KanbanBoard'
import LiveFeed from '../components/LiveFeed'
import StatsHeader from '../components/StatsHeader'
import TaskModal from '../components/TaskModal'

export default function MissionControl() {
  const [agents, setAgents] = useState(FALLBACK_AGENTS)
  const [tasks, setTasks] = useState(MOCK_TASKS)
  const [activity, setActivity] = useState(MOCK_ACTIVITY)
  const [selectedAgent, setSelectedAgent] = useState(null)
  const [configAgent, setConfigAgent] = useState(null) // Agent being configured
  const [selectedTask, setSelectedTask] = useState(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [feedFilter, setFeedFilter] = useState('All')
  const [dataSource, setDataSource] = useState('loading') // 'airtable' | 'mock' | 'loading'
  const [lastSync, setLastSync] = useState(null)

  // Fetch live data from Airtable
  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/data')
      if (!res.ok) throw new Error('API error')
      const data = await res.json()

      if (data.agents && data.agents.length > 0) {
        setAgents(data.agents)
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

  // Initial fetch + polling every 15 seconds
  useEffect(() => {
    fetchData()
    const poller = setInterval(fetchData, 15000)
    return () => clearInterval(poller)
  }, [fetchData])

  // Clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  // Handle agent config update (optimistic UI)
  const handleAgentUpdate = useCallback((updatedAgent) => {
    setAgents(prev => prev.map(a => a.id === updatedAgent.id ? { ...a, ...updatedAgent } : a))
  }, [])

  const filteredTasks = selectedAgent
    ? tasks.filter(t => t.agent === selectedAgent)
    : tasks

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

        {/* Kanban Board */}
        <div className="flex-1 overflow-x-auto">
          <KanbanBoard
            tasks={filteredTasks}
            onTaskClick={setSelectedTask}
          />
        </div>

        {/* Live Feed */}
        <LiveFeed
          activity={activity}
          filter={feedFilter}
          onFilterChange={setFeedFilter}
        />
      </div>

      {/* Footer */}
      <footer className="bg-dark-800 border-t border-dark-500 px-6 py-2 flex items-center justify-between shrink-0">
        <div className="text-[11px] text-gray-600">
          Songfinch Mission Control {VERSION}
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
          <span>|</span>
          <span>{agents.length} agents deployed</span>
        </div>
      </footer>

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          agent={agents.find(a => a.name === selectedTask.agent)}
          onClose={() => setSelectedTask(null)}
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
    </div>
  )
}
